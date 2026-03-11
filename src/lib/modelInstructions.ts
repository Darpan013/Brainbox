// ─── Model-Specific System Instructions Persistence ────────────────────────
// Stores a map of { modelName: string[] } in localStorage.
// Each array entry becomes a `role: 'system'` message prepended to every
// Ollama chat call for that model.

const LS_KEY = 'brainbox:modelInstructions';

type InstructionMap = Record<string, string[]>;

function load(): InstructionMap {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as InstructionMap;
    } catch {
        return {};
    }
}

function save(map: InstructionMap): void {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
}

/** Returns the list of instructions for a given model (empty array if none). */
export function getInstructions(model: string): string[] {
    return load()[model] ?? [];
}

/** Replaces (or sets) the full instruction list for a model. */
export function setInstructions(model: string, instructions: string[]): void {
    const map = load();
    if (instructions.length === 0) {
        delete map[model];
    } else {
        map[model] = instructions;
    }
    save(map);
}

/** Removes all instructions for a single model. */
export function deleteModelInstructions(model: string): void {
    const map = load();
    delete map[model];
    save(map);
}

/**
 * Removes instructions for any model that is no longer installed.
 * Call this after refreshing the installed model list.
 */
export function cleanupStaleInstructions(currentModels: string[]): void {
    const map = load();
    const currentSet = new Set(currentModels);
    let changed = false;
    for (const key of Object.keys(map)) {
        if (!currentSet.has(key)) {
            delete map[key];
            changed = true;
        }
    }
    if (changed) save(map);
}

/** Returns the full map (for rendering the model list in Settings). */
export function getAllInstructions(): InstructionMap {
    return load();
}
