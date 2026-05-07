import {
  decayOptimizeAll,
  decayRefreshAll,
  nodeCreate,
  nodeDelete,
  nodeGet,
  nodeList,
  nodeTouch,
  nodeUpdate,
  type Node,
  type NodeCreateInput,
  type NodeUpdateInput,
} from "../ipc";
import { unwrapIpcResult } from "./ipcResult";

export async function createNode(input: NodeCreateInput): Promise<Node> {
  return unwrapIpcResult(nodeCreate(input));
}

export async function getNode(nodeId: string): Promise<Node | null> {
  return unwrapIpcResult(nodeGet(nodeId));
}

export async function getNodes(): Promise<Node[]> {
  return unwrapIpcResult(nodeList());
}

export async function getAllNodes(): Promise<Node[]> {
  return getNodes();
}

export async function updateNode(input: NodeUpdateInput): Promise<Node> {
  return unwrapIpcResult(nodeUpdate(input));
}

export async function deleteNode(nodeId: string): Promise<boolean> {
  return unwrapIpcResult(nodeDelete(nodeId));
}

export async function touchNode(nodeId: string): Promise<boolean> {
  return unwrapIpcResult(nodeTouch(nodeId));
}

export async function refreshAllDecayScores(): Promise<number> {
  return unwrapIpcResult(decayRefreshAll());
}

export async function optimizeAllDecayRates(): Promise<number> {
  return unwrapIpcResult(decayOptimizeAll());
}
