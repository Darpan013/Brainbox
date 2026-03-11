import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Ollama } from 'ollama/browser';
import { MODEL_REGISTRY } from '../data/modelRegistry';
import {
    setInstructions,
    getAllInstructions,
} from '../lib/modelInstructions';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

// ─── Storage size helper (mirrors ManageModelsModal) ─────────────────────────

function getStorageSize(modelId: string): string {
    const entry = MODEL_REGISTRY.find(m => m.id === modelId);
    return entry?.storage ?? '—';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsModalProps {
    theme: 'dark' | 'light';
    onClose: () => void;
    onRefreshModels: () => void;
    installedModels: string[];
    selectedModel: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsModal({
    theme,
    onClose,
    onRefreshModels,
    installedModels,
    selectedModel,
}: SettingsModalProps) {
    const isDark = theme === 'dark';

    // ── Colour tokens ─────────────────────────────────────────────────────────
    const surface = isDark ? '#18181b' : '#ffffff';
    const surface2 = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const textPrimary = isDark ? '#e5e5e5' : '#1a1a1a';
    const textMuted = isDark ? '#737373' : '#6b7280';

    // ── Manage Storage state ──────────────────────────────────────────────────
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteLog, setDeleteLog] = useState<string[]>([]);

    const allSelected = installedModels.length > 0 && checked.size === installedModels.length;
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
        ? totalSpace >= 1 ? `${totalSpace.toFixed(1)} GB` : `${Math.round(totalSpace * 1024)} MB`
        : null;

    const handleDeleteModels = async () => {
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
        await new Promise(r => setTimeout(r, 600));
        setChecked(new Set());
        setIsDeleting(false);
        onRefreshModels();
    };

    // ── Instructions state ────────────────────────────────────────────────────
    // allInstructions is kept in component state so edits are instantly reflected
    const [allInstructions, setAllInstructions] = useState<Record<string, string[]>>(getAllInstructions);
    // activeModel = which model's instruction editor is open (null = list view)
    const [activeModel, setActiveModel] = useState<string | null>(null);
    const [newInstr, setNewInstr] = useState('');
    const instrInputRef = useRef<HTMLInputElement>(null);

    const openEditor = (model: string) => {
        setActiveModel(model);
        setNewInstr('');
        setTimeout(() => instrInputRef.current?.focus(), 150);
    };

    const saveAndSync = (model: string, next: string[]) => {
        setInstructions(model, next);
        setAllInstructions(prev => {
            if (next.length === 0) {
                const copy = { ...prev };
                delete copy[model];
                return copy;
            }
            return { ...prev, [model]: next };
        });
    };

    const addInstruction = () => {
        if (!activeModel || !newInstr.trim()) return;
        const current = allInstructions[activeModel] ?? [];
        saveAndSync(activeModel, [...current, newInstr.trim()]);
        setNewInstr('');
        instrInputRef.current?.focus();
    };

    const deleteInstruction = (model: string, idx: number) => {
        const current = allInstructions[model] ?? [];
        saveAndSync(model, current.filter((_, i) => i !== idx));
    };

    // ── Danger Zone state ─────────────────────────────────────────────────────
    const [confirm, setConfirm] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [done, setDone] = useState(false);
    const [clearError, setClearError] = useState<string | null>(null);

    const handleClear = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 4000); return; }
        setClearing(true);
        try {
            await invoke('clear_app_data');
            await onRefreshModels();
            setDone(true);
            setTimeout(onClose, 1200);
        } catch (e: any) {
            setClearError(e?.message ?? 'Failed to clear data.');
        } finally {
            setClearing(false);
        }
    };

    // ── Section divider ───────────────────────────────────────────────────────
    const Divider = () => (
        <div style={{ height: '1px', backgroundColor: border, margin: '0.75rem 0' }} />
    );

    // ── Instruction editor sub-view ───────────────────────────────────────────
    const instructions = activeModel ? (allInstructions[activeModel] ?? []) : [];

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                className="fixed inset-0 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 60 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={!isDeleting ? onClose : undefined}
            >
                <motion.div
                    className="relative flex flex-col overflow-hidden"
                    style={{
                        backgroundColor: surface,
                        border: `1px solid ${border}`,
                        borderRadius: '1.25rem',
                        boxShadow: isDark ? '0 32px 80px rgba(0,0,0,0.85)' : '0 24px 64px rgba(0,0,0,0.15)',
                        width: '520px',
                        maxHeight: '82vh',
                    }}
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* ── Header ───────────────────────────────────────────── */}
                    <div
                        className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
                        style={{ borderBottom: `1px solid ${border}` }}
                    >
                        <div className="flex items-center gap-2">
                            {activeModel && (
                                <button
                                    onClick={() => setActiveModel(null)}
                                    className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors cursor-pointer"
                                    style={{ color: textMuted }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    title="Back"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>
                                    {activeModel ? 'Instructions' : 'Settings'}
                                </h2>
                                {activeModel && (
                                    <p className="text-xs mt-0.5 font-mono" style={{ color: textMuted }}>{activeModel}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Select All toggle — only in storage list view */}
                            {!activeModel && installedModels.length > 0 && !isDeleting && (
                                <button
                                    onClick={() => allSelected ? setChecked(new Set()) : setChecked(new Set(installedModels))}
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
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Scrollable body ───────────────────────────────────── */}
                    <div
                        className="flex-1 overflow-y-auto px-6 py-5 space-y-0"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(255,255,255,0.07) transparent' : 'rgba(0,0,0,0.07) transparent' }}
                    >
                        <AnimatePresence mode="wait">
                            {activeModel ? (
                                /* ── INSTRUCTION EDITOR VIEW ───────────────── */
                                <motion.div
                                    key="editor"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.18 }}
                                    className="space-y-3"
                                >
                                    <p className="text-xs" style={{ color: textMuted }}>
                                        These instructions are sent as <span style={{ color: isDark ? '#a78bfa' : '#7c3aed', fontFamily: 'monospace' }}>system</span> messages at the start of every conversation with this model.
                                    </p>

                                    {/* Existing instructions */}
                                    {instructions.length === 0 ? (
                                        <div
                                            className="flex items-center justify-center py-8 rounded-xl"
                                            style={{ backgroundColor: surface2, border: `1px dashed ${border}` }}
                                        >
                                            <p className="text-xs" style={{ color: textMuted }}>No instructions yet. Add one below.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {instructions.map((instr, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    layout
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                                                    style={{ backgroundColor: surface2, border: `1px solid ${border}` }}
                                                >
                                                    <span
                                                        className="flex-shrink-0 text-xs font-mono font-semibold mt-0.5 w-5 h-5 rounded-md flex items-center justify-center"
                                                        style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.1)', color: isDark ? '#a78bfa' : '#7c3aed' }}
                                                    >
                                                        {idx + 1}
                                                    </span>
                                                    <p className="flex-1 text-xs leading-relaxed" style={{ color: textPrimary }}>{instr}</p>
                                                    <button
                                                        onClick={() => deleteInstruction(activeModel, idx)}
                                                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer mt-0.5"
                                                        style={{ color: textMuted }}
                                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = textMuted; }}
                                                        title={`Delete #${idx + 1}`}
                                                    >
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                                                        </svg>
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add new instruction */}
                                    <div
                                        className="flex gap-2 p-3 rounded-xl"
                                        style={{ backgroundColor: surface2, border: `1px solid ${border}` }}
                                    >
                                        <input
                                            ref={instrInputRef}
                                            value={newInstr}
                                            onChange={e => setNewInstr(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addInstruction(); } }}
                                            placeholder="Add a system instruction…"
                                            className="flex-1 bg-transparent focus:outline-none text-xs"
                                            style={{ color: textPrimary }}
                                        />
                                        <button
                                            onClick={addInstruction}
                                            disabled={!newInstr.trim()}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0"
                                            style={{
                                                backgroundColor: newInstr.trim() ? 'rgba(139,92,246,0.2)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                                                border: `1px solid ${newInstr.trim() ? 'rgba(139,92,246,0.35)' : border}`,
                                                color: newInstr.trim() ? (isDark ? '#a78bfa' : '#7c3aed') : textMuted,
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                /* ── MAIN SETTINGS VIEW ────────────────────── */
                                <motion.div
                                    key="main"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.18 }}
                                    className="space-y-5"
                                >
                                    {/* ── SECTION 1: Manage Storage ─────────── */}
                                    <section>
                                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' }}>
                                            Manage Storage
                                        </p>

                                        {installedModels.length === 0 ? (
                                            <div
                                                className="flex items-center justify-center py-6 rounded-xl"
                                                style={{ backgroundColor: surface2, border: `1px dashed ${border}` }}
                                            >
                                                <p className="text-xs" style={{ color: textMuted }}>No models installed yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {installedModels.map(id => {
                                                    const isChecked = checked.has(id);
                                                    const isActive = id === selectedModel;
                                                    return (
                                                        <div
                                                            key={id}
                                                            onClick={() => !isDeleting && setChecked(prev => {
                                                                const next = new Set(prev);
                                                                next.has(id) ? next.delete(id) : next.add(id);
                                                                return next;
                                                            })}
                                                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150"
                                                            style={{
                                                                backgroundColor: isChecked ? 'rgba(239,68,68,0.07)' : surface2,
                                                                border: `1px solid ${isChecked ? 'rgba(239,68,68,0.22)' : border}`,
                                                                cursor: isDeleting ? 'default' : 'pointer',
                                                            }}
                                                            onMouseEnter={e => { if (!isChecked && !isDeleting) e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'; }}
                                                            onMouseLeave={e => { if (!isChecked) e.currentTarget.style.borderColor = border; }}
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
                                                                    <span className="text-xs font-mono truncate" style={{ color: isChecked ? '#f87171' : textPrimary }}>{id}</span>
                                                                    {isActive && (
                                                                        <span className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                                                                            active
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs" style={{ color: isDark ? '#525252' : '#9ca3af' }}>
                                                                    {getStorageSize(id)} · {MODEL_REGISTRY.find(m => m.id === id)?.type ?? 'Unknown type'}
                                                                </p>
                                                            </div>
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
                                                            className="rounded-xl px-3 py-2 space-y-1 overflow-hidden"
                                                            style={{ backgroundColor: surface2, border: `1px solid ${border}` }}
                                                        >
                                                            {deleteLog.map((line, i) => (
                                                                <p key={i} className="text-xs font-mono" style={{
                                                                    color: line.startsWith('✓') ? '#22c55e' : line.startsWith('✗') ? '#f87171' : textMuted
                                                                }}>{line}</p>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Space indicator + delete button */}
                                        {checked.size > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {spaceLabel && (
                                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                                                        style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                                        <span className="text-xs" style={{ color: '#f87171' }}>{checked.size} model{checked.size !== 1 ? 's' : ''} selected</span>
                                                        <span className="text-xs font-mono font-medium" style={{ color: '#22c55e' }}>+{spaceLabel} freed</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={handleDeleteModels}
                                                    disabled={isDeleting}
                                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
                                                    style={{
                                                        backgroundColor: isDeleting ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'rgba(239,68,68,0.85)',
                                                        color: isDeleting ? textMuted : 'white',
                                                        boxShadow: isDeleting ? 'none' : '0 0 16px rgba(239,68,68,0.3)',
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
                                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                                            </svg>
                                                            Delete {checked.size} Selected Model{checked.size !== 1 ? 's' : ''}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </section>

                                    <Divider />

                                    {/* ── SECTION 2: Instructions for Models ── */}
                                    <section>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' }}>
                                                Instructions for Models
                                            </p>
                                            <span className="text-xs px-2 py-0.5 rounded-md font-mono" style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(124,58,237,0.08)', color: isDark ? '#a78bfa' : '#7c3aed', border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(124,58,237,0.15)'}` }}>
                                                system role
                                            </span>
                                        </div>

                                        {installedModels.length === 0 ? (
                                            <div
                                                className="flex items-center justify-center py-6 rounded-xl"
                                                style={{ backgroundColor: surface2, border: `1px dashed ${border}` }}
                                            >
                                                <p className="text-xs" style={{ color: textMuted }}>Install a model to add instructions.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {installedModels.map(model => {
                                                    const count = (allInstructions[model] ?? []).length;
                                                    return (
                                                        <button
                                                            key={model}
                                                            onClick={() => openEditor(model)}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer text-left"
                                                            style={{ backgroundColor: surface2, border: `1px solid ${border}` }}
                                                            onMouseEnter={e => e.currentTarget.style.borderColor = isDark ? 'rgba(139,92,246,0.3)' : 'rgba(124,58,237,0.25)'}
                                                            onMouseLeave={e => e.currentTarget.style.borderColor = border}
                                                        >
                                                            {/* Icon */}
                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(124,58,237,0.08)' }}>
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#a78bfa' : '#7c3aed'} strokeWidth="2" strokeLinecap="round">
                                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                                </svg>
                                                            </div>
                                                            {/* Name */}
                                                            <span className="flex-1 text-xs font-mono truncate" style={{ color: textPrimary }}>{model}</span>
                                                            {/* Instruction count badge */}
                                                            <span
                                                                className="text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
                                                                style={{
                                                                    backgroundColor: count > 0 ? (isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.1)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                                                    color: count > 0 ? (isDark ? '#a78bfa' : '#7c3aed') : textMuted,
                                                                }}
                                                            >
                                                                {count === 0 ? 'No instructions' : `${count} instruction${count !== 1 ? 's' : ''}`}
                                                            </span>
                                                            {/* Chevron */}
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                                                                <polyline points="9 18 15 12 9 6" />
                                                            </svg>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    <Divider />

                                    {/* ── SECTION 3: Danger Zone ─────────────── */}
                                    <section>
                                        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                            <p className="text-xs font-medium mb-1" style={{ color: '#f87171' }}>Danger Zone</p>
                                            <p className="text-xs mb-3" style={{ color: textMuted }}>
                                                Permanently deletes all downloaded models and app data. This cannot be undone.
                                            </p>
                                            {clearError && (
                                                <p className="text-xs mb-2 px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{clearError}</p>
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
                                    </section>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
