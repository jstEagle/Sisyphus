# Sisyphus Tab Manager Extension

## Current Concept

A Chrome extension that runs quietly in the background and keeps the user's tab
state under control. It should learn from tab usage over time, close stale tabs,
and move likely-discardable tabs into a collapsed temporary group that is deleted
after about a day.

The product should feel like a personal tab steward: tabs stay organized the way
the user prefers without requiring constant manual cleanup.

## Target Audience

- Primary: the project owner, personal-use first because this solves a real
  recurring pain.
- Secondary: other people who keep too many Chrome tabs open and want their
  browser to stay organized without constant manual cleanup.
- Distribution should support public installation from the repository first,
  then eventual Chrome Web Store release.

## Goals

- Prevent tab buildup without making the browser feel unpredictable.
- Learn patterns from actual tab behavior over time.
- Reduce manual tab management work.
- Keep old tabs recoverable for a short grace period before deletion.
- Run mostly in the background.
- Automatically create and maintain groups of similar tabs.
- Feel like an assistant that keeps tabs organized according to the user's
  preferences, not like a rigid cleanup script.
- Make the experience feel like "this is just how Chrome works now" after the
  user gets used to it.
- Deliver the full product shape rather than intentionally downscoping to a
  narrow demo: grouping, cleanup, and learning all matter.

## Non-Goals

- Not a chatbot.
- Not a full bookmarks or read-it-later replacement unless later chosen.
- Not a cross-browser product until Chrome behavior is proven.

## Key Decisions

- Chrome extension.
- Background-first behavior.
- Designed for both personal use and eventual public installation.
- Initial public distribution can be via the repository before a Chrome Web
  Store release.
- Adaptive cleanup model: start cautious, then become more assertive as it
  learns from the user's behavior.
- Uses tab groups as a temporary holding area for tabs the extension thinks can
  be removed soon.
- Temporary cleanup groups should stay collapsed.
- Users can pin tabs or create protected groups that the extension ignores,
  giving them intentional "dead space" it will not manage.
- The default experience should be quiet: actions happen in the background
  without constant prompts or notifications.
- Extension popup should be intentionally simple: on/off, basic settings,
  protected items, import/export, and a GitHub link.
- Extension sidebar should provide a recent-action stack where users can undo
  recent tab management actions.
- Undo/redo should be available through the sidebar and likely keyboard
  shortcuts.
- Learned behavior stays local for now in Chrome extension storage.
- Users should be able to transfer learned behavior manually through an export
  and import flow.
- The extension should begin managing tabs from the start, while weighting early
  user corrections heavily so it adapts quickly.
- On first run, the extension should open a polished onboarding/tutorial page
  with minimal Chrome-native UI before it begins.
- After onboarding, the extension should observe briefly, then start taking
  reversible actions and learn heavily from whether the user undoes them.
- Right-click context menu is the primary way to protect a tab or group.
- The learning-heavy warmup should be based on active browsing, not just elapsed
  time: roughly a few hours of active use or about 150 meaningful user tab
  events, such as opened, closed, rearranged, grouped, or activated tabs.
- During warmup, the extension should take small reversible actions rather than
  only observing.
- All extension actions should be designed as reversible. Undoing a tab close
  should reopen the tab at the same URL and restore placement/group context
  where feasible.
- Undo can be best effort when browser APIs cannot restore every detail, such as
  form state or scroll position.
- Tab closing should only happen after a meaningful inactivity threshold, such
  as around 15 hours open/inactive, and should become more conservative for tabs
  the user repeatedly restores or reopens.
- Cleanup timing should vary by category and even by individual tab/domain
  behavior rather than relying on one global timeout.
- Group names should be contextual, minimal, and natural rather than verbose.
- Similar group themes should keep stable colors over time, such as Dev always
  using the same color once learned or configured.
- The extension should not use notifications by default. If everything works,
  users should barely notice it and should not need to think about tab
  management.
- Confidence should stay internal. Users should not need to understand scores
  or model state.
- Core tab management should use a local adaptive scoring engine rather than a
  heavy neural network or cloud model in the first complete version.
- The learning system can be ML-like: an online, user-specific ranking/scoring
  model that learns from rewards and penalties such as undo, reopen-after-close,
  repeated switching, manual regrouping, and protected tabs.
- Later versions can add local embeddings, clustering, or classifiers if the
  adaptive scoring engine is not expressive enough.
