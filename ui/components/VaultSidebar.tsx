import { useEffect, useMemo, useState } from "react";
import type { Node, Vault } from "../ipc";
import { getAllNodes } from "../services/nodes";
import { createVault, deleteVault, listVaults, resolveVaultPath } from "../services/vaults";
import { AppError } from "../services/ipcResult";

type VaultSidebarProps = {
  selectedVaultId: string | null;
  refreshKey: number;
  onSelectVault: (vaultId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onVaultCreated: (vaultId: string) => void;
  onVaultDeleted: (vaultId: string) => void;
};

function VaultSidebar({
  selectedVaultId,
  refreshKey,
  onSelectVault,
  onSelectNode,
  onVaultCreated,
  onVaultDeleted,
}: VaultSidebarProps) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVaults, setExpandedVaults] = useState<Record<string, boolean>>({});

  async function loadVaults() {
    try {
      const data = await listVaults();
      setVaults(data);
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to load vaults.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadVaults();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const nodes = await getAllNodes();
          setAllNodes(nodes);
        } catch (err) {
          if (err instanceof AppError) {
            setError(err.message);
          } else {
            setError("Failed to load nodes for search.");
          }
        }
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  async function onCreateVault() {
    const name = window.prompt("Vault name");
    if (!name || !name.trim()) {
      return;
    }

    try {
      const created = await createVault({
        name: name.trim(),
      });
      onVaultCreated(created.id);
      await loadVaults();
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to create vault.");
    }
  }

  async function onCreateSubVault(parentVaultId: string, parentName: string) {
    const name = window.prompt(`Sub-vault name for ${parentName}`);
    if (!name || !name.trim()) {
      return;
    }

    try {
      const created = await createVault({
        name: name.trim(),
        parentVaultId,
      });
      setExpandedVaults((prev) => ({ ...prev, [parentVaultId]: true }));
      onVaultCreated(created.id);
      await loadVaults();
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to create sub-vault.");
    }
  }

  async function onDeleteVault(vaultId: string) {
    if (!window.confirm("Are you sure?")) {
      return;
    }
    try {
      const deleted = await deleteVault(vaultId);
      if (!deleted) {
        setError("Vault could not be deleted.");
        return;
      }
      onVaultDeleted(vaultId);
      await loadVaults();
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to delete vault.");
    }
  }

  function onSelectVaultEntry(vault: Vault) {
    onSelectVault(vault.id);
  }

  function onSelectNodeEntry(node: Node) {
    onSelectVault(node.subVaultId ?? node.vaultId);
    onSelectNode(node.id);
  }

  function onToggleExpand(vaultId: string) {
    setExpandedVaults((prev) => ({
      ...prev,
      [vaultId]: !prev[vaultId],
    }));
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const { topLevelVaults, childrenByParent, searchNodesByTopLevel } = useMemo(() => {
    const childMap = new Map<string, Vault[]>();
    for (const vault of vaults) {
      if (!vault.parentVaultId) {
        continue;
      }
      const existing = childMap.get(vault.parentVaultId) ?? [];
      existing.push(vault);
      childMap.set(vault.parentVaultId, existing);
    }

    for (const children of childMap.values()) {
      children.sort((a, b) => a.name.localeCompare(b.name));
    }

    const roots = vaults.filter((vault) => !vault.parentVaultId);
    roots.sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedQuery) {
      return {
        topLevelVaults: roots,
        childrenByParent: childMap,
        searchNodesByTopLevel: new Map<string, Node[]>(),
      };
    }

    const filteredRoots: Vault[] = [];
    const filteredChildMap = new Map<string, Vault[]>();
    const nodeMap = new Map<string, Node[]>();

    const matchingNodes = allNodes.filter((node) => {
      const title = node.title.toLowerCase();
      const summary = node.summary.toLowerCase();
      return title.includes(normalizedQuery) || summary.includes(normalizedQuery);
    });

    for (const root of roots) {
      const rootMatches = root.name.toLowerCase().includes(normalizedQuery);
      const children = childMap.get(root.id) ?? [];
      const childNameMatches = children.filter((child) =>
        child.name.toLowerCase().includes(normalizedQuery)
      );
      const childIds = new Set(children.map((child) => child.id));
      const rootNodes = matchingNodes.filter(
        (node) =>
          node.vaultId === root.id || (node.subVaultId ? childIds.has(node.subVaultId) : false)
      );
      const childNodeMatchIds = new Set(
        rootNodes
          .map((node) => node.subVaultId)
          .filter((subVaultId): subVaultId is string => Boolean(subVaultId))
      );
      const matchingChildren = children.filter(
        (child) =>
          childNameMatches.some((matchedChild) => matchedChild.id === child.id) ||
          childNodeMatchIds.has(child.id)
      );

      if (rootMatches || matchingChildren.length > 0 || rootNodes.length > 0) {
        filteredRoots.push(root);
        filteredChildMap.set(root.id, rootMatches ? children : matchingChildren);
        nodeMap.set(root.id, rootNodes);
      }
    }

    return {
      topLevelVaults: filteredRoots,
      childrenByParent: filteredChildMap,
      searchNodesByTopLevel: nodeMap,
    };
  }, [allNodes, normalizedQuery, vaults]);

  return (
    <aside className="pane pane-left">
      <div className="pane-header">
        <h3>Vaults</h3>
        <button type="button" onClick={onCreateVault}>
          New Vault
        </button>
      </div>
      <input
        type="search"
        className="vault-search"
        placeholder="Search vaults..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {error && <p className="pane-error">{error}</p>}
      <ul className="vault-list">
        {topLevelVaults.map((vault) => {
          const children = childrenByParent.get(vault.id) ?? [];
          const matchingNodes = searchNodesByTopLevel.get(vault.id) ?? [];
          const expanded = normalizedQuery ? true : (expandedVaults[vault.id] ?? false);
          return (
            <li key={vault.id}>
              <div className={`list-item ${selectedVaultId === vault.id ? "active" : ""}`}>
                <button
                  type="button"
                  className={`tree-toggle ${children.length === 0 ? "empty" : ""}`}
                  onClick={() => onToggleExpand(vault.id)}
                  disabled={children.length === 0}
                  aria-label={expanded ? `Collapse ${vault.name}` : `Expand ${vault.name}`}
                >
                  {children.length === 0 ? "" : expanded ? "v" : ">"}
                </button>
                <button
                  type="button"
                  className="list-main"
                  onClick={() => onSelectVaultEntry(vault)}
                >
                  <span>{vault.name}</span>
                  {vault.description && <small>{vault.description}</small>}
                </button>
                <button
                  type="button"
                  className="list-subvault"
                  onClick={() => onCreateSubVault(vault.id, vault.name)}
                  aria-label={`Create sub-vault under ${vault.name}`}
                >
                  +
                </button>
                <button
                  type="button"
                  className="list-delete"
                  onClick={() => onDeleteVault(vault.id)}
                  aria-label={`Delete ${vault.name}`}
                >
                  ×
                </button>
              </div>
              {children.length > 0 && expanded && (
                <ul className="sub-vault-list">
                  {children.map((child) => (
                    <li key={child.id}>
                      <div
                        className={`list-item sub ${
                          selectedVaultId === (child.parentVaultId ?? child.id) ? "active" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="list-main"
                          onClick={() => onSelectVaultEntry(child)}
                        >
                          <span>{child.name}</span>
                          {child.description && <small>{child.description}</small>}
                        </button>
                        <button
                          type="button"
                          className="list-delete"
                          onClick={() => onDeleteVault(child.id)}
                          aria-label={`Delete ${child.name}`}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {normalizedQuery && matchingNodes.length > 0 && (
                <ul className="search-node-list">
                  {matchingNodes.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        className="search-node-item"
                        onClick={() => onSelectNodeEntry(node)}
                      >
                        <span className="search-node-icon">f</span>
                        <span className="search-node-text">
                          <strong>{node.title}</strong>
                          <small>{node.summary.slice(0, 72)}</small>
                          <small className="search-node-context">
                            📁 {resolveVaultPath(node, vaults)}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default VaultSidebar;
