import { extensionConfig } from "./core/config";
import {
  createAction,
  learnFromUndo,
  learnWorkflowSwitch,
  markRedone,
  markUndone,
  planAutomation,
  protectGroup,
  protectTab,
  pushAction,
  recordEvent,
  rememberTabs
} from "./core/engine";
import { exportState, importState, loadState, saveState } from "./core/state";
import type {
  ExtensionAction,
  GroupColor,
  PlannedAction,
  RuntimeState,
  TabEvent,
  TabSnapshot
} from "./core/types";
import { domainFromUrl } from "./core/url";

const CLEANUP_GROUP_TITLE = "Later";
const MENU_PROTECT_TAB = "protect-tab";
const MENU_PROTECT_GROUP = "protect-group";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureSetup();
  if (reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onStartup.addListener(ensureSetup);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sisyphus-automation") {
    void runAutomation();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenu(info.menuItemId.toString(), tab);
});

chrome.tabs.onCreated.addListener((tab) => {
  void withState(async (state) => {
    const snapshot = snapshotFromChromeTab(tab);
    return rememberTabs(recordEvent(state, tabEvent("opened", snapshot)), [snapshot]);
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  void withState(async (state) => {
    const remembered = state.tabMemory[tabId];
    const event: Omit<TabEvent, "id" | "at"> = {
      type: "closed",
      tabId,
      windowId: removeInfo.windowId,
      ...(remembered?.url ? { url: remembered.url } : {}),
      ...(remembered?.domain ? { domain: remembered.domain } : {})
    };
    return recordEvent(state, event);
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void updateContextMenusForActiveTab();
  void withState(async (state) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const snapshot = snapshotFromChromeTab(tab);
    const previousActive = Object.values(state.tabMemory).find(
      (item) => item.windowId === activeInfo.windowId && item.active
    );
    const remembered = rememberTabs(
      recordEvent(state, tabEvent("activated", snapshot)),
      [{ ...snapshot, active: true }]
    );
    return learnWorkflowSwitch(remembered, previousActive, snapshot);
  });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  void withState(async (state) => {
    const remembered = state.tabMemory[tabId];
    const event: Omit<TabEvent, "id" | "at"> = {
      type: "moved",
      tabId,
      windowId: moveInfo.windowId,
      ...(remembered?.url ? { url: remembered.url } : {}),
      ...(remembered?.domain ? { domain: remembered.domain } : {})
    };
    return recordEvent(state, event);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active) void updateContextMenusForActiveTab();
  void withState(async (state) => {
    let next = state;
    const snapshot = snapshotFromChromeTab(tab);
    if (changeInfo.pinned === true) {
      next = recordEvent(next, tabEvent("pinned", snapshot));
    } else if (changeInfo.pinned === false) {
      next = recordEvent(next, tabEvent("unpinned", snapshot));
    }
    if (changeInfo.url) {
      next = recordEvent(next, tabEvent("opened", snapshot));
    }
    return rememberTabs(next, [snapshot]);
  });
});

chrome.tabGroups.onUpdated.addListener((group) => {
  void withState(async (state) => {
    let next = state;
    if (group.title) {
      next = recordEvent(next, {
        type: "groupRenamed",
        groupId: group.id,
        windowId: group.windowId
      });
    }
    if (group.color) {
      next = recordEvent(next, {
        type: "groupRecolored",
        groupId: group.id,
        windowId: group.windowId
      });
    }
    return next;
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "undo-last-action") void undoLastAction();
  if (command === "redo-last-action") void redoLastAction();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse({ ok: true, data: response }))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    );
  return true;
});

async function ensureSetup(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_PROTECT_TAB,
    title: "Protect this tab",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: MENU_PROTECT_GROUP,
    title: "Protect group",
    contexts: ["page"],
    visible: false
  });
  await updateContextMenusForActiveTab();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  await chrome.alarms.create("sisyphus-automation", {
    periodInMinutes: extensionConfig.automationIntervalMinutes
  });
}

async function updateContextMenusForActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.contextMenus.update(MENU_PROTECT_GROUP, {
    visible: Boolean(tab?.groupId !== undefined && tab.groupId >= 0)
  });
}

