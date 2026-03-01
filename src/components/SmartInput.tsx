import { useRef, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Snippet {
    id: string;
    content: string;
    expanded: boolean;
    isCode: boolean;
}

interface SmartInputProps {
    onSend: (text: string, snippets: Snippet[]) => void;
    disabled?: boolean;
    theme: 'dark' | 'light';
    webEnabled: boolean;
    onToggleWeb: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const CODE_PATTERNS = /```|^\s*(import |export |const |let |var |function |class |def |#include|<\?php|<!DOCTYPE)/m;
const LONG_THRESHOLD = 300;

function detectCode(text: string): boolean { return CODE_PATTERNS.test(text); }
function getPreview(content: string, maxLength = 80): string {
    const first = content.split('\n')[0].trim();
    return first.length > maxLength ? first.slice(0, maxLength) + '…' : first;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function SmartInput({
    onSend, disabled, theme,
    webEnabled, onToggleWeb,
}: SmartInputProps) {
    const [text, setText] = useState('');
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isDark = theme === 'dark';

    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        autoResize();
    };

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pasted = e.clipboardData.getData('text');
        if (pasted.length > LONG_THRESHOLD || detectCode(pasted)) {
            e.preventDefault();
            setSnippets(prev => [...prev, {
                id: Date.now().toString(),
                content: pasted,
                expanded: false,
                isCode: detectCode(pasted),
            }]);
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    };

    const handleSubmit = () => {
        if (!text.trim() && snippets.length === 0) return;
        onSend(text.trim(), snippets);
        setText('');
        setSnippets([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#e5e5e5' : '#1a1a1a';
    const placeholderColor = isDark ? 'rgba(200,200,200,0.25)' : 'rgba(0,0,0,0.3)';
    const dimIcon = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';

    return (
        <div className="w-full">
            {/* Snippet Attachments */}
            {snippets.length > 0 && (
                <div className="mb-2 space-y-2">
                    {snippets.map(snippet => (
                        <div
                            key={snippet.id}
                            className="rounded-xl overflow-hidden"
                            style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                            }}
                        >
                            <div
                                className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
                                onClick={() => setSnippets(prev => prev.map(s => s.id === snippet.id ? { ...s, expanded: !s.expanded } : s))}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-mono"
                                        style={{ backgroundColor: snippet.isCode ? 'rgba(236,72,153,0.12)' : 'rgba(59,130,246,0.12)', color: snippet.isCode ? '#f472b6' : '#60a5fa' }}>
                                        {snippet.isCode ? 'code' : 'text'}
                                    </span>
                                    <span className="text-xs truncate font-mono" style={{ color: isDark ? '#a3a3a3' : '#525252' }}>
                                        {getPreview(snippet.content)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                    <span style={{ color: dimIcon, fontSize: 10 }}>{snippet.expanded ? '▲' : '▼'}</span>
                                    <button
                                        onClick={e => { e.stopPropagation(); setSnippets(prev => prev.filter(s => s.id !== snippet.id)); }}
                                        className="w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                                        style={{ color: dimIcon }}
                                    >×</button>
                                </div>
                            </div>
                            {snippet.expanded && (
                                <div className="px-3 pb-3" style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                    <pre className="text-xs mt-2 overflow-x-auto"
                                        style={{ fontFamily: 'ui-monospace, "Fira Code", monospace', color: isDark ? '#d4d4d4' : '#404040', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '180px', overflowY: 'auto' }}>
                                        {snippet.content}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Box */}
            <div
                className="flex items-end gap-2 px-4 py-3 rounded-2xl transition-all duration-200"
                style={{
                    backgroundColor: inputBg, border: `1px solid ${inputBorder}`,
                    boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.08)',
                }}
                onFocusCapture={e => {
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
                    e.currentTarget.style.boxShadow = isDark ? '0 0 0 1px rgba(59,130,246,0.15), 0 4px 24px rgba(0,0,0,0.4)' : '0 0 0 1px rgba(59,130,246,0.15), 0 4px 24px rgba(0,0,0,0.05)';
                }}
                onBlurCapture={e => {
                    e.currentTarget.style.borderColor = inputBorder;
                    e.currentTarget.style.boxShadow = isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.08)';
                }}
            >
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                    placeholder={snippets.length > 0 ? 'Add a message about the snippet…' : 'Message BrainBox…'}
                    className="flex-1 resize-none bg-transparent focus:outline-none text-sm leading-relaxed"
                    style={{ color: textColor, overflowY: 'hidden', minHeight: '22px', maxHeight: '150px' }}
                />
                <style>{`textarea::placeholder { color: ${placeholderColor}; }`}</style>

                {/* Web Bridge Toggle */}
                <button
                    className="flex-shrink-0 mb-0.5 transition-all duration-200 cursor-pointer rounded-md p-0.5"
                    style={{
                        color: webEnabled ? '#60a5fa' : dimIcon,
                        backgroundColor: webEnabled ? 'rgba(59,130,246,0.12)' : 'transparent',
                        boxShadow: webEnabled ? '0 0 8px rgba(59,130,246,0.3)' : 'none',
                    }}
                    title={webEnabled ? 'Web Bridge: ON' : 'Web Bridge: OFF'}
                    onClick={onToggleWeb}
                    onMouseEnter={e => { if (!webEnabled) e.currentTarget.style.color = '#60a5fa'; }}
                    onMouseLeave={e => { if (!webEnabled) e.currentTarget.style.color = dimIcon; }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                </button>

                {/* Send button */}
                <button
                    onClick={handleSubmit}
                    disabled={disabled || (!text.trim() && snippets.length === 0)}
                    className="flex-shrink-0 w-7 h-7 mb-0.5 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer"
                    style={{
                        backgroundColor: !text.trim() && snippets.length === 0
                            ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
                            : 'rgba(59,130,246,0.85)',
                        color: !text.trim() && snippets.length === 0
                            ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')
                            : 'white',
                        boxShadow: text.trim() || snippets.length > 0 ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>

            {/* Hint */}
            <p className="text-center mt-2 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)' }}>
                Enter to send · Shift+Enter for newline · Paste code → snippet
            </p>
        </div>
    );
}
