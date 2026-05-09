import {
  chatAppendMessage as ipcChatAppendMessage,
  chatClearHistory as ipcChatClearHistory,
  chatGetHistory as ipcChatGetHistory,
  type ChatMessage,
} from "../ipc";
import { unwrapIpcResult } from "./ipcResult";

export type { ChatMessage };

export async function getChatHistory(): Promise<ChatMessage[]> {
  return unwrapIpcResult(ipcChatGetHistory());
}

export async function chatAppendMessage(id: string, role: string, content: string): Promise<void> {
  return unwrapIpcResult(ipcChatAppendMessage(id, role, content));
}

export async function clearChatHistory(): Promise<void> {
  return unwrapIpcResult(ipcChatClearHistory());
}
