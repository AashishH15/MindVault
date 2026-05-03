import { useEffect, useMemo, useRef, useState } from "react";
import { deleteNode, getNode, updateNode } from "../services/nodes";
import type { Node } from "../ipc";
import { AppError } from "../services/ipcResult";
import { listVaults, resolveVaultPath } from "../services/vaults";

type NodeEditorProps = {
  selectedNodeId: string | null;
  refreshKey: number;
  onNodeDeleted: (nodeId: string) => void;
  onSaveSuccess: () => void;
};

function NodeEditor({ selectedNodeId, refreshKey, onNodeDeleted, onSaveSuccess }: NodeEditorProps) {
  const [node, setNode] = useState<Node | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editPrivacy, setEditPrivacy] = useState("open");
  const [breadcrumbPath, setBreadcrumbPath] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [status, setStatus] = useState<string>("");
  const saveRunIdRef = useRef(0);
  const saveStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedNodeId) {
      const clearTimer = window.setTimeout(() => {
        setNode(null);
        setEditTitle("");
        setEditSummary("");
        setEditDetail("");
        setEditPrivacy("open");
        setBreadcrumbPath("");
        setSaveStatus("idle");
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const nodeId = selectedNodeId;

    async function loadNode() {
      try {
        const node = await getNode(nodeId);
        if (!node) {
          setNode(null);
          setStatus("Node not found.");
          return;
        }
        setNode(node);
        setStatus("");
      } catch (err) {
        if (err instanceof AppError) {
          setStatus(err.message);
          return;
        }
        setStatus("Failed to load node.");
      }
    }

    const timer = setTimeout(() => {
      void loadNode();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshKey, selectedNodeId]);

  useEffect(() => {
    if (!node) {
      const timer = window.setTimeout(() => {
        setBreadcrumbPath("");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const vaults = await listVaults();
          setBreadcrumbPath(resolveVaultPath(node, vaults));
        } catch (err) {
          if (err instanceof AppError) {
            setStatus(err.message);
          } else {
            setStatus("Failed to resolve node path.");
          }
          setBreadcrumbPath("");
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [node]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setEditTitle(node?.title ?? "");
      setEditSummary(node?.summary ?? "");
      setEditDetail(node?.detail ?? "");
      setEditPrivacy(node?.privacyTier ?? "open");
    }, 0);
    return () => clearTimeout(syncTimer);
  }, [node]);

  useEffect(
    () => () => {
      if (saveStatusTimeoutRef.current !== null) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedNodeId || !node) {
      return;
    }

    const currentPrivacy = node.privacyTier ?? "open";
    const hasChanges =
      editTitle !== (node.title ?? "") ||
      editSummary !== (node.summary ?? "") ||
      editDetail !== (node.detail ?? "") ||
      editPrivacy !== currentPrivacy;

    if (!hasChanges) {
      return;
    }

    const runId = saveRunIdRef.current + 1;
    saveRunIdRef.current = runId;

    const statusTimer = window.setTimeout(() => {
      setSaveStatus("saving");
      setStatus("");
    }, 0);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const updated = await updateNode({
            id: selectedNodeId,
            title: editTitle,
            summary: editSummary,
            detail: editDetail,
            privacyTier: editPrivacy,
          });
          if (runId !== saveRunIdRef.current) {
            return;
          }
          setNode(updated);
          setSaveStatus("saved");
          onSaveSuccess();
          if (saveStatusTimeoutRef.current !== null) {
            window.clearTimeout(saveStatusTimeoutRef.current);
          }
          saveStatusTimeoutRef.current = window.setTimeout(() => {
            if (runId === saveRunIdRef.current) {
              setSaveStatus("idle");
            }
          }, 2000);
        } catch (err) {
          if (runId !== saveRunIdRef.current) {
            return;
          }
          setSaveStatus("idle");
          if (err instanceof AppError) {
            setStatus(err.message);
            return;
          }
          setStatus("Failed to save node.");
        }
      })();
    }, 1000);

    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(timer);
    };
  }, [editDetail, editPrivacy, editSummary, editTitle, node, onSaveSuccess, selectedNodeId]);

  const decayScore = useMemo(() => {
    if (!node?.decay) {
      return null;
    }
    try {
      const parsed = typeof node.decay === "string" ? JSON.parse(node.decay) : node.decay;
      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object" && "score" in parsed) {
        const value = Number((parsed as { score: unknown }).score);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    } catch {
      const fallback = Number(node.decay);
      if (Number.isFinite(fallback)) {
        return fallback;
      }
    }
    return null;
  }, [node]);

  async function onDelete() {
    if (!selectedNodeId || !window.confirm("Are you sure?")) {
      return;
    }
    try {
      const deleted = await deleteNode(selectedNodeId);
      if (!deleted) {
        setStatus("Node could not be deleted.");
        return;
      }
      onNodeDeleted(selectedNodeId);
      setStatus("Deleted.");
    } catch (err) {
      if (err instanceof AppError) {
        setStatus(err.message);
        return;
      }
      setStatus("Failed to delete node.");
    }
  }

  return (
    <aside className="pane pane-right">
      <div className="pane-header">
        <h3>Editor</h3>
        <div className="editor-actions">
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : ""}
          </span>
          <button type="button" onClick={onDelete} disabled={!selectedNodeId}>
            Delete
          </button>
        </div>
      </div>
      {!selectedNodeId ? (
        <p className="pane-empty">Select a node to edit.</p>
      ) : (
        <div className="editor-form">
          {breadcrumbPath && <p className="editor-breadcrumb">{breadcrumbPath}</p>}
          <div className="editor-meta">
            <label className="editor-privacy">
              <span>Privacy</span>
              <select value={editPrivacy} onChange={(e) => setEditPrivacy(e.target.value)}>
                <option value="open">Open</option>
                <option value="local_only">Local-Only</option>
                <option value="locked">Locked</option>
                <option value="redacted">Redacted</option>
              </select>
            </label>
            {decayScore !== null && (
              <span className="decay-badge">Decay: {decayScore.toFixed(2)}</span>
            )}
          </div>
          <input
            className="editor-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
          />
          <textarea
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Summary"
          />
          <textarea
            className="editor-detail"
            value={editDetail}
            onChange={(e) => setEditDetail(e.target.value)}
            placeholder="Detail"
          />
        </div>
      )}
      {status && <p className="pane-status">{status}</p>}
    </aside>
  );
}

export default NodeEditor;
