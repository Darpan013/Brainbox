import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

interface SettingsModalProps {
    theme: 'dark' | 'light';
    onClose: () => void;
    onRefreshModels: () => void;
}

export default function SettingsModal({ theme, onClose, onRefreshModels }: SettingsModalProps) {
    const isDark = theme === 'dark';
    const [confirm, setConfirm] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const surface = isDark ? '#18181b' : '#ffffff';
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const textPrimary = isDark ? '#e5e5e5' : '#1a1a1a';
    const textMuted = isDark ? '#737373' : '#6b7280';

    const handleClear = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 4000); return; }
        setClearing(true);
        try {
            await invoke('clear_app_data');
            await onRefreshModels();
            setDone(true);
            setTimeout(onClose, 1200);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to clear data.');
        } finally {
            setClearing(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 60 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="relative flex flex-col"
                    style={{
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        borderRadius: '1.25rem',
                        boxShadow: isDark ? '0 32px 80px rgba(0,0,0,0.85)' : '0 24px 64px rgba(0,0,0,0.15)',
                        width: '400px',
                        padding: '1.5rem',
                    }}
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>Settings</h2>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                            style={{ color: textMuted }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Danger zone */}
                    <div
                        className="rounded-xl p-4"
                        style={{ backgroundColor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}
                    >
                        <p className="text-xs font-medium mb-1" style={{ color: '#f87171' }}>Danger Zone</p>
                        <p className="text-xs mb-3" style={{ color: textMuted }}>
                            Permanently deletes all downloaded models from the sandboxed app data directory.
                            This cannot be undone.
                        </p>

                        {error && (
                            <p className="text-xs mb-2 px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleClear}
                            disabled={clearing || done}
                            className="w-full py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: confirm ? 'rgba(239,68,68,0.85)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${confirm ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.2)'}`,
                                color: confirm ? 'white' : '#f87171',
                                opacity: (clearing || done) ? 0.7 : 1,
                            }}
                        >
                            {done ? '✓ All data cleared' :
                                clearing ? 'Wiping…' :
                                    confirm ? '⚠ Confirm — this is irreversible' :
                                        'Clear All App Data & Models'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
