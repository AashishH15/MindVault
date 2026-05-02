import { useEffect, useMemo, useState } from "react";
import type { Node } from "../ipc";
import { createNode, getNodes } from "../services/nodes";
import { AppError } from "../services/ipcResult";

type NodeListProps = {
  selectedVaultId: string | null;
  selectedNodeId: string | null;
  refreshKey: number;
  onSelectNode: (nodeId: string) => void;
  onNodeCreated: (nodeId: string) => void;
  onBack: () => void;
};

function NodeList({
  selectedVaultId,
  selectedNodeId,
  refreshKey,
  onSelectNode,
  onNodeCreated,
  onBack,
}: NodeListProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadNodes() {
    try {
      const data = await getNodes();
      setNodes(data);
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to load nodes.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadNodes();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  const filteredNodes = useMemo(() => {
    if (!selectedVaultId) {
      return [];
    }
    return nodes.filter((node) => node.vaultId === selectedVaultId);
  }, [nodes, selectedVaultId]);

  async function onCreateNode() {
    if (!selectedVaultId) {
      return;
    }
    try {
      const created = await createNode({
        vaultId: selectedVaultId,
        title: "Untitled Node",
        summary: "",
        nodeType: "fact",
      });
      onNodeCreated(created.id);
      await loadNodes();
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to create node.");
    }
  }

  return (
    <aside className="pane pane-middle">
      <button type="button" className="back-button" onClick={onBack}>
        ← Back to Vaults
      </button>
      <div className="pane-header">
        <h3>Nodes</h3>
        <button type="button" onClick={onCreateNode} disabled={!selectedVaultId}>
          New Node
        </button>
      </div>
      {error && <p className="pane-error">{error}</p>}
      <div className="node-cards">
        {filteredNodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className={`node-card ${selectedNodeId === node.id ? "active" : ""}`}
            onClick={() => onSelectNode(node.id)}
          >
            <strong>{node.title}</strong>
            <p>{node.summary.slice(0, 120)}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default NodeList;