- Onboarding and settings should let users choose the extension's management
  level:
  - Minimal: light organization and low-risk reversible actions.
  - Medium: grouping, pin-aware organization, reordering, and cleanup staging.
  - Maximum: full automation including grouping, reordering, cleanup groups,
    closing stale tabs, and opening/restoring where useful.
- Categories should be dynamically generated, not limited to a small fixed
  taxonomy.
- Nothing should be protected by default. Protection comes from user pinning,
  protected groups, and learned behavior rather than hardcoded defaults.
- Non-secret configuration should live in project config files, not env vars.

## Core User Journey

1. User browses normally.
2. On first install, extension opens a clean onboarding/tutorial page explaining
   the basic behavior, undo stack, and right-click protection.
3. Extension observes tab age, activity, domain, grouping, pinning, and revisit
   behavior.
4. Extension identifies tabs that are probably stale.
5. Extension automatically groups tabs where useful based on both semantic
   similarity and workflow proximity.
6. Extension either closes stale tabs, suspends them, or moves them into a
   collapsed cleanup group.
7. Tabs in the cleanup group remain available for a grace period.
8. If the user does not restore or use them, the extension deletes them after
   about a day.
9. User can open the sidebar to see recent actions and undo incorrect moves,
   closes, groupings, or reorderings.
10. Undo events become strong learning signals about what the user does not want.
11. Over time, the extension adapts to domains, workflows, and patterns the user
   tends to keep or discard.

## Features And Scope

- Background tab observation.
- Stale-tab scoring.
- Collapsed temporary tab groups.
- Automatic grouping of similar tabs.
- Automatic grouping by workflow proximity:
  - GitHub, Graphite, Vercel, docs, and deployment surfaces may belong in a
    "Dev" group.
  - Gmail and Calendar may belong together.
  - Multiple tabs from the same page/site should be grouped together.
  - Tabs frequently switched between should be moved near each other.
- Possible later split-view behavior when the user repeatedly switches between
  two tabs, such as copying information between them.
- Grace-period deletion.
- Learning from user restores, manual closures, pinned tabs, active time, and
  repeated domain usage.
- Safety controls to prevent surprise data loss.
- Protected pins/groups that the extension will ignore.
- Simple popup/settings surface:
  - Master on/off toggle.
  - Management level: Minimal, Medium, or Maximum.
  - Basic behavior settings.
  - Protected tab/group management.
  - Import/export of local learned behavior and settings.
  - Link to GitHub repository.
- First-run onboarding:
  - Opens automatically after install.
  - Uses a very nice, minimal Chrome-like interface.
  - Explains that the extension manages tabs quietly.
  - Explains the sidebar undo stack.
  - Explains right-click protection for tabs/groups.
  - Explains local-only learning and import/export.
  - Lets the user choose Minimal, Medium, or Maximum management.
  - Then hands off to immediate use.
- Sidebar action history:
  - Minimal chronological stack of recent extension actions.
  - Undo for recent closes, moves, group changes, and order changes where Chrome
    APIs make the action recoverable.
  - Redo where feasible.
  - Each action should appear as one simple stack item with easy undo/redo.
  - Action records should be concise and understandable, with details only if
    they are necessary for recovery.
  - Undo/redo should feed the learning model.
  - During initial learning, the sidebar should show a visual learning progress
    indicator.
  - A distinctive option is a subtle "filling up" treatment, like water or
    juice rising in the sidebar, while keeping the UI minimal and Chrome-native.
  - After the initial 150-event learning phase, the progress visual should
    disappear and the sidebar should return to only the action stack.
- Keyboard shortcuts:
  - Undo last extension action.
  - Redo last extension action if available.
  - Possibly protect current tab/group.
- Context menu actions:
  - Protect this tab.
  - Protect this group, shown when the current tab belongs to a group.
  - Unprotect this tab/group when applicable.
  - Possibly "don't do this again" from recent action context.
- Local-only learning and state by default:
  - Use Chrome extension storage for preferences, protected groups, learned
    domain/category mappings, and behavior history.
  - Prefer `chrome.storage.local` for local-first private behavior.
  - Consider `chrome.storage.sync` only for lightweight settings if the user
    explicitly opts into browser sync later.
  - Export/import should support transferring local state across Chrome
    profiles or browsers without requiring an account or server.
