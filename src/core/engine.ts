import type {
  DomainLearning,
  ExtensionAction,
  GroupColor,
  LearnedCategory,
  PlannedAction,
  RuntimeState,
  TabCandidate,
  TabEvent,
  TabEventType,
  TabSnapshot
} from "./types";
import { normalizeUrlForProtection, pairKey } from "./url";

const CATEGORY_COLORS: GroupColor[] = [
  "blue",
  "green",
  "purple",
  "cyan",
  "orange",
  "yellow",
  "pink",
  "red",
  "grey"
];

const DOMAIN_LABELS: Record<string, string> = {
  "github.com": "Dev",
  "graphite.dev": "Dev",
  "vercel.com": "Dev",
  "linear.app": "Dev",
  "localhost": "Dev",
  "mail.google.com": "Mail",
  "calendar.google.com": "Calendar",
  "docs.google.com": "Docs",
  "drive.google.com": "Docs",
  "youtube.com": "Watch",
  "netflix.com": "Watch"
};

export function isWarmup(state: RuntimeState): boolean {
  return state.events.length < state.settings.warmupEventTarget;
}

export function warmupProgress(state: RuntimeState): number {
  return Math.min(1, state.events.length / state.settings.warmupEventTarget);
}

export function recordEvent(
  state: RuntimeState,
  event: Omit<TabEvent, "id" | "at"> & { at?: number }
): RuntimeState {
  const at = event.at ?? Date.now();
  const nextEvent: TabEvent = {
    ...event,
    id: crypto.randomUUID(),
    at
  };

  const domain = event.domain;
  const domains = { ...state.domains };
  if (domain) {
    const existing = domains[domain] ?? createDomainLearning(domain, at);
    domains[domain] = {
      ...existing,
      lastSeenAt: at,
      keepScore: existing.keepScore + keepDeltaForEvent(event.type),
      closeScore: Math.max(0, existing.closeScore + closeDeltaForEvent(event.type))
    };
  }

  return {
    ...state,
    domains,
    events: [...state.events, nextEvent]
  };
}

export function rememberTabs(state: RuntimeState, tabs: TabSnapshot[]): RuntimeState {
  const tabMemory = { ...state.tabMemory };
  const domains = { ...state.domains };
  const categories = { ...state.categories };
  const now = Date.now();

  for (const tab of tabs) {
    if (tab.id !== undefined) {
      tabMemory[tab.id] = tab;
    }
    const domain = tab.domain;
    const domainLearning = domains[domain] ?? createDomainLearning(domain, now);
    const category = ensureCategory(categories, domain, now);
    domains[domain] = {
      ...domainLearning,
      categoryId: category.id,
      lastSeenAt: now
    };
  }

  return {
    ...state,
    tabMemory,
    domains,
    categories
  };
}

export function learnFromUndo(state: RuntimeState, action: ExtensionAction): RuntimeState {
  let next = recordEvent(state, { type: "undo" });
  const domains = { ...next.domains };

  for (const snapshot of action.snapshots) {
    const domain = new URL(snapshot.url).hostname.replace(/^www\./, "");
    const existing = domains[domain] ?? createDomainLearning(domain, Date.now());
    domains[domain] = {
      ...existing,
      keepScore: existing.keepScore + 5,
      closeScore: Math.max(0, existing.closeScore - 4),
      undoCount: existing.undoCount + 1,
      inactiveCloseHours: Math.max(existing.inactiveCloseHours ?? 0, 24)
    };
  }

  next = {
    ...next,
    domains
  };
  return next;
}

export function learnWorkflowSwitch(
  state: RuntimeState,
  previous: TabSnapshot | undefined,
  nextTab: TabSnapshot | undefined
): RuntimeState {
  if (!previous || !nextTab || previous.domain === nextTab.domain) return state;
  const key = pairKey(previous.domain, nextTab.domain);
  const existing = state.workflowPairs[key] ?? {
    key,
    leftDomain: previous.domain,
    rightDomain: nextTab.domain,
    score: 0,
    lastSeenAt: Date.now()
  };

  return {
    ...state,
    workflowPairs: {
      ...state.workflowPairs,
      [key]: {
        ...existing,
        score: existing.score + 1,
        lastSeenAt: Date.now()
      }
    }
  };
}

