const LLM_PROVIDER_KEY = "mindvault.llm.provider";
const OLLAMA_ENDPOINT_KEY = "mindvault.llm.ollama.endpoint";
const LMSTUDIO_ENDPOINT_KEY = "mindvault.llm.lmstudio.endpoint";
const LLM_MODEL_KEY = "mindvault.llm.model";
const DEFAULT_PROVIDER = "ollama";
const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
const DEFAULT_LMSTUDIO_ENDPOINT = "http://localhost:1234";

export function getLlmProvider(): string {
  const value = window.localStorage.getItem(LLM_PROVIDER_KEY);
  if (!value || !value.trim()) {
    return DEFAULT_PROVIDER;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "lmstudio" ? "lmstudio" : "ollama";
}

export function setLlmProvider(provider: string): void {
  const normalized = provider.trim().toLowerCase();
  const next = normalized === "lmstudio" ? "lmstudio" : "ollama";
  window.localStorage.setItem(LLM_PROVIDER_KEY, next);
}

export function getOllamaEndpoint(): string {
  const value = window.localStorage.getItem(OLLAMA_ENDPOINT_KEY);
  if (!value || !value.trim()) {
    return DEFAULT_OLLAMA_ENDPOINT;
  }
  return value;
}

export function setOllamaEndpoint(url: string): void {
  const normalized = url.trim();
  window.localStorage.setItem(OLLAMA_ENDPOINT_KEY, normalized || DEFAULT_OLLAMA_ENDPOINT);
}

export function getLmStudioEndpoint(): string {
  const value = window.localStorage.getItem(LMSTUDIO_ENDPOINT_KEY);
  if (!value || !value.trim()) {
    return DEFAULT_LMSTUDIO_ENDPOINT;
  }
  return value;
}

export function setLmStudioEndpoint(url: string): void {
  const normalized = url.trim();
  window.localStorage.setItem(LMSTUDIO_ENDPOINT_KEY, normalized || DEFAULT_LMSTUDIO_ENDPOINT);
}

export function getLlmModel(): string {
  return window.localStorage.getItem(LLM_MODEL_KEY) ?? "";
}

export function setLlmModel(model: string): void {
  window.localStorage.setItem(LLM_MODEL_KEY, model.trim());
}
