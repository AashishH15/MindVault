import { invoke } from "@tauri-apps/api/core";
import type {
  Node,
  NodeCreateInput,
  NodeUpdateInput,
  Vault,
  VaultCreateInput,
} from "./types/generated";

export type IpcResult<T> = { ok: T } | { err: string };
export type { Node, NodeCreateInput, NodeUpdateInput, Vault, VaultCreateInput };

async function invokeTyped<T>(
  command: string,
  payload?: Record<string, unknown>
): Promise<IpcResult<T>> {
  try {
    return await invoke<IpcResult<T>>(command, payload);
  } catch (error) {
    return { err: String(error) };
  }
}

export function greet(name: string) {
  return invokeTyped<string>("greet", { name });
}

export function dbPing() {
  return invokeTyped<string>("db_ping");
}

export function vaultCreate(input: VaultCreateInput) {
  return invokeTyped<Vault>("vault_create", { input });
}

export function vaultList() {
  return invokeTyped<Vault[]>("vault_list");
}

export function vaultDelete(vaultId: string) {
  return invokeTyped<boolean>("vault_delete", { vaultId });
}

export function nodeCreate(input: NodeCreateInput) {
  return invokeTyped<Node>("node_create", { input });
}

export function nodeGet(nodeId: string) {
  return invokeTyped<Node | null>("node_get", { nodeId });
}

export function nodeList() {
  return invokeTyped<Node[]>("node_list");
}

export function nodeUpdate(input: NodeUpdateInput) {
  return invokeTyped<Node>("node_update", { input });
}

export function nodeDelete(nodeId: string) {
  return invokeTyped<boolean>("node_delete", { nodeId });
}
