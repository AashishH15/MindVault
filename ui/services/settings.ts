import { onboardingGetComplete, onboardingSetComplete, settingsGet, settingsSet } from "../ipc";
import { unwrapIpcResult } from "./ipcResult";

export async function getSetting(key: string): Promise<string | null> {
  return unwrapIpcResult(settingsGet(key));
}

export async function setSetting(key: string, value: string): Promise<boolean> {
  return unwrapIpcResult(settingsSet(key, value));
}

export async function getOnboardingComplete(): Promise<boolean> {
  const rawValue = await unwrapIpcResult(onboardingGetComplete());
  return rawValue === "true";
}

export async function setOnboardingComplete(isComplete: boolean): Promise<boolean> {
  return unwrapIpcResult(onboardingSetComplete(isComplete));
}
