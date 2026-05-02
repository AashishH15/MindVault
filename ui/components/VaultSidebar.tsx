import { useEffect, useState } from "react";
import type { Vault } from "../ipc";
import { createVault, deleteVault, listVaults } from "../services/vaults";
import { AppError } from "../services/ipcResult";

type VaultSidebarProps = {
  selectedVaultId: string | null;
  refreshKey: number;
  onSelectVault: (vaultId: string) => void;
  onVaultCreated: (vaultId: string) => void;
  onVaultDeleted: (vaultId: string) => void;
};

function VaultSidebar({
  selectedVaultId,
  refreshKey,
  onSelectVault,
  onVaultCreated,
  onVaultDeleted,
}: VaultSidebarProps) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <aside className="pane pane-left">
      <div className="pane-header">
        <h3>Vaults</h3>
        <button type="button" onClick={onCreateVault}>
          New Vault
        </button>
      </div>
      {error && <p className="pane-error">{error}</p>}
      <ul className="vault-list">
        {vaults.map((vault) => (
          <li key={vault.id}>
            <div className={`list-item ${selectedVaultId === vault.id ? "active" : ""}`}>
              <button type="button" className="list-main" onClick={() => onSelectVault(vault.id)}>
                <span>{vault.name}</span>
                {vault.description && <small>{vault.description}</small>}
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
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default VaultSidebar;
