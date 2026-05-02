import { vaultCreate, vaultDelete, vaultList, type Vault, type VaultCreateInput } from "../ipc";
import { unwrapIpcResult } from "./ipcResult";

export async function createVault(input: VaultCreateInput): Promise<Vault> {
  return unwrapIpcResult(vaultCreate(input));
}

export async function listVaults(): Promise<Vault[]> {
  return unwrapIpcResult(vaultList());
}

export async function deleteVault(vaultId: string): Promise<boolean> {
  return unwrapIpcResult(vaultDelete(vaultId));
}
