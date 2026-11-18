# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tampermonkey userscript that beautifies Douyu (斗鱼) live streaming pages by removing clutter (ads, gift bars, activity popups, sidebars), applying a dark theme, and adding configurable keyboard shortcuts. The entire project is a single self-contained IIFE in `douyu-beautification.user.js`.

## Architecture

The script follows a linear pipeline inside one IIFE:

1. **Config management** — `DEFAULT_CONFIG` → `getConfig()` merges saved values via `GM_getValue` → `saveConfig()` persists with `GM_setValue`
2. **CSS injection** — `generateBaseCSS()` (always-on dark theme + settings panel styles) + `generateHideCSS()` (config-driven `display:none` rules) → combined and injected via `GM_addStyle` at `document-start` to prevent FOUC
3. **DOM cleanup** — `forceRemoveElements()` does `.remove()` on hard-to-hide elements; a `MutationObserver` on `document.body` (`startObserver()`) catches dynamically injected ads/popups. Its callback returns early while `document.hidden`, and `isNoiseMutationTarget()` skips mutations inside chat/gift/danmaku containers using a short-lived cache of noise roots.
4. **Shortcuts** — `SHORTCUT_ITEMS` (fullscreen / webFullscreen / danmaku) feed panel rows and the window-capture `keydown` listener; defaults are `F` fullscreen, `H` web fullscreen, `D` danmaku. `toggleFullscreen()` first calls `#js-player-main.requestFullscreen()` (true native fullscreen) and falls back to clicking `getFullscreenButton()` (the control bar's last child, Douyu's native fullscreen button; four-corner icon) when the browser rejects the API; `toggleWebFullscreen()` clicks `getWebFullscreenButton()` (the second-to-last control, or an SVG path containing `M20 25h6v-6`). `Space` is deliberately NOT intercepted and there is no `playPauseShortcut` config or panel row: playback is left to Douyu's native player, but `watchNativeSpacePlayback()` samples the video before the key and again after 450ms and only supplements when the page ignored the key or auto-resumed (engages the 6s re-pause guard) — normal native pauses are left untouched. `shortcutFromEvent()` maps `event.key` (with an `event.code` fallback for empty keys) to canonical strings; `isTypingTarget()` suppresses shortcuts only for text entry (`input` except non-text types, `textarea`, `select`, `contenteditable`) — it deliberately does NOT blanket-block the settings panel, because focus stays on a panel switch after clicking it; `shortcutOwner()` rejects duplicates against `RESERVED_SHORTCUTS`. Only trusted (`event.isTrusted`) events are handled, because Douyu re-dispatches a synthetic `keydown` after some native hotkeys. A matched non-Space shortcut calls `preventDefault()` + `stopImmediatePropagation()` and runs its action.
5. **Playback** — `togglePlayback()` is used by `watchNativeSpacePlayback()` and the top-bar/GM menu play/pause command (not by a configurable keyboard shortcut). It resolves the player's own pause/play control via `getPlayPauseButton()`: scans `#js-player-controlbar` candidates for a `pause_svg`/`play_svg` icon first, then `aria-label`/`title` containing 播放/暂停 (selection must not depend on one hashed class). Pausing sets `userWantsPaused`, a 6s `userPausedUntil` window and `repauseBudget = 8`; it clicks the control icon but also calls `video.pause()` synchronously for instant feedback/fallback when synthetic clicks are ignored. `schedulePauseCheck()`/`ensurePaused()` re-check every 700ms and re-click/pause if the player auto-resumed. Clicking the native control resets that intent; the document-capture `play` listener also schedules a check.
6. **Danmaku** — `hideDanmaku` first clicks Douyu's own overlay switch: `.showdanmuWrap-9c22cd` (without `.removed-304d55`) is the ON state and its inner `i.icon-c8be96` clicks OFF; when the wrapper has `.removed-304d55` the follow-up sibling `i.icon-c8be96` clicks ON. `getNativeDanmakuToggle()`/`setNativeDanmaku()` implement this and are called from `toggleDanmaku()`, the panel checkbox, and `startGuard()`. The CSS fallback still targets `[class^="danmu-"]`, `[class*=" danmu-"]`, `[class*="danmuItem"]`, `.DanmuEffectDom`, `[class*="retentionDanmu"]` for rooms where the native control is absent; it only hides overlay bullets, while the right chat list is governed separately by the single `hideChatPanel` toggle (which also drives the player layout width). Old configs are migrated in `getConfig()` from the former inverse pair `removeAside` + `showChatPanel`. Overlay markers mount late (~6s) in some rooms, so tests must wait for `.danmu-fbb2a3` and `.danmuItem-*` before checking.
7. **Settings panel** — built entirely in `createSettingsPanel()`, toggled via the top navigation bar button (`createHeaderSettingsButton()`) or Tampermonkey menu (`GM_registerMenuCommand`). Shortcut rows use `data-shortcut-key` and are re-rendered by `renderShortcutRows()`.
8. **Automation & guards** — `autoHighQuality()` and `autoWebFullscreen()` poll for player UI elements with `setInterval`; `startGuard()` is a 4s interval (skipped when hidden) that re-ensures the panel/header button and cleans homepage nodes.

Key Tampermonkey APIs used: `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`.

## Modifying the Script

- **Adding a new hideable element**: add CSS selector to the relevant section in `generateHideCSS()`, and if it needs JS removal too, add to `forceRemoveElements()` or `JS_REMOVE_SELECTORS`
- **Adding a new config toggle**: add to `DEFAULT_CONFIG`, add an entry to `SETTINGS_GROUPS`, wire the CSS/JS logic, and call `applyStyles()` after changes
- **Adding a new shortcut**: add a config key to `DEFAULT_CONFIG`, append to `SHORTCUT_ITEMS`, implement the action, and add it to the `actions` array in the window keydown handler
- **CSS selectors**: Douyu uses both stable class names (`.GiftBar`, `.layout-Player-aside`) and obfuscated/hashed ones — the script uses `[class*="..."]` attribute selectors as a hedge
- **Config persistence**: changes to settings auto-save on toggle; "apply" button reloads the page. CSS hot-switches via `applyStyles()`; some JS-removed elements are restored through the reversible `data-douyu-hidden` marker

## Verification

- Syntax: `node --check douyu-beautification/douyu-beautification.user.js`
- Manual: install in Tampermonkey, open `https://www.douyu.com/9999`, verify panel tabs (界面/播放), shortcut badges (`F`/`H`/`D`), native `Space` pause/resume still works while the script is enabled, `D` toggling `.danmu-fbb2a3`/`[class*="danmuItem"]` after the overlay mounts (~6s), `F` entering/exiting fullscreen (or adding/removing `is-fullScreen`), `H` adding/removing `is-fullScreenPage`, typing guard (text input receives `d`/space), and conflict toast while recording
