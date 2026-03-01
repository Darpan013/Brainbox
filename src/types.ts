// ─── Shared Types ──────────────────────────────────────────────────────────

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isEphemeral?: boolean;   // true = removed from session after search completes
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;          // Date.now() for sorting
}