export function planAutomation(
  state: RuntimeState,
  tabs: TabSnapshot[],
  now = Date.now()
): PlannedAction[] {
  if (!state.settings.enabled) return [];

  const candidates = tabs.map<TabCandidate>((tab) => ({
    ...tab,
    protected: isProtected(state, tab)
  }));
  const actions: PlannedAction[] = [];

  if (state.settings.allowGroup) {
    actions.push(...planGroups(state, candidates));
  }

  if (state.settings.allowReorder) {
    actions.push(...planWorkflowMoves(state, candidates));
  }

  if (state.settings.allowCleanupGroup) {
    actions.push(...planCleanupGroups(state, candidates, now));
  }

  if (state.settings.allowClose && !isWarmup(state)) {
    actions.push(...planCloses(state, candidates, now));
  }

  return actions;
}

export function createAction(
  type: PlannedAction["type"],
  label: string,
  tabs: TabSnapshot[],
  meta: ExtensionAction["meta"] = {}
): ExtensionAction {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    at: Date.now(),
    reversible: true,
    snapshots: tabs.map((tab) => ({
      url: tab.url,
      ...(tab.title ? { title: tab.title } : {}),
      windowId: tab.windowId,
      index: tab.index,
      ...(tab.groupId !== undefined ? { groupId: tab.groupId } : {}),
      ...(tab.groupTitle ? { groupTitle: tab.groupTitle } : {}),
      ...(tab.groupColor ? { groupColor: tab.groupColor } : {}),
      pinned: tab.pinned
    })),
    meta
  };
}

export function pushAction(state: RuntimeState, action: ExtensionAction): RuntimeState {
  return {
    ...state,
    actions: [action, ...state.actions],
    redoStack: []
  };
}

export function markUndone(state: RuntimeState, actionId: string): RuntimeState {
  const action = state.actions.find((item) => item.id === actionId);
  if (!action) return state;
  return {
    ...state,
    actions: state.actions.map((item) =>
      item.id === actionId ? { ...item, undone: true, redone: false } : item
    ),
    redoStack: [{ ...action, undone: true }, ...state.redoStack]
  };
}

export function markRedone(state: RuntimeState, actionId: string): RuntimeState {
  const action = state.redoStack.find((item) => item.id === actionId);
  if (!action) return state;
  return {
    ...state,
    actions: state.actions.map((item) =>
      item.id === actionId ? { ...item, undone: false, redone: true } : item
    ),
    redoStack: state.redoStack.filter((item) => item.id !== actionId)
  };
}

export function protectTab(state: RuntimeState, tab: TabSnapshot): RuntimeState {
  const key = normalizeUrlForProtection(tab.url);
  const protectedTab = {
    url: key,
    ...(tab.title ? { title: tab.title } : {}),
    createdAt: Date.now()
  };
  return {
    ...state,
    protectedTabs: {
      ...state.protectedTabs,
      [key]: protectedTab
    }
  };
}

export function protectGroup(
  state: RuntimeState,
  group: { title?: string; color?: GroupColor }
): RuntimeState {
  if (!group.title) return state;
  const protectedGroup = {
    title: group.title,
    ...(group.color ? { color: group.color } : {}),
    createdAt: Date.now()
  };
  return {
    ...state,
    protectedGroups: {
      ...state.protectedGroups,
      [group.title]: protectedGroup
    }
  };
}

function planGroups(state: RuntimeState, tabs: TabCandidate[]): PlannedAction[] {
  const byCategory = new Map<string, TabCandidate[]>();
  for (const tab of tabs) {
    if (tab.protected || !tab.id || tab.groupId !== undefined) continue;
    const category = categoryForDomain(state, tab.domain);
    if (!category) continue;
    const current = byCategory.get(category.id) ?? [];
    current.push(tab);
    byCategory.set(category.id, current);
  }

  return [...byCategory.entries()].flatMap(([categoryId, groupedTabs]) => {
    const category = state.categories[categoryId];
    if (groupedTabs.length < 2 || !category) return [];
    return [
      {
        type: "group-tabs" as const,
        label: `Grouped ${groupedTabs.length} tabs as ${category.label}`,
        tabs: groupedTabs,
        category
      }
    ];
  });
}

