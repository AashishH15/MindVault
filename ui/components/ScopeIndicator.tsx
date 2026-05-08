import { useEffect, useState } from "react";
import { debugBuildContext } from "../services/nodes";
import { AppError } from "../services/ipcResult";

type ScopeIndicatorProps = {
  selectedNodeIds: string[];
  scope: string;
};

function ScopeIndicator({ selectedNodeIds, scope }: ScopeIndicatorProps) {
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const context = await debugBuildContext(selectedNodeIds, scope);
        if (!active) {
          return;
        }
        setTokenEstimate(Math.floor(context.length / 4));
        setStatus("");
      } catch (err) {
        if (!active) {
          return;
        }
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

  const maxTokens = 8000;
  const overBudget = tokenEstimate > maxTokens;
  const scopeLabel = scope ? scope[0].toUpperCase() + scope.slice(1) : "Local";

  return (
    <section className="scope-indicator">
      <div className="scope-indicator-row">
        <span>Scope: {scopeLabel}</span>
        <span>Nodes in Context: {selectedNodeIds.length}</span>
        <span>
          Estimated Tokens: {tokenEstimate} / {maxTokens}
        </span>
      </div>
      <progress
        className={`scope-indicator-track ${overBudget ? "danger" : ""}`}
        value={Math.min(tokenEstimate, maxTokens)}
        max={maxTokens}
      />
      {status && <p className="scope-indicator-status">{status}</p>}
    </section>
  );
}

export default ScopeIndicator;
