// ==UserScript==
// @name         抖音直播美化 - 纯净沉浸版
// @namespace    https://github.com/e69d8e/tampermonkey-scripts
// @version      0.1.2
// @description  抖音直播间极简美化：隐藏聊天区、礼物栏、弹幕、活动提示等冗余元素，竖屏沉浸宽屏、氛围渐变背景、默认静音与自动最高画质，支持自定义全屏快捷键与毛玻璃设置面板即时热切换。
// @author       YH
// @match        *://live.douyin.com/*
// @match        *://www.douyin.com/root/live/*
// @match        *://www.douyin.com/live/*
// @icon         https://live.douyin.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @noframes
// @license      MIT
// @downloadURL  https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyin-beautification/douyin-beautification.user.js
// @updateURL    https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyin-beautification/douyin-beautification.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (window.self !== window.top) return;

    const SCRIPT_VERSION = '0.1.2';
    const CONFIG_KEY = 'douyinBeautifyConfig';
    const STYLE_ID = 'dyb-global-style';
    const HOST_ID = 'dyb-ui-host';

    function isLiveRoom() {
        if (location.hostname === 'live.douyin.com') {
            return /^\/\d+/.test(location.pathname);
        }
        return /\/(?:root\/)?live\//.test(location.pathname);
    }

    if (!isLiveRoom()) return;

    // ==========================================
    //  配置管理
    // ==========================================
    const DEFAULT_CONFIG = {
        hideHeader: true,         // 精简顶部信息栏
        hideChat: true,           // 隐藏右侧聊天区
        hideGiftBar: true,        // 隐藏底部礼物栏
        hideGiftEffects: true,    // 隐藏礼物特效
        hideDanmaku: true,        // 隐藏飘屏弹幕
        hideActivity: true,       // 隐藏活动、提示与悬浮挂件
        hideLikeEffects: true,    // 隐藏点赞动效
        hideWatermark: true,      // 隐藏水印与广告标识
        muteLive: true,           // 进入直播间默认静音
        autoHighestQuality: true, // 自动选择可用的最高画质
        showTopbar: true,         // 显示自定义悬浮顶栏
        ambientGlow: true,        // 在竖屏黑边区域渲染氛围光
        fullscreenShortcut: 'f',  // 直播原生全屏快捷键（用户可录制修改）
    };

    const CLEAN_ITEMS = [
        { key: 'hideHeader', label: '精简顶部信息栏', desc: '隐藏主播信息、榜单和退出按钮' },
        { key: 'hideChat', label: '隐藏右侧聊天区', desc: '直播画面扩展至全窗口' },
        { key: 'hideGiftBar', label: '隐藏礼物栏', desc: '移除底部礼物入口与横幅' },
        { key: 'hideGiftEffects', label: '隐藏礼物特效', desc: '不再弹出全屏礼物动画' },
        { key: 'hideDanmaku', label: '隐藏弹幕', desc: '关闭覆盖画面的滚动弹幕' },
        { key: 'hideActivity', label: '隐藏活动与提示', desc: '屏蔽红包、活动、试看提示' },
        { key: 'hideLikeEffects', label: '隐藏点赞与特效', desc: '关闭飘心、点赞动画' },
        { key: 'hideWatermark', label: '隐藏水印与广告', desc: '保持画面干净' },
    ];

    const PLAY_ITEMS = [
        { key: 'muteLive', label: '默认静音', desc: '进入直播间自动将音量归零' },
        { key: 'autoHighestQuality', label: '自动最高画质', desc: '优先切换最高画质' },
        { key: 'showTopbar', label: '显示悬浮顶栏', desc: '保留主播名、返回与设置入口' },
        { key: 'ambientGlow', label: '氛围光效', desc: '在竖屏黑边区域渲染柔和渐变' },
    ];

    const ITEM_MAP = {};
    CLEAN_ITEMS.concat(PLAY_ITEMS).forEach(function (item) {
        ITEM_MAP[item.key] = item;
    });

    function getConfig() {
        let saved = null;
        try {
            if (typeof GM_getValue === 'function') {
                saved = GM_getValue(CONFIG_KEY, null);
            }
        } catch (e) { /* ignore */ }

        if (typeof saved === 'string') {
            try { saved = JSON.parse(saved); } catch (e) { saved = null; }
        }

        if (!saved) {
            try {
                saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
            } catch (e) { /* ignore */ }
        }

        const cfg = Object.assign({}, DEFAULT_CONFIG);
        if (saved && typeof saved === 'object') {
            Object.keys(DEFAULT_CONFIG).forEach(function (key) {
                if (typeof saved[key] !== typeof DEFAULT_CONFIG[key]) return;
                if (typeof DEFAULT_CONFIG[key] === 'string') {
                    const value = String(saved[key]).trim();
                    if (value) cfg[key] = value;
                } else {
                    cfg[key] = saved[key];
                }
            });
        }
        return cfg;
    }

    function saveConfig(cfg) {
        if (typeof GM_setValue === 'function') {
            try { GM_setValue(CONFIG_KEY, cfg); } catch (e) { /* ignore */ }
        }
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        } catch (e) { /* ignore */ }
    }

    let config = getConfig();

    // ==========================================
    //  全局净化样式
    // ==========================================
    function buildGlobalCSS() {
        const rules = [
            'html, body { background: #050507 !important; overflow: hidden !important; }',
            '#root { background: #050507 !important; }',
            '#ContainerBackgroundLayout { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important; }',
            '#LeftBackgroundLayout { overflow: hidden !important; }',
            '#PlayerLayout, .douyin-player, .douyin-player > video { background: transparent !important; }',
            '.douyin-player-controls { background: linear-gradient(to top, rgba(0, 0, 0, .78), rgba(0, 0, 0, 0)) !important; }',
        ];

        if (config.ambientGlow) {
            rules.push([
                '#ContainerBackgroundLayout {',
                '  background: radial-gradient(1200px 700px at 50% 45%, #1b1220 0%, #0b0b10 45%, #050507 100%) !important;',
                '}',
                '#LeftBackgroundLayout {',
                '  background:',
                '    radial-gradient(ellipse at center, rgba(254, 44, 85, .16) 0%, rgba(254, 44, 85, 0) 60%),',
                '    linear-gradient(180deg, #111019, #07070a) !important;',
                '}',
                '#LeftBackgroundLayout::after {',
                '  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;',
                '  background:',
                '    radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, .32) 100%),',
                '    linear-gradient(to top, rgba(0, 0, 0, .55), transparent 38%);',
                '}',
            ].join('\n'));
        } else {
            rules.push('#ContainerBackgroundLayout, #LeftBackgroundLayout { background: #050507 !important; }');
            rules.push('#LeftBackgroundLayout::after { display: none !important; }');
        }

        if (!config.hideChat) {
            rules.push([
                '#RightBackgroundLayout, #chatroom {',
                '  background: linear-gradient(180deg, rgba(14, 14, 20, .98), rgba(7, 7, 10, .98)) !important;',
                '}',
                '#RightBackgroundLayout {',
                '  border-left: 1px solid rgba(255, 255, 255, .06) !important;',
                '  box-shadow: -20px 0 60px rgba(0, 0, 0, .32) !important;',
                '}',
                '#chatroom ::-webkit-scrollbar { width: 6px; }',
                '#chatroom ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, .14); border-radius: 999px; }',
            ].join('\n'));
        }

        const hidden = [];
        if (config.hideHeader) {
            hidden.push('#douyin-header', '#douyin-navigation', '#HeaderLayout', '#room_info_bar');
        }
        if (config.hideChat) {
            hidden.push('#RightBackgroundLayout', '#chatroom');
        }
        if (config.hideGiftBar) {
            hidden.push('.OperatingBarPluginContainer', '#giftPanelEntrance');
        }
        if (config.hideGiftEffects) {
            hidden.push('#GiftEffectLayout', '#GiftTrayLayout', '#GiftMenuLayout');
        }
        if (config.hideDanmaku) {
            hidden.push('#DanmakuLayout', '.CanvasDanmakuPlugin');
        }
        if (config.hideActivity) {
            hidden.push('#TipsLayout', '#EcmoCardLayout', '#ShortTouchLayout', '#ServiceCenterLayout', '#LinkMicAnimationLayout');
        }
        if (config.hideLikeEffects) {
            hidden.push('#LikeLayout');
        }
        if (config.hideWatermark) {
            hidden.push('#WaterMarkLayout');
        }

        if (hidden.length) {
            rules.push(hidden.join(',\n') + ' { display: none !important; }');
        }

        return rules.join('\n');
    }

    let globalStyleEl = null;

    function ensureStyleElement() {
        if (globalStyleEl && globalStyleEl.isConnected) return globalStyleEl;

        if (typeof GM_addStyle === 'function') {
            try {
                const created = GM_addStyle('/* douyin-beautification */');
                if (created && created.nodeType === 1) {
                    created.id = STYLE_ID;
                    globalStyleEl = created;
                    return created;
                }
            } catch (e) { /* ignore */ }
        }

        let el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.type = 'text/css';
        }
        if (!el.isConnected) {
            const parent = document.head || document.documentElement;
            if (!parent) return null;
            parent.appendChild(el);
        }
        globalStyleEl = el;
        return el;
    }

    function applyStyles() {
        const el = ensureStyleElement();
        if (!el) return;
        const css = buildGlobalCSS();
        if (el.textContent !== css) el.textContent = css;
    }

    // ==========================================
    //  静音与画质
    // ==========================================
    function applyMutePreference() {
        const videos = document.querySelectorAll('video');
        videos.forEach(function (video) {
            try {
                if (config.muteLive) {
                    video.muted = true;
                    video.volume = 0;
                } else {
                    if (video.muted) video.muted = false;
                    if (video.volume === 0) video.volume = 0.7;
                }
            } catch (e) { /* ignore */ }
        });
    }

    function enforceMuteOnNewVideos() {
        if (!config.muteLive) return;
        document.querySelectorAll('video').forEach(function (video) {
            try {
                if (!video.muted) video.muted = true;
                if (video.volume !== 0) video.volume = 0;
            } catch (e) { /* ignore */ }
        });
    }

    let qualityTimer = null;
    let qualityAttempts = 0;
    let qualityDone = false;

    function wakePlayerControls() {
        const player = document.querySelector('.douyin-player');
        if (!player) return;
        ['mousemove', 'mouseenter', 'mouseover'].forEach(function (type) {
            player.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: window.innerWidth / 2,
                clientY: window.innerHeight - 30,
            }));
        });
    }

    function scheduleQualityCheck(delay) {
        clearTimeout(qualityTimer);
        if (!config.autoHighestQuality) return;
        qualityTimer = setTimeout(tryAutoQuality, typeof delay === 'number' ? delay : 2200);
    }

    function readQualityOptions(plugin) {
        const root = plugin || document.querySelector('.QualitySwitchNewPlugin');
        if (!root) return [];
        return Array.prototype.slice.call(root.querySelectorAll('.KJ5LucVT')).map(function (option) {
            const item = option.closest('.tmNdnn5Q') || option.parentElement;
            return {
                el: option,
                name: option.textContent.replace(/\s+/g, ''),
                locked: !!item && /登录即享/.test(item.textContent),
            };
        }).filter(function (option) {
            return option.name;
        });
    }

    function pickHighestQuality(options) {
        const preferences = ['原画', '蓝光', '超清', '高清', '标清'];
        for (let i = 0; i < preferences.length; i++) {
            const match = options.find(function (option) {
                return !option.locked && option.name.indexOf(preferences[i]) === 0;
            });
            if (match) return match;
        }
        return options.find(function (option) { return !option.locked; }) || null;
    }

    function tryAutoQuality() {
        if (!config.autoHighestQuality || qualityDone) return;

        const plugin = document.querySelector('.QualitySwitchNewPlugin');
        if (!plugin) {
            if (qualityAttempts++ < 6) qualityTimer = setTimeout(tryAutoQuality, 1600);
            return;
        }

        const currentEl = plugin.querySelector('[data-e2e="quality"]');
        const current = (currentEl ? currentEl.textContent : '').replace(/\s+/g, '');
        if (!current) {
            if (qualityAttempts++ < 6) qualityTimer = setTimeout(tryAutoQuality, 1600);
            return;
        }

        // 已在最高可用档位时不再打开画质菜单。
        const initialTarget = pickHighestQuality(readQualityOptions(plugin));
        if (initialTarget && initialTarget.name === current) {
            qualityDone = true;
            return;
        }

        qualityDone = true;
        qualityAttempts = 0;
        wakePlayerControls();

        setTimeout(function () {
            const display = plugin.querySelector('[data-e2e="quality"]');
            if (!display) return;
            display.click();

            setTimeout(function () {
                const target = pickHighestQuality(readQualityOptions(plugin));
                const activeEl = plugin.querySelector('[data-e2e="quality"]');
                const active = (activeEl ? activeEl.textContent : '').replace(/\s+/g, '');
                if (!target || target.name === active) return;
                target.el.click();
                showToast('已切换至「' + target.name + '」画质');
            }, 220);
        }, 100);
    }

    // ==========================================
    //  直播全屏快捷键
    // ==========================================
    const RESERVED_SHORTCUTS = {
        h: '抖音原生全屏',
        y: '抖音网页全屏',
        u: '抖音小窗',
        d: '抖音旋转画面',
        'alt+d': '设置面板',
        'alt+m': '直播静音',
        escape: '关闭面板',
        tab: '页面焦点切换',
    };

    function getLivePlayer() {
        const mount = document.querySelector('.douyin-player');
        const holder = mount && mount._player;
        const player = holder && holder.proxy;
        return player && typeof player.requestFullscreen === 'function' ? player : null;
    }

    function isNativeFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function requestLiveFullscreen() {
        const player = getLivePlayer();
        if (player) {
            try {
                const result = player.requestFullscreen();
                if (result && typeof result.catch === 'function') result.catch(function () {});
                return;
            } catch (e) { /* fall through */ }
        }

        const nativeButton = document.querySelector('.douyin-player-fullscreen .douyin-player-icon') || document.querySelector('.douyin-player-fullscreen');
        if (nativeButton) {
            nativeButton.click();
            return;
        }

        const target = document.body;
        const request = target.requestFullscreen || target.webkitRequestFullscreen;
        if (request) {
            try {
                const result = request.call(target);
                if (result && typeof result.catch === 'function') result.catch(function () {});
            } catch (e) { /* ignore */ }
        }
    }

    function exitLiveFullscreen() {
        const player = getLivePlayer();
        if (player && typeof player.exitFullscreen === 'function') {
            try {
                const result = player.exitFullscreen();
                if (result && typeof result.catch === 'function') result.catch(function () {});
                return;
            } catch (e) { /* fall through */ }
        }

        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) {
            try {
                const result = exit.call(document);
                if (result && typeof result.catch === 'function') result.catch(function () {});
            } catch (e) { /* ignore */ }
        }
    }

    function toggleLiveFullscreen() {
        if (isNativeFullscreen()) exitLiveFullscreen();
        else requestLiveFullscreen();
    }

    function shortcutKeyFromEvent(event) {
        const code = event.code || '';
        if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
        if (/^Digit[0-9]$/.test(code)) return code.slice(5);
        if (/^Numpad[0-9]$/.test(code)) return 'numpad' + code.slice(6);

        const named = {
            Space: 'space', Enter: 'enter', Escape: 'escape', Tab: 'tab',
            ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
            Home: 'home', End: 'end', PageUp: 'pageup', PageDown: 'pagedown',
            Insert: 'insert', Delete: 'delete', Backspace: 'backspace',
            Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']',
            Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
        };
        return named[code] || String(event.key || '').toLowerCase();
    }

    function shortcutFromEvent(event) {
        if (event.isComposing) return '';
        const key = shortcutKeyFromEvent(event);
        if (!key || /^(control|ctrl|alt|shift|meta|os)$/.test(key)) return '';

        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');
        parts.push(key);
        return parts.join('+');
    }

    function matchesShortcut(event, shortcut) {
        const expected = String(shortcut || '').trim().toLowerCase();
        return !!expected && shortcutFromEvent(event) === expected;
    }

    function formatShortcutLabel(shortcut) {
        const names = {
            ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta',
            space: 'Space', enter: 'Enter', escape: 'Esc', tab: 'Tab',
            arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
            pageup: 'PageUp', pagedown: 'PageDown', backspace: 'Backspace', delete: 'Delete',
        };
        return String(shortcut || '').split('+').map(function (part) {
            return names[part] || part.toUpperCase();
        }).join(' + ');
    }

    function isTypingTarget(event) {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
        return path.some(function (node) {
            if (!node || node.nodeType !== 1) return false;
            return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable;
        });
    }

    // ==========================================
    //  自定义 UI（Shadow DOM 隔离页面样式）
    // ==========================================
    let host = null;
    let shadow = null;
    let anchorName = '抖音直播';
    let panelOpen = false;
    let activeTab = 'clean';
    let shortcutRecording = false;
    let toastMessage = '';
    let toastTimer = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
    }

    function getAnchorName() {
        const bar = document.querySelector('#room_info_bar');
        if (bar) {
            const links = Array.prototype.slice.call(bar.querySelectorAll('a[href*="douyin.com/user/"]'));
            const named = links.find(function (link) { return link.textContent.trim(); });
            if (named) return named.textContent.trim().slice(0, 24);
        }

        let name = (document.title || '')
            .replace(/的抖音直播间.*$/, '')
            .replace(/\s*[-|]\s*抖音直播.*$/, '')
            .trim();
        if (!name || name === '抖音直播') name = '抖音直播';
        return name.slice(0, 24);
    }

    const SHADOW_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; }
        .dyb-layer {
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
            color: #f7f7fb;
            -webkit-font-smoothing: antialiased;
        }
        .dyb-topbar {
            position: fixed; top: 18px; left: 18px;
            display: flex; align-items: center; gap: 10px;
            height: 42px; padding: 0 9px 0 7px;
            border: 1px solid rgba(255, 255, 255, .09);
            border-radius: 14px;
            background: rgba(11, 11, 17, .62);
            box-shadow: 0 10px 36px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .04);
            backdrop-filter: blur(20px) saturate(140%);
            -webkit-backdrop-filter: blur(20px) saturate(140%);
            pointer-events: auto;
            user-select: none;
            animation: dyb-fade-in .28s ease both;
        }
        .dyb-icon-btn {
            width: 28px; height: 28px; padding: 0;
            display: inline-flex; align-items: center; justify-content: center;
            border: 0; border-radius: 9px;
            color: rgba(255, 255, 255, .72);
            background: transparent;
            cursor: pointer;
            transition: background .18s ease, color .18s ease, transform .18s ease;
        }
        .dyb-icon-btn:hover { color: #fff; background: rgba(255, 255, 255, .1); }
        .dyb-icon-btn:active { transform: scale(.94); }
        .dyb-icon-btn svg { width: 17px; height: 17px; display: block; }
        .dyb-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .dyb-logo {
            width: 28px; height: 28px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; font-weight: 800; line-height: 1; color: #fff;
            background: linear-gradient(145deg, #fe2c55 0%, #ff6b81 100%);
            box-shadow: 0 4px 14px rgba(254, 44, 85, .36);
        }
        .dyb-brand-copy { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .dyb-brand-line { display: flex; align-items: center; gap: 6px; height: 12px; }
        .dyb-brand-name { font-size: 10px; font-weight: 600; letter-spacing: .02em; color: rgba(255, 255, 255, .46); }
        .dyb-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #fe2c55; box-shadow: 0 0 0 3px rgba(254, 44, 85, .13); }
        .dyb-live-text { font-size: 9px; font-weight: 700; color: #ff7a90; letter-spacing: .06em; }
        .dyb-anchor {
            max-width: 142px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-size: 12.5px; font-weight: 650; line-height: 15px; color: rgba(255, 255, 255, .95);
        }
        .dyb-gear { margin-left: 1px; }
        .dyb-panel {
            position: fixed; top: 72px; left: 18px;
            width: 344px; max-height: calc(100vh - 96px);
            display: flex; flex-direction: column;
            border: 1px solid rgba(255, 255, 255, .085);
            border-radius: 18px;
            background: rgba(14, 14, 21, .92);
            box-shadow: 0 28px 80px rgba(0, 0, 0, .55), inset 0 1px 0 rgba(255, 255, 255, .05);
            backdrop-filter: blur(30px) saturate(140%);
            -webkit-backdrop-filter: blur(30px) saturate(140%);
            overflow: hidden;
            pointer-events: auto;
            animation: dyb-panel-in .24s cubic-bezier(.2, .8, .2, 1) both;
        }
        .dyb-panel-head {
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 17px 17px 13px;
        }
        .dyb-title-wrap { display: flex; align-items: center; gap: 11px; }
        .dyb-title-logo {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-weight: 800; color: #fff;
            background: linear-gradient(145deg, #fe2c55, #ff6b81);
            box-shadow: 0 7px 20px rgba(254, 44, 85, .3);
        }
        .dyb-title { display: flex; align-items: baseline; gap: 7px; margin: 0; font-size: 16px; font-weight: 750; letter-spacing: .01em; }
        .dyb-version { font-size: 9.5px; font-weight: 600; color: rgba(255, 255, 255, .28); letter-spacing: .04em; }
        .dyb-subtitle { margin: 3px 0 0; font-size: 10px; letter-spacing: .12em; color: rgba(255, 255, 255, .34); }
        .dyb-close {
            width: 27px; height: 27px; padding: 0; border: 0; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255, 255, 255, .05); color: rgba(255, 255, 255, .45);
            cursor: pointer; transition: background .18s ease, color .18s ease;
        }
        .dyb-close:hover { background: rgba(255, 255, 255, .1); color: #fff; }
        .dyb-close svg { width: 14px; height: 14px; }
        .dyb-tabs {
            display: flex; gap: 4px; margin: 0 13px; padding: 3px;
            border-radius: 11px; background: rgba(255, 255, 255, .035);
            border: 1px solid rgba(255, 255, 255, .035);
        }
        .dyb-tab {
            flex: 1; height: 31px; border: 0; border-radius: 8px;
            background: transparent; color: rgba(255, 255, 255, .4);
            font-family: inherit; font-size: 11.5px; font-weight: 600;
            cursor: pointer; transition: color .18s ease, background .18s ease, box-shadow .18s ease;
        }
        .dyb-tab:hover { color: rgba(255, 255, 255, .72); }
        .dyb-tab.is-active {
            color: #fff; background: rgba(254, 44, 85, .14);
            box-shadow: inset 0 0 0 1px rgba(254, 44, 85, .32), 0 4px 14px rgba(0, 0, 0, .18);
        }
        .dyb-scroll { overflow-y: auto; padding: 8px 10px 5px; }
        .dyb-scroll::-webkit-scrollbar { width: 5px; }
        .dyb-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, .1); border-radius: 999px; }
        .dyb-row {
            width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 10px 9px; border: 0; border-radius: 11px;
            color: inherit; background: transparent; text-align: left;
            cursor: pointer; transition: background .18s ease;
        }
        .dyb-row:hover { background: rgba(255, 255, 255, .035); }
        .dyb-row-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .dyb-row-title { font-size: 12.5px; font-weight: 600; line-height: 16px; color: rgba(255, 255, 255, .9); }
        .dyb-row-desc { font-size: 10px; line-height: 14px; color: rgba(255, 255, 255, .33); }
        .dyb-switch {
            position: relative; flex: 0 0 auto;
            width: 38px; height: 21px; border-radius: 999px;
            background: rgba(255, 255, 255, .12);
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, .28);
            transition: background .2s ease, box-shadow .2s ease;
        }
        .dyb-switch::after {
            content: ""; position: absolute; top: 3px; left: 3px;
            width: 15px; height: 15px; border-radius: 50%;
            background: rgba(255, 255, 255, .7);
            box-shadow: 0 1px 4px rgba(0, 0, 0, .28);
            transition: transform .2s cubic-bezier(.2, .8, .2, 1), background .2s ease;
        }
        .dyb-switch.is-on {
            background: linear-gradient(135deg, #fe2c55, #ff6b81);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08), 0 4px 15px rgba(254, 44, 85, .34);
        }
        .dyb-switch.is-on::after { transform: translateX(17px); background: #fff; }
        .dyb-key {
            flex: 0 0 auto; min-width: 32px; height: 24px; padding: 0 8px;
            display: inline-flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255, 255, 255, .13);
            border-bottom-width: 2px; border-radius: 6px;
            background: rgba(255, 255, 255, .055);
            color: rgba(255, 255, 255, .82);
            font-family: inherit; font-size: 10.5px; font-weight: 650; letter-spacing: .03em;
            white-space: nowrap;
        }
        .dyb-row.is-recording { background: rgba(254, 44, 85, .09); box-shadow: inset 0 0 0 1px rgba(254, 44, 85, .26); }
        .dyb-row.is-recording .dyb-key {
            color: #fff; border-color: rgba(254, 44, 85, .52); background: rgba(254, 44, 85, .16);
            animation: dyb-key-pulse 1.1s ease-in-out infinite;
        }
        .dyb-panel-foot {
            display: flex; align-items: center; justify-content: space-between;
            padding: 11px 14px 13px;
            border-top: 1px solid rgba(255, 255, 255, .055);
        }
        .dyb-reset {
            height: 28px; padding: 0 11px; border: 1px solid rgba(255, 255, 255, .08);
            border-radius: 8px; background: rgba(255, 255, 255, .035);
            color: rgba(255, 255, 255, .5); font-family: inherit; font-size: 10.5px;
            cursor: pointer; transition: color .18s ease, background .18s ease;
        }
        .dyb-reset:hover { color: #fff; background: rgba(255, 255, 255, .08); }
        .dyb-foot-note { font-size: 9.5px; color: rgba(255, 255, 255, .25); letter-spacing: .03em; }
        .dyb-toast {
            position: fixed; left: 50%; bottom: 42px; transform: translateX(-50%) translateY(8px);
            display: flex; align-items: center; gap: 8px;
            padding: 9px 14px; border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, .09);
            background: rgba(16, 16, 23, .9);
            box-shadow: 0 12px 36px rgba(0, 0, 0, .4);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            color: rgba(255, 255, 255, .82); font-size: 11px; white-space: nowrap;
            opacity: 0; pointer-events: none;
            transition: opacity .2s ease, transform .2s ease;
        }
        .dyb-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        .dyb-toast-dot { width: 5px; height: 5px; border-radius: 50%; background: #fe2c55; box-shadow: 0 0 7px rgba(254, 44, 85, .75); }
        @keyframes dyb-fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dyb-panel-in { from { opacity: 0; transform: translateY(-7px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes dyb-key-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(254, 44, 85, .28); } 50% { box-shadow: 0 0 0 4px rgba(254, 44, 85, 0); } }
        @media (max-width: 720px) {
            .dyb-topbar { top: 10px; left: 10px; }
            .dyb-panel { top: 62px; left: 10px; right: 10px; width: auto; max-height: calc(100vh - 82px); }
            .dyb-anchor { max-width: 92px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .dyb-topbar, .dyb-panel, .dyb-toast { animation: none; transition: none; }
        }
    `;

    function buildRow(item) {
        const enabled = !!config[item.key];
        return [
            '<button type="button" class="dyb-row" data-dyb-toggle="' + item.key + '" role="switch" aria-checked="' + String(enabled) + '">',
            '  <span class="dyb-row-copy">',
            '    <span class="dyb-row-title">' + item.label + '</span>',
            '    <span class="dyb-row-desc">' + item.desc + '</span>',
            '  </span>',
            '  <span class="dyb-switch ' + (enabled ? 'is-on' : '') + '" aria-hidden="true"></span>',
            '</button>',
        ].join('');
    }

    function buildShortcutRow() {
        const label = config.fullscreenShortcut ? formatShortcutLabel(config.fullscreenShortcut) : '未设置';
        return [
            '<button type="button" class="dyb-row dyb-row-shortcut ' + (shortcutRecording ? 'is-recording' : '') + '" data-dyb-action="shortcut" title="点击后按下新的快捷键">',
            '  <span class="dyb-row-copy">',
            '    <span class="dyb-row-title">全屏快捷键</span>',
            '    <span class="dyb-row-desc">' + (shortcutRecording ? '请按下新的快捷键，Esc 取消' : '切换直播原生全屏') + '</span>',
            '  </span>',
            '  <kbd class="dyb-key">' + escapeHtml(shortcutRecording ? '按下按键…' : label) + '</kbd>',
            '</button>',
        ].join('');
    }

    function buildPanelHTML() {
        if (!panelOpen) return '';
        const items = activeTab === 'clean' ? CLEAN_ITEMS : PLAY_ITEMS;
        return [
            '<section class="dyb-panel" role="dialog" aria-label="直播美化设置">',
            '  <header class="dyb-panel-head">',
            '    <div class="dyb-title-wrap">',
            '      <div class="dyb-title-logo">抖</div>',
            '      <div>',
            '        <h1 class="dyb-title">直播美化 <span class="dyb-version">v' + SCRIPT_VERSION + '</span></h1>',
            '        <p class="dyb-subtitle">纯净 · 沉浸 · 不打扰</p>',
            '      </div>',
            '    </div>',
            '    <button type="button" class="dyb-close" data-dyb-action="close" title="关闭设置">',
            '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
            '    </button>',
            '  </header>',
            '  <div class="dyb-tabs">',
            '    <button type="button" class="dyb-tab ' + (activeTab === 'clean' ? 'is-active' : '') + '" data-dyb-tab="clean">界面净化</button>',
            '    <button type="button" class="dyb-tab ' + (activeTab === 'play' ? 'is-active' : '') + '" data-dyb-tab="play">播放体验</button>',
            '  </div>',
            '  <div class="dyb-scroll">' + items.map(buildRow).join('') + (activeTab === 'play' ? buildShortcutRow() : '') + '</div>',
            '  <footer class="dyb-panel-foot">',
            '    <button type="button" class="dyb-reset" data-dyb-action="reset">恢复默认</button>',
            '    <span class="dyb-foot-note">设置自动保存 · Alt+D 呼出</span>',
            '  </footer>',
            '</section>',
        ].join('');
    }

    function renderUI() {
        if (!shadow) return;
        const previousScroll = shadow.querySelector('.dyb-scroll');
        const scrollTop = previousScroll ? previousScroll.scrollTop : 0;
        const topbar = config.showTopbar ? [
            '<div class="dyb-topbar">',
            '  <button type="button" class="dyb-icon-btn" data-dyb-action="back" title="返回">',
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
            '  </button>',
            '  <div class="dyb-brand">',
            '    <div class="dyb-logo">抖</div>',
            '    <div class="dyb-brand-copy">',
            '      <div class="dyb-brand-line"><span class="dyb-brand-name">抖音直播</span><span class="dyb-live-dot"></span><span class="dyb-live-text">直播中</span></div>',
            '      <div class="dyb-anchor">' + escapeHtml(anchorName) + '</div>',
            '    </div>',
            '  </div>',
            '  <button type="button" class="dyb-icon-btn dyb-gear" data-dyb-action="panel" title="直播美化设置">',
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.3"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.3"/></svg>',
            '  </button>',
            '</div>',
        ].join('') : '';

        const toast = '<div class="dyb-toast ' + (toastMessage ? 'is-visible' : '') + '"><span class="dyb-toast-dot"></span>' + escapeHtml(toastMessage) + '</div>';

        shadow.innerHTML = '<style>' + SHADOW_CSS + '</style><div class="dyb-layer">' + topbar + buildPanelHTML() + toast + '</div>';

        const nextScroll = shadow.querySelector('.dyb-scroll');
        if (nextScroll && scrollTop) nextScroll.scrollTop = scrollTop;
    }

    function ensureUI() {
        if (!document.body) return;

        if (!host) {
            host = document.createElement('div');
            host.id = HOST_ID;
            host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;pointer-events:none!important;';
            shadow = host.attachShadow({ mode: 'open' });
            shadow.addEventListener('click', handleShadowClick);
            document.body.appendChild(host);
            renderUI();
            return;
        }

        if (!host.isConnected) {
            document.body.appendChild(host);
        }
    }

    function showToast(message) {
        toastMessage = message;
        renderUI();
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastMessage = '';
            renderUI();
        }, 2200);
    }

    function applyAll() {
        applyStyles();
        applyMutePreference();
    }

    function resetConfig() {
        config = Object.assign({}, DEFAULT_CONFIG);
        saveConfig(config);
        applyAll();
        renderUI();
        showToast('已恢复默认设置');
    }

    function toggleMute() {
        config.muteLive = !config.muteLive;
        saveConfig(config);
        applyMutePreference();
        renderUI();
        showToast(config.muteLive ? '已静音直播' : '已恢复直播声音');
    }

    function handleShadowClick(event) {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;

        // 点击面板任意位置都会结束上一次录制，再由下方按钮重新进入录制。
        shortcutRecording = false;

        const tab = target.closest('[data-dyb-tab]');
        if (tab) {
            activeTab = tab.getAttribute('data-dyb-tab') === 'play' ? 'play' : 'clean';
            renderUI();
            return;
        }

        const action = target.closest('[data-dyb-action]');
        if (action) {
            const name = action.getAttribute('data-dyb-action');
            if (name === 'panel') {
                panelOpen = !panelOpen;
                renderUI();
            } else if (name === 'close') {
                panelOpen = false;
                renderUI();
            } else if (name === 'reset') {
                resetConfig();
            } else if (name === 'shortcut') {
                shortcutRecording = true;
                renderUI();
            } else if (name === 'back') {
                if (history.length > 1) history.back();
                else location.href = 'https://live.douyin.com/';
            }
            return;
        }

        const toggle = target.closest('[data-dyb-toggle]');
        if (toggle) {
            const key = toggle.getAttribute('data-dyb-toggle');
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) return;
            config[key] = !config[key];
            saveConfig(config);
            applyAll();

            let message = (config[key] ? '已开启：' : '已关闭：') + (ITEM_MAP[key] ? ITEM_MAP[key].label : key);
            if (key === 'showTopbar' && !config.showTopbar) {
                message = '已隐藏顶栏，Alt+D 可重新打开设置';
            }
            toastMessage = message;
            renderUI();
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () {
                toastMessage = '';
                renderUI();
            }, 2400);
        }
    }

    // ==========================================
    //  启动与动态监听
    // ==========================================
    let observer = null;
    let observerTimer = null;
    let pendingNewVideo = false;
    let booted = false;

    function refreshAnchorIfNeeded() {
        const nextName = getAnchorName();
        if (nextName !== anchorName) {
            anchorName = nextName;
            if (shadow) renderUI();
        }
    }

    function setupObserver() {
        if (observer || !document.documentElement) return;
        observer = new MutationObserver(function (mutations) {
            const hostDetached = !!host && !host.isConnected;
            let hasNewVideo = false;
            let hasRoomInfo = false;

            mutations.forEach(function (mutation) {
                Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.tagName === 'VIDEO' || (typeof node.querySelector === 'function' && !!node.querySelector('video'))) {
                        hasNewVideo = true;
                    }
                    if (node.id === 'room_info_bar' || (typeof node.querySelector === 'function' && !!node.querySelector('#room_info_bar'))) {
                        hasRoomInfo = true;
                    }
                });
            });

            // 聊天消息会让 Webcast DOM 持续变化，只在真正需要守护时调度，避免无谓开销。
            if (!hostDetached && !hasNewVideo && !hasRoomInfo) return;
            if (hasNewVideo) pendingNewVideo = true;
            if (observerTimer) return;
            observerTimer = setTimeout(function () {
                observerTimer = null;
                ensureUI();
                refreshAnchorIfNeeded();
                if (pendingNewVideo) {
                    pendingNewVideo = false;
                    enforceMuteOnNewVideos();
                }
            }, 220);
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    function boot() {
        if (booted) return;
        if (!document.body) return;
        booted = true;

        applyStyles();
        anchorName = getAnchorName();
        ensureUI();
        applyMutePreference();
        setupObserver();
        scheduleQualityCheck(2200);
    }

    // 页面样式第一时刻注入，避免净化前闪屏。
    applyStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    document.addEventListener('keydown', function (event) {
        if (event.isComposing || event.repeat) return;

        if (shortcutRecording) {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                shortcutRecording = false;
                renderUI();
                return;
            }

            const shortcut = shortcutFromEvent(event);
            if (!shortcut) return;
            if (RESERVED_SHORTCUTS[shortcut]) {
                showToast('「' + formatShortcutLabel(shortcut) + '」已被' + RESERVED_SHORTCUTS[shortcut] + '占用，请换一个');
                return;
            }

            config.fullscreenShortcut = shortcut;
            saveConfig(config);
            shortcutRecording = false;
            showToast('全屏快捷键已设为 ' + formatShortcutLabel(shortcut));
            return;
        }

        if (!isTypingTarget(event) && matchesShortcut(event, config.fullscreenShortcut)) {
            event.preventDefault();
            event.stopPropagation();
            toggleLiveFullscreen();
            return;
        }

        if (event.key === 'Escape' && panelOpen) {
            event.preventDefault();
            panelOpen = false;
            renderUI();
            return;
        }
        if (!event.altKey) return;
        const key = (event.key || '').toLowerCase();
        if (key === 'd') {
            event.preventDefault();
            panelOpen = !panelOpen;
            renderUI();
        } else if (key === 'm') {
            event.preventDefault();
            toggleMute();
        }
    }, true);

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('⚙️ 打开直播美化设置', function () {
            panelOpen = true;
            ensureUI();
            renderUI();
        });
        GM_registerMenuCommand('🔇 切换直播静音', toggleMute);
        GM_registerMenuCommand('🖥️ 切换直播全屏', toggleLiveFullscreen);
        GM_registerMenuCommand('♻️ 恢复默认设置', resetConfig);
    }
})();
