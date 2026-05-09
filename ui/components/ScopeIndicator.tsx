import { useEffect, useState } from "react";
import { CONTEXT_MAX_TOKENS, type ContextAssemblerScope } from "../constants/contextBudget";
import { countTokens } from "../ipc";
import { debugBuildContext } from "../services/nodes";
import { AppError } from "../services/ipcResult";

type ScopeIndicatorProps = {
  selectedNodeIds: string[];
  scope: ContextAssemblerScope;
  onScopeChange: (scope: ContextAssemblerScope) => void;
};

function ScopeIndicator({ selectedNodeIds, scope, onScopeChange }: ScopeIndicatorProps) {
  const [contextString, setContextString] = useState("");
  const [tokenCount, setTokenCount] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const context = await debugBuildContext(selectedNodeIds, scope);
        if (!active) {
          return;
        }
        setContextString(context);
        setStatus("");
      } catch (err) {
        if (!active) {
          return;
        }
        setContextString("");
        setTokenCount(0);
        if (err instanceof AppError) {
          setStatus(err.message);
        } else {
          setStatus("Unable to estimate token usage.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [scope, selectedNodeIds]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!contextString) {
        if (active) {
          setTokenCount(0);
        }
        return;
      }
      try {
        const exactCount = await countTokens(contextString);
        if (active) {
          setTokenCount(exactCount);
        }
      } catch {
        if (active) {
          setTokenCount(0);
          setStatus("Unable to compute token count.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [contextString]);

  const maxTokens = CONTEXT_MAX_TOKENS;
  const overBudget = tokenCount > maxTokens;

  return (
    <section className="scope-indicator">
      <div className="scope-indicator-row scope-indicator-row-controls">
        <span className="scope-indicator-label">Assembler scope</span>
        <div
          className="scope-indicator-scope-toggle"
          role="group"
          aria-label="Assembler privacy scope"
        >
          <button
            type="button"
            className={`scope-scope-btn ${scope === "local" ? "active" : ""}`}
            onClick={() => onScopeChange("local")}
          >
            Local
          </button>
          <button
            type="button"
            className={`scope-scope-btn ${scope === "cloud" ? "active" : ""}`}
            onClick={() => onScopeChange("cloud")}
          >
            Cloud
          </button>
        </div>
      </div>
      <div className="scope-indicator-row">
        <span>Nodes in Context: {selectedNodeIds.length}</span>
        <span>
          Estimated Tokens: {tokenCount} / {maxTokens}
        </span>
      </div>
      <progress
        className={`scope-indicator-track ${overBudget ? "danger" : ""}`}
        value={Math.min(tokenCount, maxTokens)}
        max={maxTokens}
      />
      {status && <p className="scope-indicator-status">{status}</p>}
    </section>
  );
}

export default ScopeIndicator;
