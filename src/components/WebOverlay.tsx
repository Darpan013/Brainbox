import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Props ──────────────────────────────────────────────────────────────────

interface WebOverlayProps {
    url: string;
    isMinimized: boolean;
    theme: 'dark' | 'light';
    onNavigate: (url: string) => void;
    onMinimize: () => void;
    onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WebOverlay({
    url,
    isMinimized,
    theme,
    onNavigate,
    onMinimize,
    onClose,
}: WebOverlayProps) {
    const isDark = theme === 'dark';
    const [inputUrl, setInputUrl] = useState(url);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync address bar when url prop changes (e.g. first load / link intercept)
    useEffect(() => {
        setInputUrl(url);
    }, [url]);

    function handleGo(e: React.FormEvent) {
        e.preventDefault();
        let target = inputUrl.trim();
        if (target && !/^https?:\/\//i.test(target)) {
            target = 'https://' + target;
        }
        if (target) onNavigate(target);
    }

    // ── colours ──────────────────────────────────────────────────────────────
    const headerBg = isDark ? 'rgba(18,18,20,0.97)' : 'rgba(245,245,247,0.97)';
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
    const btnHover = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

    return (
        <AnimatePresence>
            {!isMinimized && (
                <motion.div
                    key="web-overlay"
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: isDark
                            ? '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
                            : '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
                        margin: '8px',
                    }}
                >
                    {/* ── Header bar ── */}
                    <div
                        style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 14px',
                            backgroundColor: headerBg,
                            borderBottom: `1px solid ${border}`,
                            backdropFilter: 'blur(16px)',
                        }}
                    >
                        {/* Globe icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>

                        {/* Address bar */}
                        <form onSubmit={handleGo} style={{ flex: 1 }}>
                            <input
                                ref={inputRef}
                                value={inputUrl}
                                onChange={e => setInputUrl(e.target.value)}
                                onFocus={e => e.currentTarget.select()}
                                placeholder="Enter a URL…"
                                style={{
                                    width: '100%',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${border}`,
                                    backgroundColor: inputBg,
                                    color: textColor,
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e =>
                                (e.currentTarget.style.borderColor = isDark
                                    ? 'rgba(255,255,255,0.18)'
                                    : 'rgba(0,0,0,0.2)')
                                }
                                onMouseLeave={e =>
                                    (e.currentTarget.style.borderColor = border)
                                }
                            />
                        </form>

                        {/* Minimize button */}
                        <IconBtn
                            title="Minimize"
                            hoverBg={btnHover}
                            onClick={onMinimize}
                            color={textColor}
                        >
                            {/* dash / minus */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </IconBtn>

                        {/* Close button */}
                        <IconBtn
                            title="Close browser"
                            hoverBg="rgba(239,68,68,0.18)"
                            onClick={onClose}
                            color={isDark ? 'rgba(248,113,113,0.85)' : 'rgba(185,28,28,0.85)'}
                        >
                            {/* X */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </IconBtn>
                    </div>

                    {/* ── iframe body ── */}
                    <iframe
                        key={url}           /* remount when url changes to clear history */
                        src={url}
                        title="Internal browser"
                        style={{
                            flex: 1, border: 'none', display: 'block',
                            backgroundColor: isDark ? '#09090b' : '#ffffff'
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── Small icon button helper ───────────────────────────────────────────────

function IconBtn({
    children,
    title,
    hoverBg,
    color,
    onClick,
}: {
    children: React.ReactNode;
    title: string;
    hoverBg: string;
    color: string;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            title={title}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: hovered ? hoverBg : 'transparent',
                color,
                transition: 'background-color 0.15s',
            }}
        >
            {children}
        </button>
    );
}
