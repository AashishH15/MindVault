import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllNodes,
  optimizeAllDecayRates,
  refreshAllDecayScores,
  updateNode,
} from "../services/nodes";
import type { Node } from "../ipc";
import { AppError } from "../services/ipcResult";
import DecayBar from "./DecayBar";

function parseDecayJson(decay: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decay);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return {};
}

function getDecayScore(node: Node): number {
  const obj = parseDecayJson(node.decay);
  if (typeof obj.score === "number" && Number.isFinite(obj.score)) {
    return obj.score;
  }
  return 1.0;
}

function getDecayRate(node: Node): string {
  const obj = parseDecayJson(node.decay);
  if (typeof obj.rate === "string") {
    return obj.rate;
  }
  return "standard";
}

function isFrozen(node: Node): boolean {
  const obj = parseDecayJson(node.decay);
  return obj.frozen === true;
}

function getAccessCount(node: Node, key: string): number {
  const obj = parseDecayJson(node.decay);
  const val = obj[key];
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  return 0;
}

type DecayDashboardProps = {
  refreshKey: number;
};

function DecayDashboard({ refreshKey }: DecayDashboardProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [status, setStatus] = useState("");
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const [frozenOverrides, setFrozenOverrides] = useState<Record<string, boolean>>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const saveTimersRef = useRef<Record<string, number>>({});

  async function fetchNodes() {
    try {
      await refreshAllDecayScores();
      const all = await getAllNodes();
      setNodes(all);
      const rates: Record<string, string> = {};
      const frozen: Record<string, boolean> = {};
      for (const node of all) {
        rates[node.id] = getDecayRate(node);
        frozen[node.id] = isFrozen(node);
      }
      setRateOverrides(rates);
      setFrozenOverrides(frozen);
      setStatus("");
    } catch (err) {
      if (err instanceof AppError) {
        setStatus(err.message);
      } else {
        setStatus("Failed to load nodes.");
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNodes();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshKey]);

  useEffect(
    () => () => {
      for (const id of Object.keys(saveTimersRef.current)) {
        window.clearTimeout(saveTimersRef.current[id]);
      }
    },
    []
  );

  const sorted = useMemo(() => {
    return [...nodes].sort((a, b) => getDecayScore(b) - getDecayScore(a));
  }, [nodes]);

  function onChangeRate(node: Node, nextRate: string) {
    setRateOverrides((prev) => ({ ...prev, [node.id]: nextRate }));

    if (saveTimersRef.current[node.id]) {
      window.clearTimeout(saveTimersRef.current[node.id]);
    }

    saveTimersRef.current[node.id] = window.setTimeout(() => {
      void (async () => {
        try {
          const decayObj = parseDecayJson(node.decay);
          decayObj.rate = nextRate;
          decayObj.pinned = nextRate === "pinned";
          await updateNode({
            id: node.id,
            decay: JSON.stringify(decayObj),
          });
          await refreshAllDecayScores();
          const freshNodes = await getAllNodes();
          setNodes(freshNodes);
        } catch (err) {
          if (err instanceof AppError) {
            setStatus(err.message);
          } else {
            setStatus("Failed to update decay rate.");
          }
        }
      })();
    }, 600);
  }

  function onToggleFreeze(node: Node) {
    const currentFrozen = frozenOverrides[node.id] ?? isFrozen(node);
    const nextFrozen = !currentFrozen;
    setFrozenOverrides((prev) => ({ ...prev, [node.id]: nextFrozen }));

    void (async () => {
      try {
        const decayObj = parseDecayJson(node.decay);
        decayObj.frozen = nextFrozen;
        await updateNode({
          id: node.id,
          decay: JSON.stringify(decayObj),
        });
        const freshNodes = await getAllNodes();
        setNodes(freshNodes);
      } catch (err) {
        if (err instanceof AppError) {
          setStatus(err.message);
        } else {
          setStatus("Failed to toggle freeze.");
        }
      }
    })();
  }

  async function onAutoOptimize() {
    setIsOptimizing(true);
    try {
      await optimizeAllDecayRates();
      await refreshAllDecayScores();
      const freshNodes = await getAllNodes();
      setNodes(freshNodes);
      const rates: Record<string, string> = {};
      const frozen: Record<string, boolean> = {};
      for (const node of freshNodes) {
        rates[node.id] = getDecayRate(node);
        frozen[node.id] = isFrozen(node);
      }
      setRateOverrides(rates);
      setFrozenOverrides(frozen);
      setStatus("");
    } catch (err) {
      if (err instanceof AppError) {
        setStatus(err.message);
      } else {
        setStatus("Failed to auto-optimize.");
      }
    }
    setIsOptimizing(false);
  }

  return (
    <aside className="pane pane-right">
      <div className="pane-header">
        <h3>🧠 Active Memory</h3>
        <button
          type="button"
          className="optimize-button"
          disabled={isOptimizing}
          onClick={() => void onAutoOptimize()}
        >
          {isOptimizing ? "Optimizing…" : "✨ Auto-Optimize"}
        </button>
      </div>
      {status && <p className="pane-error">{status}</p>}
      {sorted.length === 0 && <p className="pane-empty">No nodes yet.</p>}
      <div className="dashboard-list">
        {sorted.length > 0 && (
          <div className="dashboard-header">
            <span>Node</span>
            <span>Priority</span>
            <span>Activity</span>
            <span>Speed</span>
            <span></span>
          </div>
        )}
        {sorted.map((node) => {
          const score = getDecayScore(node);
          const count30 =
            getAccessCount(node, "access_count_30active") ||
            getAccessCount(node, "access_count_30d");
          const count90 =
            getAccessCount(node, "access_count_90active") ||
            getAccessCount(node, "access_count_90d");
          const currentRate = rateOverrides[node.id] ?? getDecayRate(node);
          const frozen = frozenOverrides[node.id] ?? isFrozen(node);
          return (
            <div key={node.id} className={`dashboard-row ${frozen ? "dashboard-frozen" : ""}`}>
              <div className="dashboard-title">{node.title}</div>
              <DecayBar score={score} />
              <span
                className="dashboard-activity"
                title="Touches: last 30 sessions · last 90 sessions"
              >
                {count30} · {count90}
              </span>
              <select
                className="dashboard-rate"
                value={currentRate}
                onChange={(e) => onChangeRate(node, e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="slow">Slow</option>
                <option value="fast">Fast</option>
                <option value="pinned">Pinned</option>
              </select>
              <button
                type="button"
                className={`freeze-toggle ${frozen ? "frozen" : ""}`}
                onClick={() => onToggleFreeze(node)}
                title={
                  frozen ? "Unfreeze — allow auto-optimize" : "Freeze — protect from auto-optimize"
                }
              >
                ❄️
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default DecayDashboard;
