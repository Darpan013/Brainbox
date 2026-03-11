import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import SmartInput from './SmartInput';
import WebOverlay from './WebOverlay';
import type { Message } from '../types';

// ─── Props ─────────────────────────────────────────────────────────────────

interface ChatAreaProps {
    messages: Message[];
    onSend: (text: string, snippets: any[]) => void;
    theme: 'dark' | 'light';
    isLoading?: boolean;
    isGenerating?: boolean;
    onStopGeneration?: () => void;
    webEnabled: boolean;
    onToggleWeb: () => void;
    /** In-flight assistant reply — rendered from local state, never persisted until done */
    streamingMessage?: Message | null;
    // ── Internal browser ──────────────────────────────────────────────────
    browserUrl?: string | null;
    isBrowserMinimized?: boolean;
    onOpenBrowser?: (url: string) => void;
    onBrowserNavigate?: (url: string) => void;
    onBrowserMinimize?: () => void;
    onBrowserRestore?: () => void;
    onBrowserClose?: () => void;
}

// ─── Typing indicator ──────────────────────────────────────────────────────

function TypingIndicator({ theme }: { theme: 'dark' | 'light' }) {
    const isDark = theme === 'dark';
    return (
        <div className="flex items-center gap-3 px-6 mb-4">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 20 20" fill="white" opacity="0.9">
                    <path d="M10 3C8 3 5 5 5 8c0 2 1.5 3.5 3 4.5V15h4v-2.5C13.5 11.5 15 10 15 8c0-3-3-5-5-5z" />
                </svg>
            </div>
            <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isDark ? '#525252' : '#d1d5db' }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
            </div>
        </div>
    );
}

// ─── Memoised message row ──────────────────────────────────────────────────
// Wrapped in React.memo so that token-by-token streaming updates to the
// *last* message never trigger re-renders of the entire history list.

const MemoMessage = React.memo(function MemoMessage({
    msg, theme,
}: { msg: import('../types').Message; theme: 'dark' | 'light' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            <MessageBubble message={msg} theme={theme} />
        </motion.div>
    );
});

const EMPTY_HINTS = [
    'Ask anything. Think privately.',
    'Your data stays local, always.',
    'Paste code for instant analysis.',
    'Toggle models from the sidebar.',
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function ChatArea({
    messages, onSend, theme, isLoading, isGenerating, onStopGeneration,
    webEnabled, onToggleWeb,
    streamingMessage,
    browserUrl, isBrowserMinimized,
    onOpenBrowser, onBrowserNavigate, onBrowserMinimize, onBrowserRestore, onBrowserClose,
}: ChatAreaProps) {
    const hasMessages = messages.length > 0;
    const isDark = theme === 'dark';
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current && (hasMessages || streamingMessage)) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingMessage, isLoading, hasMessages]);

    // ── Intercept link clicks in the messages area ───────────────────────────
    const handleMessagesClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const anchor = (e.target as HTMLElement).closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        e.preventDefault();
        onOpenBrowser?.(href);
    }, [onOpenBrowser]);

    const bgColor = isDark ? '#0a0a0b' : '#fafafa';

    const sharedInputProps = {
        onSend, theme,
        webEnabled,
        onToggleWeb,
        isGenerating: isGenerating ?? false,
        onStopGeneration,
    };

    const showFAB = !!browserUrl && isBrowserMinimized;

    return (
        <div className="relative flex flex-col h-full w-full overflow-hidden" style={{ backgroundColor: bgColor }}>
            <AnimatePresence mode="wait">
                {!hasMessages ? (
                    /* ── Empty state ── */
                    <motion.div
                        key="centered"
                        className="flex flex-col items-center justify-center h-full w-full px-6"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="absolute inset-0 pointer-events-none"
                            style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(58,68,85,0.04) 0%, transparent 70%)' }} />
                        <div className="mb-10 text-center space-y-2 relative z-10">
                            <h2 className="text-2xl font-light tracking-wide"
                                style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                                What's on your mind?
                            </h2>
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)' }}>
                                {EMPTY_HINTS[Math.floor(Date.now() / 10000) % EMPTY_HINTS.length]}
                            </p>
                        </div>
                        <div className="w-full max-w-2xl relative z-10">
                            <SmartInput {...sharedInputProps} />
                        </div>
                    </motion.div>
                ) : (
                    /* ── Chat state ── */
                    <motion.div
                        key="chat"
                        className="flex flex-col h-full w-full"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Messages — clicks here may open the floating browser */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto py-6"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(255,255,255,0.08) transparent' : 'rgba(0,0,0,0.08) transparent' }}
                            onClick={handleMessagesClick}
                        >
                            <AnimatePresence initial={false}>
                                {messages.map(msg => (
                                    <MemoMessage key={msg.id} msg={msg} theme={theme} />
                                ))}
                            </AnimatePresence>
                            {/* Streaming reply — rendered from local ephemeral state only */}
                            {streamingMessage && (
                                <MessageBubble message={streamingMessage} theme={theme} />
                            )}
                            {isLoading && !streamingMessage && <TypingIndicator theme={theme} />}
                        </div>

                        {/* Gradient at top */}
                        <div className="absolute top-0 left-0 right-0 h-12 pointer-events-none"
                            style={{ background: `linear-gradient(to bottom, ${bgColor}, transparent)`, zIndex: 1 }} />

                        {/* Bottom input */}
                        <motion.div
                            layout
                            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                            className="relative flex-shrink-0 px-6 pb-5 pt-3"
                            style={{
                                borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
                                backgroundColor: isDark ? 'rgba(10,10,11,0.9)' : 'rgba(250,250,250,0.9)',
                                backdropFilter: 'blur(12px)', zIndex: 2,
                            }}
                        >
                            <div className="max-w-3xl mx-auto">
                                <SmartInput {...sharedInputProps} disabled={isLoading} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating internal browser overlay ── */}
            {browserUrl && (
                <WebOverlay
                    url={browserUrl}
                    isMinimized={!!isBrowserMinimized}
                    theme={theme}
                    onNavigate={onBrowserNavigate ?? (() => { })}
                    onMinimize={onBrowserMinimize ?? (() => { })}
                    onClose={onBrowserClose ?? (() => { })}
                />
            )}

            {/* ── FAB: restore minimised browser ── */}
            <AnimatePresence>
                {showFAB && (
                    <motion.button
                        key="browser-fab"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                        onClick={onBrowserRestore}
                        title="Restore browser"
                        style={{
                            position: 'absolute',
                            bottom: '96px',
                            right: '24px',
                            zIndex: 40,
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 4px 18px rgba(99,102,241,0.45)',
                            color: '#fff',
                        }}
                    >
                        {/* Globe icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
