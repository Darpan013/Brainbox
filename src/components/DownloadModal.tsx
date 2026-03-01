import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ollama } from 'ollama/browser';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

const RECOMMENDED_MODELS = ['gemma3:4b', 'llama3.2:3b', 'deepseek-r1:1.5b'];

interface DownloadModalProps {
    installedModels: string[];
    theme: 'dark' | 'light';
    onClose: () => void;
    onInstalled: () => void; // refresh list after download
}

interface PullStatus {
    status: string;
    percent: number;
}

export default function DownloadModal({ installedModels, theme, onClose, onInstalled }: DownloadModalProps) {
    const isDark = theme === 'dark';
    const [customModel, setCustomModel] = useState('');
    const [pulling, setPulling] = useState<string | null>(null);
    const [pullStatus, setPullStatus] = useState<PullStatus>({ status: '', percent: 0 });
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    const notInstalled = RECOMMENDED_MODELS.filter(m => !installedModels.includes(m));

    const startPull = async (modelName: string) => {
        if (!modelName.trim()) return;
        setPulling(modelName);
        setError(null);
        abortRef.current = false;
        setPullStatus({ status: 'Starting…', percent: 0 });

        try {
            const stream = await ollama.pull({ model: modelName.trim(), stream: true });
            for await (const part of stream) {
                if (abortRef.current) break;
                const pct = part.total && part.completed
                    ? Math.round((part.completed / part.total) * 100)
                    : pullStatus.percent;
                setPullStatus({ status: part.status ?? 'Downloading…', percent: pct });
            }
            if (!abortRef.current) {
                setPullStatus({ status: 'Complete!', percent: 100 });
                await new Promise(r => setTimeout(r, 900));
                onInstalled();
                onClose();
            }
        } catch (err: any) {
            setError(err?.message ?? 'Pull failed. Is Ollama running?');
            setPulling(null);
        }
    };

    const cancelPull = () => {
        abortRef.current = true;
        setPulling(null);
        setPullStatus({ status: '', percent: 0 });
    };

    const surface = isDark ? '#18181b' : '#ffffff';
    const overlay = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)';
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    const textPrimary = isDark ? '#e5e5e5' : '#1a1a1a';
    const textMuted = isDark ? '#737373' : '#6b7280';
    const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                className="fixed inset-0 flex items-center justify-center"
                style={{ backgroundColor: overlay, zIndex: 50 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={pulling ? undefined : onClose}
            >
                {/* Modal panel */}
                <motion.div
                    key="modal"
                    className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        boxShadow: isDark
                            ? '0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)'
                            : '0 24px 64px rgba(0,0,0,0.18)',
                    }}
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 12 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-5 pt-5 pb-4"
                        style={{ borderBottom: `1px solid ${border}` }}
                    >
                        <div>
                            <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>
                                Download Model
                            </h2>
                            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                                Pulled directly from Ollama registry
                            </p>
                        </div>
                        {!pulling && (
                            <button
                                onClick={onClose}
                                className="w-6 h-6 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                                style={{ color: textMuted }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="px-5 py-4 space-y-5">
                        {/* Download Progress */}
                        <AnimatePresence>
                            {pulling && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-2"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-mono" style={{ color: '#60a5fa' }}>
                                            {pulling}
                                        </span>
                                        <span className="text-xs font-mono" style={{ color: textMuted }}>
                                            {pullStatus.percent}%
                                        </span>
                                    </div>
                                    {/* Track */}
                                    <div
                                        className="w-full h-1.5 rounded-full overflow-hidden"
                                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}
                                    >
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{
                                                background: 'linear-gradient(90deg, #3b82f6, #ec4899)',
                                                boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                                            }}
                                            animate={{ width: `${pullStatus.percent}%` }}
                                            transition={{ duration: 0.4 }}
                                        />
                                    </div>
                                    <p className="text-xs" style={{ color: textMuted }}>
                                        {pullStatus.status}
                                    </p>
                                    <button
                                        onClick={cancelPull}
                                        className="text-xs cursor-pointer transition-colors"
                                        style={{ color: '#f87171' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#f87171')}
                                    >
                                        Cancel
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error */}
                        {error && (
                            <p className="text-xs px-3 py-2 rounded-lg" style={{
                                backgroundColor: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.15)',
                                color: '#f87171',
                            }}>
                                {error}
                            </p>
                        )}

                        {/* Recommended list */}
                        {!pulling && (
                            <>
                                {notInstalled.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: textMuted }}>
                                            Recommended
                                        </p>
                                        <div className="space-y-1.5">
                                            {notInstalled.map(model => (
                                                <button
                                                    key={model}
                                                    onClick={() => startPull(model)}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-150"
                                                    style={{
                                                        backgroundColor: inputBg,
                                                        border: `1px solid ${border}`,
                                                        color: textPrimary,
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
                                                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(59,130,246,0.07)' : 'rgba(59,130,246,0.05)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.borderColor = border;
                                                        e.currentTarget.style.backgroundColor = inputBg;
                                                    }}
                                                >
                                                    <span className="font-mono">{model}</span>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                        <polyline points="7 10 12 15 17 10" />
                                                        <line x1="12" y1="15" x2="12" y2="3" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {notInstalled.length === 0 && (
                                    <p className="text-xs text-center py-2" style={{ color: textMuted }}>
                                        All recommended models are installed ✓
                                    </p>
                                )}

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: border }} />

                                {/* Custom model input */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: textMuted }}>
                                        Custom Model
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={customModel}
                                            onChange={e => setCustomModel(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && startPull(customModel)}
                                            placeholder="e.g. phi3:mini"
                                            className="flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none transition-all"
                                            style={{
                                                backgroundColor: inputBg,
                                                border: `1px solid ${border}`,
                                                color: textPrimary,
                                            }}
                                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)')}
                                            onBlur={e => (e.currentTarget.style.borderColor = border)}
                                        />
                                        <button
                                            onClick={() => startPull(customModel)}
                                            disabled={!customModel.trim()}
                                            className="px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all"
                                            style={{
                                                backgroundColor: customModel.trim() ? 'rgba(59,130,246,0.85)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                                color: customModel.trim() ? 'white' : textMuted,
                                                boxShadow: customModel.trim() ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
                                            }}
                                        >
                                            Pull
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
