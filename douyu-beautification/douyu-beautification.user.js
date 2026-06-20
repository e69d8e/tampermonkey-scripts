// ==UserScript==
// @name         斗鱼直播美化 - 极简纯净版
// @namespace    https://github.com/douyu-beautification
// @version      1.1.0
// @description  斗鱼直播间极简美化：移除广告、礼物栏、侧边推荐、活动弹窗等冗余元素，保留纯净的直播观看体验。支持自动最高画质、网页全屏、快捷键操作。
// @author       YH
// @match        *://www.douyu.com/*
// @match        *://douyu.com/*
// @icon         https://www.douyu.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @license      MIT
// @downloadURL  https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyu-beautification/douyu-beautification.user.js
// @updateURL    https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyu-beautification/douyu-beautification.user.js
// ==/UserScript==

(function () {
    'use strict';

    const isHomepage = window.location.pathname === '/' || window.location.pathname === '/index.htm' || window.location.pathname === '/index.html';

    const HOMEPAGE_PLAYER_SELECTORS = [
        '.IndexPlayer', '.IndexModule-player', '.layout-Main-player',
        '.LivePlayer-index', '.FeaturedPlayer', '[class*="index-player"]',
        '[class*="IndexPlayer"]', '[class*="HomeLive"]', '[class*="home-live"]',
        '[class*="HomePlayer"]', '[class*="home-player"]', '[class*="player-wrapper__"]',
        '[class*="player-component__"]'
    ];

    // ========================
    //  配置管理
    // ========================
    const DEFAULT_CONFIG = {
        removeHeader: true,         // 精简顶部导航栏
        removeAside: true,          // 移除右侧边栏（聊天区域）
        removeGiftBar: true,        // 移除礼物栏
        removeFooter: true,         // 移除底部
        removeAds: true,            // 移除广告
        removeWatermark: true,      // 移除水印
        removeActivity: true,       // 移除活动/任务弹窗
        removeSideBanner: true,     // 移除侧边横幅
        removeRecommend: true,      // 移除推荐内容
        removeTopBar: true,         // 精简信息栏（粉丝勋章、贵族图标等）
        autoWebFullscreen: false,   // 自动网页全屏
        autoHighQuality: true,      // 自动最高画质
        darkMode: true,             // 暗黑模式增强
        showChatPanel: false,       // 显示聊天面板（覆盖 removeAside）
        playerExpand: true,         // 播放器扩展填充
    };

    const CONFIG_KEY = 'douyuBeautifyConfig';

    function getConfig() {
        const saved = GM_getValue(CONFIG_KEY, null);
        return Object.assign({}, DEFAULT_CONFIG, saved || {});
    }

    function saveConfig(config) {
        GM_setValue(CONFIG_KEY, config);
    }

    let config = getConfig();

    // ========================
    //  CSS 注入 - 核心样式
    // ========================

    /**
     * 根据配置生成需要隐藏的元素 CSS
     * 每个配置项对应一组选择器，未启用的配置直接跳过
     */
    function generateHideCSS() {
        const rules = [];

        // ---- 广告 ----
        if (config.removeAds) {
            rules.push(`
                .MatchFocusFullPic, .Prompt-container,
                .DropMenuList-ad, .DropPane-ad,
                .CloudGameLink, .AdCover,
                .google-auto-placed, .adsbygoogle, .wm-general,
                .ScreenBannerAd, .BackpackSuper498, .PlayListC-ad,
                section.layout-Banner, .layout-Bottom-banner,
                .red-packet-wrap, .Title-followBox, .HeaderCell-banner,
                [class*="ad-wrap"], [class*="AdWrap"], [class*="banner-ad"] {
                    display: none !important;
                }
            `);
        }

        // ---- 首页直播播放区域（始终隐藏） ----
        rules.push(`
            [class*="background__"], [class*="wrapper__"],
            [class*="switcher__"], [class*="player-parallax__"],
            [class*="player-wrapper__"], [class*="player-component__"],
            [class*="player-aside__"], [class*="switcherTabs__"],
            [class*="backgroundHolder__"], [class*="backgroundHolderBlur__"],
            [class*="backgroundHandleWrapper__"], [class*="backgroundHandle__"],
            [class*="contianer__"],
            .layout-Ede, .layout-Module-player, .layout-Cover, .layout-Slide,
            .IndexPlayer, .IndexModule-player, .HeaderSlide, .SlideNav, .Slide-list,
            .layout-Main-player, .HomeHero, .LivePlayer-index, .FeaturedPlayer,
            [class*="index-player"], [class*="IndexPlayer"],
            [class*="HomeLive"], [class*="home-live"],
            [class*="HomePlayer"], [class*="home-player"],
            [class*="Slide-module"], [class*="swiper-slide"],
            [class*="featured-live"], [class*="FeaturedLive"] {
                display: none !important;
            }
            [class*="floor__"]:first-of-type,
            [class*="favorite__"] {
                margin-top: 90px !important;
            }
        `);

        // ---- 顶部导航栏精简（保留：搜索、关注、消息、头像） ----
        if (config.removeHeader) {
            rules.push(`
                [class*="logo__"], .HeaderLogo,
                .Header-toggle-btn, .Header-menu-wrap,
                .Header-history-wrap, .Header-download-wrap,
                .Header-broadcast-wrap, .Header-createcenter-wrap {
                    display: none !important;
                }
                #js-header, [class*="header__"] {
                    background: rgba(10, 10, 15, 0.95) !important;
                    backdrop-filter: blur(12px) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
                }
                .Header-left {
                    flex: 0 !important;
                    min-width: 0 !important;
                }
            `);
        }

        // ---- 右侧边栏（弹幕/聊天区域） ----
        if (config.removeAside && !config.showChatPanel) {
            rules.push(`
                /* 旧版选择器（兼容） */
                #js-aside, .layout-Player-aside, .aside-Main,
                .ChatRoomTabComponent, .RoomInfoTabComponent,
                .layout-Player-chat, .Right-container, .Aside-main,
                /* 新版：斗鱼改版后的侧边栏 */
                [class*="stage__"] > [class*="sidebar"],
                [class*="snapbar__"] {
                    display: none !important;
                }
            `);
        }

        // ---- 礼物栏 ----
        if (config.removeGiftBar) {
            rules.push(`
                .gift-wrap, .GiftBar, .GiftBar498, .GiftBar-498,
                .GiftBagPop, .GiftBarComponent, .gift-orange-498,
                .GiftSection, .NoblePkBox, .FansBadgeEnter,
                .layout-Player-gift, #js-gift-bar, .Gift-498,
                .BottomBar, .layout-Player-bar498,
                .layout-Player-rankHover, .BackpackMainBtn,
                [class*="GiftBar"], [class*="gift-bar"], [class*="gift-wrap"],
                [class*="gift" i], [class*="Gift" i],
                [class*="backpack" i], [class*="Backpack" i],
                [class*="recharge" i], [class*="Recharge" i] {
                    display: none !important;
                }
            `);
        }

        // ---- 底部 ----
        if (config.removeFooter) {
            rules.push(`
                #js-bottom, .layout-Bottom, footer, .Footer, .BottomFooter {
                    display: none !important;
                }
            `);
        }

        // ---- 水印 ----
        if (config.removeWatermark) {
            rules.push(`
                .watermark-442a18, [class*="watermark"], [class*="Watermark"] {
                    visibility: hidden !important;
                    display: none !important;
                }
            `);
        }

        // ---- 活动/任务/弹窗 ----
        if (config.removeActivity) {
            rules.push(`
                #js-room-activity, .layout-Player-guessgame,
                #js-player-dialog, .RoomActivityFloat,
                .TaskBox, .GuessGame, .TreasureBox, .LotteryBox,
                .SignBarComponent, .ActivityReceivePopup,
                .FansInteractPopup, .YBHotDebate, .is-ybHotDebate,
                .HoverTips, .SignCont, .activityWrap,
                .view-67255d.zoomIn-0f4645,
                .FloatLayerContent, .TaskBarComponent,
                .EnterEffect, .RoomBusiness-498,
                .RoomFocusBanner, .PkBox498,
                .DiamondNoble, .FansRankBox,
                [class*="Activity"], [class*="activity"],
                [class*="lottery"], [class*="Lottery"] {
                    display: none !important;
                }
            `);
        }

        // ---- 侧边横幅 ----
        if (config.removeSideBanner) {
            rules.push(`
                .ToTopBtn, .SideBar, .SidebarFloat, .BackTop, .RightFloat,
                [class*="SideBar"], [class*="sidebar"], [class*="elevator__"] {
                    display: none !important;
                }
            `);
        }

        // ---- 推荐内容 & 评论区 ----
        if (config.removeRecommend) {
            rules.push(`
                /* 旧版选择器（兼容） */
                .layout-Module, .RecommendList, .PlayList, .ListContent,
                .layout-Powerful, .layout-Hot, .RoomListItem, .ListModule,
                .Comment, .CommentList, .CommentModule, .RoomComment,
                .RoomCommentPanel, .InteractPlayback,
                .layout-Bottom-comment,
                .layout-Player-toolbar, .layout-Player-announce,
                .layout-Player-rank, .layout-Player-guessgame,
                [class*="Recommend"], [class*="recommend"],
                [class*="Comment"], [class*="comment-list"],
                [class*="CommentSection"],
                [class*="playback-comment"], [class*="PlaybackComment"],
                [class*="Player-toolbar"], [class*="Player-announce"],
                [class*="Player-rank"], [class*="Player-guessgame"],
                [class*="yuba" i], [class*="Yuba" i],
                /* 新版：播放器下方功能卡片（任务大厅、游戏租号、免费办卡等）
                   注意：不要用 [class*="toolbar__"] 或 [class*="interactive__"]
                   这些会匹配播放器内部元素导致小窗模式 */
                .ToolbarCardModule, .ToolBarCardProxyItem,
                .InteractLayout, .interactEntry, .InteractEntryPanel,
                .InteractEntryPanelRecent, .InteractEntryPanelList,
                .PlayerToolbar-ContentRow.InteractABAd,
                .PlayerToolbar-ContentCell.is-full.InteractABAd-aside,
                .snapbar__TUgkE {
                    display: none !important;
                }
            `);
        }

        // ---- 信息栏精简（粉丝勋章、贵族图标等） ----
        if (config.removeTopBar) {
            rules.push(`
                .FollowLevelBox, .Title-followBox, .Title-anchorLevel,
                .FansMedal, .Title-nobleIcon, .Title-liveTags, .Title-liveTag,
                [class*="Noble"], [class*="FansMedal"],
                #js-player-main::before {
                    display: none !important;
                }
            `);
        }

        // ---- 播放器填充扩展 ----
        if (config.playerExpand) {
            rules.push(`
                /* 旧版选择器（兼容） */
                .layout-Player-main, .layout-Player, .layout-Main {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    padding-bottom: 0 !important;
                }
                body:not([class*="wfs"]):not([class*="fullscreen"]) .layout-Main {
                    padding-top: 72px !important;
                }
                body[class*="wfs"] .layout-Main,
                body[class*="fullscreen"] .layout-Main {
                    padding-top: 0 !important;
                }
                #js-player-video, .layout-Player-video {
                    width: 100% !important;
                }
                /* 新版：斗鱼改版后的播放器填充 + 居中 */
                [class*="stage__"] > [class*="main__"] {
                    margin: 0 auto !important;
                    max-width: 100% !important;
                }
            `);
        }

        return rules.join('\n');
    }

    /**
     * 基础美化样式（始终应用）
     */
    function generateBaseCSS() {
        return `
            /* ========== 基础美化 ========== */
            body {
                background-color: #0a0a0f !important;
                overflow-x: hidden !important;
            }
            .layout-Player {
                background-color: #0a0a0f !important;
                border: none !important;
                box-shadow: none !important;
            }
            .layout-Player-main {
                background-color: #000 !important;
                border-radius: 0 !important;
                margin: 0 auto !important;
                float: none !important;
            }
            /* 新版：播放器区域居中 */
            [class*="playerWrap__"] {
                background-color: #0a0a0f !important;
                padding: 0 !important;
                display: flex !important;
                justify-content: center !important;
            }
            [class*="stage__"] {
                justify-content: center !important;
                max-width: 100vw !important;
            }
            #__video2, video {
                background-color: #000 !important;
            }
            .controlbar-573af1, .ControlBar, [class*="controlbar"] {
                background: linear-gradient(transparent, rgba(0, 0, 0, 0.85)) !important;
                border: none !important;
            }
            .Title-header, .HeaderRoomInfo, .Title-roomInfo {
                background-color: #12121a !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
                padding: 8px 16px !important;
            }
            .Title-header .Title-anchorName,
            .Title-header .Title-roomName,
            .HeaderRoomInfo .Title-anchorName {
                color: #e8e8e8 !important;
                font-weight: 600 !important;
            }
            .Title-header .Title-online,
            .HeaderRoomInfo .Title-online {
                color: rgba(255, 255, 255, 0.5) !important;
            }
            .Title-followBtn, .FollowBtn {
                background: linear-gradient(135deg, #ff6a00, #ee0979) !important;
                border: none !important;
                border-radius: 20px !important;
                color: #fff !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
            }
            .Title-followBtn:hover, .FollowBtn:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 4px 15px rgba(238, 9, 121, 0.4) !important;
            }
            ::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
            ::-webkit-scrollbar-track { background: transparent !important; }
            ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15) !important; border-radius: 3px !important; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25) !important; }
            ._1Osm4fzGmcuRK9M8IVy3u6 { visibility: hidden !important; }
            .wfs-exit, .wfs-exit #__video2 { background-color: #000 !important; }

            /* ========== 设置面板 ========== */
            #douyu-beautify-panel {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                z-index: 999999; width: 420px; max-height: 80vh;
                background: rgba(18, 18, 26, 0.97);
                backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 80px rgba(238,9,121,0.08);
                overflow: hidden; opacity: 0; pointer-events: none;
                transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #douyu-beautify-panel.is-visible { opacity: 1; pointer-events: all; transform: translate(-50%, -50%) scale(1); }
            #douyu-beautify-panel .panel-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            #douyu-beautify-panel .panel-header h3 {
                margin: 0; font-size: 18px; font-weight: 700;
                background: linear-gradient(135deg, #ff6a00, #ee0979);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                background-clip: text; letter-spacing: 0.5px;
            }
            #douyu-beautify-panel .panel-close {
                width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                border: none; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                border-radius: 8px; cursor: pointer; font-size: 18px; transition: all 0.2s ease; line-height: 1;
            }
            #douyu-beautify-panel .panel-close:hover { background: rgba(255,59,48,0.2); color: #ff3b30; }
            #douyu-beautify-panel .panel-body { padding: 16px 24px 24px; overflow-y: auto; max-height: 60vh; }
            #douyu-beautify-panel .setting-group { margin-bottom: 8px; }
            #douyu-beautify-panel .setting-group-title {
                font-size: 11px; font-weight: 600; text-transform: uppercase;
                letter-spacing: 1.5px; color: rgba(255,255,255,0.3); margin-bottom: 10px; padding-left: 2px;
            }
            #douyu-beautify-panel .setting-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 14px; margin-bottom: 4px; border-radius: 10px; transition: background 0.2s ease;
            }
            #douyu-beautify-panel .setting-item:hover { background: rgba(255,255,255,0.04); }
            #douyu-beautify-panel .setting-label { font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 500; }
            #douyu-beautify-panel .setting-desc { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
            #douyu-beautify-panel .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; margin-left: 12px; }
            #douyu-beautify-panel .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
            #douyu-beautify-panel .toggle-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: rgba(255,255,255,0.1); border-radius: 12px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #douyu-beautify-panel .toggle-slider::before {
                position: absolute; content: ''; height: 18px; width: 18px;
                left: 3px; bottom: 3px; background: rgba(255,255,255,0.7);
                border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            #douyu-beautify-panel .toggle-switch input:checked + .toggle-slider {
                background: linear-gradient(135deg, #ff6a00, #ee0979);
            }
            #douyu-beautify-panel .toggle-switch input:checked + .toggle-slider::before {
                transform: translateX(20px); background: #fff;
            }
            #douyu-beautify-panel .panel-footer {
                padding: 12px 24px 16px; border-top: 1px solid rgba(255,255,255,0.06);
                display: flex; align-items: center; justify-content: space-between;
            }
            #douyu-beautify-panel .panel-footer .hint { font-size: 11px; color: rgba(255,255,255,0.3); }
            #douyu-beautify-panel .panel-footer .hint kbd {
                display: inline-block; padding: 1px 5px; font-size: 10px;
                background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 4px; color: rgba(255,255,255,0.5); font-family: monospace; margin: 0 2px;
            }
            #douyu-beautify-panel .panel-footer .apply-btn {
                padding: 6px 20px; border: none; border-radius: 8px;
                background: linear-gradient(135deg, #ff6a00, #ee0979);
                color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
            }
            #douyu-beautify-panel .panel-footer .apply-btn:hover {
                transform: scale(1.05); box-shadow: 0 4px 15px rgba(238,9,121,0.4);
            }
            #douyu-beautify-overlay {
                position: fixed; inset: 0; z-index: 999998;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
            }
            #douyu-beautify-overlay.is-visible { opacity: 1; pointer-events: all; }

            /* ========== 悬浮触发按钮 ========== */
            #douyu-beautify-trigger {
                position: fixed; bottom: 24px; right: 24px; z-index: 999990;
                width: 48px; height: 48px; border-radius: 14px;
                background: linear-gradient(135deg, #ff6a00, #ee0979);
                border: none; cursor: pointer; display: flex;
                align-items: center; justify-content: center;
                box-shadow: 0 4px 15px rgba(238,9,121,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); opacity: 0.7;
            }
            #douyu-beautify-trigger:hover {
                opacity: 1; transform: scale(1.1);
                box-shadow: 0 8px 25px rgba(238,9,121,0.4), 0 0 0 1px rgba(255,255,255,0.15) inset;
            }
            #douyu-beautify-trigger svg { width: 22px; height: 22px; fill: #fff; }

            /* ========== 聊天面板 ========== */
            .layout-Player-aside.beautified-chat {
                background: rgba(18,18,26,0.95) !important;
                border-left: 1px solid rgba(255,255,255,0.06) !important;
            }

            /* ========== Toast ========== */
            #douyu-beautify-toast {
                position: fixed; top: 20px; left: 50%;
                transform: translateX(-50%) translateY(-100px);
                z-index: 9999999; padding: 10px 24px;
                background: rgba(18,18,26,0.95); backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
                color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #douyu-beautify-toast.is-visible { transform: translateX(-50%) translateY(0); }
        `;
    }

    // ========================
    //  样式管理器
    // ========================
    let dynamicStyleEl = null;

    function applyStyles() {
        const cssText = generateBaseCSS() + '\n' + generateHideCSS();
        if (dynamicStyleEl) {
            dynamicStyleEl.textContent = cssText;
        } else {
            dynamicStyleEl = GM_addStyle(cssText);
        }
        // 触发 resize 让播放器自适应
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }

    // document-start 阶段尽早注入，防止元素闪烁
    applyStyles();

    // ========================
    //  DOM 工具
    // ========================
    function onDomReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function onPageLoaded(fn) {
        if (document.readyState === 'complete') {
            fn();
        } else {
            window.addEventListener('load', fn);
        }
    }

    // ========================
    //  Toast 提示
    // ========================
    let toastTimer = null;
    function showToast(message, duration = 2000) {
        let toast = document.getElementById('douyu-beautify-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'douyu-beautify-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
    }

    // ========================
    //  强制移除元素（JS 层面，处理 CSS 无法覆盖的情况）
    // ========================
    const JS_REMOVE_SELECTORS = {
        removeAds: [
            '.MatchFocusFullPic', '.DropMenuList-ad', '.DropPane-ad',
            '.CloudGameLink', '.AdCover', '.google-auto-placed',
            '.adsbygoogle', '.ScreenBannerAd', 'section.layout-Banner'
        ],
        removeActivity: [
            '#js-room-activity', '.layout-Player-guessgame',
            '#js-player-dialog', '.RoomActivityFloat',
            '.TreasureBox', '.LotteryBox', '.EnterEffect'
        ],
        removeRecommend: [
            '.ToolbarCardModule', '.ToolBarCardProxyItem',
            '.InteractLayout', '.interactEntry', '.InteractEntryPanel'
        ]
    };

    function forceRemoveElements() {
        Object.entries(JS_REMOVE_SELECTORS).forEach(([key, selectors]) => {
            if (config[key]) {
                selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => {
                    el.style.display = 'none';
                }));
            }
        });
    }

    // ========================
    //  自动最高画质
    // ========================
    /**
     * 通用轮询重试函数
     * @param {Function} fn 返回 true 表示成功并停止重试
     * @param {number} interval 间隔时间（ms）
     * @param {number} maxAttempts 最大尝试次数
     */
    function retry(fn, interval = 1000, maxAttempts = 20) {
        let attempts = 0;
        const timer = setInterval(() => {
            if (fn() || ++attempts >= maxAttempts) clearInterval(timer);
        }, interval);
    }

    // ========================
    //  自动最高画质
    // ========================
    function autoHighQuality() {
        if (!config.autoHighQuality) return;

        retry(() => {
            // 直接点击画质选项
            const qualityBtns = document.querySelectorAll(
                '.tipitem, .PlayerControl-item[class*="quality"], [class*="QualityItem"], [class*="quality-item"]'
            );
            if (qualityBtns.length > 0) {
                qualityBtns[0].click();
                return true;
            }

            // 备选：点击画质选择器后选最高
            const qualitySelector = document.querySelector(
                '[class*="QualitySwitch"], [class*="quality-switch"]'
            );
            if (qualitySelector) {
                qualitySelector.click();
                setTimeout(() => {
                    const items = document.querySelectorAll('.tipitem, [class*="QualityItem"]');
                    if (items.length > 0) {
                        items[0].click();
                    }
                }, 300);
                return true;
            }
            return false;
        }, 1500, 15);
    }

    // ========================
    //  自动网页全屏
    // ========================
    function autoWebFullscreen() {
        if (!config.autoWebFullscreen) return;

        retry(() => {
            const btn = document.querySelector(
                '[class*="wfs"], [class*="WebScreen"], .controlbar-item-wfs, [title="网页全屏"]'
            );
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        }, 1000, 20);
    }

    // ========================
    //  首页自动直播清理
    // ========================
    function cleanHomepagePlayer() {
        if (!isHomepage) return;

        // 查找所有 video 元素并暂停、静音、断开源链接，防止后台播放发声
        document.querySelectorAll('video').forEach(video => {
            try {
                video.pause();
                video.muted = true;
                video.src = '';
                video.srcObject = null;
                video.load();
            } catch (e) { /* ignore */ }
        });

        // 查找首页播放器容器相关元素，并静音/暂停内部的所有 video
        HOMEPAGE_PLAYER_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.querySelectorAll('video').forEach(v => {
                    try {
                        v.pause();
                        v.muted = true;
                        v.src = '';
                        v.srcObject = null;
                        v.load();
                    } catch (e) { /* ignore */ }
                });
            });
        });
    }

    // ========================
    //  MutationObserver - 持续清理动态加载的元素
    // ========================
    const OBSERVER_CLASS_LIST = [
        'MatchFocusFullPic', 'Prompt-container', 'AdCover',
        'ScreenBannerAd', 'EnterEffect', 'RoomActivityFloat',
        'ActivityReceivePopup', 'FansInteractPopup', 'FloatLayerContent',
        'ToolbarCardModule', 'InteractEntryPanel'
    ];

    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    // 首页新插入了视频或播放器容器，则执行强力清理
                    if (isHomepage && (
                        node.tagName === 'VIDEO' ||
                        node.querySelector('video') ||
                        HOMEPAGE_PLAYER_SELECTORS.some(sel => {
                            try {
                                return (node.matches && node.matches(sel)) || (node.querySelector && node.querySelector(sel));
                            } catch (e) {
                                return false;
                            }
                        })
                    )) {
                        cleanHomepagePlayer();
                    }

                    if (OBSERVER_CLASS_LIST.some(cls => node.classList?.contains(cls))) {
                        node.style.display = 'none';
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ========================
    //  设置面板 UI
    // ========================
    const SETTINGS_GROUPS = [
        {
            group: '元素清理',
            items: [
                { key: 'removeHeader', label: '精简顶部导航', desc: '仅保留搜索、关注、消息、头像' },
                { key: 'removeAside', label: '移除右侧边栏', desc: '隐藏弹幕/聊天区域' },
                { key: 'removeGiftBar', label: '移除礼物栏', desc: '隐藏礼物赠送区域' },
                { key: 'removeFooter', label: '移除页脚', desc: '隐藏底部页脚信息' },
                { key: 'removeAds', label: '移除广告', desc: '屏蔽所有广告元素' },
                { key: 'removeWatermark', label: '移除水印', desc: '隐藏播放器水印' },
                { key: 'removeActivity', label: '移除活动弹窗', desc: '屏蔽任务/活动/抽奖弹窗' },
                { key: 'removeSideBanner', label: '移除侧边横幅', desc: '隐藏浮动按钮和侧边栏' },
                { key: 'removeRecommend', label: '精简视频下方', desc: '移除视频下方的工具栏、推荐、评论等所有元素' },
                { key: 'removeTopBar', label: '精简信息栏', desc: '移除粉丝勋章、贵族图标等' },
            ]
        },
        {
            group: '功能增强',
            items: [
                { key: 'playerExpand', label: '播放器全宽', desc: '播放器扩展为全屏宽度' },
                { key: 'autoHighQuality', label: '自动最高画质', desc: '自动选择最高可用画质' },
                { key: 'autoWebFullscreen', label: '自动网页全屏', desc: '进入直播间自动网页全屏' },
                { key: 'showChatPanel', label: '保留聊天面板', desc: '保留右侧弹幕聊天（覆盖侧边栏移除）' },
            ]
        }
    ];

    function createSettingsPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'douyu-beautify-overlay';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'douyu-beautify-panel';

        const bodyHtml = SETTINGS_GROUPS.map(group => `
            <div class="setting-group">
                <div class="setting-group-title">${group.group}</div>
                ${group.items.map(item => `
                    <div class="setting-item">
                        <div>
                            <div class="setting-label">${item.label}</div>
                            <div class="setting-desc">${item.desc}</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" data-key="${item.key}" ${config[item.key] ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `).join('')}
            </div>
        `).join('');

        panel.innerHTML = `
            <div class="panel-header">
                <h3>⚡ 斗鱼美化设置</h3>
                <button class="panel-close" id="beautify-panel-close">✕</button>
            </div>
            <div class="panel-body">${bodyHtml}</div>
            <div class="panel-footer">
                <span class="hint">快捷键 <kbd>Alt</kbd>+<kbd>S</kbd> 打开设置</span>
                <button class="apply-btn" id="beautify-apply">应用并刷新</button>
            </div>
        `;
        document.body.appendChild(panel);

        // 事件绑定
        overlay.addEventListener('click', togglePanel);
        document.getElementById('beautify-panel-close').addEventListener('click', togglePanel);

        panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                config[input.dataset.key] = input.checked;
                saveConfig(config);
            });
        });

        document.getElementById('beautify-apply').addEventListener('click', () => {
            saveConfig(config);
            location.reload();
        });

        // 悬浮触发按钮
        const trigger = document.createElement('button');
        trigger.id = 'douyu-beautify-trigger';
        trigger.title = '斗鱼美化设置 (Alt+S)';
        trigger.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
        trigger.addEventListener('click', togglePanel);
        document.body.appendChild(trigger);
    }

    let panelVisible = false;
    function togglePanel() {
        panelVisible = !panelVisible;
        const panel = document.getElementById('douyu-beautify-panel');
        const overlay = document.getElementById('douyu-beautify-overlay');
        if (panel) panel.classList.toggle('is-visible', panelVisible);
        if (overlay) overlay.classList.toggle('is-visible', panelVisible);
    }

    // ========================
    //  快捷键
    // ========================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + S: 打开/关闭设置面板
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                togglePanel();
                return;
            }

            // 以下快捷键仅在非输入框时生效
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const shortcutMap = {
                w: { selector: '[class*="wfs"], [class*="WebScreen"], .controlbar-item-wfs, [title="网页全屏"]', msg: '🖥 切换网页全屏' },
                f: { selector: '[class*="full-screen"], [class*="FullScreen"], [title="全屏"], .controlbar-item-fs', msg: '🖥 切换全屏' },
                d: { selector: '[class*="danmu-switch"], [class*="DanmuSwitch"], [class*="barrage-switch"], [title*="弹幕"]', msg: '💬 切换弹幕' },
                m: { selector: '[class*="volume"], [class*="Volume"], [title*="音量"], [title*="静音"]', msg: '🔇 切换静音' },
            };

            const action = shortcutMap[e.key.toLowerCase()];
            if (action) {
                const btn = document.querySelector(action.selector);
                if (btn) {
                    btn.click();
                    showToast(action.msg);
                }
            }
        });
    }

    // ========================
    //  注册 Tampermonkey 菜单命令
    // ========================
    GM_registerMenuCommand('⚡ 斗鱼美化 - 打开设置', togglePanel);
    GM_registerMenuCommand('🔄 斗鱼美化 - 恢复默认设置', () => {
        saveConfig(DEFAULT_CONFIG);
        location.reload();
    });

    // ========================
    //  初始化
    // ========================
    onDomReady(() => {
        if (isHomepage) cleanHomepagePlayer();
        applyStyles();
        forceRemoveElements();
        createSettingsPanel();
        setupKeyboardShortcuts();
        startObserver();
    });

    onPageLoaded(() => {
        if (isHomepage) cleanHomepagePlayer();
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            forceRemoveElements();
            applyStyles();
        }, 500);

        // 延迟执行自动化功能，等待播放器 UI 加载
        setTimeout(() => {
            autoHighQuality();
            autoWebFullscreen();
        }, 2000);

        // 第三次清理（处理懒加载内容）
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            forceRemoveElements();
        }, 5000);
    });

    console.log(
        '%c ⚡ 斗鱼美化 v1.1.0 已加载 %c Alt+S 打开设置 ',
        'background: linear-gradient(135deg, #ff6a00, #ee0979); color: #fff; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
        'background: #12121a; color: #ee0979; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #ee0979;'
    );
})();
