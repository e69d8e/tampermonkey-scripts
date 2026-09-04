# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tampermonkey userscript that beautifies Douyu (斗鱼) live streaming pages by removing clutter (ads, gift bars, activity popups, sidebars) and applying a dark theme. The entire project is a single self-contained IIFE in `douyu-beautification.user.js`.

## Architecture

The script follows a linear pipeline inside one IIFE:

1. **Config management** — `DEFAULT_CONFIG` → `getConfig()` merges saved values via `GM_getValue` → `saveConfig()` persists with `GM_setValue`
2. **CSS injection** — `generateBaseCSS()` (always-on dark theme + settings panel styles) + `generateHideCSS()` (config-driven `display:none` rules) → combined and injected via `GM_addStyle` at `document-start` to prevent FOUC
3. **DOM cleanup** — `forceRemoveElements()` does `.remove()` on hard-to-hide elements; `MutationObserver` catches dynamically injected ads/popups
5. **Settings panel** — built entirely in `createSettingsPanel()`, toggled via the top navigation bar button (`createHeaderSettingsButton()`) or Tampermonkey menu (`GM_registerMenuCommand`)
6. **Automation** — `autoHighQuality()` and `autoWebFullscreen()` poll for player UI elements with `setInterval` (retries ~15-20 times)

Key Tampermonkey APIs used: `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`.

## Modifying the Script

- **Adding a new hideable element**: add CSS selector to the relevant section in `generateHideCSS()`, and if it needs JS removal too, add to `forceRemoveElements()`
- **Adding a new config toggle**: add to `DEFAULT_CONFIG`, add entry to the `settings` array in `createSettingsPanel()`, wire the CSS/JS logic
- **CSS selectors**: Douyu uses both stable class names (`.GiftBar`, `.layout-Player-aside`) and obfuscated/hashed ones — the script uses `[class*="..."]` attribute selectors as a hedge
- **Config persistence**: changes to settings auto-save on toggle; "apply" button reloads the page. No hot-reload of CSS on toggle change (requires page refresh)
