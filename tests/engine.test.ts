import { describe, expect, it } from "vitest";
import {
  createAction,
  learnFromActionFeedback,
  learnFromManualUngroup,
  learnFromUndo,
  learnWorkflowSwitch,
  planAutomation,
  pushAction,
  recordEvent,
  rememberTabs,
  warmupProgress
} from "../src/core/engine";
import { createInitialState } from "../src/core/state";
import type { ExtensionAction, Settings, TabSnapshot } from "../src/core/types";

const now = new Date("2026-06-11T00:00:00Z").getTime();

describe("engine", () => {
  it("tracks warmup progress toward 150 events", () => {
    let state = createInitialState();
    for (let index = 0; index < 75; index += 1) {
      state = recordEvent(state, { type: "activated", domain: "github.com", at: now + index });
    }

    expect(warmupProgress(state)).toBe(0.5);
  });

  it("does not group tabs by default", () => {
    let state = onboardedState();
    const tabs = [
      tab({ id: 1, url: "https://github.com/a", domain: "github.com", index: 0 }),
      tab({ id: 2, url: "https://github.com/b", domain: "github.com", index: 1 }),
      tab({ id: 3, url: "https://example.com", domain: "example.com", index: 2 })
    ];
    state = rememberTabs(state, tabs);

    const plans = planAutomation(state, tabs, now);

    expect(plans.some((plan) => plan.type === "group-tabs")).toBe(false);
  });

  it("does not automate before onboarding is complete", () => {
    let state = createInitialState();
    const oldTab = tab({
      id: 1,
      url: "https://old.example.com",
      domain: "old.example.com",
      lastAccessedAt: now - 30 * 3_600_000
    });
    for (let index = 0; index < 150; index += 1) {
      state = recordEvent(state, { type: "activated", domain: "github.com", at: now + index });
    }
    state = rememberTabs(state, [oldTab]);

    const plans = planAutomation(state, [oldTab], now);

    expect(plans).toEqual([]);
  });

  it("can group tabs when grouping is explicitly enabled and category evidence is strong", () => {
    let state = createInitialState({
      ...createInitialState().settings,
      onboarded: true,
      allowGroup: true
    });
    const tabs = [
      tab({ id: 1, url: "https://github.com/a", domain: "github.com", index: 0 }),
      tab({ id: 2, url: "https://github.com/b", domain: "github.com", index: 1 }),
      tab({ id: 3, url: "https://example.com", domain: "example.com", index: 2 })
    ];
    for (let index = 0; index < 6; index += 1) {
      state = rememberTabs(state, tabs);
    }

    const plans = planAutomation(state, tabs, now);

    expect(plans.some((plan) => plan.type === "group-tabs" && plan.tabs.length === 2)).toBe(true);
  });

  it("learns not to restage a tab when the user pulls it out of Later", () => {
    let state = onboardedState();
    const oldTab = tab({
      id: 1,
      url: "https://old.example.com/still-needed",
      domain: "old.example.com",
      groupTitle: "Later",
      lastAccessedAt: now - 30 * 3_600_000
    });
    state = rememberTabs(state, [oldTab]);
    state = learnFromManualUngroup(state, oldTab, "Later");

    const { groupTitle: _groupTitle, groupId: _groupId, ...currentTab } = oldTab;
    const plans = planAutomation(state, [currentTab], now);

    expect(plans.some((plan) => plan.type === "move-to-cleanup")).toBe(false);
  });

  it("keeps workflow-paired tabs adjacent", () => {
    let state = onboardedState();
    const left = tab({ id: 1, url: "https://github.com/a", domain: "github.com", index: 0 });
    const right = tab({ id: 2, url: "https://vercel.com/x", domain: "vercel.com", index: 5 });
    state = rememberTabs(state, [left, right]);
    state = learnWorkflowSwitch(state, left, right);
    state = learnWorkflowSwitch(state, left, right);
    state = learnWorkflowSwitch(state, left, right);

    const plans = planAutomation(state, [left, right], now);

    expect(plans.some((plan) => plan.type === "move-tabs")).toBe(true);
  });

  it("does not close tabs during warmup", () => {
    let state = onboardedState();
    const oldTab = tab({
      id: 1,
      url: "https://old.example.com",
      domain: "old.example.com",
      lastAccessedAt: now - 30 * 3_600_000
    });
    state = rememberTabs(state, [oldTab]);

    const plans = planAutomation(state, [oldTab], now);

    expect(plans.some((plan) => plan.type === "close-tabs")).toBe(false);
  });

  it("does not stage active, pinned, audible, or already grouped tabs for Later", () => {
    let state = onboardedState();
    for (let index = 0; index < 150; index += 1) {
      state = recordEvent(state, { type: "activated", domain: "github.com", at: now + index });
    }
    const tabs = [
      tab({
        id: 1,
        url: "https://active.example.com",
        domain: "active.example.com",
        active: true,
        lastAccessedAt: now - 30 * 3_600_000
      }),
      tab({
        id: 2,
        url: "https://pinned.example.com",
        domain: "pinned.example.com",
        pinned: true,
        lastAccessedAt: now - 30 * 3_600_000
      }),
      tab({
        id: 3,
        url: "https://audio.example.com",
        domain: "audio.example.com",
        audible: true,
        lastAccessedAt: now - 30 * 3_600_000
      }),
      tab({
        id: 4,
        url: "https://grouped.example.com",
        domain: "grouped.example.com",
        groupId: 5,
        groupTitle: "Later",
        lastAccessedAt: now - 30 * 3_600_000
      })
    ];
    state = rememberTabs(state, tabs);

    const plans = planAutomation(state, tabs, now);

    expect(plans.some((plan) => plan.type === "move-to-cleanup")).toBe(false);
  });

  it("stages only inactive ungrouped tabs for Later after warmup", () => {
    let state = onboardedState();
    for (let index = 0; index < 150; index += 1) {
      state = recordEvent(state, { type: "activated", domain: "github.com", at: now + index });
    }
    const staleTab = tab({
      id: 1,
      url: "https://old.example.com",
      domain: "old.example.com",
      lastAccessedAt: now - 30 * 3_600_000
    });
    state = rememberTabs(state, [staleTab]);

    const plans = planAutomation(state, [staleTab], now);

    expect(plans.some((plan) => plan.type === "move-to-cleanup")).toBe(true);
  });

  it("learns from undo and becomes more conservative for a domain", () => {
    let state = createInitialState();
    const action: ExtensionAction = {
      id: "action-1",
      type: "close-tabs",
      label: "Closed stale tab",
      at: now,
      reversible: true,
      snapshots: [
        {
          url: "https://github.com/important",
          windowId: 1,
          index: 0
        }
      ]
    };

    state = pushAction(state, action);
    state = learnFromUndo(state, action);

    expect(state.domains["github.com"]?.keepScore).toBeGreaterThan(0);
    expect(state.domains["github.com"]?.undoCount).toBe(1);
  });

  it("strongly suppresses similar cleanup after bad learning feedback", () => {
    let state = warmedOnboardedState();
    const staleTab = tab({
      id: 1,
      url: "https://old.example.com/still-needed",
      domain: "old.example.com",
      lastAccessedAt: now - 30 * 3_600_000
    });
    state = rememberTabs(state, [staleTab]);
    const action = createAction("move-to-cleanup", "Moved 1 stale tab to Later", [staleTab]);

    state = pushAction(state, action);
    state = learnFromActionFeedback(state, action.id, "bad", now);

    const plans = planAutomation(state, [staleTab], now);

    expect(plans.some((plan) => plan.type === "move-to-cleanup")).toBe(false);
    expect(state.actions[0]?.feedback).toBe("bad");
  });

  it("strongly reinforces similar grouping after good learning feedback", () => {
    let state = warmedOnboardedState({ allowGroup: true });
    const tabs = [
      tab({ id: 1, url: "https://github.com/a", domain: "github.com", index: 0 }),
      tab({ id: 2, url: "https://github.com/b", domain: "github.com", index: 1 })
    ];
    state = rememberTabs(state, tabs);
    const beforeFeedback = planAutomation(state, tabs, now);
    const action = createAction("group-tabs", "Grouped 2 tabs as Dev", tabs);

    state = pushAction(state, action);
    state = learnFromActionFeedback(state, action.id, "good", now);
    const afterFeedback = planAutomation(state, tabs, now);

    expect(beforeFeedback.some((plan) => plan.type === "group-tabs")).toBe(false);
    expect(afterFeedback.some((plan) => plan.type === "group-tabs")).toBe(true);
  });
});

function onboardedState() {
  return createInitialState({
    ...createInitialState().settings,
    onboarded: true
  });
}

function warmedOnboardedState(settings: Partial<Settings> = {}) {
  let state = createInitialState({
    ...createInitialState().settings,
    onboarded: true,
    ...settings
  });
  for (let index = 0; index < 150; index += 1) {
    state = recordEvent(state, { type: "activated", domain: "warmup.example.com", at: now + index });
  }
  return state;
}

function tab(overrides: Partial<TabSnapshot>): TabSnapshot {
  return {
    id: 1,
    windowId: 1,
    index: 0,
    title: "Tab",
    url: "https://example.com",
    domain: "example.com",
    active: false,
    pinned: false,
    lastAccessedAt: now,
    openedAt: now,
    ...overrides
  };
}