- Learning signals:
  - The first implementation should be a transparent local feature/scoring
    model, not an LLM or server-trained model.
  - Initial post-onboarding period should emphasize observation and fast
    learning before becoming more assertive.
  - The warmup should last until a useful activity threshold is reached, such as
    a few hours of active browsing or about 150 meaningful user tab events.
  - Everything meaningful should count toward the event threshold, including
    opening, closing, switching, moving, grouping, ungrouping, pinning,
    unpinning, restoring, reopening, renaming groups, recoloring groups, and
    undoing/redoing extension actions.
  - User undoing a close means the tab/domain/session was misclassified.
  - User reopening a recently closed tab is a strong negative signal for future
    closure.
  - User frequently switching between two tabs is a strong signal to move them
    next to each other or group them together.
  - User manually moving a tab out of an automatic group weakens that grouping
    rule.
  - User repeatedly preserving a domain or group should make the extension more
    conservative with that category.
- Cleanup behavior:
  - Closing should happen only after an inactivity threshold.
  - Timing should vary by category, domain, and individual tab behavior.
  - A tab may become safer to close sooner if its category is transient and the
    user rarely revisits it.
  - A tab should become safer to keep longer if the user often returns to that
    domain, restores it, or keeps similar tabs open during active workflows.
  - Tabs can be moved to a collapsed cleanup group before final deletion.
  - Tabs in cleanup groups should still be recoverable during the grace period.
  - The extension should avoid closing tabs the user reopens soon after closure.
- Group naming and colors:
  - Names should be short and contextual.
  - Categories should be generated dynamically from the user's actual tab
    patterns rather than restricted to built-in labels.
  - Built-in examples such as Dev, Mail, Calendar, Research, Shopping, Reading,
    Watch, Admin, Docs, Finance, Travel, or Later can be seed labels, not hard
    limits.
  - Theme/category colors should be stable so repeated categories feel familiar.
  - User-custom group names and colors should become preferred examples.
- Protection model:
  - No tabs are protected by default.
  - Users can explicitly protect tabs/groups through the right-click context
    menu.
  - The primary right-click action protects only the exact tab.
  - If the exact tab is already in a tab group, the context menu should also
    offer "Protect group".
  - The extension can learn to avoid disrupting certain tabs/domains/workflows,
    but this is learned behavior rather than a default hardcoded blocklist.
- Workflow detection:
  - Rapid switching between tabs.
  - Tabs opened close together.
  - Possible copy/paste or transfer behavior where detectable.
  - Same opener/source.
  - Same window or existing group.
  - Related domains.
  - Repeated historical pairing.
  - User corrections through undo/redo.

## Constraints

- Chrome extension APIs and Manifest V3 limitations.
- Must be privacy-conscious because tab URLs and browsing behavior are sensitive.
- Should avoid environment variables for non-secret settings.
- Chrome does not provide native split-view tab layout in the same way some
  browsers do, so split-view may require a separate window arrangement, side
  panel, or a later browser-specific strategy.
- Public distribution from the repo means the install and build instructions
  must be clean enough for non-author users before Chrome Web Store submission.
- Some undo operations may be lossy because Chrome may not preserve all page
  state, form data, or closed-tab session details through extension APIs.
- Closing undo should at minimum reopen the same URL, and should restore index,
  window, and group where API state makes that possible.
- Best-effort undo is acceptable when browser limits prevent perfect state
  restoration.
- No-notification UX and no default protection mean trust has to come from
  reversibility, robust action history, and fast learning from corrections
  rather than prompts or hardcoded safety lists.

## Risks And Open Questions

- What grouping confidence threshold is acceptable before the extension changes
  tab order or groups tabs silently?
- How can the extension stay quiet while still making its behavior reversible
  and trustworthy?
- Should split view be part of the MVP, a later advanced feature, or a separate
  experiment?
- What exact controls belong in "basic settings" without turning the popup into
  a power-user dashboard?
- How much history should be retained locally before pruning?
- How should the sidebar expose action details without becoming noisy?
- How should per-tab cleanup timing be learned without making behavior feel
  random?
- How aggressive can the extension be on first run if nothing is protected by
  default?
- What exact onboarding steps are necessary without making setup feel heavy?
- How playful can the warmup progress visual be while still feeling like a
  minimal Chrome-native utility?
- What exact permissions should Minimal, Medium, and Maximum enable?

## Next Questions

1. Build the first complete version.

## Final Spec Draft

To be filled in after the interview.
