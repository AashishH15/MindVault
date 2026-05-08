import { useState } from "react";
import { getLlmModels } from "../services/nodes";
import { AppError } from "../services/ipcResult";
import {
  getLlmModel,
  getLlmProvider,
  getLmStudioEndpoint,
  getOllamaEndpoint,
  setLlmModel,
  setLlmProvider,
  setLmStudioEndpoint,
  setOllamaEndpoint,
} from "../utils/settings";

type Provider = "ollama" | "lmstudio";

function LlmSettings() {
  const [provider, setProvider] = useState<Provider>(() => {
    return getLlmProvider() === "lmstudio" ? "lmstudio" : "ollama";
  });
  const [ollamaEndpoint, setOllamaEndpointState] = useState(() => getOllamaEndpoint());
  const [lmStudioEndpoint, setLmStudioEndpointState] = useState(() => getLmStudioEndpoint());
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => getLlmModel());
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endpoint = provider === "ollama" ? ollamaEndpoint : lmStudioEndpoint;

  async function onTestConnection() {
    setIsLoading(true);
    setStatus("");
    try {
      const fetchedModels = await getLlmModels(provider, endpoint.trim());
      setModels(fetchedModels);
      if (fetchedModels.length === 0) {
        setStatus("Connected, but no models were returned.");
      } else {
        const nextModel =
          selectedModel && fetchedModels.includes(selectedModel) ? selectedModel : fetchedModels[0];
        setSelectedModel(nextModel);
        setLlmModel(nextModel);
        setStatus(`Connected. Found ${fetchedModels.length} model(s).`);
      }
    } catch (err) {
      if (err instanceof AppError) {
        setStatus(err.message);
      } else {
        setStatus("Failed to connect to endpoint.");
      }
    }
    setIsLoading(false);
  }

  function onSaveSettings() {
    setLlmProvider(provider);
    if (provider === "ollama") {
      setOllamaEndpoint(ollamaEndpoint);
      setStatus("Saved Ollama settings.");
    } else {
      setLmStudioEndpoint(lmStudioEndpoint);
      setStatus("Saved LM Studio settings.");
    }
  }

  function onSelectModel(model: string) {
    setSelectedModel(model);
    setLlmModel(model);
    setStatus("Saved model.");
  }

  function onProviderChange(nextProvider: Provider) {
    setProvider(nextProvider);
    setLlmProvider(nextProvider);
    setModels([]);
    setStatus("");
  }

  return (
    <aside className="pane pane-right llm-settings">
      <div className="pane-header">
        <h3>⚙️ LLM Settings</h3>
      </div>

      <div className="provider-toggle" role="radiogroup" aria-label="LLM provider">
        <label>
          <input
            type="radio"
            name="llm-provider"
            checked={provider === "ollama"}
            onChange={() => onProviderChange("ollama")}
          />
          Ollama
        </label>
        <label>
          <input
            type="radio"
            name="llm-provider"
            checked={provider === "lmstudio"}
            onChange={() => onProviderChange("lmstudio")}
          />
          LM Studio
        </label>
      </div>

      <label className="settings-field">
        <span>Endpoint URL</span>
        <input
          type="text"
          value={endpoint}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (provider === "ollama") {
              setOllamaEndpointState(nextValue);
            } else {
              setLmStudioEndpointState(nextValue);
            }
          }}
          placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
        />
      </label>

      <button type="button" className="settings-action" onClick={() => void onTestConnection()}>
        {isLoading ? "Testing..." : "Test Connection & Fetch Models"}
      </button>

      <label className="settings-field">
        <span>Model</span>
        <select
          value={selectedModel}
          onChange={(event) => onSelectModel(event.target.value)}
          disabled={models.length === 0}
        >
          {models.length === 0 ? (
            <option value="">No models loaded</option>
          ) : (
            models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))
          )}
        </select>
      </label>

      <button type="button" className="settings-action save" onClick={onSaveSettings}>
        Save
      </button>

      {status && <p className="pane-status">{status}</p>}
    </aside>
  );
}

export default LlmSettings;
