# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`pure-reader` is a self-contained Tampermonkey userscript (`pure-reader.user.js`) that provides a distraction-free, privacy-preserving, and enhanced reading experience across major Chinese technical and content platforms (CSDN, Zhihu, Juejin, JianShu, Cnblogs, WeChat Articles).

## Architecture

The script follows a linear, pipeline-based single IIFE architecture:

1. **Design Tokens (`THEME`)**: Warm editorial canvas inspired by Anthropic's design system (`#faf9f5` canvas, `#cc785c` terracotta primary, `#efe9de` card surfaces).
2. **Config Manager (`DEFAULT_CONFIG`, `loadConfig`, `saveConfig`)**: Reads and persists preferences via `GM_getValue`/`GM_setValue` with fallback to `localStorage`.
3. **Pre-render CSS Engine (`injectStartCSS`)**: Injects zero-flicker CSS rules at `document-start` via `GM_addStyle`, handling layout centering, ad removal, and login-modal suppressing before DOM paint.
4. **Copy Guard (`setupCopyGuard`)**: Captures the `copy` event at the capturing phase, cleans copyright boilerplate suffixes (`著作权归作者所有...`, CSDN copyright notes), and unlocks `user-select` styles.
5. **Link Guard (`setupLinkGuard`)**: Resolves redirect URLs on Zhihu, CSDN, Juejin, and JianShu to prevent intermediate "leaving site" warning pages.
6. **Platform Fixes (`setupPlatformFixes`)**: Site-specific DOM observers and handlers (auto-expanding CSDN full text and unlocking code-copy buttons; suppressing Zhihu's modal screen locks).
7. **Floating Smart TOC (`FloatingTOC`)**: Scans `h1-h4` headings within detected article wrappers and renders an interactive, smooth-scrolling table of contents with scroll spy.
8. **Zen Reader Mode (`ZenReader`)**: Renders an isolated, distraction-free reading overlay with 4 eye-care color palettes (Cream, Green, White, Dark), adjustable type scale, and line length.
9. **Article Exporter (`Exporter`)**: Converts purified DOM trees into clean Markdown (`.md`) or invokes clean print styles for PDF export.
10. **UI Dock & Settings (`SettingsUI`)**: Minimal floating dock at bottom-right plus a modal settings dialog with hotkeys (`Alt+R`, `Alt+T`).

## Adding Support for a New Platform

To add a new platform:
1. Add match patterns to the `@match` headers in `pure-reader.user.js`.
2. Add hostname detection flag (e.g. `const isNewSite = host.includes('newsite.com');`).
3. Add site-specific hide and layout rules to `injectStartCSS()`.
4. If the site has redirect links, add regex pattern to `resolveRealUrl()` in `setupLinkGuard()`.
5. Add content element and title selector to `extractArticleData()`.
6. Document the platform in `README.md`.
