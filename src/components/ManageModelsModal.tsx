import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ollama } from 'ollama/browser';
import { MODEL_REGISTRY } from '../data/modelRegistry';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

// Try to match installed model name to registry storage size
function getStorageSize(modelId: string): string {
    const entry = MODEL_REGISTRY.find(m => m.id === modelId);
    return entry?.storage ?? '—';
}

interface ManageModelsModalProps {
    installedModels: string[];
    selectedModel: string;
    theme: 'dark' | 'light';
    onClose: () => void;
    onDeleted: () => void; // refresh + auto-select
}

export default function ManageModelsModal({
    installedModels,
    selectedModel,
    theme,
    onClose,
    onDeleted,
}: ManageModelsModalProps) {
    const isDark = theme === 'dark';
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteLog, setDeleteLog] = useState<string[]>([]);

    const surface = isDark ? '#18181b' : '#ffffff';
    const surface2 = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const textPrimary = isDark ? '#e5e5e5' : '#1a1a1a';
    const textMuted = isDark ? '#737373' : '#6b7280';

    const allSelected = installedModels.length > 0 && checked.size === installedModels.length;

    const toggleAll = () => {
        if (allSelected) {
            setChecked(new Set());
        } else {
            setChecked(new Set(installedModels));
        }
    };

    const toggleOne = (id: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Calculate total space to free (rough sum based on registry data)
    const totalSpace = [...checked].reduce((sum, id) => {
        const entry = MODEL_REGISTRY.find(m => m.id === id);
        if (!entry) return sum;
        const num = parseFloat(entry.storage);
        const unit = entry.storage.toUpperCase();
        if (unit.includes('GB')) return sum + num;
        if (unit.includes('MB')) return sum + num / 1024;
        return sum;
    }, 0);

    const spaceLabel = totalSpace > 0
        ? totalSpace >= 1
            ? `${totalSpace.toFixed(1)} GB`
            : `${Math.round(totalSpace * 1024)} MB`
        : null;

    const handleDelete = async () => {
        if (checked.size === 0 || isDeleting) return;
        setIsDeleting(true);
        setDeleteLog([]);

        for (const id of checked) {
            setDeleteLog(prev => [...prev, `Deleting ${id}…`]);
            try {
                await ollama.delete({ model: id });
                setDeleteLog(prev => [...prev, `✓ Deleted ${id}`]);
            } catch (err: any) {
                setDeleteLog(prev => [...prev, `✗ Failed: ${id} — ${err?.message ?? 'error'}`]);
            }
        }

        await new Promise(r => setTimeout(r, 500));
        setIsDeleting(false);
        onDeleted();
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                className="fixed inset-0 flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', zIndex: 50 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={!isDeleting ? onClose : undefined}
            >
                <motion.div
                    key="panel"
                    className="relative flex flex-col"
                    style={{
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        borderRadius: '1.25rem',
                        boxShadow: isDark
                            ? '0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)'
                            : '0 24px 64px rgba(0,0,0,0.15)',
                        width: '440px',
                        maxHeight: '72vh',
                    }}
                    initial={{ opacity: 0, scale: 0.93, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 16 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
                        style={{ borderBottom: `1px solid ${border}` }}
                    >
                        <div>
                            <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>
                                Manage Storage
                            </h2>
                            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                                {installedModels.length} model{installedModels.length !== 1 ? 's' : ''} installed
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Select All toggle */}
                            {installedModels.length > 0 && !isDeleting && (
                                <button
                                    onClick={toggleAll}
                                    className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                                    style={{
                                        backgroundColor: allSelected ? 'rgba(239,68,68,0.1)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                                        border: `1px solid ${allSelected ? 'rgba(239,68,68,0.2)' : border}`,
                                        color: allSelected ? '#f87171' : textMuted,
                                    }}
                                >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                            {!isDeleting && (
                                <button
                                    onClick={onClose}
                                    className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                                    style={{ color: textMuted }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Model list */}
                    <div
                        className="flex-1 overflow-y-auto px-6 py-4 space-y-2"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(255,255,255,0.07) transparent' : 'rgba(0,0,0,0.07) transparent' }}
                    >
                        {installedModels.length === 0 && (
                            <p className="text-xs text-center py-8" style={{ color: textMuted }}>
                                No models installed yet.
                            </p>
                        )}

                        {installedModels.map(id => {
                            const isChecked = checked.has(id);
                            const isActive = id === selectedModel;
                            return (
                                <div
                                    key={id}
                                    onClick={() => !isDeleting && toggleOne(id)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
                                    style={{
                                        backgroundColor: isChecked
                                            ? 'rgba(239,68,68,0.07)'
                                            : surface2,
                                        border: `1px solid ${isChecked ? 'rgba(239,68,68,0.2)' : border}`,
                                        cursor: isDeleting ? 'default' : 'pointer',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isChecked && !isDeleting) {
                                            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isChecked) e.currentTarget.style.borderColor = border;
                                    }}
                                >
                                    {/* Checkbox */}
                                    <div
                                        className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all duration-150"
                                        style={{
                                            backgroundColor: isChecked ? '#ef4444' : 'transparent',
                                            border: `1.5px solid ${isChecked ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')}`,
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {isChecked && (
                                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                                <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Model info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono" style={{ color: isChecked ? '#f87171' : textPrimary }}>
                                                {id}
                                            </span>
                                            {isActive && (
                                                <span
                                                    className="text-xs px-1.5 py-0.5 rounded-md"
                                                    style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                                                >
                                                    active
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs mt-0.5" style={{ color: isDark ? '#525252' : '#9ca3af' }}>
                                            {getStorageSize(id)} · {MODEL_REGISTRY.find(m => m.id === id)?.type ?? 'Unknown type'}
                                        </p>
                                    </div>

                                    {/* Size */}
                                    <span className="text-xs font-mono flex-shrink-0" style={{ color: isChecked ? '#f87171' : (isDark ? '#404040' : '#d1d5db') }}>
                                        {getStorageSize(id)}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Deletion log */}
                        <AnimatePresence>
                            {deleteLog.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="rounded-xl px-3 py-2 space-y-1"
                                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}
                                >
                                    {deleteLog.map((line, i) => (
                                        <p key={i} className="text-xs font-mono" style={{
                                            color: line.startsWith('✓') ? '#22c55e' : line.startsWith('✗') ? '#f87171' : textMuted
                                        }}>
                                            {line}
                                        </p>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div
                        className="px-6 py-4 flex-shrink-0 space-y-3"
                        style={{ borderTop: `1px solid ${border}` }}
                    >
                        {/* Space freed indicator */}
                        {checked.size > 0 && spaceLabel && (
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-between px-3 py-2 rounded-xl"
                                style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}
                            >
                                <span className="text-xs" style={{ color: '#f87171' }}>
                                    {checked.size} model{checked.size !== 1 ? 's' : ''} selected
                                </span>
                                <span className="text-xs font-mono font-medium" style={{ color: '#22c55e' }}>
                                    +{spaceLabel} freed
                                </span>
                            </motion.div>
                        )}

                        <button
                            onClick={handleDelete}
                            disabled={checked.size === 0 || isDeleting}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
                            style={{
                                backgroundColor: checked.size > 0 && !isDeleting ? 'rgba(239,68,68,0.85)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                color: checked.size > 0 && !isDeleting ? 'white' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                                boxShadow: checked.size > 0 && !isDeleting ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
                                cursor: checked.size === 0 || isDeleting ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {isDeleting ? (
                                <>
                                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                                    </svg>
                                    Deleting…
                                </>
                            ) : (
                                <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                        <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                    </svg>
                                    Delete {checked.size > 0 ? `${checked.size} Selected Model${checked.size !== 1 ? 's' : ''}` : 'Selected Models'}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