function planWorkflowMoves(state: RuntimeState, tabs: TabCandidate[]): PlannedAction[] {
  const strongPairs = Object.values(state.workflowPairs)
    .filter((pair) => pair.score >= 3)
    .sort((a, b) => b.score - a.score);

  for (const pair of strongPairs) {
    const left = tabs.find((tab) => !tab.protected && tab.domain === pair.leftDomain);
    const right = tabs.find((tab) => !tab.protected && tab.domain === pair.rightDomain);
    if (!left || !right || left.windowId !== right.windowId) continue;
    if (Math.abs(left.index - right.index) <= 1) continue;

    return [
      {
        type: "move-tabs",
        label: `Moved related tabs together`,
        tabs: [right],
        targetIndex: left.index + 1
      }
    ];
  }

  return [];
}

function planCleanupGroups(
  state: RuntimeState,
  tabs: TabCandidate[],
  now: number
): PlannedAction[] {
  const inactive = tabs.filter((tab) => {
    if (tab.protected || !tab.id) return false;
    const inactiveHours = (now - tab.lastAccessedAt) / 3_600_000;
    const threshold = inactiveThresholdForTab(state, tab) * 0.7;
    return inactiveHours >= threshold;
  });

  if (inactive.length === 0) return [];
  return [
    {
      type: "move-to-cleanup",
      label: `Moved ${inactive.length} stale tab${inactive.length === 1 ? "" : "s"} to Later`,
      tabs: inactive,
      cleanup: true
    }
  ];
}

function planCloses(state: RuntimeState, tabs: TabCandidate[], now: number): PlannedAction[] {
  const stale = tabs.filter((tab) => {
    if (tab.protected || !tab.id) return false;
    const inactiveHours = (now - tab.lastAccessedAt) / 3_600_000;
    return inactiveHours >= inactiveThresholdForTab(state, tab);
  });

  if (stale.length === 0) return [];
  return [
    {
      type: "close-tabs",
      label: `Closed ${stale.length} stale tab${stale.length === 1 ? "" : "s"}`,
      tabs: stale
    }
  ];
}

function isProtected(state: RuntimeState, tab: TabSnapshot): boolean {
  if (state.protectedTabs[normalizeUrlForProtection(tab.url)]) return true;
  if (tab.groupTitle && state.protectedGroups[tab.groupTitle]) return true;
  return false;
}

function inactiveThresholdForTab(state: RuntimeState, tab: TabSnapshot): number {
  const learning = state.domains[tab.domain];
  if (!learning) return state.settings.inactiveCloseHours;
  const learned = learning.inactiveCloseHours ?? state.settings.inactiveCloseHours;
  const keepBias = Math.max(0, learning.keepScore - learning.closeScore);
  return Math.min(72, learned + keepBias * 0.5 + learning.reopenCount * 3);
}

function categoryForDomain(
  state: RuntimeState,
  domain: string
): LearnedCategory | undefined {
  const learning = state.domains[domain];
  if (learning?.categoryId) return state.categories[learning.categoryId];
  return undefined;
}

function ensureCategory(
  categories: Record<string, LearnedCategory>,
  domain: string,
  now: number
): LearnedCategory {
  const label = labelForDomain(domain);
  const existing = Object.values(categories).find((category) => category.label === label);
  if (existing) {
    existing.domains = Array.from(new Set([...existing.domains, domain]));
    existing.updatedAt = now;
    existing.score += 1;
    return existing;
  }

  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || domain;
  const color = CATEGORY_COLORS[Object.keys(categories).length % CATEGORY_COLORS.length] ?? "grey";
  const category: LearnedCategory = {
    id,
    label,
    color,
    domains: [domain],
    score: 1,
    createdAt: now,
    updatedAt: now
  };
  categories[id] = category;
  return category;
}

function labelForDomain(domain: string): string {
  const known = DOMAIN_LABELS[domain];
  if (known) return known;
  const base = domain.split(".").at(-2) ?? domain;
  return titleCase(base);
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 18);
}

function createDomainLearning(domain: string, at: number): DomainLearning {
  return {
    domain,
    keepScore: 0,
    closeScore: 0,
    reopenCount: 0,
    undoCount: 0,
    lastSeenAt: at
  };
}

function keepDeltaForEvent(type: TabEventType): number {
  if (type === "activated" || type === "restored" || type === "reopened") return 1;
  if (type === "undo") return 3;
  return 0;
}

function closeDeltaForEvent(type: TabEventType): number {
  if (type === "closed") return 1;
  if (type === "undo" || type === "reopened") return -2;
  return 0;
}
