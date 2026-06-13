# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing independent Tampermonkey userscripts. Each project is a self-contained single-file IIFE — no build system, no package manager, no tests, no CI/CD. The `.user.js` files are installed directly into Tampermonkey.

| Project | Script | Purpose |
|---|---|---|
| `automatic-AI-answer-system-for-xxt/` | `学习通AI答题.user.js` | Automates quiz answering on Chaoxing (学习通) learning platform via DeepSeek/MiMo AI APIs |
| `douyu-beautification/` | `douyu-beautification.user.js` | Removes clutter and applies dark theme on Douyu (斗鱼) live streaming pages |

Each project has its own `CLAUDE.md` with detailed architecture documentation — read those before making changes.

## Development Workflow

There is no build, lint, or test infrastructure. To develop:

1. Edit the `.user.js` file directly
2. Install/update it in Tampermonkey
3. Navigate to the target site and verify changes

Both scripts use Tampermonkey APIs: `GM_addStyle`, `GM_getValue`/`GM_setValue`, `GM_xmlhttpRequest`, `GM_registerMenuCommand`.

## Cross-Project Conventions

- Both scripts share the same architectural pattern: single IIFE, config via `GM_getValue`/`GM_setValue`, CSS injection via `GM_addStyle`, floating settings panel UI
- Both use a warm color palette inspired by Anthropic's design system (see `automatic-AI-answer-system-for-xxt/DESIGN.md` for color tokens)
- Chinese is the primary language for user-facing strings and README documentation
