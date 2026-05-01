import { useState } from "react";
import { createNode, getNodes } from "./services/nodes";
import { listVaults } from "./services/vaults";
import type { Node } from "./ipc";

function DebugPanel() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [status, setStatus] = useState("");

  async function onInsertDummyNode() {
    try {
      setStatus("Creating dummy node...");
      const vaults = await listVaults();
      const firstVault = vaults[0];
      if (!firstVault) {
        setStatus("No vault found.");
        return;
      }

      await createNode({
        vaultId: firstVault.id,
        title: `Debug Node ${new Date().toISOString()}`,
        summary: "Temporary debug node",
        nodeType: "fact",
      });

      setStatus("Dummy node created.");
    } catch (error) {
      setStatus(String(error));
    }
  }

  async function onFetchNodes() {
    try {
      setStatus("Loading nodes...");
      const allNodes = await getNodes();
      setNodes(allNodes);
      setStatus(`Loaded ${allNodes.length} nodes.`);
    } catch (error) {
      setStatus(String(error));
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Debug Panel</h2>
      <div className="row">
        <button type="button" onClick={onInsertDummyNode}>
          Insert Dummy Node
        </button>
        <button type="button" onClick={onFetchNodes}>
          Fetch All Nodes
        </button>
      </div>
      <p>{status}</p>
      <pre style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(nodes, null, 2)}
      </pre>
    </section>
  );
}

export default DebugPanel;
