import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import ModelLibraryModal from './ModelLibraryModal';
import ManageModelsModal from './ManageModelsModal';
import SettingsModal from './SettingsModal';
import type { ChatSession } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
    onClearChat: () => void;
    selectedModel: string;
    onSelectModel: (model: string) => void;
    installedModels: string[];
    onRefreshModels: () => void;
    // Session props
    sessions: ChatSession[];
    activeSessionId: string;
    onNewChat: () => void;
    onSwitchSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
    onDeleteSession: (id: string) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HardwareBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#737373' }}>{label}</span>
                <span className="text-xs font-mono" style={{ color }}>{value}%</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 6px ${color}66` }}
                />
            </div>
        </div>
    );
}

function ModelSelector({ models, selected, onSelect, isDark }: {
    models: string[]; selected: string; onSelect: (m: string) => void; isDark: boolean;
}) {
    const [open, setOpen] = useState(false);
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    if (models.length === 0) {
        return (
            <div className="px-3 py-2.5 rounded-xl text-xs text-center"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}`, color: isDark ? '#525252' : '#9ca3af' }}>
                No models installed
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => models.length > 1 && setOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${open ? 'rgba(59,130,246,0.35)' : border}`, color: isDark ? '#d4d4d4' : '#404040', cursor: models.length <= 1 ? 'default' : 'pointer' }}
            >
                <span className="font-mono truncate">{selected || models[0]}</span>
                {models.length > 1 && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                )}
            </button>
            <AnimatePresence>
                {open && models.length > 1 && (
                    <motion.div
                        className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                        style={{ backgroundColor: isDark ? '#1c1c1e' : '#ffffff', border: `1px solid ${border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                    >
                        {models.map(m => (
                            <button key={m} onClick={() => { onSelect(m); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs font-mono transition-colors cursor-pointer"
                                style={{ color: m === selected ? '#60a5fa' : (isDark ? '#d4d4d4' : '#404040'), backgroundColor: m === selected ? (isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)') : 'transparent' }}
                                onMouseEnter={e => { if (m !== selected) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
                                onMouseLeave={e => { if (m !== selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                {m}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface CtxMenu { x: number; y: number; sessionId: string; }

// ─── Chat History Item ────────────────────────────────────────────────────────

function HistoryItem({
    session, isActive, isDark,
    onSelect, onRename,
}: {
    session: ChatSession; isActive: boolean; isDark: boolean;
    onSelect: () => void; onRename: (title: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(session.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const commitRename = () => {
        const trimmed = draft.trim();
        onRename(trimmed || session.title);
        setEditing(false);
    };

    // Called from outside via event bubble
    const startEditing = () => {
        setDraft(session.title);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };

    return (
        <div
            data-session-id={session.id}
            onClick={editing ? undefined : onSelect}
            className="group relative px-3 py-2 rounded-xl cursor-pointer transition-all duration-150"
            style={{
                backgroundColor: isActive
                    ? (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)')
                    : 'transparent',
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.25)' : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
            {editing ? (
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
                    className="w-full bg-transparent focus:outline-none text-xs"
                    style={{ color: isDark ? '#e5e5e5' : '#1a1a1a' }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                />
            ) : (
                <span
                    className="text-xs block truncate"
                    style={{ color: isActive ? '#60a5fa' : (isDark ? '#a3a3a3' : '#525252') }}
                    onDoubleClick={e => { e.stopPropagation(); startEditing(); }}
                >
                    {session.title}
                </span>
            )}
        </div>
    );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar({
    theme, onToggleTheme, onClearChat,
    selectedModel, onSelectModel, installedModels, onRefreshModels,
    sessions, activeSessionId, onNewChat, onSwitchSession, onRenameSession, onDeleteSession,
}: SidebarProps) {
    const [ram, setRam] = useState(38);
    const [vram, setVram] = useState(51);
    const [showLibrary, setShowLibrary] = useState(false);
    const [showManage, setShowManage] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [engineStatus, setEngineStatus] = useState<'starting' | 'running' | 'error'>('starting');
    const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
    const ctxRef = useRef<HTMLDivElement>(null);

    // Hardware jitter
    useEffect(() => {
        const id = setInterval(() => {
            setRam(p => Math.min(95, Math.max(20, p + (Math.random() - 0.5) * 8)));
            setVram(p => Math.min(95, Math.max(30, p + (Math.random() - 0.5) * 6)));
        }, 2000);
        return () => clearInterval(id);
    }, []);

    // Engine status poll
    useEffect(() => {
        const check = async () => {
            try {
                const running = await invoke<boolean>('ollama_running');
                setEngineStatus(running ? 'running' : 'starting');
            } catch {
                try {
                    const res = await fetch('http://127.0.0.1:11434/', { signal: AbortSignal.timeout(1000) });
                    setEngineStatus(res.ok ? 'running' : 'error');
                } catch {
                    setEngineStatus('error');
                }
            }
        };
        check();
        const id = setInterval(check, 3000);
        return () => clearInterval(id);
    }, []);

    // Dismiss context menu on outside click
    useEffect(() => {
        if (!ctxMenu) return;
        const handler = () => setCtxMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [ctxMenu]);

    // Right-click on history list
    const handleContextMenu = (e: React.MouseEvent) => {
        const item = (e.target as HTMLElement).closest('[data-session-id]') as HTMLElement | null;
        if (!item) return;
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY, sessionId: item.dataset.sessionId! });
    };

    const isDark = theme === 'dark';
    const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    const sectionLabel = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';

    const ctxSession = ctxMenu ? sessions.find(s => s.id === ctxMenu.sessionId) : null;

    const triggerRename = () => {
        if (!ctxMenu) return;
        // Dispatch a synthetic dblclick to trigger inline edit
        const el = document.querySelector(`[data-session-id="${ctxMenu.sessionId}"] span`);
        if (el) (el as HTMLElement).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        setCtxMenu(null);
    };

    return (
        <>
            <div
                className="flex flex-col h-full w-full select-none"
                style={{ backgroundColor: isDark ? '#111113' : '#f5f5f7', borderRight: `1px solid ${border}` }}
            >
                {/* ── Header ── */}
                <div className="px-4 py-5 border-b" style={{ borderColor: border }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-pink-500 flex-shrink-0" />
                            <span className="font-semibold tracking-wide text-sm" style={{ color: isDark ? '#e5e5e5' : '#1a1a1a' }}>
                                BrainBox
                            </span>
                        </div>
                        {/* Engine dot */}
                        <div className="flex items-center gap-1.5" title={`Local Engine: ${engineStatus}`}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{
                                backgroundColor: engineStatus === 'running' ? '#22c55e' : engineStatus === 'starting' ? '#f59e0b' : '#ef4444',
                                boxShadow: engineStatus === 'running' ? '0 0 6px #22c55e' : engineStatus === 'starting' ? '0 0 6px #f59e0b' : '0 0 6px #ef4444',
                                animation: engineStatus === 'running' ? 'pulse 2s infinite' : 'none',
                            }} />
                            <span className="text-xs" style={{ color: isDark ? '#525252' : '#9ca3af' }}>
                                {engineStatus === 'running' ? 'Engine' : engineStatus === 'starting' ? 'Starting…' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

                    {/* Appearance */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: sectionLabel }}>Appearance</p>
                        <button
                            onClick={onToggleTheme}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
                        >
                            <div className="flex items-center gap-2.5">
                                {isDark ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
                                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                    </svg>
                                )}
                                <span className="text-xs" style={{ color: isDark ? '#a3a3a3' : '#525252' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                            </div>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.12)', color: isDark ? '#60a5fa' : '#d97706' }}>
                                {isDark ? 'Dark' : 'Light'}
                            </span>
                        </button>
                    </section>

                    {/* Model */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: sectionLabel }}>Model</p>
                        <div className="space-y-2">
                            <ModelSelector models={installedModels} selected={selectedModel} onSelect={onSelectModel} isDark={isDark} />
                            <button onClick={() => setShowLibrary(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                                style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Model Library
                            </button>
                            <button onClick={() => setShowManage(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                                style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.13)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.07)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                                </svg>
                                Manage Storage
                            </button>
                        </div>
                    </section>

                    {/* Chats */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: sectionLabel }}>Chats</p>
                        <div className="space-y-1.5">
                            {/* New Chat */}
                            <button onClick={onNewChat}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, color: isDark ? '#a3a3a3' : '#525252' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                New Chat
                            </button>

                            {/* History list */}
                            <div
                                ref={ctxRef}
                                className="space-y-0.5 max-h-48 overflow-y-auto"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.05) transparent' }}
                                onContextMenu={handleContextMenu}
                            >
                                {sessions.map(session => (
                                    <HistoryItem
                                        key={session.id}
                                        session={session}
                                        isActive={session.id === activeSessionId}
                                        isDark={isDark}
                                        onSelect={() => onSwitchSession(session.id)}
                                        onRename={title => onRenameSession(session.id, title)}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Hardware */}
                    <section>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: sectionLabel }}>Hardware</p>
                        <div
                            className="px-3 py-3 rounded-xl space-y-3"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
                        >
                            <HardwareBar label="RAM" value={Math.round(ram)} color="#3b82f6" />
                            <HardwareBar label="VRAM" value={Math.round(vram)} color="#ec4899" />
                        </div>
                    </section>
                </div>

                {/* ── Footer ── */}
                <div className="px-4 pb-4 pt-3 border-t space-y-2" style={{ borderColor: border }}>
                    <button onClick={onClearChat}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                        style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#f87171' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)'}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                        </svg>
                        Clear Chat
                    </button>

                    {/* Settings gear */}
                    <button onClick={() => setShowSettings(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                        style={{ backgroundColor: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, color: isDark ? '#525252' : '#9ca3af' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = isDark ? '#a3a3a3' : '#525252'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = isDark ? '#525252' : '#9ca3af'; }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        Settings
                    </button>
                </div>
            </div>

            {/* ── Context Menu ── */}
            <AnimatePresence>
                {ctxMenu && ctxSession && (
                    <motion.div
                        className="fixed rounded-xl overflow-hidden z-50"
                        style={{
                            left: ctxMenu.x, top: ctxMenu.y,
                            backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            minWidth: '140px',
                        }}
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {[
                            {
                                label: 'Rename', icon: (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                ), action: triggerRename, color: isDark ? '#d4d4d4' : '#404040',
                            },
                            {
                                label: 'Delete', icon: (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                                    </svg>
                                ), action: () => { onDeleteSession(ctxMenu.sessionId); setCtxMenu(null); }, color: '#f87171',
                            },
                        ].map(item => (
                            <button key={item.label} onClick={item.action}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors cursor-pointer"
                                style={{ color: item.color }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Modals ── */}
            {showLibrary && <ModelLibraryModal installedModels={installedModels} theme={theme} onClose={() => setShowLibrary(false)} onInstalled={onRefreshModels} />}
            {showManage && <ManageModelsModal installedModels={installedModels} selectedModel={selectedModel} theme={theme} onClose={() => setShowManage(false)} onDeleted={onRefreshModels} />}
            {showSettings && <SettingsModal theme={theme} onClose={() => setShowSettings(false)} onRefreshModels={onRefreshModels} />}
        </>
    );
}
