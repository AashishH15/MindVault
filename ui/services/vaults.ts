import {
  vaultCreate,
  vaultDelete,
  vaultList,
  type Node,
  type Vault,
  type VaultCreateInput,
} from "../ipc";
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

function getParentVaultId(vault: Vault): string | null {
  const parentFromCamel = vault.parentVaultId ?? null;
  const parentFromSnake =
    (vault as unknown as { parent_vault_id?: string | null }).parent_vault_id ?? null;
  return parentFromCamel ?? parentFromSnake;
}

export function resolveVaultPath(node: Node, allVaults: Vault[]): string {
  const vaultById = new Map<string, Vault>();
  for (const vault of allVaults) {
    vaultById.set(vault.id, vault);
  }

  if (node.subVaultId) {
    const parentVault = vaultById.get(node.vaultId);
    const childVault = vaultById.get(node.subVaultId);
    if (parentVault && childVault) {
      return `${parentVault.name} / ${childVault.name}`;
    }
    if (childVault) {
      return childVault.name;
    }
    if (parentVault) {
      return parentVault.name;
    }
    return "Unknown Vault";
  }

  const topLevelVault = vaultById.get(node.vaultId);
  if (!topLevelVault) {
    return "Unknown Vault";
  }

  const parentVaultId = getParentVaultId(topLevelVault);
  if (!parentVaultId) {
    return topLevelVault.name;
  }

  const parentVault = vaultById.get(parentVaultId);
  return parentVault ? `${parentVault.name} / ${topLevelVault.name}` : topLevelVault.name;
}
