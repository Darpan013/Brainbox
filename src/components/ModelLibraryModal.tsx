import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ollama } from 'ollama/browser';
import { MODEL_REGISTRY, CATEGORY_META, type ModelEntry } from '../data/modelRegistry';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

interface ModelLibraryModalProps {
    installedModels: string[];
    theme: 'dark' | 'light';
    onClose: () => void;
    onInstalled: () => void;
}

type ModalStep = 'library' | 'warning' | 'downloading';

// ─── Sub-components ────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: ModelEntry['category'] }) {
    const meta = CATEGORY_META[category];
    return (
        <span
            className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{
                backgroundColor: `${meta.color}18`,
                color: meta.color,
                border: `1px solid ${meta.color}30`,
            }}
        >
            {meta.label}
        </span>
    );
}

function TypeBadge({ type, isDark }: { type: string; isDark: boolean }) {
    return (
        <span
            className="text-xs px-1.5 py-0.5 rounded-md"
            style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: isDark ? '#a3a3a3' : '#6b7280',
            }}
        >
            {type}
        </span>
    );
}

function SpecRow({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-xs" style={{ color: '#737373' }}>{label}</span>
            <span className="text-xs font-mono font-medium" style={{ color: color ?? '#e5e5e5' }}>{value}</span>
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ModelLibraryModal({
    installedModels,
    theme,
    onClose,
    onInstalled,
}: ModelLibraryModalProps) {
    const isDark = theme === 'dark';
    const [step, setStep] = useState<ModalStep>('library');
    const [selected, setSelected] = useState<ModelEntry | null>(null);
    const [pullPercent, setPullPercent] = useState(0);
    const [pullStatus, setPullStatus] = useState('');
    const [pullError, setPullError] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [activeCategory, setActiveCategory] = useState<ModelEntry['category'] | 'all'>('all');
    const pullStreamRef = useRef<{ abort: () => void } | null>(null);

    const available = MODEL_REGISTRY.filter(m => !installedModels.includes(m.id));
    const filtered = activeCategory === 'all' ? available : available.filter(m => m.category === activeCategory);
    const categories = (['all', ...Object.keys(CATEGORY_META)] as Array<ModelEntry['category'] | 'all'>).filter(
        c => c === 'all' || available.some(m => m.category === c)
    );

    // Styling helpers
    const surface = isDark ? '#18181b' : '#ffffff';
    const surface2 = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const textPrimary = isDark ? '#e5e5e5' : '#1a1a1a';
    const textMuted = isDark ? '#737373' : '#6b7280';


    const handleSelectModel = (model: ModelEntry) => {
        setSelected(model);
        setStep('warning');
    };

    const handleConfirmDownload = async () => {
        if (!selected) return;
        setStep('downloading');
        setPullPercent(0);
        setPullStatus('Connecting to Ollama registry…');
        setPullError(null);
        setIsCancelling(false);

        try {
            const stream = await ollama.pull({ model: selected.id, stream: true }) as AsyncIterable<any> & { abort: () => void };
            pullStreamRef.current = stream;
            for await (const part of stream) {
                if (!pullStreamRef.current) break; // cancelled
                const pct = part.total && part.completed
                    ? Math.round((part.completed / part.total) * 100)
                    : pullPercent;
                setPullPercent(pct);
                setPullStatus(part.status ?? 'Downloading…');
            }
            // Only commit if not cancelled
            if (pullStreamRef.current !== null) {
                setPullPercent(100);
                setPullStatus('Complete!');
                await new Promise(r => setTimeout(r, 900));
                onInstalled();
                onClose();
            }
        } catch (err: any) {
            if (!isCancelling) {
                setPullError(err?.message ?? 'Pull failed. Is Ollama running?');
            }
        } finally {
            pullStreamRef.current = null;
        }
    };

    const handleCancelDownload = () => {
        setIsCancelling(true);
        pullStreamRef.current?.abort();
        pullStreamRef.current = null;
        // Reset to warning step so user can retry
        setStep('warning');
        setPullPercent(0);
        setPullStatus('');
        setPullError(null);
    };

    const goBack = () => {
        setStep('library');
        setSelected(null);
        setPullError(null);
    };

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                className="fixed inset-0 flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', zIndex: 50 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={step !== 'downloading' ? onClose : undefined}
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
                        width: step === 'library' ? '680px' : '440px',
                        maxHeight: step === 'library' ? '82vh' : 'auto',
                    }}
                    initial={{ opacity: 0, scale: 0.93, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 16 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* ── STEP: Library ─────────────────────────────────────────── */}
                    <AnimatePresence mode="wait">
                        {step === 'library' && (
                            <motion.div
                                key="library"
                                className="flex flex-col overflow-hidden"
                                style={{ borderRadius: '1.25rem', maxHeight: '82vh' }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Header */}
                                <div
                                    className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0"
                                    style={{ borderBottom: `1px solid ${border}` }}
                                >
                                    <div>
                                        <h2 className="text-base font-semibold" style={{ color: textPrimary }}>
                                            Model Library
                                        </h2>
                                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                                            {available.length} models available to download
                                        </p>
                                    </div>
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
                                </div>

                                {/* Category tabs */}
                                <div className="flex gap-1.5 px-6 py-3 flex-shrink-0 overflow-x-auto">
                                    {categories.map(cat => {
                                        const isActive = activeCategory === cat;
                                        const meta = cat !== 'all' ? CATEGORY_META[cat] : null;
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setActiveCategory(cat)}
                                                className="px-3 py-1 rounded-full text-xs whitespace-nowrap cursor-pointer transition-all duration-150"
                                                style={{
                                                    backgroundColor: isActive
                                                        ? (meta ? `${meta.color}18` : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'))
                                                        : 'transparent',
                                                    border: `1px solid ${isActive ? (meta?.color ?? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')) + '40' : 'transparent'}`,
                                                    color: isActive ? (meta?.color ?? textPrimary) : textMuted,
                                                    fontWeight: isActive ? 500 : 400,
                                                }}
                                            >
                                                {cat === 'all' ? 'All Models' : CATEGORY_META[cat as ModelEntry['category']].label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Model list */}
                                <div
                                    className="flex-1 overflow-y-auto px-6 pb-6 space-y-2"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(255,255,255,0.07) transparent' : 'rgba(0,0,0,0.07) transparent' }}
                                >
                                    {filtered.length === 0 && (
                                        <p className="text-xs text-center py-8" style={{ color: textMuted }}>
                                            All models in this category are already installed.
                                        </p>
                                    )}
                                    {filtered.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleSelectModel(model)}
                                            className="w-full text-left px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-150 group"
                                            style={{
                                                backgroundColor: surface2,
                                                border: `1px solid ${border}`,
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = border;
                                                e.currentTarget.style.backgroundColor = surface2;
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="text-sm font-medium" style={{ color: textPrimary }}>
                                                            {model.name}
                                                        </span>
                                                        <CategoryBadge category={model.category} />
                                                        <TypeBadge type={model.type} isDark={isDark} />
                                                    </div>
                                                    <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                                                        {model.description}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                                    <span className="text-xs font-mono" style={{ color: isDark ? '#525252' : '#9ca3af' }}>
                                                        {model.storage}
                                                    </span>
                                                    <div
                                                        className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        style={{ backgroundColor: 'rgba(59,130,246,0.8)' }}
                                                    >
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Quick specs row */}
                                            <div className="flex gap-4 mt-2">
                                                {[
                                                    { label: 'VRAM', value: model.vram },
                                                    { label: 'RAM', value: model.ram },
                                                    { label: 'Params', value: model.params },
                                                ].map(spec => (
                                                    <div key={spec.label} className="flex items-center gap-1">
                                                        <span className="text-xs" style={{ color: isDark ? '#404040' : '#d1d5db' }}>{spec.label}</span>
                                                        <span className="text-xs font-mono" style={{ color: isDark ? '#737373' : '#6b7280' }}>{spec.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* ── STEP: Warning ──────────────────────────────────────── */}
                        {step === 'warning' && selected && (
                            <motion.div
                                key="warning"
                                className="px-6 py-6"
                                style={{ borderRadius: '1.25rem' }}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Warning icon + title */}
                                <div className="flex items-start gap-3 mb-5">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>
                                            System Requirements Warning
                                        </h2>
                                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                                            {selected.name} · {selected.params} parameters
                                        </p>
                                    </div>
                                </div>

                                {/* Spec table */}
                                <div
                                    className="rounded-xl px-4 py-1 mb-5"
                                    style={{ backgroundColor: surface2, border: `1px solid ${border}` }}
                                >
                                    <div style={{ borderBottom: `1px solid ${border}` }}>
                                        <SpecRow label="Required VRAM" value={selected.vram} color="#3b82f6" />
                                    </div>
                                    <div style={{ borderBottom: `1px solid ${border}` }}>
                                        <SpecRow label="Required RAM" value={selected.ram} color="#22c55e" />
                                    </div>
                                    <SpecRow label="Download Size" value={selected.storage} color="#f59e0b" />
                                </div>

                                <p className="text-xs mb-5 leading-relaxed" style={{ color: textMuted }}>
                                    Downloading a model that exceeds your hardware may cause system slowdowns or crashes.
                                    Make sure you have enough free disk space.
                                </p>

                                <div className="flex gap-2.5">
                                    <button
                                        onClick={goBack}
                                        className="flex-1 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all"
                                        style={{
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                            border: `1px solid ${border}`,
                                            color: textMuted,
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmDownload}
                                        className="flex-1 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-2"
                                        style={{
                                            backgroundColor: 'rgba(59,130,246,0.85)',
                                            color: 'white',
                                            boxShadow: '0 0 16px rgba(59,130,246,0.35)',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,1)')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.85)')}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download Anyways
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── STEP: Downloading ──────────────────────────────────── */}
                        {step === 'downloading' && selected && (
                            <motion.div
                                key="downloading"
                                className="px-6 py-6"
                                style={{ borderRadius: '1.25rem' }}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Gradient icon */}
                                <div className="flex flex-col items-center text-center mb-6">
                                    <div
                                        className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)' }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                    </div>
                                    <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>
                                        Downloading {selected.name}
                                    </h2>
                                    <p className="text-xs mt-1" style={{ color: textMuted }}>{selected.storage} · Do not close this window</p>
                                </div>

                                {/* Error */}
                                {pullError && (
                                    <div className="mb-4 px-3 py-2 rounded-xl text-xs" style={{
                                        backgroundColor: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.15)',
                                        color: '#f87171',
                                    }}>
                                        {pullError}
                                    </div>
                                )}

                                {/* Progress */}
                                <div className="space-y-2.5">
                                    <div className="flex justify-between text-xs">
                                        <span style={{ color: textMuted }} className="truncate max-w-[240px]">{pullStatus}</span>
                                        <span className="font-mono ml-2 flex-shrink-0" style={{ color: '#60a5fa' }}>{pullPercent}%</span>
                                    </div>
                                    <div
                                        className="w-full h-2 rounded-full overflow-hidden"
                                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}
                                    >
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{ background: 'linear-gradient(90deg, #3b82f6, #ec4899)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }}
                                            animate={{ width: `${pullPercent}%` }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                        />
                                    </div>

                                    {/* Animated segments */}
                                    <div className="flex gap-1 mt-1">
                                        {Array.from({ length: 20 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 h-0.5 rounded-full transition-all duration-300"
                                                style={{
                                                    backgroundColor: i < Math.floor(pullPercent / 5)
                                                        ? '#3b82f6'
                                                        : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                    {/* Cancel download */}
                                    <button
                                        onClick={handleCancelDownload}
                                        className="mt-4 w-full py-2 rounded-xl text-xs font-medium cursor-pointer transition-all"
                                        style={{
                                            backgroundColor: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            color: '#f87171',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.14)')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)')}
                                    >
                                        Cancel Download
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
