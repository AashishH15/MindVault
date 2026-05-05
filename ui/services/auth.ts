import { authIsSetup, authSetPassword, authVerifyPassword } from "../ipc";
import { AppError } from "./ipcResult";

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: AppError };

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new AppError(String(error));
}

export async function isAuthSetup(): Promise<ServiceResult<boolean>> {
  const result = await authIsSetup();
  if ("ok" in result) {
    return { data: result.ok, error: null };
  }
  return { data: null, error: toAppError(result.err) };
}

export async function setMasterPassword(password: string): Promise<ServiceResult<boolean>> {
  const result = await authSetPassword(password);
  if ("ok" in result) {
    return { data: result.ok, error: null };
  }
  return { data: null, error: toAppError(result.err) };
}

export async function verifyMasterPassword(password: string): Promise<ServiceResult<boolean>> {
  const result = await authVerifyPassword(password);
  if ("ok" in result) {
    return { data: result.ok, error: null };
  }
  return { data: null, error: toAppError(result.err) };
}
