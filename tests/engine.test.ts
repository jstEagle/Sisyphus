import { describe, expect, it } from "vitest";
import {
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
import type { ExtensionAction, TabSnapshot } from "../src/core/types";

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
    let state = createInitialState();
    const tabs = [
      tab({ id: 1, url: "https://github.com/a", domain: "github.com", index: 0 }),
      tab({ id: 2, url: "https://github.com/b", domain: "github.com", index: 1 }),
      tab({ id: 3, url: "https://example.com", domain: "example.com", index: 2 })
    ];
    state = rememberTabs(state, tabs);

    const plans = planAutomation(state, tabs, now);

    expect(plans.some((plan) => plan.type === "group-tabs")).toBe(false);
  });

  it("can group tabs when grouping is explicitly enabled and category evidence is strong", () => {
    let state = createInitialState({
      ...createInitialState().settings,
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
    let state = createInitialState();
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
    let state = createInitialState();
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
    let state = createInitialState();
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
});

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
