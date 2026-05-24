import { memoryExtract, memoryExtractIfReady, type Changeset } from "../ipc";
import { unwrapIpcResult } from "./ipcResult";

/**
 * Extracts proposed memory changesets from the current chat history.
 */
export async function extractMemory(
  provider: string,
  endpoint: string,
  model: string
): Promise<Changeset> {
  return unwrapIpcResult(memoryExtract(provider, endpoint, model));
}

/**
 * Checks triggers and extracts proposed memory changesets if ready (messages >= 6 and debounce passed).
 */
export async function extractMemoryIfReady(
  provider: string,
  endpoint: string,
  model: string
): Promise<Changeset | null> {
  return unwrapIpcResult(memoryExtractIfReady(provider, endpoint, model));
}

// Expose temporary debug helpers on window for manual console testing
if (typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.testMemoryExtract = (provider?: string, endpoint?: string, model?: string) => {
    const p = provider || "ollama";
    const e = endpoint || "http://localhost:11434";
    const m = model || "granite4.1:3b";
    return extractMemory(p, e, m).then(console.log).catch(console.error);
  };
  w.testMemoryExtractIfReady = (provider?: string, endpoint?: string, model?: string) => {
    const p = provider || "ollama";
    const e = endpoint || "http://localhost:11434";
    const m = model || "granite4.1:3b";
    return extractMemoryIfReady(p, e, m).then(console.log).catch(console.error);
  };
}
