import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

import { Ollama } from 'ollama/browser';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import type { Message, ChatSession } from './types';
import { getInstructions, cleanupStaleInstructions } from './lib/modelInstructions';
import './App.css';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
const LS_KEY = 'brainbox:sessions';

// ─── Helpers ───────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function autoTitle(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 5).join(' ');
  return words.length > 30 ? words.slice(0, 30) + '…' : words;
}

function blankSession(): ChatSession {
  return { id: genId(), title: 'New Chat', messages: [], createdAt: Date.now() };
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [blankSession()];
    const parsed = JSON.parse(raw) as ChatSession[];
    // Re-hydrate Date objects
    return parsed.map(s => ({
      ...s,
      messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [blankSession()];
  }
}

// ─── App ───────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Multi-session state
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId] = useState<string>(() => loadSessions()[0]?.id ?? genId());

  // Web bridge toggle (global, not per-session)
  const [webEnabled, setWebEnabled] = useState(false);

  // Internal floating browser state
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [isBrowserMinimized, setIsBrowserMinimized] = useState(false);

  // Model state
  // modelStatus drives the sidebar placeholder text only — never blocks the UI.
  // 'checking' = initial fetch / silent retry in progress
  // 'found'    = at least one model returned
  // 'empty'    = all retries exhausted, still nothing
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelStatus, setModelStatus] = useState<'checking' | 'found' | 'empty'>('checking');

  // ── Streaming isolation ──────────────────────────────────────────────────
  // streamingContent lives ONLY in local state so each token chunk triggers
  // the smallest possible re-render (just ChatArea), never the sessions array.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  const isLoading = useRef(false);
  const abortStreamRef = useRef<{ abort: () => void } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, forceRender] = useState(0);

  // Persist sessions whenever they change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Active session derived value
  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0];

  // ─── Model helpers ───────────────────────────────────────────────────────
  // Single plain fetch — no retries or delays (those live in the useEffect).
  const refreshModels = useCallback(async () => {
    try {
      const res = await ollama.list();
      const names = res.models.map((m: any) => m.name as string);
      setInstalledModels(names);
      setSelectedModel(prev => (prev && names.includes(prev) ? prev : names[0] ?? ''));
      cleanupStaleInstructions(names);
      return names;
    } catch {
      return [] as string[];
    }
  }, []);

  // Silent background retry: fetch immediately on mount; if empty, silently retry
  // up to MAX_RETRIES more times (RETRY_DELAY_MS apart). Never blocks the UI.
  useEffect(() => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const attempt = async (triesLeft: number) => {
      if (cancelled) return;
      const names = await refreshModels();
      if (cancelled) return;

      if (names.length > 0) {
        setModelStatus('found');
        return;
      }
      // Still empty
      if (triesLeft <= 0) {
        setModelStatus('empty');
        return;
      }
      // Schedule next silent retry
      const t = setTimeout(() => attempt(triesLeft - 1), RETRY_DELAY_MS);
      timers.push(t);
    };

    attempt(MAX_RETRIES);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [refreshModels]);

  // ─── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.style.colorScheme = 'dark';
    } else {
      html.classList.remove('dark');
      html.style.colorScheme = 'light';
    }
  }, [theme]);

  // ─── Session management ──────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    const s = blankSession();
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
  }, []);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleRenameSession = useCallback((id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const fresh = blankSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      // Switch active if we deleted the current one
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }, [activeId]);


  const handleClearChat = useCallback(() => {
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [], title: 'New Chat' } : s));
  }, [activeId]);

  // ─── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string, snippets: any[]) => {
    const userContent = [
      text,
      ...snippets.map((s: any) => `\`\`\`\n${s.content}\n\`\`\``),
    ].filter(Boolean).join('\n\n');

    if (!userContent.trim()) return;

    const model = selectedModel;
    if (!model) {
      setSessions(prev => prev.map(s =>
        s.id === activeId
          ? { ...s, messages: [...s.messages, { id: genId(), role: 'assistant', content: '⚠️ No model selected. Please download a model using the sidebar.', timestamp: new Date() }] }
          : s
      ));
      return;
    }

    const aiId = genId();
    const userMsg: Message = { id: genId(), role: 'user', content: userContent, timestamp: new Date() };

    // Commit the user message + auto-title in ONE setSessions call.
    setSessions(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const isFirst = s.messages.length === 0;
      return {
        ...s,
        title: isFirst ? autoTitle(userContent) : s.title,
        messages: [...s.messages, userMsg],
      };
    }));

    // ── Web Search RAG ──────────────────────────────────────────────────────
    let finalPrompt = userContent;

    if (webEnabled) {
      const searchMsgId = genId();
      const searchStatusMsg: Message = {
        id: searchMsgId,
        role: 'system',
        content: `Searching the web for: "${text.slice(0, 80)}"…`,
        timestamp: new Date(),
        isEphemeral: true,
      };

      // Show the searching indicator
      setSessions(prev => prev.map(s =>
        s.id === activeId ? { ...s, messages: [...s.messages, searchStatusMsg] } : s
      ));

      try {
        const webSnippets = await invoke<string[]>('web_search', { query: text });

        if (webSnippets.length > 0) {
          const snippetsBlock = webSnippets
            .map((snippet, i) => `[${i + 1}] ${snippet}`)
            .join('\n');
          finalPrompt =
            `Use the following internet search results to answer the user's question.\n\n` +
            `Search Results:\n${snippetsBlock}\n\n` +
            `User Question: ${userContent}`;
        }
      } catch (err) {
        console.warn('[BrainBox] Web search failed, falling back to plain Ollama:', err);
      } finally {
        // Remove the ephemeral search status message
        setSessions(prev => prev.map(s =>
          s.id === activeId
            ? { ...s, messages: s.messages.filter(m => m.id !== searchMsgId) }
            : s
        ));
      }
    }
    // ── End Web Search RAG ──────────────────────────────────────────────────

    // Arm the streaming slot
    setStreamingId(aiId);
    setStreamingContent('');
    setIsGenerating(true);
    isLoading.current = true;
    forceRender(n => n + 1);

    setStreamingContent('');
    setIsGenerating(true);
    isLoading.current = true;
    forceRender(n => n + 1);

    let finalContent = '';
    try {
      const contextMessages = (sessions.find(s => s.id === activeId)?.messages ?? [])
        .slice(-10)
        .filter(m => !m.isEphemeral)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const systemInstructions = getInstructions(model).map(inst => ({
        role: 'system' as const,
        content: inst,
      }));

      const response = await ollama.chat({
        model,
        messages: [...systemInstructions, ...contextMessages, { role: 'user', content: finalPrompt }],
        stream: true,
        options: { num_ctx: 2048, num_thread: 8 },
      }) as AsyncIterable<any> & { abort: () => void };

      abortStreamRef.current = response;

      for await (const part of response) {
        if (!abortStreamRef.current) break; // stop was called
        finalContent += part.message.content;
        setStreamingContent(finalContent);
      }
    } catch (err: any) {
      const wasStopped = abortStreamRef.current === null;
      if (!wasStopped) {
        console.error('Ollama error:', err);
        finalContent = finalContent || "Error: Couldn't reach the engine. Is Ollama running? ⚠️";
        setStreamingContent(finalContent);
      }
    } finally {
      abortStreamRef.current = null;
      setIsGenerating(false);
      const completedMsg: Message = {
        id: aiId,
        role: 'assistant',
        content: finalContent || '…',
        timestamp: new Date(),
      };
      setSessions(prev => prev.map(s =>
        s.id === activeId
          ? { ...s, messages: [...s.messages, completedMsg] }
          : s
      ));
      setStreamingId(null);
      setStreamingContent('');
      isLoading.current = false;
      forceRender(n => n + 1);
    }
  }, [sessions, activeId, selectedModel, webEnabled]);

  const handleStopGeneration = useCallback(() => {
    abortStreamRef.current?.abort();
    abortStreamRef.current = null;
  }, []);

  const isDark = theme === 'dark';

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: isDark ? '#0a0a0b' : '#fafafa' }}>

      <AnimatePresence mode="wait">
        {screen === 'landing' ? (
          <LandingPage key="landing" onEnter={() => setScreen('chat')} />
        ) : (
          <div key="chat" className="flex h-full w-full" style={{ animation: 'fadeIn 0.5s ease' }}>
            {/* Sidebar — fixed width */}
            <div className="flex-shrink-0 h-full" style={{ width: '220px' }}>
              <Sidebar
                theme={theme}
                onToggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
                onClearChat={handleClearChat}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                installedModels={installedModels}
                modelStatus={modelStatus}
                onRefreshModels={refreshModels}
                sessions={sessions}
                activeSessionId={activeId}
                onNewChat={handleNewChat}
                onSwitchSession={handleSwitchSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
              />
            </div>

            {/* Chat area */}
            <div className="flex-1 h-full min-w-0">
              <ChatArea
                messages={activeSession?.messages ?? []}
                onSend={handleSend}
                theme={theme}
                isLoading={isLoading.current}
                isGenerating={isGenerating}
                onStopGeneration={handleStopGeneration}
                webEnabled={webEnabled}
                onToggleWeb={() => setWebEnabled(p => !p)}
                streamingMessage={
                  streamingId
                    ? { id: streamingId, role: 'assistant', content: streamingContent, timestamp: new Date() }
                    : null
                }
                browserUrl={browserUrl}
                isBrowserMinimized={isBrowserMinimized}
                onOpenBrowser={(url) => { setBrowserUrl(url); setIsBrowserMinimized(false); }}
                onBrowserNavigate={(url) => setBrowserUrl(url)}
                onBrowserMinimize={() => setIsBrowserMinimized(true)}
                onBrowserRestore={() => setIsBrowserMinimized(false)}
                onBrowserClose={() => { setBrowserUrl(null); setIsBrowserMinimized(false); }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
}