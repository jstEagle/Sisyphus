import { extensionConfig, defaultSettings } from "./config";
import type { RuntimeState, Settings } from "./types";

const STORAGE_KEY = "sisyphus.runtimeState";

export function createInitialState(settings: Settings = defaultSettings()): RuntimeState {
  return {
    settings,
    tabMemory: {},
    events: [],
    actions: [],
    redoStack: [],
    categories: {},
    domains: {},
    workflowPairs: {},
    protectedTabs: {},
    protectedGroups: {},
    cleanupGroups: {}
  };
}

export async function loadState(): Promise<RuntimeState> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const saved = data[STORAGE_KEY] as Partial<RuntimeState> | undefined;
  if (!saved) return createInitialState();

  const defaults = createInitialState();
  return {
    ...defaults,
    ...saved,
    settings: {
      ...defaults.settings,
      ...saved.settings
    }
  };
}

export async function saveState(state: RuntimeState): Promise<void> {
  const trimmed: RuntimeState = {
    ...state,
    events: state.events.slice(-extensionConfig.maxEventsStored),
    actions: state.actions.slice(0, extensionConfig.recentActionLimit),
    redoStack: state.redoStack.slice(0, extensionConfig.recentActionLimit)
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
}

export async function exportState(): Promise<string> {
  const state = await loadState();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      state
    },
    null,
    2
  );
}

export async function importState(payload: string): Promise<RuntimeState> {
  const parsed = JSON.parse(payload) as { state?: RuntimeState };
  if (!parsed.state?.settings) {
    throw new Error("Import file does not look like Sisyphus state.");
  }
  await saveState(parsed.state);
  return parsed.state;
}
