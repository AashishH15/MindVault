import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { ContextAssemblerScope } from "../constants/contextBudget";
import type { Vault } from "../ipc";
import {
  chatAppendMessage,
  clearChatHistory,
  getChatHistory,
  type ChatMessage,
} from "../services/chat";
import { chatWithScope } from "../services/nodes";
import { getSetting } from "../services/settings";
import { listVaults } from "../services/vaults";
import {
  getLlmModel,
  getLlmProvider,
  getLmStudioEndpoint,
  getOllamaEndpoint,
  getLlmMode,
  setLlmMode,
  getApiKey,
} from "../utils/settings";

type ChatPanelProps = {
  selectedNodeIds: string[];
  scope: ContextAssemblerScope;
  selectedVaultId: string | null;
  onSelectVault: (vaultId: string | null) => void;
  onOpenSettings?: () => void;
};

function ChatPanel({
  selectedNodeIds,
  scope,
  selectedVaultId,
  onSelectVault,
  onOpenSettings,
}: ChatPanelProps) {
  const MAX_RENDERED_MESSAGES = 120;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState("");

  const [userName, setUserName] = useState("Lisa");
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [agentMode, setAgentMode] = useState<"Recall/Chat" | "Ingest/Memory" | "Onboarding">(
    "Recall/Chat"
  );
  const [currentProvider, setCurrentProvider] = useState(() => getLlmProvider());
  const [currentModel, setCurrentModel] = useState(() => getLlmModel());
  const [currentMode, setCurrentMode] = useState(() => getLlmMode());
  const [activeDropdown, setActiveDropdown] = useState<"vault" | "mode" | "model" | null>(null);

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }, []);

  const selectedVaultName = useMemo(() => {
    if (!selectedVaultId) return "Root Graph";
    const match = vaults.find((v) => v.id === selectedVaultId);
    return match ? match.name : "Root Graph";
  }, [selectedVaultId, vaults]);

  const activeModelDisplay = useMemo(() => {
    const isCloud = ["openai", "anthropic", "google", "xai"].includes(currentProvider);
    if (isCloud) {
      let niceName = currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1);
      if (currentProvider === "openai") niceName = "OpenAI";
      if (currentProvider === "anthropic") niceName = "Anthropic";
      if (currentProvider === "google") niceName = "Google Gemini";
      if (currentProvider === "xai") niceName = "xAI Grok";
      return `Cloud: ${currentModel || "Model"} (${niceName})`;
    }
    const niceName = currentProvider === "ollama" ? "Ollama" : "LM Studio";
    return `Local: ${currentModel || "Model"} (${niceName})`;
  }, [currentProvider, currentModel]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const name = await getSetting("displayName");
        if (active && name && name.trim()) {
          setUserName(name.trim());
        }
      } catch (e) {
        console.error("Failed to load user name:", e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleSettingsChange() {
      setCurrentProvider(getLlmProvider());
      setCurrentModel(getLlmModel());
      setCurrentMode(getLlmMode());
    }
    window.addEventListener("mindvault:llm-settings-changed", handleSettingsChange);
    return () => {
      window.removeEventListener("mindvault:llm-settings-changed", handleSettingsChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await listVaults();
        if (active) {
          setVaults(data);
        }
      } catch (e) {
        console.error("Failed to load vaults:", e);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedVaultId]);

  useEffect(() => {
    if (!activeDropdown) return;
    function handleGlobalClick() {
      setActiveDropdown(null);
    }
    const timer = setTimeout(() => {
      window.addEventListener("click", handleGlobalClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [activeDropdown]);

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

    const rawPrompt = input.trim();
    setInput("");
    setStatus("");
    setIsSending(true);

    const userMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: rawPrompt,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const persistUserMessage = chatAppendMessage(userMsgId, "user", rawPrompt);

      const provider = getLlmProvider();
      let endpoint = "";
      if (provider === "lmstudio") {
        endpoint = getLmStudioEndpoint();
      } else if (provider === "ollama") {
        endpoint = getOllamaEndpoint();
      } else if (["openai", "anthropic", "google", "xai"].includes(provider)) {
        endpoint = getApiKey(provider);
      }
      const model = getLlmModel();

      let executionPrompt = rawPrompt;
      if (agentMode === "Ingest/Memory") {
        executionPrompt = `[Agent Mode: Ingest/Memory] Please extract, deduplicate, and store the following input as a new Node in the memory system. Do not generate a long conversational response, just confirm storage details or output a brief success summary:\n\n${rawPrompt}`;
      } else if (agentMode === "Onboarding") {
        executionPrompt = `[Agent Mode: Onboarding] Act as the Onboarding Agent. Conduct an interview and ask clarifying questions to help build initial context for the user:\n\n${rawPrompt}`;
      }

      const aiResponse = await chatWithScope(
        selectedNodeIds,
        scope,
        provider,
        endpoint,
        model,
        executionPrompt
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

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function toggleDropdown(type: "vault" | "mode" | "model") {
    setActiveDropdown((prev) => (prev === type ? null : type));
  }

  function handleSelectVault(vaultId: string | null) {
    onSelectVault(vaultId);
    setActiveDropdown(null);
  }

  function handleSelectMode(mode: "Recall/Chat" | "Ingest/Memory" | "Onboarding") {
    setAgentMode(mode);
    setActiveDropdown(null);
  }

  function handleSelectModeSettings(mode: "local" | "cloud" | "hybrid") {
    setLlmMode(mode);
    setCurrentMode(mode);
    setActiveDropdown(null);
    if (onOpenSettings) {
      onOpenSettings();
    }
  }

  if (messages.length === 0) {
    return (
      <section className="chat-panel zen-dashboard">
        <div className="zen-container">
          <h1 className="zen-greeting">
            Good {timeOfDay}, <span className="zen-username">{userName}</span>
          </h1>
          <div className="zen-search-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask MindVault..."
              className="zen-search-input"
              autoFocus
              disabled={isSending || isClearing}
            />
            <button
              type="button"
              className="zen-search-submit"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isSending || isClearing}
              aria-label="Send query"
            >
              ➔
            </button>
          </div>

          <div className="zen-pills-row">
            {/* Pill 1: Active Vault */}
            <div className="zen-pill-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`zen-pill ${activeDropdown === "vault" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown("vault");
                }}
              >
                <span className="zen-pill-icon">📁</span>
                <span className="zen-pill-label">Vault:</span>
                <span className="zen-pill-value">{selectedVaultName}</span>
                <span className="zen-pill-chevron">▾</span>
              </button>
              {activeDropdown === "vault" && (
                <div className="zen-dropdown">
                  <div className="zen-dropdown-header">Select Scoped Memory Domain</div>
                  <button
                    type="button"
                    className={`zen-dropdown-item ${!selectedVaultId ? "selected" : ""}`}
                    onClick={() => handleSelectVault(null)}
                  >
                    <span className="item-icon">🌐</span>
                    <span className="item-text">Root Graph (Global Context)</span>
                  </button>
                  {vaults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`zen-dropdown-item ${selectedVaultId === v.id ? "selected" : ""}`}
                      onClick={() => handleSelectVault(v.id)}
                    >
                      <span className="item-icon">📁</span>
                      <span className="item-text">{v.name}</span>
                      <span className="item-badge">{v.privacyTier.replace("_", " ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pill 2: Agent Mode */}
            <div className="zen-pill-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`zen-pill ${activeDropdown === "mode" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown("mode");
                }}
              >
                <span className="zen-pill-icon">✦</span>
                <span className="zen-pill-label">Mode:</span>
                <span className="zen-pill-value">{agentMode}</span>
                <span className="zen-pill-chevron">▾</span>
              </button>
              {activeDropdown === "mode" && (
                <div className="zen-dropdown animate-fade-in">
                  <div className="zen-dropdown-header">Select Intent / Execution State</div>
                  <button
                    type="button"
                    className={`zen-dropdown-item ${agentMode === "Recall/Chat" ? "selected" : ""}`}
                    onClick={() => handleSelectMode("Recall/Chat")}
                  >
                    <span className="item-icon">💬</span>
                    <div className="item-details">
                      <div className="item-title">Recall/Chat</div>
                      <div className="item-desc">
                        MACRL routing to fetch relevant Nodes & converse
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`zen-dropdown-item ${agentMode === "Ingest/Memory" ? "selected" : ""}`}
                    onClick={() => handleSelectMode("Ingest/Memory")}
                  >
                    <span className="item-icon">📥</span>
                    <div className="item-details">
                      <div className="item-title">Ingest/Memory</div>
                      <div className="item-desc">
                        Extract, deduplicate, and store input as new Node
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`zen-dropdown-item ${agentMode === "Onboarding" ? "selected" : ""}`}
                    onClick={() => handleSelectMode("Onboarding")}
                  >
                    <span className="item-icon">🎓</span>
                    <div className="item-details">
                      <div className="item-title">Onboarding</div>
                      <div className="item-desc">
                        Trigger Onboarding Agent interview for context
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Pill 3: Model */}
            <div className="zen-pill-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`zen-pill ${activeDropdown === "model" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown("model");
                }}
              >
                <span className="zen-pill-icon">⚙</span>
                <span className="zen-pill-label">Model:</span>
                <span className="zen-pill-value">{activeModelDisplay}</span>
                <span className="zen-pill-chevron">▾</span>
              </button>
              {activeDropdown === "model" && (
                <div className="zen-dropdown models-dropdown">
                  <div className="zen-dropdown-header">Select Model Environment</div>

                  <button
                    type="button"
                    className={`zen-dropdown-item ${currentMode === "local" ? "selected" : ""}`}
                    onClick={() => handleSelectModeSettings("local")}
                  >
                    <span className="item-icon">💻</span>
                    <div className="item-details">
                      <div className="item-title">Local Models</div>
                      <div className="item-desc">
                        Secure, offline models via Ollama or LM Studio
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`zen-dropdown-item ${currentMode === "cloud" ? "selected" : ""}`}
                    onClick={() => handleSelectModeSettings("cloud")}
                  >
                    <span className="item-icon">☁️</span>
                    <div className="item-details">
                      <div className="item-title">Cloud Models</div>
                      <div className="item-desc">
                        High-performance AI via OpenAI, Anthropic, Google, xAI
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`zen-dropdown-item ${currentMode === "hybrid" ? "selected" : ""}`}
                    onClick={() => handleSelectModeSettings("hybrid")}
                  >
                    <span className="item-icon">⚡</span>
                    <div className="item-details">
                      <div className="item-title">Hybrid Mode</div>
                      <div className="item-desc">
                        Run both Cloud and Local models simultaneously
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
          {status && <p className="chat-status">{status}</p>}
        </div>
      </section>
    );
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