async function handleMessage(message: unknown): Promise<unknown> {
  if (!isMessage(message)) throw new Error("Invalid message.");

  if (message.type === "get-state") {
    return loadState();
  }

  if (message.type === "save-settings") {
    return withState(async (state) => ({
      ...state,
      settings: {
        ...state.settings,
        ...message.settings
      }
    }));
  }

  if (message.type === "finish-onboarding") {
    return withState(async (state) => ({
      ...state,
      settings: {
        ...state.settings,
        ...message.settings,
        onboarded: true
      }
    }));
  }

  if (message.type === "undo") {
    return undoAction(message.actionId);
  }

  if (message.type === "redo") {
    return redoAction(message.actionId);
  }

  if (message.type === "export") {
    return exportState();
  }

  if (message.type === "import") {
    return importState(message.payload);
  }

  if (message.type === "open-sidebar") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    return true;
  }

  throw new Error(`Unknown message type: ${message.type}`);
}

async function handleContextMenu(menuItemId: string, tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.url) return;
  const snapshot = snapshotFromChromeTab(tab);

  await withState(async (state) => {
    if (menuItemId === MENU_PROTECT_TAB) {
      const action = createAction("protect-tab", "Protected tab", [snapshot]);
      return pushAction(protectTab(recordEvent(state, tabEvent("pinned", snapshot)), snapshot), action);
    }

    if (menuItemId === MENU_PROTECT_GROUP && tab.groupId !== undefined && tab.groupId >= 0) {
      const group = await chrome.tabGroups.get(tab.groupId);
      const action = createAction("protect-group", "Protected group", [snapshot], {
        groupTitle: group.title ?? "Group"
      });
      return pushAction(
        protectGroup(state, {
          ...(group.title ? { title: group.title } : {}),
          color: group.color as GroupColor
        }),
        action
      );
    }

    return state;
  });
}

async function runAutomation(): Promise<void> {
  await withState(async (state) => {
    const tabs = await querySnapshots();
    let next = rememberTabs(state, tabs);
    const plans = planAutomation(next, tabs);
    for (const plan of plans.slice(0, 2)) {
      next = await executePlan(next, plan);
    }
    return next;
  });
}

async function executePlan(state: RuntimeState, plan: PlannedAction): Promise<RuntimeState> {
  if (plan.tabs.length === 0) return state;
  const action = createAction(plan.type, plan.label, plan.tabs, {
    category: plan.category?.label ?? "",
    cleanup: plan.cleanup ?? false
  });

  if (plan.type === "group-tabs") {
    const tabIds = plan.tabs.map((tab) => tab.id).filter(isNumber);
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: plan.category?.label ?? "Tabs",
      color: plan.category?.color ?? "blue",
      collapsed: true
    });
  }

  if (plan.type === "move-tabs") {
    const tabIds = plan.tabs.map((tab) => tab.id).filter(isNumber);
    if (plan.targetIndex !== undefined) {
      await chrome.tabs.move(tabIds, { index: plan.targetIndex });
    }
  }

  if (plan.type === "move-to-cleanup") {
    const tabIds = plan.tabs.map((tab) => tab.id).filter(isNumber);
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: CLEANUP_GROUP_TITLE,
      color: "grey",
      collapsed: true
    });
    state = {
      ...state,
      cleanupGroups: {
        ...state.cleanupGroups,
        [groupId]: {
          createdAt: Date.now(),
          expiresAt: Date.now() + state.settings.cleanupGroupTtlHours * 3_600_000
        }
      }
    };
  }

  if (plan.type === "close-tabs") {
    await chrome.tabs.remove(plan.tabs.map((tab) => tab.id).filter(isNumber));
  }

  return pushAction(state, action);
}

async function undoLastAction(): Promise<RuntimeState> {
  const state = await loadState();
  const action = state.actions.find((item) => !item.undone);
  if (!action) return state;
  return undoAction(action.id);
}

async function redoLastAction(): Promise<RuntimeState> {
  const state = await loadState();
  const action = state.redoStack[0];
  if (!action) return state;
  return redoAction(action.id);
}

async function undoAction(actionId: string): Promise<RuntimeState> {
  return withState(async (state) => {
    const action = state.actions.find((item) => item.id === actionId);
    if (!action || action.undone) return state;
    await reverseAction(action);
    return learnFromUndo(markUndone(state, actionId), action);
  });
}

