export type ManagementLevel = "minimal" | "medium" | "maximum";

export type TabEventType =
  | "opened"
  | "closed"
  | "activated"
  | "moved"
  | "grouped"
  | "ungrouped"
  | "pinned"
  | "unpinned"
  | "restored"
  | "reopened"
  | "groupRenamed"
  | "groupRecolored"
  | "undo"
  | "redo";

export type ActionType =
  | "group-tabs"
  | "move-tabs"
  | "move-to-cleanup"
  | "close-tabs"
  | "open-tab"
  | "protect-tab"
  | "protect-group";

export type GroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

export interface LevelPermissions {
  allowOpen: boolean;
  allowClose: boolean;
  allowReorder: boolean;
  allowGroup: boolean;
  allowCleanupGroup: boolean;
}

export interface ExtensionConfig {
  warmupEventTarget: number;
  cleanupGroupTtlHours: number;
  defaultInactiveCloseHours: number;
  recentActionLimit: number;
  maxEventsStored: number;
  automationIntervalMinutes: number;
  githubUrl: string;
  managementLevels: Record<ManagementLevel, LevelPermissions>;
}

export interface Settings {
  enabled: boolean;
  onboarded: boolean;
  managementLevel: ManagementLevel;
  allowOpen: boolean;
  allowClose: boolean;
  allowReorder: boolean;
  allowGroup: boolean;
  allowCleanupGroup: boolean;
  inactiveCloseHours: number;
  cleanupGroupTtlHours: number;
  warmupEventTarget: number;
}

export interface TabSnapshot {
  id?: number;
  windowId: number;
  index: number;
  groupId?: number;
  groupTitle?: string;
  groupColor?: GroupColor;
  title?: string;
  url: string;
  domain: string;
  active: boolean;
  pinned: boolean;
  audible?: boolean;
  lastAccessedAt: number;
  openedAt: number;
}

export interface TabEvent {
  id: string;
  type: TabEventType;
  at: number;
  tabId?: number;
  windowId?: number;
  groupId?: number;
  url?: string;
  domain?: string;
}

export interface LearnedCategory {
  id: string;
  label: string;
  color: GroupColor;
  domains: string[];
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface DomainLearning {
  domain: string;
  categoryId?: string;
  keepScore: number;
  closeScore: number;
  groupDislikeScore?: number;
  cleanupDislikeScore?: number;
  reopenCount: number;
  undoCount: number;
  lastSeenAt: number;
  inactiveCloseHours?: number;
}

export interface WorkflowPair {
  key: string;
  leftDomain: string;
  rightDomain: string;
  score: number;
  lastSeenAt: number;
}

export interface ProtectedTab {
  url: string;
  title?: string;
  createdAt: number;
}

export interface ProtectedGroup {
  title: string;
  color?: GroupColor;
  createdAt: number;
}

export interface TabPreference {
  url: string;
  ungroupCount: number;
  avoidGroupingUntil?: number;
  avoidCleanupUntil?: number;
  updatedAt: number;
}

export interface ActionSnapshot {
  url: string;
  title?: string;
  windowId: number;
  index: number;
  groupId?: number;
  groupTitle?: string;
  groupColor?: GroupColor;
  pinned?: boolean;
}

export interface ExtensionAction {
  id: string;
  type: ActionType;
  label: string;
  at: number;
  reversible: boolean;
  undone?: boolean;
  redone?: boolean;
  snapshots: ActionSnapshot[];
  meta?: Record<string, string | number | boolean>;
}

export interface RuntimeState {
  stateVersion: number;
  settings: Settings;
  tabMemory: Record<number, TabSnapshot>;
  events: TabEvent[];
  actions: ExtensionAction[];
  redoStack: ExtensionAction[];
  categories: Record<string, LearnedCategory>;
  domains: Record<string, DomainLearning>;
  workflowPairs: Record<string, WorkflowPair>;
  tabPreferences: Record<string, TabPreference>;
  protectedTabs: Record<string, ProtectedTab>;
  protectedGroups: Record<string, ProtectedGroup>;
  cleanupGroups: Record<number, { createdAt: number; expiresAt: number }>;
}

export interface TabCandidate extends TabSnapshot {
  protected: boolean;
}

export interface PlannedAction {
  type: ActionType;
  label: string;
  tabs: TabCandidate[];
  category?: LearnedCategory;
  targetIndex?: number;
  cleanup?: boolean;
}
