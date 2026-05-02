import type { IpcResult } from "../ipc";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export async function unwrapIpcResult<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if ("ok" in result) {
    return result.ok;
  }
  throw new AppError(result.err);
}
