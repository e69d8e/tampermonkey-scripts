# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tampermonkey userscript that beautifies Douyin (抖音) live streaming pages at `live.douyin.com`. It removes the chat sidebar, gift bar, gift effects, danmaku, activity overlays and watermark, expands the vertical player into an immersive full-window stage, and adds a glassmorphism settings panel. The script also defaults live audio to muted, tries to select the highest non-login quality tier, and binds `Space` to pause/resume the live stream plus `D` to show/hide danmaku. Pressing `D` drives Douyin's own danmaku switch with a synthetic `B` keydown so the renderer actually stops instead of being only CSS-hidden. It still suppresses the page's native `D` (rotate), `H` (fullscreen) and `B` (danmaku switch) shortcuts so those plain keys belong to the script.

Everything lives in one self-contained IIFE: `douyin-beautification.user.js`.

## Architecture

The script follows a linear pipeline inside the IIFE:

1. **Config management** — `DEFAULT_CONFIG` → `getConfig()` merges saved values via `GM_getValue`/`localStorage` → `saveConfig()` persists via `GM_setValue` (with `localStorage` fallback).
2. **CSS injection** — `buildGlobalCSS()` composes always-on beautification rules and config-driven `display: none !important` rules. `applyStyles()` injects through `GM_addStyle` at `document-start` to avoid FOUC.
3. **Player automation** — `applyMutePreference()` sets `video.muted = true; video.volume = 0`; `tryAutoQuality()` reads every `.KJ5LucVT` option, filters out rows containing 「登录即享」, then picks the highest available tier in `原画 → 蓝光 → 超清 → 高清 → 标清` order (logged-in users get the true highest; logged-out users fall back to 「高清」). It wakes the controls and opens the menu only when an upgrade is needed. `toggleLiveFullscreen()` uses the xgplayer facade (`document.querySelector('.douyin-player')._player.proxy`) and falls back to the native fullscreen button or `body.requestFullscreen()`.
4. **Custom UI** — a fixed host element (`#dyb-ui-host`) with a Shadow DOM render of the topbar and settings panel. `renderUI()` is a pure string render driven by `config`; a `lastRenderHTML` cache skips identical rebuilds, and `showToast()` updates the existing `.dyb-toast` node in place (`.dyb-toast-text`, `is-visible`) instead of re-rendering. Shadow DOM keeps the UI isolated from page CSS.
5. **Dynamic guarding** — two narrow observers plus a fallback interval: `structureObserver` watches only `document.documentElement` / `document.body` direct children (no subtree) for body replacement and UI removal; `playerObserver` watches `getPlayerScope()` (`#PlayerLayout → .douyin-player → #LeftBackgroundLayout`) subtree and only reacts to added `VIDEO` nodes (mute) and new danmaku `<canvas>` nodes (immediate `enforceDanmakuPreference()`, so a rebuilt danmaku canvas is switched off before the browser paints). `scheduleGuard()` debounces `runGuard()` (ensureUI, anchor refresh, re-observe player, mute new videos, enforce the danmaku preference). `startGuard()` runs every 3s while the page is visible and reattaches observers/mutes videos as a safety net. Chat and gift DOM churn never enters a callback. The observers never remove page nodes.
6. **Native danmaku sync** — `syncNativeDanmaku(hidden)` compares `config.hideDanmaku` with `hasNativeDanmakuCanvas()` (a `<canvas>` inside `#DanmakuLayout` / `.CanvasDanmakuPlugin` means the page's switch is on). On a mismatch it calls `dispatchNativeDanmakuSwitch()`, which sends a synthetic `keydown` (`key: 'b'`, `code: 'KeyB'`, `keyCode`/`which` 66) on `document.body` with `nativeDanmakuKeyInFlight` set so the script's own window-capture suppressor lets it through. `scheduleNativeDanmakuVerify()` re-checks after 600/700ms and retries up to `DANMAKU_SYNC_RETRIES` (3) times; `enforceDanmakuPreference()` runs once in `boot()` right after `setupObserver()`, in `runGuard()` as the safety net, and synchronously from `handlePlayerMutations()` when a danmaku canvas appears. The show direction only dispatches when a canvas has been seen before, so it cannot flip an already-on state. No CSS rule hides `#DanmakuLayout` / `.CanvasDanmakuPlugin` anymore — the page's own switch is the only mechanism.

Key Tampermonkey APIs: `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`.

## Douyin DOM Targets

Use stable IDs first; hashed class names are fallback only.

| Area | Stable selector |
|---|---|
| Page shell | `#ContainerBackgroundLayout`, `#LeftBackgroundLayout`, `#PlayerLayout` |
| Right chat | `#RightBackgroundLayout`, `#chatroom` |
| Top info bar | `#HeaderLayout`, `#room_info_bar` |
| Player | `.douyin-player`, `.douyin-player-controls`, `.douyin-player-controls-inner` |
| Gift bar | `.OperatingBarPluginContainer`, `#giftPanelEntrance` |
| Gift effects | `#GiftEffectLayout`, `#GiftTrayLayout`, `#GiftMenuLayout` |
| Danmaku | `#DanmakuLayout`, `.CanvasDanmakuPlugin` (a child `<canvas>` exists only while the native switch is on; nothing here is CSS-hidden) |
| Activity / tips | `#TipsLayout`, `#EcmoCardLayout`, `#ShortTouchLayout`, `#ServiceCenterLayout`, `#LinkMicAnimationLayout` |
| Likes | `#LikeLayout` |
| Watermark | `#WaterMarkLayout` |

`#LinkMicLayout` and `#LinkMicBackgroundLayout` must stay visible so 连麦/PK streams keep working.

## Modifying the Script

- **Add a hideable element**: append its selector to the matching block in `buildGlobalCSS()`, then add a boolean to `DEFAULT_CONFIG`, `CLEAN_ITEMS`, and the README table.
- **Add a playback option**: extend `DEFAULT_CONFIG` and `PLAY_ITEMS`; wire the behavior in `applyAll()` or the relevant automation function.
- **Add a shortcut**: add a string key to `DEFAULT_CONFIG` (e.g. `danmakuShortcut: 'd'`), append an entry to `SHORTCUT_ITEMS` (`{ key, label, desc }`), then match it in the keydown handler with `matchesShortcut()`. Settings rows are rendered by `buildShortcutRow()` with `data-dyb-action="shortcut"` and `data-dyb-key="<configKey>"`; clicking one sets `shortcutRecording` to that config key, and the next keydown writes the canonical `shortcutFromEvent()` string into it.
- **Shortcut conflicts**: `shortcutConflict(shortcut, selfKey)` rejects `RESERVED_SHORTCUTS` plus any value already used by another entry in `SHORTCUT_ITEMS`, so the same key can never toggle two actions. `B`, `H` and `D` are deliberately not reserved because `SUPPRESSED_NATIVE_CODES` + `isSuppressedNativeKey()` swallow their plain (no modifier) presses after the script's own matches.
- **Danmaku toggle**: `toggleDanmaku()` flips `hideDanmaku`, persists it, then calls `syncNativeDanmaku(config.hideDanmaku)` and `renderUI()` — no style rebuild, since Danmaku is driven only by Douyin's own hotkey, dispatched as a synthetic `B` on `document.body` (Architecture step 6). Other panel toggles call `applyAll()`; its optional `syncDanmaku` flag is set only for the `hideDanmaku` row and `resetConfig()`. If you ever need to hide the layer again, re-add a rule in `buildGlobalCSS()`, but prefer the native switch.
- **Selector strategy**: prefer IDs because Douyin's class names are hashed and change frequently. Use `[class*="..."]` only as a fallback.
- **Config persistence**: every toggle calls `saveConfig(config)` and `applyAll()`, so changes are immediate; no apply button or reload is needed.
- **UI isolation**: keep custom UI in the Shadow Root. Do not add page-global selectors that could target `.dyb-*` classes outside the shadow boundary.

## Important Quirks

- `.douyin-player-controls-inner` starts at `display: none` and only becomes `flex` after a synthetic `mousemove/mouseenter/mouseover` on `.douyin-player`. Quality automation must wake the controls first.
- Quality options are `.KJ5LucVT` inside `.QualitySwitchNewPlugin`; the current value is `[data-e2e="quality"]`. Each option sits in a `.tmNdnn5Q` row; when logged out, `原画 / 蓝光 / 超清` rows contain hidden 「登录即享」 text. Filter on that text before auto-clicking — clicking a gated option opens `#login-panel-new`.
- Hiding `#RightBackgroundLayout` makes `#LeftBackgroundLayout` expand from 960px to the full 1280px viewport by flex layout, so the script must not force a fixed width on the left pane.
- `body` can gain `xgplayer-fullscreen-parent` when native fullscreen is used; the UI is fixed and outside the player, so it intentionally stays out of native fullscreen.
- Douyin already binds `H` (native fullscreen), `Y` (web fullscreen), `U` (mini window), `D` (rotate) and `B` (danmaku switch, also the shortcut shown in the 弹幕设置 panel). The script suppresses plain `B` / `D` / `H` at window capture (`preventDefault` + `stopPropagation`, only when not typing and no Ctrl/Alt/Meta/Shift), so its own defaults can own `D` (danmaku) and `Space`, and `H` / `B` no longer trigger native behaviour. `Y`, `U`, `Alt+D`, `Alt+M`, `Esc` and `Tab` remain reserved for their native/panel functions.
- Danmaku is switched purely through Douyin's own hotkey; there is no CSS fallback anymore. The page listens for `B` on the document/body path (a `window`-level synthetic event is ignored), so `dispatchNativeDanmakuSwitch()` sends the event on `document.body`; the script's own window-capture suppressor would otherwise swallow it, hence `nativeDanmakuKeyInFlight`. A `<canvas>` inside `#DanmakuLayout` / `.CanvasDanmakuPlugin` is the state source of truth — `#DanmakuLayout` keeps `display: block` either way — and the page removes/recreates the canvas on its own, so the script never touches React nodes. The show direction only dispatches when a canvas has been seen at least once (`nativeDanmakuSeen`), so a slow first paint cannot flip an already-on switch; `boot()` enforces the preference once, `handlePlayerMutations()` re-enforces the moment a canvas is added, and `runGuard()` re-enforces every 3s as a safety net.
- `Space` is bound by the script to play/pause, not by Douyin. The keydown listener is registered on `window` in the capture phase (not `document`) so it runs before page handlers, and matched shortcuts call `stopPropagation()` — this keeps a native space binding from toggling playback twice.
- `toggleLivePlayback()` prefers the xgplayer facade (`_player.proxy.play/pause`), then falls back to the `<video>` element, and reads `video.paused` to decide direction. Pausing a live stream may leave the player showing a resume overlay; the next space press resumes at the live edge.

## Verification Workflow

There is no build system or test suite. After editing:

1. Run `node --check douyin-beautification.user.js`.
2. Install or update in Tampermonkey.
3. Open a real room such as `https://live.douyin.com/148108118778` and verify:
   - first paint shows no chat/gift flash, and danmaku never paints (the `<canvas>` is gone by the time the player mounts — no CSS fallback hides it anymore);
   - `#LeftBackgroundLayout` width is 1280 with chat hidden, 960 when shown;
   - `video.muted === true` and `video.volume === 0` by default;
   - pressing the configured fullscreen shortcut (default `F`) toggles native fullscreen without firing while typing in chat;
   - pressing the configured play/pause shortcut (default `Space`) pauses and resumes the video, and does not scroll the page or re-click a focused panel button;
   - pressing the configured danmaku shortcut (default `D`) calls Douyin's native danmaku switch: the `<canvas>` inside `#DanmakuLayout` / `.CanvasDanmakuPlugin` disappears when hidden and is recreated when shown, while `#DanmakuLayout` itself stays laid out (its `display` may stay `block`), and the 隐藏弹幕 switch stays in sync; typing `d` in chat does not toggle it;
   - pressing native `D` / `H` / `B` no longer rotates, fullscreens or toggles native danmaku; with modifiers (`Alt+D`) the panel still toggles;
   - recording `Space` for the fullscreen row is rejected with a conflict toast, and vice versa; recording `D` is rejected for other rows because the danmaku row owns it by default;
   - the shortcut row records a new key and persists it after reload;
   - with chat hidden, chat/gift DOM mutations do not trigger render or guard work (check via performance profiler / `renderCount`);
   - panel toggles take effect without refresh;
   - the custom topbar and panel remain visible above the player.
