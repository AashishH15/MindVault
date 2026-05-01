import {
  nodeCreate,
  nodeDelete,
  nodeGet,
  nodeList,
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

export async function updateNode(input: NodeUpdateInput): Promise<Node> {
  return unwrapIpcResult(nodeUpdate(input));
}

export async function deleteNode(nodeId: string): Promise<boolean> {
  return unwrapIpcResult(nodeDelete(nodeId));
}
