import { useEffect, useMemo, useRef, useState } from "react";
import type { Node, Vault } from "../ipc";
import { createNode, getNodes } from "../services/nodes";
import { AppError } from "../services/ipcResult";
import { listVaults } from "../services/vaults";
import { getEffectivePrivacy } from "../utils/privacy";
import { PrivacyBadge } from "./PrivacyBadge";

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
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await listVaults();
          setVaults(data);
        } catch (err) {
          if (err instanceof AppError) {
            setError(err.message);
          } else {
            setError("Failed to load vault context.");
          }
        }
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedVaultId]);

  const selectedVault = useMemo(() => {
    if (!selectedVaultId) {
      return null;
    }
    return vaults.find((vault) => vault.id === selectedVaultId) ?? null;
  }, [selectedVaultId, vaults]);

  const vaultById = useMemo(() => {
    const map: Record<string, Vault> = {};
    for (const vault of vaults) {
      map[vault.id] = vault;
    }
    return map;
  }, [vaults]);

  const scopedNodes = useMemo(() => {
    if (!selectedVault) {
      return [];
    }
    if (selectedVault.parentVaultId) {
      return nodes.filter((node) => node.subVaultId === selectedVault.id);
    }
    return nodes.filter((node) => node.vaultId === selectedVault.id && !node.subVaultId);
  }, [nodes, selectedVault]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredNodes = useMemo(() => {
    if (!normalizedQuery) {
      return scopedNodes;
    }
    return scopedNodes.filter((node) => {
      const title = node.title.toLowerCase();
      const summary = node.summary.toLowerCase();
      return title.includes(normalizedQuery) || summary.includes(normalizedQuery);
    });
  }, [normalizedQuery, scopedNodes]);

  const effectivePrivacyByNodeId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const node of filteredNodes) {
      const subVault = node.subVaultId ? vaultById[node.subVaultId] : undefined;
      const parentVaultId = subVault?.parentVaultId ?? node.vaultId;
      const vault = vaultById[parentVaultId];
      map[node.id] = getEffectivePrivacy(
        node.privacyTier,
        subVault?.privacyTier,
        vault?.privacyTier
      );
    }
    return map;
  }, [filteredNodes, vaultById]);

  async function onCreateNode() {
    if (!selectedVault) {
      return;
    }
    try {
      const input = selectedVault.parentVaultId
        ? {
            vaultId: selectedVault.parentVaultId,
            subVaultId: selectedVault.id,
            title: "Untitled Node",
            summary: "",
            nodeType: "fact",
          }
        : {
            vaultId: selectedVault.id,
            title: "Untitled Node",
            summary: "",
            nodeType: "fact",
          };
      const created = await createNode({
        ...input,
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
      <input
        ref={searchInputRef}
        type="search"
        placeholder="Search nodes..."
        className="search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="pane-header">
        <h3>Nodes</h3>
        <button type="button" onClick={onCreateNode} disabled={!selectedVault}>
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
            <span className="node-card-title-row">
              <strong>{node.title}</strong>
              <PrivacyBadge tier={effectivePrivacyByNodeId[node.id] ?? "open"} />
            </span>
            <p>{node.summary.slice(0, 120)}</p>
          </button>
        ))}
      </div>
      {filteredNodes.length === 0 && normalizedQuery && (
        <p className="pane-empty">No nodes found matching '{searchQuery}'.</p>
      )}
    </aside>
  );
}

export default NodeList;
