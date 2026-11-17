# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tampermonkey userscript that cleans and beautifies the feed timelines of Xiaohongshu (`www.xiaohongshu.com`) and Weibo (`weibo.com`). It hides login prompts, promotional/recommended/live/video cards, left navigation, right sidebars and Weibo's hero banner, then centers the original feed column with a soft paper theme. A Shadow DOM floating panel provides per-option control.

Everything lives in one self-contained IIFE: `social-feed-cleaner.user.js`.

## Architecture

The script follows a linear pipeline inside the IIFE:

1. **Platform selection** — `PLATFORM` is derived from `location.hostname` (`xhs` / `weibo`). `IS_XHS` and `PLATFORM_LABEL` drive platform-specific CSS, labels and behavior.
2. **Config management** — `DEFAULT_CONFIG` → `getConfig()` merges saved values via `GM_getValue`/`localStorage` → `saveConfig()` persists via `GM_setValue` with a `localStorage` fallback (`socialFeedCleanerConfig`).
3. **CSS injection** — `buildGlobalCSS()` returns static `GLOBAL_CSS`; `ensureStyleElement()` prefers `GM_addStyle` and falls back to a `<style id="sfb-global-style">` element. `syncRootState()` sets `data-sfb-platform` and `sfb-*` state classes on `<html>`.
4. **Runtime filtering** — `applyRuntimeFilters()` scans `section.note-item` (XHS) and `article` (Weibo), marking cards with `data-sfb-sponsored`, `data-sfb-recommended`, `data-sfb-live`, `data-sfb-video`. Hiding is still CSS-only (`display: none !important`), never `.remove()`.
5. **Custom UI** — `createUI()` mounts `#sfb-ui-host` with an open Shadow DOM, renders the floating pill, settings panel, tabs and switches.
6. **Dynamic guarding** — `MutationObserver` watches `document.documentElement` child-list changes and schedules `applyRuntimeFilters()` with a 180ms debounce.

Key Tampermonkey APIs: `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`.

## Platform Targets

### Xiaohongshu

| Area | Selector |
|---|---|
| Page shell | `#app`, `#global.layout`, `#mfContainer.feeds-page`, `#exploreFeeds.feeds-container` |
| Header | `header.mask-paper`, `.header-container`, `.right` |
| Left navigation | `.side-bar`, `.main-content.with-side-bar` |
| Feed cards | `section.note-item`, `.cover`, `.footer`, `.live-badge` |
| Floating tools | `.floating-btn-sets` |
| Login overlay | `.login-container`, `.login-modal`, `.close-button` |

XHS renders the feed at a fixed 980px / four-column grid inside `#mfContainer` (1028px including padding). Hiding `.side-bar` requires zeroing `.main-content.with-side-bar` padding-left; then cap `#mfContainer` at 1028px and center with auto margins. Do not widen further — the site does not add columns.

### Weibo

| Area | Selector |
|---|---|
| Page shell | `#app`, `._content_1ubn9_18` |
| Top hero | `._top_1ubn9_14` |
| Left navigation | `._side_1ubn9_37`, `._main_mmtyp_2` |
| Feed column | `main`, `._full_1l406_7`, `#scroller` |
| Right sidebar | `#__sidebar`, `._side_1l406_17`, `.rightSide` |
| Feed cards | `article`, `.wbpro-scroller-item`, `.vue-recycle-scroller__item-view` |
| Header tabs | `._visable_r36s9_8`, `.wbpro-tab2` |

The actual 642→932px container is `._side_1l406_17` (not `#__sidebar` itself). Hide it so `main` contracts to 642px, then make `._content_1ubn9_18` full-width flex with `justify-content: center`.

## Modifying the Script

- **Add a hideable element**: append its selector to the matching platform block in `GLOBAL_CSS`, then add a boolean to `DEFAULT_CONFIG`, `CONFIG_SCHEMA`, and the README table.
- **Add a platform**: extend `PLATFORM` detection, add CSS scoped by `[data-sfb-platform="..."]`, extend `applyRuntimeFilters()`, and add a platform label/color branch.
- **Selector strategy**: prefer stable container IDs and semantic tags; hashed Weibo class names are fallback only.
- **Config persistence**: every switch change calls `saveConfig()` then `applyAll()`; exceptions are `showFab` (must keep panel usable while hidden) and `zenMode` (menu/shortcut toggles also save).
- **UI isolation**: keep custom UI in the Shadow Root. Do not add page-global selectors that could target `.sfb-*` classes outside the shadow boundary.

## Important Quirks

- 小红书登录弹窗会给 `<html>` 加 `reds-lock-scroll`（且 `html/body` 计算样式为 `overflow:hidden`）。仅用 CSS 隐藏弹窗不够，`applyRuntimeFilters()` 还要移除该 class 并恢复滚动；`html.sfb-hide-login` 的滚动修复规则必须用 `[data-sfb-platform="xhs"]` 限定，否则微博的 `body` 会变成内层滚动容器，表现为页面无法滚动、上下滑动大面积空白。
- 小红书 `#mfContainer` 固定四列网格，加宽容器不会增加列数，因此保持 1028px 最大宽并居中。
- 微博 `#scroller` 和 `._full_1l406_7` 都是 642px；真正需要隐藏的是 `._side_1l406_17`，仅隐藏 `#__sidebar` 不会让 `main` 收缩。
- 微博搜索/信息流顶部是 `._visable_r36s9_8` 标签条，不是全站 header；清洁规则只做半透明毛玻璃，不隐藏它。
- 脚本在 `document-start` 运行，`document.body` 可能尚不存在；所有涉及 body 的操作必须加存在性判断。`applyStyles()` 在 `boot()` 和 `onReady()` 各调用一次以覆盖极早注入。
- 视频卡片在 XHS 可能只有 hover 时才插入 `<video>`，所以 `hideVideoCards` 依靠 MutationObserver 重新标记，而非一次性静态扫描。
- 微博时间线是 `.vue-recycle-scroller__item-view` 绝对定位虚拟列表，`article` 被隐藏后父项高度变 0，但后续项 `transform: translateY()` 不会自动重算，会造成空洞。因此 `isLiveCard()` 只能识别文章头部的明确直播徽标，不能扫描正文或视频播放器控制条中的“直播”字样，否则普通 `微博视频号` 帖子会被误隐藏并留下大面积空白。

## Verification Workflow

There is no build system or test suite. After editing:

1. Run `node --check social-feed-cleaner.user.js`.
2. Install or update in Tampermonkey.
3. Open `https://www.xiaohongshu.com/explore` and verify:
   - no login modal flash and page can scroll;
   - `.side-bar` is hidden, `#mfContainer` is 1028px wide and centered, four columns remain;
   - default `sfb-hide-live` hides `.live-badge` cards and `sfb-hide-recommended` hides marked recommendation cards;
   - toggling `hideLeftNav` restores the sidebar and feed position.
4. Open `https://weibo.com/` and verify:
   - `._top_1ubn9_14`, `._side_1ubn9_37`, `._side_1l406_17` are hidden;
   - `._content_1ubn9_18` is full width, `main`/`article` are 642px and horizontally centered;
   - page has no horizontal scroll (`scrollWidth === clientWidth`);
   - scroll from top to bottom: first article starts at y≈54 and consecutive `.vue-recycle-scroller__item-view` blocks leave no gap > 80px; no normal `微博视频号` post is marked `data-sfb-live`.
5. Verify Shadow DOM panel opens, switches apply immediately, `Alt+Shift+S`/`Alt+Shift+Z` work, and config survives reload.
