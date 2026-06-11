import "./styles.css";
import "./popup.css";
import { extensionConfig, settingsForLevel } from "./core/config";
import type { ManagementLevel, RuntimeState, Settings } from "./core/types";
import { loadRuntimeState, sendMessage } from "./ui/messages";

let state: RuntimeState;

const enabled = element<HTMLInputElement>("enabled");
const level = element<HTMLSelectElement>("level");
const allowReorder = element<HTMLInputElement>("allowReorder");
const allowGroup = element<HTMLInputElement>("allowGroup");
const allowCleanupGroup = element<HTMLInputElement>("allowCleanupGroup");
const allowClose = element<HTMLInputElement>("allowClose");
const allowOpen = element<HTMLInputElement>("allowOpen");
const inactiveHours = element<HTMLInputElement>("inactiveHours");
const status = element<HTMLElement>("status");
const protectedCount = element<HTMLElement>("protectedCount");
const importFile = element<HTMLInputElement>("importFile");

void render();

enabled.addEventListener("change", () => save({ enabled: enabled.checked }));
level.addEventListener("change", () => {
  const next = settingsForLevel(state.settings, level.value as ManagementLevel);
  save(next);
});

for (const input of [allowReorder, allowGroup, allowCleanupGroup, allowClose, allowOpen]) {
  input.addEventListener("change", () => {
    save({
      allowReorder: allowReorder.checked,
      allowGroup: allowGroup.checked,
      allowCleanupGroup: allowCleanupGroup.checked,
      allowClose: allowClose.checked,
      allowOpen: allowOpen.checked
    });
  });
}

inactiveHours.addEventListener("change", () => {
  save({ inactiveCloseHours: Number(inactiveHours.value) });
});

element<HTMLButtonElement>("sidebar").addEventListener("click", () => {
  void sendMessage({ type: "open-sidebar" });
});

element<HTMLButtonElement>("export").addEventListener("click", async () => {
  const payload = await sendMessage<string>({ type: "export" });
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sisyphus-state-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

element<HTMLButtonElement>("import").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  await sendMessage({ type: "import", payload: await file.text() });
  await render();
});

async function render(): Promise<void> {
  state = await loadRuntimeState();
  const settings = state.settings;
  enabled.checked = settings.enabled;
  level.value = settings.managementLevel;
  allowReorder.checked = settings.allowReorder;
  allowGroup.checked = settings.allowGroup;
  allowCleanupGroup.checked = settings.allowCleanupGroup;
  allowClose.checked = settings.allowClose;
  allowOpen.checked = settings.allowOpen;
  inactiveHours.value = String(settings.inactiveCloseHours);
  status.textContent = settings.onboarded ? "Quietly managing tabs" : "Onboarding pending";
  protectedCount.textContent = `${Object.keys(state.protectedTabs).length + Object.keys(state.protectedGroups).length} protected`;
  const github = element<HTMLAnchorElement>("github");
  github.href = extensionConfig.githubUrl;
}

async function save(settings: Partial<Settings>): Promise<void> {
  state = await sendMessage<RuntimeState>({ type: "save-settings", settings });
  await render();
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}
