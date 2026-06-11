import type { RuntimeState } from "../core/types";

export interface ExtensionResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionResponse<T>;
  if (!response.ok) {
    throw new Error(response.error ?? "Extension request failed.");
  }
  return response.data as T;
}

export function loadRuntimeState(): Promise<RuntimeState> {
  return sendMessage<RuntimeState>({ type: "get-state" });
}
