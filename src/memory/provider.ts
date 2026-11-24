export type MemoryEntry = {
  id: string; title: string; content: string; type: string; subjectKey?: string;
};
export type MemorySession = { id: string; entries: MemoryEntry[] };
export type MemoryDraft = {
  type: 'decision' | 'discovery' | 'pattern' | 'preference' | 'summary';
  title: string; content: string; subjectKey: string;
};

/** Bound to one explicitly configured project. No transport or storage details. */
export interface MemoryProvider {
  check(): Promise<void>;
  list(): Promise<MemoryEntry[]>;
  search(query: string): Promise<MemoryEntry[]>;
  get(id: string): Promise<MemoryEntry>;
  start(): Promise<MemorySession>;
  save(sessionId: string, draft: MemoryDraft): Promise<string>;
  finish(sessionId: string, summary?: string): Promise<void>;
  close(): Promise<void>;
}
