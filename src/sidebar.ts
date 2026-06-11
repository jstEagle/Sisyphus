import "./styles.css";
import "./sidebar.css";
import { warmupProgress } from "./core/engine";
import type { ExtensionAction, RuntimeState } from "./core/types";
import { loadRuntimeState, sendMessage } from "./ui/messages";

const actions = element<HTMLElement>("actions");
const empty = element<HTMLElement>("empty");
const learning = element<HTMLElement>("learning");
const fill = element<HTMLElement>("fill");
const learningText = element<HTMLElement>("learningText");

element<HTMLButtonElement>("refresh").addEventListener("click", () => {
  void render();
});

void render();
setInterval(() => void render(), 5_000);

async function render(): Promise<void> {
  const state = await loadRuntimeState();
  renderLearning(state);
  renderActions(state);
}

function renderLearning(state: RuntimeState): void {
  const progress = warmupProgress(state);
  const isDone = progress >= 1;
  learning.hidden = isDone;
  fill.style.height = `${Math.round(progress * 100)}%`;
  learningText.textContent = `${state.events.length} / ${state.settings.warmupEventTarget} events`;
}

function renderActions(state: RuntimeState): void {
  actions.replaceChildren();
  empty.hidden = state.actions.length > 0;
  for (const action of state.actions) {
    actions.append(actionItem(action));
  }
}

function actionItem(action: ExtensionAction): HTMLElement {
  const item = document.createElement("article");
  item.className = "action-item";
  if (action.undone) item.classList.add("undone");

  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = action.label;
  const meta = document.createElement("span");
  meta.textContent = relativeTime(action.at);
  copy.append(title, meta);

  const controls = document.createElement("div");
  controls.className = "item-controls";

  const undo = document.createElement("button");
  undo.textContent = "Undo";
  undo.disabled = Boolean(action.undone);
  undo.addEventListener("click", async () => {
    await sendMessage({ type: "undo", actionId: action.id });
    await render();
  });

  const redo = document.createElement("button");
  redo.textContent = "Redo";
  redo.disabled = !action.undone;
  redo.addEventListener("click", async () => {
    await sendMessage({ type: "redo", actionId: action.id });
    await render();
  });

  controls.append(undo, redo);
  item.append(copy, controls);
  return item;
}

function relativeTime(at: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}
