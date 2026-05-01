import type { IpcResult } from "../ipc";

export async function unwrapIpcResult<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if ("ok" in result) {
    return result.ok;
  }
  throw new Error(result.err);
}
