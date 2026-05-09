import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { ContextAssemblerScope } from "../constants/contextBudget";
import {
  chatAppendMessage,
  clearChatHistory,
  getChatHistory,
  type ChatMessage,
} from "../services/chat";
import { chatWithScope } from "../services/nodes";
import {
  getLlmModel,
  getLlmProvider,
  getLmStudioEndpoint,
  getOllamaEndpoint,
} from "../utils/settings";

type ChatPanelProps = {
  selectedNodeIds: string[];
  scope: ContextAssemblerScope;
};

function ChatPanel({ selectedNodeIds, scope }: ChatPanelProps) {
  const MAX_RENDERED_MESSAGES = 120;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const history = await getChatHistory();
        if (!active) {
          return;
        }
        setMessages(history);
        setStatus("");
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus(String(error));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending && !isClearing,
    [input, isSending, isClearing]
  );
  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_RENDERED_MESSAGES) {
      return messages;
    }
    return messages.slice(-MAX_RENDERED_MESSAGES);
  }, [messages]);
  const hiddenMessageCount = Math.max(0, messages.length - visibleMessages.length);

  async function handleSend() {
    if (!canSend) {
      return;
    }

    const prompt = input.trim();
    setInput("");
    setStatus("");
    setIsSending(true);

    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: prompt,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const persistUserMessage = chatAppendMessage(userMsgId, "user", prompt);

      const provider = getLlmProvider();
      const endpoint = provider === "lmstudio" ? getLmStudioEndpoint() : getOllamaEndpoint();
      const model = getLlmModel();

      const aiResponse = await chatWithScope(
        selectedNodeIds,
        scope,
        provider,
        endpoint,
        model,
        prompt
      );
      await persistUserMessage;

      const aiMsgId = crypto.randomUUID();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        content: aiResponse,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      await chatAppendMessage(aiMsgId, "assistant", aiResponse);
    } catch (error) {
      setStatus(String(error));
    } finally {
      setIsSending(false);
    }
  }

  async function handleClearChat() {
    if (isSending || isClearing || messages.length === 0) {
      return;
    }
    const shouldClear = window.confirm("Clear all messages from this chat?");
    if (!shouldClear) {
      return;
    }

    setIsClearing(true);
    setStatus("");
    try {
      await clearChatHistory();
      setMessages([]);
      setStatus("Chat cleared.");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setIsClearing(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <h2>MindVault</h2>
          <p>Unified memory chat</p>
        </div>
        <button
          type="button"
          className="chat-clear-btn"
          onClick={() => void handleClearChat()}
          disabled={isSending || isClearing || messages.length === 0}
        >
          {isClearing ? "Clearing..." : "Clear Chat"}
        </button>
      </header>
      <div className="chat-thread">
        {hiddenMessageCount > 0 ? (
          <p className="chat-history-trim-note">
            Showing latest {visibleMessages.length} messages ({hiddenMessageCount} older hidden for
            speed).
          </p>
        ) : null}
        {visibleMessages.map((message) => (
          <article key={message.id} className={`chat-message chat-message-${message.role}`}>
            <header>{message.role}</header>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <div className="chat-input-container">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask MindVault..."
          disabled={isSending || isClearing}
        />
        <button type="button" onClick={() => void handleSend()} disabled={!canSend}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
      {status && <p className="chat-status">{status}</p>}
    </section>
  );
}

export default ChatPanel;