async function redoAction(actionId: string): Promise<RuntimeState> {
  return withState(async (state) => {
    const action = state.redoStack.find((item) => item.id === actionId);
    if (!action) return state;
    await replayAction(action);
    return markRedone(state, actionId);
  });
}

async function reverseAction(action: ExtensionAction): Promise<void> {
  if (action.type === "close-tabs") {
    for (const snapshot of action.snapshots) {
      const tab = await chrome.tabs.create({
        url: snapshot.url,
        windowId: snapshot.windowId,
        index: snapshot.index,
        pinned: snapshot.pinned
      });
      if (snapshot.groupId !== undefined && snapshot.groupId >= 0 && tab.id !== undefined) {
        try {
          await chrome.tabs.group({ tabIds: [tab.id], groupId: snapshot.groupId });
        } catch {
          // Best effort: Chrome may not have the original group anymore.
        }
      }
    }
    return;
  }

  if (action.type === "move-tabs" || action.type === "group-tabs" || action.type === "move-to-cleanup") {
    for (const snapshot of action.snapshots) {
      const tab = await findTabByUrl(snapshot.url);
      if (!tab?.id) continue;
      await chrome.tabs.move(tab.id, {
        windowId: snapshot.windowId,
        index: snapshot.index
      });
      if (snapshot.groupId !== undefined && snapshot.groupId >= 0) {
        try {
          await chrome.tabs.group({ tabIds: [tab.id], groupId: snapshot.groupId });
        } catch {
          // Best effort: original group may be gone.
        }
      } else {
        await chrome.tabs.ungroup(tab.id);
      }
    }
  }
}

async function replayAction(action: ExtensionAction): Promise<void> {
  const tabs = await Promise.all(action.snapshots.map((snapshot) => findTabByUrl(snapshot.url)));
  const ids = tabs.map((tab) => tab?.id).filter(isNumber);
  if (ids.length === 0 && action.type === "close-tabs") {
    return;
  }
  if (action.type === "close-tabs") await chrome.tabs.remove(ids);
}

async function findTabByUrl(url: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url === url);
}

async function querySnapshots(): Promise<TabSnapshot[]> {
  const tabs = await chrome.tabs.query({});
  return Promise.all(tabs.filter((tab) => Boolean(tab.url)).map(snapshotWithGroup));
}

async function snapshotWithGroup(tab: chrome.tabs.Tab): Promise<TabSnapshot> {
  const snapshot = snapshotFromChromeTab(tab);
  if (tab.groupId === undefined || tab.groupId < 0) return snapshot;
  try {
    const group = await chrome.tabGroups.get(tab.groupId);
    return {
      ...snapshot,
      ...(group.title ? { groupTitle: group.title } : {}),
      ...(group.color ? { groupColor: group.color as GroupColor } : {})
    };
  } catch {
    return snapshot;
  }
}

function snapshotFromChromeTab(tab: chrome.tabs.Tab): TabSnapshot {
  const now = Date.now();
  return {
    ...(tab.id !== undefined ? { id: tab.id } : {}),
    windowId: tab.windowId,
    index: tab.index,
    ...(tab.groupId >= 0 ? { groupId: tab.groupId } : {}),
    ...(tab.title ? { title: tab.title } : {}),
    url: tab.url ?? "about:blank",
    domain: domainFromUrl(tab.url),
    active: tab.active,
    pinned: tab.pinned,
    ...(tab.audible !== undefined ? { audible: tab.audible } : {}),
    lastAccessedAt: tab.lastAccessed ?? now,
    openedAt: now
  };
}

function tabEvent(
  type: Parameters<typeof recordEvent>[1]["type"],
  tab: TabSnapshot
): Parameters<typeof recordEvent>[1] {
  return {
    type,
    ...(tab.id !== undefined ? { tabId: tab.id } : {}),
    windowId: tab.windowId,
    ...(tab.groupId !== undefined ? { groupId: tab.groupId } : {}),
    url: tab.url,
    domain: tab.domain
  };
}

async function withState(
  updater: (state: RuntimeState) => Promise<RuntimeState> | RuntimeState
): Promise<RuntimeState> {
  const state = await loadState();
  const next = await updater(state);
  await saveState(next);
  return next;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number";
}


function isMessage(message: unknown): message is {
  type: string;
  settings?: Partial<RuntimeState["settings"]>;
  actionId: string;
  payload: string;
} {
  return typeof message === "object" && message !== null && "type" in message;
}
