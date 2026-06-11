import rawConfig from "../config/extension-config.json";
import type { ExtensionConfig, Settings } from "./types";

export const extensionConfig = rawConfig as ExtensionConfig;

export function defaultSettings(): Settings {
  const level = "maximum";
  const permissions = extensionConfig.managementLevels[level];

  return {
    enabled: true,
    onboarded: false,
    managementLevel: level,
    allowOpen: permissions.allowOpen,
    allowClose: permissions.allowClose,
    allowReorder: permissions.allowReorder,
    allowGroup: permissions.allowGroup,
    allowCleanupGroup: permissions.allowCleanupGroup,
    inactiveCloseHours: extensionConfig.defaultInactiveCloseHours,
    cleanupGroupTtlHours: extensionConfig.cleanupGroupTtlHours,
    warmupEventTarget: extensionConfig.warmupEventTarget
  };
}

export function settingsForLevel(
  current: Settings,
  level: Settings["managementLevel"]
): Settings {
  const permissions = extensionConfig.managementLevels[level];

  return {
    ...current,
    managementLevel: level,
    allowOpen: permissions.allowOpen,
    allowClose: permissions.allowClose,
    allowReorder: permissions.allowReorder,
    allowGroup: permissions.allowGroup,
    allowCleanupGroup: permissions.allowCleanupGroup
  };
}
