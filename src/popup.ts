import "./styles.css";
import "./popup.css";
import { extensionConfig, settingsForLevel } from "./core/config";
import type {
  ActionFeedbackRating,
  ExtensionAction,
  ManagementLevel,
  RuntimeState,
  Settings
} from "./core/types";
import { decode } from "./ui/fx";
import { loadRuntimeState, sendMessage } from "./ui/messages";

let state: RuntimeState;

const enabled = element<HTMLInputElement>("enabled");
const learningMode = element<HTMLInputElement>("learningMode");
const level = element<HTMLElement>("level");
const allowReorder = element<HTMLInputElement>("allowReorder");
const allowGroup = element<HTMLInputElement>("allowGroup");
const allowCleanupGroup = element<HTMLInputElement>("allowCleanupGroup");
const allowClose = element<HTMLInputElement>("allowClose");
const allowOpen = element<HTMLInputElement>("allowOpen");
const inactiveHours = element<HTMLInputElement>("inactiveHours");
const status = element<HTMLElement>("status");
const statusDot = element<HTMLElement>("statusDot");
const protectedCount = element<HTMLElement>("protectedCount");
const importFile = element<HTMLInputElement>("importFile");
const feedbackPanel = element<HTMLElement>("feedbackPanel");
const feedbackAction = element<HTMLElement>("feedbackAction");
const feedbackScale = element<HTMLElement>("feedbackScale");

void render();

enabled.addEventListener("change", () => save({ enabled: enabled.checked }));
learningMode.addEventListener("change", () => save({ learningMode: learningMode.checked }));

level.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-level]");
  if (!button) return;
  const next = settingsForLevel(state.settings, button.dataset.level as ManagementLevel);
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

feedbackScale.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-feedback]");
  const action = selectedFeedbackAction();
  if (!button || !action) return;
  void submitFeedback(action.id, button.dataset.feedback as ActionFeedbackRating);
});

element<HTMLButtonElement>("sidebar").addEventListener("click", () => {
  void openStack();
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
  learningMode.checked = settings.learningMode;
  level.querySelectorAll<HTMLButtonElement>("button[data-level]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.level === settings.managementLevel);
  });
  allowReorder.checked = settings.allowReorder;
  allowGroup.checked = settings.allowGroup;
  allowCleanupGroup.checked = settings.allowCleanupGroup;
  allowClose.checked = settings.allowClose;
  allowOpen.checked = settings.allowOpen;
  inactiveHours.value = String(settings.inactiveCloseHours);
  if (!settings.enabled) {
    statusDot.className = "dot";
    decode(status, "Standing by");
  } else if (settings.onboarded) {
    statusDot.className = "dot ok";
    decode(status, "Quietly managing");
  } else {
    statusDot.className = "dot warn";
    decode(status, "Setup pending");
  }
  protectedCount.textContent = `${Object.keys(state.protectedTabs).length + Object.keys(state.protectedGroups).length} protected`;
  const github = element<HTMLAnchorElement>("github");
  github.href = extensionConfig.githubUrl;
  renderFeedback();
}

async function save(settings: Partial<Settings>): Promise<void> {
  state = await sendMessage<RuntimeState>({ type: "save-settings", settings });
  await render();
}

async function openStack(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id !== undefined) {
      await chrome.sidePanel.setOptions({
        path: "sidebar.html",
        enabled: true
      });
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      window.close();
      return;
    }
  } catch {
    // Fall back to the background worker path below.
  }

  await sendMessage({ type: "open-sidebar" });
  window.close();
}

function renderFeedback(): void {
  const action = selectedFeedbackAction();
  feedbackPanel.hidden = !state.settings.learningMode || !action;
  if (!action) return;

  feedbackAction.textContent = action.label;
  feedbackScale.querySelectorAll<HTMLButtonElement>("button[data-feedback]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.feedback === action.feedback);
  });
}

function selectedFeedbackAction(): ExtensionAction | undefined {
  const actionId = new URLSearchParams(location.search).get("feedback");
  if (actionId) {
    return state.actions.find((action) => action.id === actionId);
  }
  return state.actions.find((action) => !action.undone);
}

async function submitFeedback(
  actionId: string,
  rating: ActionFeedbackRating
): Promise<void> {
  state = await sendMessage<RuntimeState>({ type: "submit-feedback", actionId, rating });
  renderFeedback();
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}
