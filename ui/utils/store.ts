import { useSyncExternalStore } from "react";
import {
  getChatChartsEnabled,
  setChatChartsEnabled as apiSetChatChartsEnabled,
  getNodeEditorChartsEnabled,
  setNodeEditorChartsEnabled as apiSetNodeEditorChartsEnabled,
} from "./settings";

import { getSetting, setSetting } from "../services/settings";

export interface UIPreferenceState {
  chat: {
    chartsEnabled: boolean;
  };
  nodeEditor: {
    chartsEnabled: boolean;
  };
  setChatChartsEnabled: (enabled: boolean) => void;
  setNodeEditorChartsEnabled: (enabled: boolean) => void;
}

// Stable static action references to prevent Object.is inequality and eliminate any infinite re-render loops
const stableSetChatChartsEnabled = (enabled: boolean) => {
  apiSetChatChartsEnabled(enabled);
  void setSetting("mindvault.llm.charts.chat.enabled", enabled ? "true" : "false").catch(() => {});
};

const stableSetNodeEditorChartsEnabled = (enabled: boolean) => {
  apiSetNodeEditorChartsEnabled(enabled);
  void setSetting("mindvault.llm.charts.nodeeditor.enabled", enabled ? "true" : "false").catch(
    () => {}
  );
};

// Singleton store snapshot state
let currentStoreState: UIPreferenceState = createStoreSnapshot();

// Asynchronously load settings from SQLite on startup to restore settings and override flaky localStorage
void (async () => {
  try {
    const chatVal = await getSetting("mindvault.llm.charts.chat.enabled");
    if (chatVal !== null) {
      apiSetChatChartsEnabled(chatVal === "true");
    }
    const editorVal = await getSetting("mindvault.llm.charts.nodeeditor.enabled");
    if (editorVal !== null) {
      apiSetNodeEditorChartsEnabled(editorVal === "true");
    }
  } catch (e) {
    console.error("Failed to load charts settings from SQLite:", e);
  }
})();

function createStoreSnapshot(): UIPreferenceState {
  return {
    chat: {
      chartsEnabled: getChatChartsEnabled(),
    },
    nodeEditor: {
      chartsEnabled: getNodeEditorChartsEnabled(),
    },
    setChatChartsEnabled: stableSetChatChartsEnabled,
    setNodeEditorChartsEnabled: stableSetNodeEditorChartsEnabled,
  };
}

// Manage list of reactive listeners
const listeners = new Set<() => void>();

function notify() {
  currentStoreState = createStoreSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

// Synchronize with external settings changes (e.g. from localStorage triggers)
window.addEventListener("mindvault:llm-settings-changed", notify);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentStoreState;

// High-performance reactive selector hook utilizing native React useSyncExternalStore
export function useUIStore<T>(selector: (state: UIPreferenceState) => T): T {
  const entireState = useSyncExternalStore(subscribe, getSnapshot);
  return selector(entireState);
}
