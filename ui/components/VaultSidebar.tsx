import { useEffect, useMemo, useRef, useState } from "react";
import type { Node, Vault } from "../ipc";
import { getAllNodes } from "../services/nodes";
import {
  createVault,
  deleteVault,
  listVaults,
  resolveVaultPath,
  updateVault,
} from "../services/vaults";
import { isAuthSetup, setMasterPassword, verifyMasterPassword } from "../services/auth";
import { AppError } from "../services/ipcResult";
import { PrivacyBadge } from "./PrivacyBadge";
import { getEffectivePrivacy, getPrivacyRank } from "../utils/privacy";

type VaultSidebarProps = {
  selectedVaultId: string | null;
  refreshKey: number;
  onSelectVault: (vaultId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onVaultCreated: (vaultId: string) => void;
  onVaultDeleted: (vaultId: string) => void;
  onOpenDashboard: () => void;
  isRedactedUnlocked: boolean;
  setIsRedactedUnlocked: (value: boolean) => void;
};

function VaultSidebar({
  selectedVaultId,
  refreshKey,
  onSelectVault,
  onSelectNode,
  onVaultCreated,
  onVaultDeleted,
  onOpenDashboard,
  isRedactedUnlocked,
  setIsRedactedUnlocked,
}: VaultSidebarProps) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVaults, setExpandedVaults] = useState<Record<string, boolean>>({});
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"verify" | "setup">("verify");
  const [authModalTitle, setAuthModalTitle] = useState("Redacted");
  const [authModalSubtitle, setAuthModalSubtitle] = useState("");
  const [authModalSubmitLabel, setAuthModalSubmitLabel] = useState("Unlock");
  const [authUnlockOnSuccess, setAuthUnlockOnSuccess] = useState(true);
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authModalError, setAuthModalError] = useState("");
  const authModalResolverRef = useRef<((allowed: boolean) => void) | null>(null);

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

  function closeAuthModal(allowed: boolean) {
    setAuthModalOpen(false);
    setAuthPasswordInput("");
    setAuthModalError("");
    const resolver = authModalResolverRef.current;
    authModalResolverRef.current = null;
    if (resolver) {
      resolver(allowed);
    }
  }

  function openAuthModal({
    mode,
    title,
    subtitle,
    submitLabel,
    unlockOnSuccess,
  }: {
    mode: "verify" | "setup";
    title: string;
    subtitle: string;
    submitLabel: string;
    unlockOnSuccess: boolean;
  }): Promise<boolean> {
    setAuthMode(mode);
    setAuthModalTitle(title);
    setAuthModalSubtitle(subtitle);
    setAuthModalSubmitLabel(submitLabel);
    setAuthUnlockOnSuccess(unlockOnSuccess);
    setAuthPasswordInput("");
    setAuthModalError("");
    setAuthModalOpen(true);
    return new Promise((resolve) => {
      authModalResolverRef.current = resolve;
    });
  }

  async function submitAuthModal() {
    if (!authPasswordInput) {
      return;
    }
    setAuthModalError("");
    if (authMode === "verify") {
      const verifyResult = await verifyMasterPassword(authPasswordInput);
      if (verifyResult.error) {
        setAuthModalError(verifyResult.error.message);
        return;
      }
      if (!verifyResult.data) {
        setAuthModalError("Incorrect password");
        return;
      }
      if (authUnlockOnSuccess) {
        setIsRedactedUnlocked(true);
      }
      closeAuthModal(true);
      return;
    }

    const setResult = await setMasterPassword(authPasswordInput);
    if (setResult.error) {
      setAuthModalError(setResult.error.message);
      return;
    }
    if (!setResult.data) {
      setAuthModalError("Failed to set master password.");
      return;
    }
    if (authUnlockOnSuccess) {
      setIsRedactedUnlocked(true);
    }
    closeAuthModal(true);
  }

  async function unlockRedactedFromSidebar(): Promise<boolean> {
    const setupResult = await isAuthSetup();
    if (setupResult.error) {
      setError(setupResult.error.message);
      return false;
    }

    if (setupResult.data) {
      return openAuthModal({
        mode: "verify",
        title: "Redacted",
        subtitle: "Enter your master password to unlock this tier.",
        submitLabel: "Unlock",
        unlockOnSuccess: true,
      });
    }

    return openAuthModal({
      mode: "setup",
      title: "Redacted",
      subtitle: "Set a master password to unlock this tier.",
      submitLabel: "Set Master Password",
      unlockOnSuccess: true,
    });
  }

  async function onUpdateVaultPrivacy(vault: Vault, effectiveTier: string) {
    if (effectiveTier === "redacted" && !isRedactedUnlocked) {
      const unlocked = await unlockRedactedFromSidebar();
      if (!unlocked) {
        return;
      }
    }
    const input = window.prompt(
      "Enter new privacy tier (open, local_only, locked, redacted):",
      vault.privacyTier
    );
    if (input === null) {
      return;
    }
    const nextTier = input.trim().toLowerCase();
    if (!["open", "local_only", "locked", "redacted"].includes(nextTier)) {
      setError("Invalid privacy tier. Use open, local_only, locked, or redacted.");
      return;
    }

    const isDowngradeFromRedacted =
      effectiveTier === "redacted" && getPrivacyRank(nextTier) < getPrivacyRank("redacted");
    if (isDowngradeFromRedacted) {
      const verified = await openAuthModal({
        mode: "verify",
        title: "Confirm Privacy Downgrade",
        subtitle: "Enter your master password to downgrade from redacted.",
        submitLabel: "Confirm",
        unlockOnSuccess: false,
      });
      if (!verified) {
        return;
      }
    }

    try {
      await updateVault({ id: vault.id, privacyTier: nextTier });
      await loadVaults();
      setError(null);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
        return;
      }
      setError("Failed to update vault privacy tier.");
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
      <button type="button" className="dashboard-trigger" onClick={onOpenDashboard}>
        🧠 Active Memory
      </button>
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
          const effectiveTier = getEffectivePrivacy(vault.privacyTier);
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
                <div className="vault-header">
                  <button
                    type="button"
                    className="list-main"
                    onClick={() => onSelectVaultEntry(vault)}
                  >
                    <span className="list-title-row">
                      <span className="list-title-text">{vault.name}</span>
                      <PrivacyBadge tier={effectiveTier} />
                    </span>
                    {vault.description && <small>{vault.description}</small>}
                  </button>
                  <div className="list-actions">
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
                      className="list-settings"
                      onClick={() => onUpdateVaultPrivacy(vault, effectiveTier)}
                      aria-label={`Update settings for ${vault.name}`}
                    >
                      ⚙️
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
                </div>
              </div>
              {children.length > 0 && expanded && (
                <ul className="sub-vault-list">
                  {children.map((child) => {
                    const effectiveTier = getEffectivePrivacy(child.privacyTier, vault.privacyTier);
                    return (
                      <li key={child.id}>
                        <div
                          className={`list-item sub sub-vault-item ${
                            selectedVaultId === (child.parentVaultId ?? child.id) ? "active" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="list-main"
                            onClick={() => onSelectVaultEntry(child)}
                          >
                            <span className="list-title-row">
                              <span className="list-title-text">{child.name}</span>
                              <PrivacyBadge tier={effectiveTier} />
                            </span>
                            {child.description && <small>{child.description}</small>}
                          </button>
                          <div className="list-actions">
                            <button
                              type="button"
                              className="list-settings"
                              onClick={() => onUpdateVaultPrivacy(child, effectiveTier)}
                              aria-label={`Update settings for ${child.name}`}
                            >
                              ⚙️
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
                        </div>
                      </li>
                    );
                  })}
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
      {authModalOpen && (
        <div className="sidebar-auth-overlay" onClick={() => closeAuthModal(false)}>
          <div
            className="redacted-lock-screen sidebar-auth-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="redacted-lock-icon" aria-hidden="true">
              🔒
            </span>
            <h4 className="redacted-lock-title">{authModalTitle}</h4>
            <p className="redacted-lock-subtitle">{authModalSubtitle}</p>
            <form
              className="redacted-lock-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAuthModal();
              }}
            >
              <input
                className="redacted-lock-input"
                type="password"
                value={authPasswordInput}
                onChange={(event) => setAuthPasswordInput(event.target.value)}
                placeholder={authMode === "setup" ? "Choose a master password" : "Master password"}
                autoFocus
              />
              <div className="sidebar-auth-actions">
                <button
                  type="button"
                  className="redacted-lock-button sidebar-auth-cancel"
                  onClick={() => closeAuthModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="redacted-lock-button">
                  {authModalSubmitLabel}
                </button>
              </div>
            </form>
            {authModalError && <p className="redacted-lock-error">{authModalError}</p>}
          </div>
        </div>
      )}
    </aside>
  );
}

export default VaultSidebar;
