# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`pure-reader` is a self-contained Tampermonkey userscript (`pure-reader.user.js`) that provides deep ad-blocking and layout enhancement for 6 major Chinese content platforms (CSDN, Zhihu, Juejin, JianShu, Cnblogs, WeChat Articles), plus a **Universal Fallback** reading mode (lightweight Readability-style heuristic extractor) and per-domain **Element Zapper** across arbitrary `http://*/*` and `https://*/*` websites.

## Architecture

The script follows a linear, pipeline-based single IIFE architecture:

1. **Design Tokens (`THEME`)**: Warm editorial canvas inspired by Anthropic's design system (`#faf9f5` canvas, `#cc785c` terracotta primary, `#efe9de` card surfaces).
2. **Config & Rule Persistence (`DEFAULT_CONFIG`, `loadConfig`, `saveConfig`, `ZapperStore`)**: Persists `pureReaderConfig` and per-host `pureReaderZapperRules` via `GM_getValue`/`GM_setValue` with fallback to `localStorage`.
3. **Pre-render CSS Engine (`injectStartCSS`, `applyZapperCSS`, `safeAddStyle`)**: Injects zero-flicker CSS rules at `document-start` (handling pre-`<html>` DOM readiness via `MutationObserver` fallback), skipping login/auth routes (`isAuthPage()`). On unknown domains (`!isKnownPlatform`), only user Zapper rules and scoped selection rules are injected.
4. **Copy & Link Guards (`setupCopyGuard`, `setupLinkGuard`)**: Captures copy events on known platforms to strip copyright boilerplate without breaking rich web apps on unknown hosts, and resolves redirect URLs cleanly.
5. **Platform Fixes (`setupPlatformFixes`)**: Site-specific DOM observers and handlers (auto-expanding CSDN/JianShu content, unlocking code-copy buttons, suppressing Zhihu login locks).
6. **Universal Fallback Extractor (`UniversalExtractor`, `extractArticleData`)**: Scores DOM candidates using CJK/Latin weighted length, punctuation count, `<p>` density, semantic tag weights, and link density with strict auto-dock vs manual trigger thresholds.
7. **Element Zapper (`ElementZapper`)**: Interactive hover highlighter with `↑`/`↓` DOM hierarchy stepping, compact CSS selector synthesis, live HUD undo (`Ctrl/Cmd+Z`), and per-domain persistent hiding.
8. **Floating Smart TOC (`FloatingTOC`)**: Scans `h1-h4` headings (filtering noise containers and zapped nodes) and renders an interactive scroll-spied table of contents.
9. **Zen Reader Mode (`ZenReader`)**: Isolated distraction-free overlay with contrast-safe color palettes (`cream`, `green`, `dark`, `white`), type scale, width toggle, and responsive `<picture>`/`srcset`/lazy-img recovery.
10. **Article Exporter (`Exporter`)**: Converts purified article clones into Markdown (`.md` download) with resolved absolute URLs or triggers clean print styles for PDF export.
11. **UI Dock & Settings (`SettingsUI`)**: Bottom-right floating dock (`universalDockMode`: `auto` | `always` | `manual`, plus `ignoredDockDomains`), Zapper rule manager modal, Tampermonkey menu commands, and global hotkeys (`Alt+R`, `Alt+T`, `Alt+Z`).

## Adding Support for a New Platform

Because `@match` already covers `http://*/*` and `https://*/*`, adding a dedicated site adapter (which overrides `UniversalExtractor`) involves:
1. Add hostname detection flag (e.g. `const isNewSite = host.includes('newsite.com');`) and include it in `isKnownPlatform`.
2. Add site-specific hide and layout rules to `injectStartCSS()`.
3. If the site has redirect links, add regex pattern to `resolveRealUrl()` in `setupLinkGuard()`.
4. Add content element and title selector to `extractArticleData()`.
5. Document the platform in `README.md`.
