import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';

interface MessageBubbleProps {
    message: Message;
    theme: 'dark' | 'light';
}

export default function MessageBubble({ message, theme }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isDark = theme === 'dark';

    // ── System / search status message ──────────────────────────────────────
    if (isSystem) {
        return (
            <div className="flex justify-center mb-3 px-6">
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '5px 14px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                    }}
                >
                    {/* Globe / search icon */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ opacity: 0.6 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {message.content}
                </div>
            </div>
        );
    }

    // ── User message ─────────────────────────────────────────────────────────
    if (isUser) {
        return (
            <div className="flex justify-end mb-4 px-6">
                <div
                    className="max-w-[72%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                    style={{
                        background: isDark
                            ? 'rgba(30, 58, 138, 0.35)'
                            : 'rgba(219, 234, 254, 0.8)',
                        border: isDark
                            ? '1px solid rgba(59,130,246,0.15)'
                            : '1px solid rgba(147,197,253,0.5)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        color: isDark ? '#e2e8f0' : '#1e3a8a',
                        boxShadow: isDark
                            ? '0 2px 16px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
                            : '0 2px 8px rgba(147,197,253,0.2)',
                    }}
                >
                    {message.content}
                </div>
            </div>
        );
    }

    // ── AI / assistant message ───────────────────────────────────────────────
    return (
        <div className="flex justify-start mb-6 px-6">
            <div className="flex gap-3 max-w-[80%]">
                {/* AI avatar */}
                <div className="flex-shrink-0 mt-0.5">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 20 20" fill="white" opacity="0.9">
                            <path d="M10 3C8 3 5 5 5 8c0 2 1.5 3.5 3 4.5V15h4v-2.5C13.5 11.5 15 10 15 8c0-3-3-5-5-5z" />
                        </svg>
                    </div>
                </div>

                {/* Markdown content */}
                <div
                    className="text-sm leading-relaxed prose prose-sm max-w-none"
                    style={{
                        color: isDark ? '#d4d4d4' : '#262626',
                        '--tw-prose-headings': isDark ? '#e5e5e5' : '#171717',
                        '--tw-prose-code': isDark ? '#f472b6' : '#be185d',
                        '--tw-prose-pre-bg': isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    } as React.CSSProperties}
                >
                    <ReactMarkdown
                        components={{
                            code({ className, children, ...props }) {
                                const isInline = !className;
                                if (isInline) {
                                    return (
                                        <code
                                            style={{
                                                backgroundColor: isDark ? 'rgba(236,72,153,0.12)' : 'rgba(190,24,93,0.08)',
                                                color: isDark ? '#f472b6' : '#be185d',
                                                padding: '0.1em 0.35em',
                                                borderRadius: '0.3em',
                                                fontSize: '0.85em',
                                                fontFamily: 'ui-monospace, "Fira Code", monospace',
                                            }}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                }
                                return (
                                    <pre
                                        style={{
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                            border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                                            borderRadius: '0.75rem',
                                            padding: '0.85rem 1rem',
                                            overflowX: 'auto',
                                            fontSize: '0.8rem',
                                            fontFamily: 'ui-monospace, "Fira Code", monospace',
                                        }}
                                    >
                                        <code className={className} {...props}>{children}</code>
                                    </pre>
                                );
                            },
                            p({ children }) {
                                return <p style={{ margin: '0 0 0.6em', lineHeight: '1.7' }}>{children}</p>;
                            },
                            ul({ children }) {
                                return (
                                    <ul style={{ paddingLeft: '1.25em', margin: '0.4em 0', listStyleType: 'disc' }}>
                                        {children}
                                    </ul>
                                );
                            },
                            ol({ children }) {
                                return (
                                    <ol style={{ paddingLeft: '1.25em', margin: '0.4em 0', listStyleType: 'decimal' }}>
                                        {children}
                                    </ol>
                                );
                            },
                            li({ children }) {
                                return <li style={{ marginBottom: '0.2em' }}>{children}</li>;
                            },
                            strong({ children }) {
                                return <strong style={{ color: isDark ? '#e5e5e5' : '#171717', fontWeight: 600 }}>{children}</strong>;
                            },
                            blockquote({ children }) {
                                return (
                                    <blockquote
                                        style={{
                                            borderLeft: '2px solid rgba(59,130,246,0.4)',
                                            paddingLeft: '0.75em',
                                            margin: '0.4em 0',
                                            color: isDark ? '#a3a3a3' : '#525252',
                                            fontStyle: 'italic',
                                        }}
                                    >
                                        {children}
                                    </blockquote>
                                );
                            },
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
