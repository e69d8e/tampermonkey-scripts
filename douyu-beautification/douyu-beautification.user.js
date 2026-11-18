// ==UserScript==
// @name         斗鱼直播美化 - 极简纯净版
// @namespace    https://github.com/douyu-beautification
// @version      0.0.6
// @description  斗鱼直播间极简美化：移除广告、礼物栏、侧边推荐、活动弹窗等冗余元素，保留纯净的直播观看体验。支持空格暂停/继续、F 全屏、H 网页全屏、D 弹幕开关等可自定义快捷键，自动最高画质、顶栏设置按钮、设置即时热生效。
// @author       YH
// @match        *://www.douyu.com/*
// @match        *://douyu.com/*
// @icon         https://www.douyu.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @noframes
// @license      MIT
// @downloadURL  https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyu-beautification/douyu-beautification.user.js
// @updateURL    https://github.com/e69d8e/tampermonkey-scripts/raw/main/douyu-beautification/douyu-beautification.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (window.self !== window.top) return;

    const SCRIPT_VERSION = '0.0.6';

    const isHomepage = window.location.pathname === '/' || window.location.pathname === '/index.htm' || window.location.pathname === '/index.html';

    // ==========================================
    //  配置管理
    // ==========================================
    const DEFAULT_CONFIG = {
        removeHeader: true,         // 精简顶部导航栏
        removeGiftBar: true,        // 移除礼物栏
        removeFooter: true,         // 移除底部
        removeAds: true,            // 移除广告
        removeWatermark: true,      // 移除水印
        removeActivity: true,       // 移除活动/任务弹窗及活动背景皮肤
        removeSideBanner: true,     // 移除侧边横幅与浮动工具
        removeRecommend: true,      // 移除推荐内容与视频下方工具栏
        removeTopBar: true,         // 精简信息栏（粉丝勋章、贵族图标等）
        autoWebFullscreen: false,   // 自动网页全屏
        autoHighQuality: true,      // 自动最高画质
        hideChatPanel: true,        // 隐藏右侧聊天/弹幕列表
        playerExpand: true,         // 播放器扩展全屏大窗
        hideDanmaku: false,         // 隐藏覆盖画面的滚动弹幕
        fullscreenShortcut: 'f',    // 全屏快捷键
        webFullscreenShortcut: 'h', // 网页全屏快捷键
        danmakuShortcut: 'd',       // 弹幕开关快捷键
    };

    const SHORTCUT_ITEMS = [
        { key: 'fullscreenShortcut', label: '全屏', desc: '切换播放器原生全屏' },
        { key: 'webFullscreenShortcut', label: '网页全屏', desc: '切换斗鱼网页全屏' },
        { key: 'danmakuShortcut', label: '弹幕开关', desc: '显示或隐藏画面弹幕' },
    ];

    const CONFIG_KEY = 'douyuBeautifyConfig';

    function getConfig() {
        let saved = null;
        if (typeof GM_getValue !== 'undefined') {
            saved = GM_getValue(CONFIG_KEY, null);
        } else {
            try {
                saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
            } catch (e) {
                saved = null;
            }
        }
        const cfg = Object.assign({}, DEFAULT_CONFIG, saved || {});
        // 兼容旧配置：原来「移除右侧边栏」与「保留聊天面板」是一对反向开关，
        // 现在合并为单一的「隐藏聊天面板」，按旧值推导出真实的隐藏状态。
        if (saved && typeof saved.hideChatPanel !== 'boolean') {
            const removeAside = saved.removeAside !== false;
            const showChatPanel = saved.showChatPanel === true;
            cfg.hideChatPanel = removeAside && !showChatPanel;
        }
        delete cfg.removeAside;
        delete cfg.showChatPanel;
        return cfg;
    }

    function saveConfig(cfg) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(CONFIG_KEY, cfg);
        }
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        } catch (e) { /* ignore */ }
    }

    let config = getConfig();

    // ==========================================
    //  DOM 选择器注册表（兼容新版与旧版斗鱼）
    // ==========================================
    const SELECTORS = {
        controlBarRight: '#js-player-controlbar [class*="right-"], [class*="ControlBar"] [class*="right-"], [class*="controlbar"] [class*="right"]',
        qualityRate: '#js-player-controlbar [class*="rate-"], [class*="ControlBar"] [class*="rate-"], [class*="controlbar"] [class*="rate-"]'
    };

    // ==========================================
    //  CSS 样式生成
    // ==========================================
    function generateHideCSS() {
        const rules = [];

        // ---- 广告屏蔽 ----
        if (config.removeAds) {
            rules.push(`
                .MatchFocusFullPic, .Prompt-container,
                .DropMenuList-ad, .DropPane-ad,
                .CloudGameLink, .AdCover,
                .google-auto-placed, .adsbygoogle, .wm-general,
                .ScreenBannerAd, .BackpackSuper498, .PlayListC-ad,
                section.layout-Banner, .layout-Bottom-banner,
                .red-packet-wrap, .Title-followBox, .HeaderCell-banner,
                [class*="IconCardAd"], [class*="iconCardAd"],
                [class*="ad-wrap"], [class*="AdWrap"], [class*="banner-ad"],
                [class*="adBanner"], [class*="AdBanner"], [class*="abAd"] {
                    display: none !important;
                }
            `);
        }

        // ---- 首页轮播视频区域（仅在首页精简） ----
        if (isHomepage) {
            rules.push(`
                [class*="background__"], [class*="player-parallax__"],
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
                    margin-top: 80px !important;
                }
            `);
        }

        // ---- 顶部导航栏精简 ----
        if (config.removeHeader) {
            rules.push(`
                [class*="logo__"], .HeaderLogo,
                .Header-toggle-btn, .Header-menu-wrap,
                .Header-history-wrap, .Header-download-wrap,
                .Header-broadcast-wrap, .Header-createcenter-wrap,
                .Header-taskentry-wrap,
                [class*="headerDropdown"], [class*="download-app"] {
                    display: none !important;
                }
                #js-header, [class*="header__"], .Header {
                    background: rgba(10, 10, 15, 0.95) !important;
                    backdrop-filter: blur(12px) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
                }
                .Header-left {
                    flex: 0 !important;
                    min-width: 0 !important;
                }
                .Header .Search,
                .Header .Search-Input,
                #js-header [class*="search"] input {
                    background: rgba(255, 255, 255, 0.08) !important;
                    border-color: rgba(255, 255, 255, 0.14) !important;
                    color: #e8e8e8 !important;
                }
                .Header .Search-text {
                    background: transparent !important;
                    color: #e8e8e8 !important;
                }
                .Header .Search-text::placeholder {
                    color: rgba(255, 255, 255, 0.45) !important;
                }
                .Header .Search-icon,
                .Header .Search-search {
                    color: rgba(255, 255, 255, 0.65) !important;
                }
            `);
        }

        // ---- 右侧边栏（弹幕/聊天区域） ----
        if (config.hideChatPanel) {
            rules.push(`
                #js-aside, .layout-Player-aside, .aside-Main,
                .ChatRoomTabComponent, .RoomInfoTabComponent,
                .layout-Player-chat, .Right-container, .Aside-main,
                [class*="stage__"] > [class*="sidebar"],
                [class*="snapbar__"],
                aside[class*="sidebar"] {
                    display: none !important;
                }
            `);
        }

        // ---- 画面弹幕开关 ----
        if (config.hideDanmaku) {
            rules.push(`
                [class^="danmu-"], [class*=" danmu-"], [class*="danmuItem"],
                .DanmuEffectDom, [class*="retentionDanmu"] {
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
                [class*="GiftBar"], [class*="giftBar"], [class*="gift-bar"], [class*="gift-wrap"],
                [class*="GiftBag"], [class*="Backpack"], [class*="backpack-"],
                [class*="Recharge"], [class*="recharge-"] {
                    display: none !important;
                }
            `);
        }

        // ---- 底部 ----
        if (config.removeFooter) {
            rules.push(`
                #js-bottom, .layout-Bottom, footer, .Footer, .BottomFooter,
                [class*="footer__"], [class*="BottomFooter"] {
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

        // ---- 活动/任务/弹窗 & 定制皮肤 Banner 屏蔽 ----
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
                [class*="title__"] [class*="activeContainer__"],
                [class*="lottery"], [class*="Lottery"],
                [class*="TreasureBox"], [class*="GuessGame"],
                /* 屏蔽活动定制皮肤的巨型置顶 Banner 及下推背景 */
                .bc-wrapper:not([class*="playerWrap"]),
                [id^="bc"]:not([id^="bc5"]):not([id^="bc3-bg"]):not([class*="player"]):not([class*="stage"]):not([class*="main"]),
                .wm-view, .BackgroundOpacity-layout {
                    display: none !important;
                }
            `);
        }

        // ---- 侧边横幅 / 浮动导航 ----
        if (config.removeSideBanner) {
            rules.push(`
                .ToTopBtn, .SideBar, .SidebarFloat, .BackTop, .RightFloat,
                [class*="SideBar"], [class*="sidebarFloat"], [class*="elevator__"],
                [class*="floatTool"], [class*="feedback__"], [class*="survey__"] {
                    display: none !important;
                }
            `);
        }

        // ---- 推荐内容 & 视频下方卡片 & 遮挡浮层 ----
        if (config.removeRecommend) {
            rules.push(`
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
                .ToolbarCardModule, .ToolBarCardProxyItem,
                .InteractLayout, .interactEntry, .InteractEntryPanel,
                .InteractEntryPanelRecent, .InteractEntryPanelList,
                .PlayerToolbar-ContentRow.InteractABAd,
                .PlayerToolbar-ContentCell.is-full.InteractABAd-aside,
                [class*="snapbar__"], [class*="ToolbarCard"],
                /* 彻底屏蔽遮挡视频下半部的互动工具栏浮层 */
                [class*="interactive__"],
                [class*="toolbar__"],
                #js-player-toolbar,
                .PlayerToolbar,
                [class*="interact__"],
                [class*="pendant__"] {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
            `);
        }

        // ---- 精简信息栏（勋章、等级、贵族等） ----
        if (config.removeTopBar) {
            rules.push(`
                .FollowLevelBox, .Title-followBox, .Title-anchorLevel,
                .FansMedal, .Title-nobleIcon, .Title-liveTags, .Title-liveTag,
                [class*="Noble"], [class*="FansMedal"], [class*="anchorLevel"],
                #js-player-main::before {
                    display: none !important;
                }
            `);
        }

        // ---- 播放器尺寸智能适配（全屏满屏 vs 普通模式居中完整大窗） ----
        if (config.playerExpand) {
            const showChat = !config.hideChatPanel;
            const hideBottomToolbar = config.removeGiftBar || config.removeRecommend;
            const nonFs = 'body:not([class*="is-fullScreen"]):not([class*="wfs"]):not([class*="fullscreen"])';

            rules.push(`
                /* ==================== 全屏 / 网页全屏模式 (100% 充满屏幕，0px 留白) ==================== */
                body[class*="is-fullScreen"],
                body[class*="wfs"],
                body[class*="fullscreen"] {
                    overflow: hidden !important;
                }

                body[class*="is-fullScreen"] [class*="stage__"],
                body[class*="wfs"] [class*="stage__"],
                body[class*="fullscreen"] [class*="stage__"],
                :fullscreen [class*="stage__"] {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: 100vw !important;
                    max-height: 100vh !important;
                    z-index: 9999 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                body[class*="is-fullScreen"] [class*="player__"],
                body[class*="wfs"] [class*="player__"],
                body[class*="fullscreen"] [class*="player__"],
                :fullscreen [class*="player__"] {
                    width: 100% !important;
                    height: 100% !important;
                    max-width: 100% !important;
                    max-height: 100% !important;
                    min-height: 100% !important;
                    position: relative !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                body[class*="is-fullScreen"] [class*="stream__"],
                body[class*="wfs"] [class*="stream__"],
                body[class*="fullscreen"] [class*="stream__"],
                :fullscreen [class*="stream__"] {
                    inset: 0 !important;
                    top: 0 !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                }

                body[class*="is-fullScreen"] [class*="video__"],
                body[class*="wfs"] [class*="video__"],
                body[class*="fullscreen"] [class*="video__"],
                body[class*="is-fullScreen"] #js-player-video,
                body[class*="is-fullScreen"] #js-player-video-case,
                body[class*="is-fullScreen"] video,
                body[class*="is-fullScreen"] #__video2,
                :fullscreen video {
                    width: 100% !important;
                    height: 100% !important;
                    inset: 0 !important;
                    object-fit: contain !important;
                }

                body[class*="is-fullScreen"] [class*="case__"],
                body[class*="wfs"] [class*="case__"],
                body[class*="fullscreen"] [class*="case__"],
                :fullscreen [class*="case__"] {
                    bottom: 0 !important;
                    position: absolute !important;
                    width: 100% !important;
                    left: 0 !important;
                    right: 0 !important;
                }

                /* ==================== 非全屏普通模式 (16:9 比例自适应居中大窗，不遮顶、不切控制栏) ==================== */
                ${nonFs} [class*="playerWrap__"] {
                    display: flex !important;
                    justify-content: center !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                    margin-top: 64px !important;
                    padding: 0 !important;
                    top: 0 !important;
                }

                ${nonFs} [class*="playerWrap__"] > div:not([class*="playerBackground"]):not(#js-account-security):not([class*="snapbar__"]):not([class*="menu__"]) {
                    display: flex !important;
                    justify-content: center !important;
                    width: 100% !important;
                }

                ${nonFs} [class*="stage__"] {
                    display: flex !important;
                    justify-content: center !important;
                    align-items: stretch !important;
                    ${showChat
                        ? 'width: 100% !important; max-width: 100% !important; gap: 10px !important;'
                        : 'width: auto !important; max-width: 96vw !important;'}
                    margin: 0 auto !important;
                    height: ${showChat
                        ? 'min(calc(100vh - 76px), calc((min(96vw, 1493px) - 390px) * 9 / 16 + 122px))'
                        : 'min(calc(100vh - 76px), calc(94vw * 9 / 16 + 122px))'} !important;
                    max-height: calc(100vh - 76px) !important;
                }

                ${nonFs} #js-player-main,
                ${nonFs} [class*="stage__"] > [class*="main__"] {
                    display: flex !important;
                    justify-content: center !important;
                    ${showChat ? 'flex: 1 1 0% !important; min-width: 0 !important;' : 'width: auto !important;'}
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    height: 100% !important;
                    max-height: 100% !important;
                }

                ${nonFs} [class*="player__"] {
                    width: ${showChat ? '100%' : 'min(94vw, calc((100vh - 198px) * 16 / 9))'} !important;
                    max-width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    position: relative !important;
                    margin: 0 auto !important;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5) !important;
                    border-radius: 8px !important;
                    overflow: hidden !important;
                    background: #000 !important;
                }

                ${showChat ? `
                ${nonFs} [class*="stage__"] > [class*="sidebar"] {
                    display: flex !important;
                    flex-direction: column !important;
                    position: relative !important;
                    top: auto !important;
                    right: auto !important;
                    bottom: auto !important;
                    left: auto !important;
                    flex: 0 0 380px !important;
                    width: 380px !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    border-radius: 8px !important;
                    overflow: hidden !important;
                    z-index: 2 !important;
                }
                ` : ''}

                ${nonFs} [class*="player__"] > [class*="title__"] {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    height: 72px !important;
                    z-index: 3 !important;
                    background: #12121a !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
                }

                ${nonFs} [class*="stream__"] {
                    position: absolute !important;
                    top: 72px !important;
                    bottom: ${hideBottomToolbar ? '50px' : '108px'} !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                }

                ${nonFs} [class*="video__"],
                ${nonFs} #js-player-video,
                ${nonFs} #js-player-video-case,
                ${nonFs} video,
                ${nonFs} #__video2 {
                    width: 100% !important;
                    height: 100% !important;
                    inset: 0 !important;
                    object-fit: contain !important;
                }

                ${hideBottomToolbar ? `
                ${nonFs} [class*="case__"] {
                    bottom: -50px !important;
                    top: auto !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 66px !important;
                    padding: 0 !important;
                    position: absolute !important;
                    transform: none !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    z-index: 5 !important;
                }
                ` : ''}

                ${nonFs} #js-player-controlbar,
                ${nonFs} #js-player-controlbar > [class*="ControlBar"] {
                    position: relative !important;
                    bottom: 0 !important;
                    transform: none !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    pointer-events: auto !important;
                    background: #101018 !important;
                }

                /* 旧版布局选择器兼容 */
                .layout-Player-main, .layout-Player, .layout-Main {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                }
            `);
        }

        return rules.join('\n');
    }

    function generateBaseCSS() {
        return `
            /* ========== 基础暗黑美化 ========== */
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

            /* ========== 顶栏美化设置按钮 ========== */
            #douyu-beautify-header-btn {
                display: inline-flex !important;
                align-items: center !important;
                align-self: center !important;
                gap: 5px !important;
                height: 32px !important;
                padding: 0 12px !important;
                margin: 0 8px !important;
                background: rgba(255, 255, 255, 0.08) !important;
                border: 1px solid rgba(255, 255, 255, 0.14) !important;
                border-radius: 16px !important;
                color: #e8e8e8 !important;
                font-size: 12.5px !important;
                font-weight: 500 !important;
                cursor: pointer !important;
                transition: all 0.25s ease !important;
                user-select: none !important;
                flex-shrink: 0 !important;
                z-index: 1000 !important;
                position: relative !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            #douyu-beautify-header-btn:hover,
            #douyu-beautify-header-btn.is-active {
                background: rgba(255, 93, 35, 0.16) !important;
                border-color: rgba(255, 93, 35, 0.45) !important;
                color: #fff !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 12px rgba(255, 93, 35, 0.25) !important;
            }
            #douyu-beautify-header-btn svg {
                width: 14px !important;
                height: 14px !important;
                fill: #ff6a00 !important;
                transition: transform 0.3s ease !important;
                flex-shrink: 0 !important;
            }
            #douyu-beautify-header-btn:hover svg,
            #douyu-beautify-header-btn.is-active svg {
                transform: rotate(45deg) !important;
            }
            #douyu-beautify-header-btn span {
                white-space: nowrap !important;
                line-height: 1 !important;
                color: inherit !important;
            }

            /* ========== 设置面板 Popover ========== */
            #douyu-beautify-panel {
                position: fixed;
                z-index: 999999;
                width: 350px;
                max-height: calc(100vh - 72px);
                background: rgba(18, 19, 28, 0.94);
                backdrop-filter: blur(28px) saturate(190%);
                -webkit-backdrop-filter: blur(28px) saturate(190%);
                border: 1px solid rgba(255, 255, 255, 0.09);
                border-radius: 14px;
                box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 4px 12px rgba(0,0,0,0.25);
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translateY(-8px) scale(0.97);
                transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                display: flex;
                flex-direction: column;
            }
            #douyu-beautify-panel.is-visible {
                opacity: 1;
                pointer-events: all;
                transform: translateY(0) scale(1);
            }
            #douyu-beautify-panel .panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            #douyu-beautify-panel .panel-title-wrap {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #douyu-beautify-panel .panel-icon-badge {
                width: 24px;
                height: 24px;
                border-radius: 7px;
                background: linear-gradient(135deg, rgba(255, 93, 35, 0.25), rgba(255, 41, 102, 0.25));
                border: 1px solid rgba(255, 93, 35, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                color: #ff5d23;
                line-height: 1;
            }
            #douyu-beautify-panel .panel-title {
                font-size: 14px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.95);
                letter-spacing: 0.2px;
            }
            #douyu-beautify-panel .panel-version {
                font-size: 10px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.4);
                background: rgba(255, 255, 255, 0.08);
                padding: 1px 5px;
                border-radius: 4px;
                margin-left: 6px;
                vertical-align: middle;
            }
            #douyu-beautify-panel .panel-close {
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                background: rgba(255, 255, 255, 0.06);
                color: rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s ease;
                padding: 0;
            }
            #douyu-beautify-panel .panel-close:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }
            #douyu-beautify-panel .panel-close svg {
                width: 14px !important;
                height: 14px !important;
                stroke: rgba(255, 255, 255, 0.85) !important;
                stroke-width: 2.2px !important;
                fill: none !important;
                display: block !important;
                pointer-events: none !important;
            }
            #douyu-beautify-panel .panel-close:hover svg {
                stroke: #fff !important;
            }
            #douyu-beautify-panel .panel-tab svg {
                width: 13px !important;
                height: 13px !important;
                stroke: currentColor !important;
                stroke-width: 2px !important;
                fill: none !important;
                flex-shrink: 0 !important;
            }
            #douyu-beautify-panel .panel-tabs {
                display: flex;
                padding: 8px 12px 4px;
                gap: 6px;
                background: rgba(0, 0, 0, 0.15);
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            #douyu-beautify-panel .panel-tab {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 6px 10px;
                border: none;
                background: transparent;
                border-radius: 8px;
                color: rgba(255, 255, 255, 0.55);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #douyu-beautify-panel .panel-tab:hover {
                color: rgba(255, 255, 255, 0.85);
                background: rgba(255, 255, 255, 0.04);
            }
            #douyu-beautify-panel .panel-tab.is-active {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                font-weight: 600;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            }
            #douyu-beautify-panel .tab-badge {
                font-size: 10px;
                background: rgba(255, 255, 255, 0.1);
                padding: 1px 5px;
                border-radius: 10px;
                opacity: 0.8;
            }
            #douyu-beautify-panel .panel-tab.is-active .tab-badge {
                background: rgba(255, 93, 35, 0.3);
                color: #ff7a45;
            }
            #douyu-beautify-panel .panel-body {
                padding: 4px 8px;
                overflow-y: auto;
                max-height: 480px;
            }
            #douyu-beautify-panel .panel-body::-webkit-scrollbar {
                width: 4px;
            }
            #douyu-beautify-panel .panel-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 2px;
            }
            #douyu-beautify-panel .setting-group {
                display: none;
            }
            #douyu-beautify-panel .setting-group.is-active {
                display: block;
            }
            #douyu-beautify-panel .setting-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                margin-bottom: 1px;
                border-radius: 7px;
                transition: background 0.18s ease;
            }
            #douyu-beautify-panel .setting-item:hover {
                background: rgba(255, 255, 255, 0.06);
            }
            #douyu-beautify-panel .setting-label {
                font-size: 12.5px;
                color: rgba(255, 255, 255, 0.92);
                font-weight: 500;
                line-height: 1.25;
            }
            #douyu-beautify-panel .setting-desc {
                font-size: 10.5px;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 1px;
                line-height: 1.2;
            }
            #douyu-beautify-panel .toggle-switch {
                position: relative;
                width: 36px;
                height: 20px;
                flex-shrink: 0;
                margin-left: 10px;
            }
            #douyu-beautify-panel .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
                position: absolute;
            }
            #douyu-beautify-panel .toggle-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background: rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #douyu-beautify-panel .toggle-slider::before {
                position: absolute;
                content: '';
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background: #fff;
                border-radius: 50%;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
            }
            #douyu-beautify-panel .toggle-switch input:checked + .toggle-slider {
                background: #ff5d23;
                box-shadow: 0 2px 8px rgba(255, 93, 35, 0.35);
            }
            #douyu-beautify-panel .toggle-switch input:checked + .toggle-slider::before {
                transform: translateX(16px);
            }
            #douyu-beautify-panel .shortcut-title {
                font-size: 10.5px;
                letter-spacing: 0.4px;
                color: rgba(255, 255, 255, 0.35);
                padding: 8px 8px 2px;
                font-weight: 500;
            }
            #douyu-beautify-panel .shortcut-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 6px 8px;
                margin-bottom: 1px;
                border-radius: 7px;
                cursor: pointer;
                transition: background 0.18s ease, box-shadow 0.18s ease;
            }
            #douyu-beautify-panel .shortcut-item:hover {
                background: rgba(255, 255, 255, 0.06);
            }
            #douyu-beautify-panel .shortcut-item.is-recording {
                background: rgba(255, 93, 35, 0.12);
                box-shadow: inset 0 0 0 1px rgba(255, 93, 35, 0.35);
            }
            #douyu-beautify-panel .shortcut-key {
                min-width: 54px;
                text-align: center;
                font-size: 11px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.7);
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 5px;
                padding: 2px 7px;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                white-space: nowrap;
            }
            #douyu-beautify-panel .shortcut-item.is-recording .shortcut-key {
                color: #ff9a6b;
                border-color: rgba(255, 93, 35, 0.5);
                background: rgba(255, 93, 35, 0.15);
            }
            #douyu-beautify-panel .panel-footer {
                padding: 10px 14px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(0, 0, 0, 0.15);
            }
            #douyu-beautify-panel .reset-btn {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: rgba(255, 255, 255, 0.55);
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #douyu-beautify-panel .reset-btn:hover {
                border-color: rgba(255, 255, 255, 0.25);
                color: rgba(255, 255, 255, 0.85);
                background: rgba(255, 255, 255, 0.04);
            }
            #douyu-beautify-panel .apply-btn {
                padding: 5px 14px;
                border: none;
                border-radius: 6px;
                background: linear-gradient(135deg, #ff5d23, #ff3366);
                color: #fff;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(255, 93, 35, 0.3);
            }
            #douyu-beautify-panel .apply-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 14px rgba(255, 93, 35, 0.45);
            }
            #douyu-beautify-overlay {
                position: fixed;
                inset: 0;
                z-index: 999998;
                background: transparent;
                opacity: 0;
                pointer-events: none;
            }
            #douyu-beautify-overlay.is-visible {
                pointer-events: all;
            }

            /* ========== 聊天面板 ========== */
            .layout-Player-aside.beautified-chat, [class*="sidebar__"].beautified-chat {
                background: rgba(18,18,26,0.95) !important;
                border-left: 1px solid rgba(255,255,255,0.06) !important;
            }

            /* ========== Toast 提示 ========== */
            #douyu-beautify-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                z-index: 9999999;
                padding: 7px 18px;
                background: rgba(22, 23, 34, 0.94);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                color: rgba(255, 255, 255, 0.95);
                font-size: 12.5px;
                font-weight: 500;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
                opacity: 0;
                transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                pointer-events: none;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            #douyu-beautify-toast.is-visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        `;
    }

    // ==========================================
    //  样式引擎与即时应用
    // ==========================================
    let dynamicStyleEl = null;
    let lastCssText = '';
    let styleAttachObserver = null;

    function applyStyles() {
        const cssText = generateBaseCSS() + '\n' + generateHideCSS();
        if (cssText === lastCssText && dynamicStyleEl && dynamicStyleEl.isConnected) {
            return;
        }
        lastCssText = cssText;

        let injectedViaGm = false;
        if (dynamicStyleEl && dynamicStyleEl.isConnected) {
            dynamicStyleEl.textContent = cssText;
            injectedViaGm = true;
        } else {
            const existing = document.getElementById('douyu-beautify-style');
            if (existing) {
                dynamicStyleEl = existing;
                dynamicStyleEl.textContent = cssText;
                injectedViaGm = true;
            } else if (typeof GM_addStyle !== 'undefined') {
                try {
                    const injected = GM_addStyle(cssText);
                    if (injected && typeof injected === 'object' && 'textContent' in injected) {
                        injected.id = 'douyu-beautify-style';
                        dynamicStyleEl = injected;
                    } else {
                        dynamicStyleEl = null;
                    }
                    injectedViaGm = true;
                } catch (e) {
                    injectedViaGm = false;
                }
            }
        }
        if (!injectedViaGm) {
            const target = document.head || document.documentElement;
            const style = document.createElement('style');
            style.id = 'douyu-beautify-style';
            style.textContent = cssText;
            dynamicStyleEl = style;
            if (target) {
                target.appendChild(style);
            } else if (!styleAttachObserver) {
                styleAttachObserver = new MutationObserver(() => {
                    const t = document.head || document.documentElement;
                    if (t) {
                        t.appendChild(dynamicStyleEl);
                        styleAttachObserver.disconnect();
                        styleAttachObserver = null;
                    }
                });
                try {
                    styleAttachObserver.observe(document, { childList: true });
                } catch (e) { /* ignore */ }
            }
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }

    // document-start 尽早注入，防页面闪烁
    applyStyles();

    // ==========================================
    //  DOM 工具与生命周期
    // ==========================================
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

    function retry(fn, interval = 1000, maxAttempts = 20, onDone) {
        let attempts = 0;
        const timer = setInterval(() => {
            if (fn() || ++attempts >= maxAttempts) {
                clearInterval(timer);
                if (typeof onDone === 'function') onDone();
            }
        }, interval);
        return timer;
    }

    // ==========================================
    //  Toast 提示
    // ==========================================
    let toastTimer = null;
    function showToast(message, duration = 1800) {
        let toast = document.getElementById('douyu-beautify-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'douyu-beautify-toast';
            const icon = document.createElement('span');
            icon.textContent = '✓';
            icon.style.cssText = 'color:#ff5d23;font-size:14px;line-height:1;font-weight:bold;';
            const textSpan = document.createElement('span');
            textSpan.className = 'douyu-beautify-toast-text';
            toast.appendChild(icon);
            toast.appendChild(textSpan);
            document.body.appendChild(toast);
        }
        const textEl = toast.querySelector('.douyu-beautify-toast-text');
        if (textEl) {
            textEl.textContent = message;
        }
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast?.classList.remove('is-visible'), duration);
    }

    // ==========================================
    //  JS 辅助隐藏（针对复杂/动态节点）
    // ==========================================
    const JS_REMOVE_SELECTORS = {
        removeAds: [
            '.MatchFocusFullPic', '.DropMenuList-ad', '.DropPane-ad',
            '.CloudGameLink', '.AdCover', '.google-auto-placed',
            '.adsbygoogle', '.ScreenBannerAd', 'section.layout-Banner',
            '[class*="IconCardAd"]'
        ],
        removeActivity: [
            '#js-room-activity', '.layout-Player-guessgame',
            '#js-player-dialog', '.RoomActivityFloat',
            '.TreasureBox', '.LotteryBox', '.EnterEffect',
            '.bc-wrapper', '.BackgroundOpacity-layout'
        ],
        removeRecommend: [
            '.ToolbarCardModule', '.ToolBarCardProxyItem',
            '.InteractLayout', '.interactEntry', '.InteractEntryPanel',
            '[class*="interactive__"]', '[class*="toolbar__"]', '#js-player-toolbar',
            '.PlayerToolbar', '[class*="interact__"]', '[class*="pendant__"]'
        ]
    };

    function hideElementByScript(el, key) {
        if (!el || el.classList.contains('playerWrap__') || el.querySelector?.('video')) return;
        if (el.dataset.douyuHidden !== key) {
            el.dataset.douyuPrevDisplay = el.style.display || '';
            el.dataset.douyuHidden = key;
        }
        if (el.style.display !== 'none') {
            el.style.display = 'none';
        }
    }

    function restoreHiddenElements(key) {
        document.querySelectorAll(`[data-douyu-hidden="${key}"]`).forEach(el => {
            el.style.display = el.dataset.douyuPrevDisplay || '';
            delete el.dataset.douyuHidden;
            delete el.dataset.douyuPrevDisplay;
        });
    }

    function stopAdVideos() {
        if (!config.removeAds) return;
        document.querySelectorAll('video').forEach(v => {
            if (isHomepage) return;
            if (v.closest('[class*="stream__"], #js-web-stream, [class*="player__"]')) return;
            const src = v.currentSrc || v.getAttribute('src') || '';
            const isAdNode = src.includes('/adxdsp/') || v.closest('[class*="ad-wrap"], [class*="AdWrap"], [class*="AdBanner"], [class*="adBanner"], [class*="IconCardAd"], .AdCover');
            if (isAdNode) {
                try {
                    if (!v.paused) v.pause();
                    v.muted = true;
                    v.autoplay = false;
                } catch (e) { /* ignore */ }
            }
        });
    }

    function forceRemoveElements() {
        Object.entries(JS_REMOVE_SELECTORS).forEach(([key, selectors]) => {
            if (config[key]) {
                selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => hideElementByScript(el, key)));
            } else {
                restoreHiddenElements(key);
            }
        });
        stopAdVideos();
    }

    // ==========================================
    //  播放器交互逻辑（最高画质、网页全屏）
    // ==========================================
    function getWebFullscreenButton() {
        const rightBar = document.querySelector(SELECTORS.controlBarRight);
        if (rightBar) {
            const svgBtn = rightBar.querySelector('svg path[d*="M20 25h6v-6"]')?.closest('i, button, div');
            if (svgBtn) return svgBtn;
            if (rightBar.children.length >= 2) {
                return rightBar.children[rightBar.children.length - 2];
            }
        }
        return document.querySelector('[class*="wfs"], [class*="WebScreen"], .controlbar-item-wfs, [title="网页全屏"]');
    }

    const QUALITY_REGEX = /原画|蓝光|超清|高清|流畅|标清/;
    let qualitySelectedDone = false;
    let qualityPlayHooked = false;

    function getQualityItems(container) {
        return Array.from(container.querySelectorAll('ul > li'))
            .filter(li => QUALITY_REGEX.test(li.textContent));
    }

    function autoHighQuality() {
        if (!config.autoHighQuality || qualitySelectedDone) return;

        if (!qualityPlayHooked) {
            qualityPlayHooked = true;
            document.addEventListener('play', (e) => {
                if (!qualitySelectedDone && e.target && e.target.tagName === 'VIDEO') {
                    setTimeout(autoHighQuality, 300);
                }
            }, true);
        }

        retry(() => {
            if (qualitySelectedDone) return true;
            // 等待视频真正起播:未起播时画质切换会被播放器忽略或产生异常降级
            const video = document.querySelector('video');
            if (!video || video.paused) return false;

            const rateContainer = document.querySelector(SELECTORS.qualityRate);
            if (!rateContainer) return false;

            // 新版斗鱼画质下拉列表仅在悬停时才挂载到 DOM,必须先模拟悬停触发渲染
            rateContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            rateContainer.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            // 容器内同时存在线路/画质等多种列表,按文本特征过滤出画质项
            const items = getQualityItems(rateContainer);
            if (items.length === 0) return false;

            qualitySelectedDone = true;
            const highest = items[0];
            if ((highest.className || '').includes('selected')) {
                setTimeout(() => rateContainer.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })), 80);
                return true;
            }

            const prevSelected = rateContainer.querySelector('[class*="selected"]');
            const prevText = prevSelected ? prevSelected.textContent.trim() : null;
            highest.click();
            setTimeout(() => rateContainer.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })), 80);

            // 未登录时点击"原画"会被斗鱼静默拒绝并降级到更低画质,检测到降级后回选原画质(仅尝试一次)
            if (prevText) {
                setTimeout(() => {
                    const container = document.querySelector(SELECTORS.qualityRate);
                    if (!container) return;
                    // 点击画质项后下拉列表即被卸载,复查与回选前必须重新悬停展开
                    container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    setTimeout(() => {
                        try {
                            const cur = container.querySelector('[class*="selected"]');
                            if (!cur) return;
                            const freshItems = getQualityItems(container);
                            const curIdx = freshItems.findIndex(li => li.textContent.trim() === cur.textContent.trim());
                            const prevIdx = freshItems.findIndex(li => li.textContent.trim() === prevText);
                            if (prevIdx >= 0 && curIdx > prevIdx) {
                                freshItems[prevIdx].click();
                            }
                        } finally {
                            container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                        }
                    }, 600);
                }, 2500);
            }
            return true;
        }, 1200, 15);
    }

    function isWebFullscreen() {
        const bodyCls = document.body?.className || '';
        return document.body?.classList.contains('is-fullScreenPage') ||
               document.body?.classList.contains('is-fullScreenPageNew') ||
               bodyCls.includes('is-fullScreen') ||
               bodyCls.includes('wfs') ||
               bodyCls.includes('fullscreen');
    }

    function autoWebFullscreen() {
        if (!config.autoWebFullscreen) return;

        retry(() => {
            if (isWebFullscreen()) return true;

            const btn = getWebFullscreenButton();
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        }, 1000, 20);
    }

    // ==========================================
    //  快捷键与播放控制
    // ==========================================
    const RESERVED_SHORTCUTS = ['escape', 'tab', 'enter'];

    let shortcutRecording = '';
    let fullscreenToastTimer = null;
    // 空格交回页面原生处理后，延迟检查页面是否真的暂停成功
    let nativeSpaceWatchTimer = null;
    // 斗鱼播放器在暂停后可能重建 video 并自动续播；记录用户意图并在意外续播时补一次暂停
    let userWantsPaused = false;
    let userPausedUntil = 0;
    let pauseWatchTimer = null;
    let repauseBudget = 0;
    let lastRepauseAt = 0;
    let suppressIntentReset = false;

    function formatShortcut(shortcut) {
        if (!shortcut) return '未设置';
        const labels = {
            space: 'Space', escape: 'Esc', tab: 'Tab', enter: 'Enter',
            backspace: '⌫', delete: 'Del', arrowup: '↑', arrowdown: '↓',
            arrowleft: '←', arrowright: '→', pageup: 'PgUp', pagedown: 'PgDn',
            home: 'Home', end: 'End', insert: 'Ins', capslock: 'Caps'
        };
        return String(shortcut).split('+').map(part => {
            if (labels[part]) return labels[part];
            if (part.length === 1) return part.toUpperCase();
            return part.charAt(0).toUpperCase() + part.slice(1);
        }).join(' + ');
    }

    function shortcutFromEvent(event) {
        let key = event.key || '';
        // 个别环境（自动化/输入法）真实按键的 key 为空，用 code 兜底
        if (!key && event.code) {
            if (event.code === 'Space') key = ' ';
            else if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3).toLowerCase();
            else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
        }
        if (!key) return '';
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');
        if (key === ' ' || key === 'Spacebar') key = 'space';
        else key = key.toLowerCase();
        parts.push(key);
        return parts.join('+');
    }

    function isTypingTarget(event) {
        const target = event.target;
        if (!target || !(target instanceof Element)) return false;
        // 设置面板不再整体屏蔽快捷键：点过开关后焦点仍留在面板内，
        // 旧逻辑会让空格失效（斗鱼原生空格又会自动恢复播放）；只拦真正的文本输入
        if (target.closest('textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')) return true;
        const input = target.closest('input');
        if (!input) return false;
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(type);
    }

    function shortcutOwner(shortcut, selfKey) {
        for (const item of SHORTCUT_ITEMS) {
            if (item.key !== selfKey && config[item.key] === shortcut) return item;
        }
        return null;
    }

    function getLiveVideo() {
        const videos = Array.from(document.querySelectorAll('#js-player-video video, #js-player-video-first video, [class*="player__"] video, .playerWrap__ video'));
        const liveVideo = videos.find(v => !v.closest('[class*="ad-wrap"], [class*="AdWrap"], [class*="AdBanner"], [class*="adBanner"], [class*="IconCardAd"], .AdCover'));
        return liveVideo || videos[0] || document.querySelector('video');
    }

    function ensureLiveRoom() {
        if (!isHomepage) return true;
        showToast('请在直播间内使用该功能');
        return false;
    }

    function getPlayPauseButton() {
        const scope = document.querySelector('#js-player-controlbar');
        if (!scope) return null;
        const candidates = Array.from(scope.querySelectorAll('i[class*="icon-"], button, [role="button"], [aria-label], [title]'));
        // 先按 svg 图标判定，避免不同房间/布局类名变化导致找不到控制键
        for (const el of candidates) {
            if (/(?:pause|play)_svg/i.test(el.innerHTML || '')) return el;
        }
        for (const el of candidates) {
            const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
            if (/暂停|播放/.test(label)) return el;
        }
        return null;
    }

    function clickPlayPause(button) {
        suppressIntentReset = true;
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        suppressIntentReset = false;
    }

    function ensurePaused() {
        if (!userWantsPaused || suppressIntentReset) return;
        if (Date.now() > userPausedUntil || repauseBudget <= 0) {
            userWantsPaused = false;
            return;
        }
        if (Date.now() - lastRepauseAt < 350) return;
        const current = getLiveVideo();
        if (!current || current.paused) return;
        lastRepauseAt = Date.now();
        repauseBudget -= 1;
        const button = getPlayPauseButton();
        if (button && /pause_svg/i.test(button.innerHTML)) {
            clickPlayPause(button);
            // 部分播放器内核会忽略合成 click；点击后仍未暂停就直接补 pause
            try { if (!current.paused) current.pause(); } catch (e) { /* ignore */ }
        } else {
            try { current.pause(); } catch (e) { /* ignore */ }
        }
    }

    function schedulePauseCheck(delay = 260) {
        clearTimeout(pauseWatchTimer);
        pauseWatchTimer = setTimeout(function tick() {
            if (!userWantsPaused) return;
            if (Date.now() > userPausedUntil) {
                userWantsPaused = false;
                return;
            }
            ensurePaused();
            pauseWatchTimer = setTimeout(tick, 700);
        }, delay);
    }

    function togglePlayback() {
        if (!ensureLiveRoom()) return;
        const video = getLiveVideo();
        if (!video) {
            showToast('未找到直播视频');
            return;
        }
        if (video.paused) {
            userWantsPaused = false;
            userPausedUntil = 0;
            repauseBudget = 0;
            clearTimeout(pauseWatchTimer);
            const button = getPlayPauseButton();
            if (button && /play_svg/i.test(button.innerHTML)) {
                clickPlayPause(button);
            } else {
                const started = video.play();
                if (started && typeof started.catch === 'function') started.catch(() => {});
            }
            showToast('已继续播放');
            return;
        }

        // 暂停后播放器可能重建 video 或自动续播：优先点它自己的暂停键，
        // 并在 6 秒内持续核对补按（直接 video.pause() 实测约 90ms 后被拉起）。
        userWantsPaused = true;
        userPausedUntil = Date.now() + 6000;
        repauseBudget = 8;
        lastRepauseAt = 0;
        const button = getPlayPauseButton();
        if (button && /pause_svg/i.test(button.innerHTML)) {
            clickPlayPause(button);
            // 合成 click 可能被播放器异步处理甚至忽略，先直接暂停保证即时反馈
            try { if (!video.paused) video.pause(); } catch (e) { /* ignore */ }
        } else {
            try { video.pause(); } catch (e) { /* ignore */ }
        }
        showToast('已暂停直播');
        schedulePauseCheck();
    }

    // 用户主动点播放器控制条时，取消“保持暂停”的补偿，避免和用户操作打架
    document.addEventListener('click', (event) => {
        if (suppressIntentReset) return;
        const target = event.target;
        if (!(target instanceof Element) || !target.closest('#js-player-controlbar')) return;
        const button = getPlayPauseButton();
        if (button && (button === target || button.contains(target))) {
            userWantsPaused = false;
            userPausedUntil = 0;
            repauseBudget = 0;
            clearTimeout(pauseWatchTimer);
        }
    }, true);

    // 播放器重建 video 或内部逻辑自动续播时，按用户意图补回暂停
    document.addEventListener('play', (event) => {
        if (!userWantsPaused || suppressIntentReset) return;
        if (Date.now() > userPausedUntil) return;
        schedulePauseCheck(80);
    }, true);

    // 控制栏最后两个图标依次是「网页全屏」和「全屏」：
    // 倒数第二个负责网页全屏（状态在 body 的 is-fullScreenPage 类上），
    // 最后一个四角图标是斗鱼原生全屏按钮。
    function getFullscreenButton() {
        const rightBar = document.querySelector(SELECTORS.controlBarRight);
        if (!rightBar) return null;
        const last = rightBar.lastElementChild;
        if (last && last.querySelector('svg')) return last;
        return rightBar.querySelector('svg path[d*="M25 20h-5v5"]')?.closest('i, button, div') || null;
    }

    function isFullscreen() {
        return !!(document.fullscreenElement || document.body?.classList.contains('is-fullScreen'));
    }

    function toggleFullscreen() {
        if (!ensureLiveRoom()) return;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            showToast('已退出全屏');
            return;
        }
        const notify = () => {
            clearTimeout(fullscreenToastTimer);
            fullscreenToastTimer = setTimeout(() => {
                showToast(isFullscreen() ? '已进入全屏' : '已退出全屏');
            }, 250);
        };
        // 优先走浏览器 Fullscreen API（真正的原生全屏，隐藏浏览器界面）；
        // 被浏览器策略拒绝时，退回点击斗鱼自带的全屏按钮。
        const target = document.querySelector('#js-player-main') || document.querySelector('#js-player-video-first');
        if (target && target.requestFullscreen) {
            target.requestFullscreen().then(notify).catch(() => {
                const btn = getFullscreenButton();
                if (btn) btn.click();
                notify();
            });
            return;
        }
        const btn = getFullscreenButton();
        if (btn) btn.click();
        notify();
    }

    function toggleWebFullscreen() {
        if (!ensureLiveRoom()) return;
        const btn = getWebFullscreenButton();
        if (!btn) {
            showToast('未找到网页全屏按钮');
            return;
        }
        btn.click();
        clearTimeout(fullscreenToastTimer);
        fullscreenToastTimer = setTimeout(() => {
            showToast(isWebFullscreen() ? '已进入网页全屏' : '已退出网页全屏');
        }, 180);
    }

    function syncDanmakuToggle() {
        const input = document.querySelector('#douyu-beautify-panel input[data-key="hideDanmaku"]');
        if (input) input.checked = !!config.hideDanmaku;
    }

    // 斗鱼的画面弹幕开关有两个状态的图标（同一个 DOM 位）：
    //   开启：.showdanmuWrap-9c22cd 显示，内部 i 可点击关闭；
    //   关闭：同一节点加上 .removed-304d55 并隐藏，其紧邻的 i.icon-c8be96 可点击开启。
    // 优先点击斗鱼原生开关，CSS 仅作为找不到按钮时的兜底。
    function getNativeDanmakuToggle() {
        const wrap = document.querySelector('.showdanmuWrap-9c22cd');
        if (!wrap) return null;
        const isOn = !wrap.classList.contains('removed-304d55');
        const button = isOn ? wrap.querySelector('i.icon-c8be96') : wrap.nextElementSibling;
        if (!button || !button.classList.contains('icon-c8be96')) return null;
        return { isOn: isOn, button: button };
    }

    function setNativeDanmaku(shouldShow) {
        const toggle = getNativeDanmakuToggle();
        if (!toggle) return false;
        if (toggle.isOn === !!shouldShow) return true;
        toggle.button.click();
        return true;
    }

    // 设置项为「隐藏弹幕」时，把原生开关也关掉（找不到原生控件则不处理，交给 CSS 兜底）
    function syncNativeDanmakuPreference() {
        if (config.hideDanmaku) setNativeDanmaku(false);
    }

    function toggleDanmaku() {
        if (!ensureLiveRoom()) return;
        config.hideDanmaku = !config.hideDanmaku;
        setNativeDanmaku(!config.hideDanmaku);
        saveConfig(config);
        applyStyles();
        syncDanmakuToggle();
        showToast(config.hideDanmaku ? '已隐藏弹幕' : '已显示弹幕');
    }

    function renderShortcutRows() {
        const panel = document.getElementById('douyu-beautify-panel');
        if (!panel) return;
        panel.querySelectorAll('[data-shortcut-key]').forEach(row => {
            const key = row.dataset.shortcutKey;
            const badge = row.querySelector('.shortcut-key');
            const recording = shortcutRecording === key;
            row.classList.toggle('is-recording', recording);
            if (badge) badge.textContent = recording ? '按下按键…' : formatShortcut(config[key]);
        });
    }

    function startShortcutRecording(key) {
        shortcutRecording = key;
        renderShortcutRows();
        showToast('按下新快捷键，Esc 取消');
    }

    function cancelShortcutRecording(silent) {
        if (!shortcutRecording) return;
        shortcutRecording = '';
        renderShortcutRows();
        if (!silent) showToast('已取消快捷键设置');
    }

    function handleShortcutRecording(event) {
        event.preventDefault();
        // 用 stopImmediatePropagation 一并拦截同一 window 上的其它监听器（斗鱼自身
        // 也有捕获阶段快捷键，stopPropagation 拦不住同节点监听器）。
        event.stopImmediatePropagation();
        if (event.repeat) return;
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
        if (event.key === 'Escape') {
            cancelShortcutRecording();
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey) {
            showToast('暂不支持 Ctrl / Alt / Cmd 组合键');
            return;
        }
        const shortcut = shortcutFromEvent(event);
        if (!shortcut) return;
        if (RESERVED_SHORTCUTS.includes(shortcut)) {
            showToast('该按键为系统保留，请换一个');
            return;
        }
        const owner = shortcutOwner(shortcut, shortcutRecording);
        if (owner) {
            showToast(`「${formatShortcut(shortcut)}」已用于${owner.label}`);
            return;
        }
        const item = SHORTCUT_ITEMS.find(i => i.key === shortcutRecording);
        config[shortcutRecording] = shortcut;
        saveConfig(config);
        shortcutRecording = '';
        renderShortcutRows();
        showToast(`已设置${item ? item.label : '快捷键'}: ${formatShortcut(shortcut)}`);
    }

    // 挂在 window 捕获阶段，先于播放器/页面处理按键
    window.addEventListener('keydown', (event) => {
        // 页面自身的热键实现有时会重新派发合成 keydown（实测按一次 D 会来两次，
        // 第二次 isTrusted=false）；只响应真实用户输入，避免快捷键被触发两遍。
        if (!event.isTrusted) return;
        if (shortcutRecording) {
            handleShortcutRecording(event);
            return;
        }
        if (event.isComposing || event.repeat) return;
        if (isHomepage) return;
        if (isTypingTarget(event)) return;

        const shortcut = shortcutFromEvent(event);
        if (!shortcut) return;
        // 空格不设快捷键、不拦截，交回斗鱼原生播放/暂停；仅观察页面结果，
        // 页面没响应或暂停后被自动拉起时再兜底补一次，避免不同播放器实现下空格失效。
        if (shortcut === 'space') {
            watchNativeSpacePlayback();
            return;
        }
        const actions = [
            { shortcut: config.fullscreenShortcut, run: toggleFullscreen },
            { shortcut: config.webFullscreenShortcut, run: toggleWebFullscreen },
            { shortcut: config.danmakuShortcut, run: toggleDanmaku },
        ];
        for (const action of actions) {
            if (action.shortcut && action.shortcut === shortcut) {
                event.preventDefault();
                event.stopImmediatePropagation();
                action.run();
                return;
            }
        }
    }, true);

    function watchNativeSpacePlayback() {
        const source = getLiveVideo();
        if (!source) return;
        const wasPaused = source.paused;
        clearTimeout(nativeSpaceWatchTimer);
        nativeSpaceWatchTimer = setTimeout(() => {
            const video = getLiveVideo();
            if (!video) return;
            if (wasPaused) {
                // 页面上一次处于暂停：页面未响应时由脚本继续播放
                if (video.paused) togglePlayback();
                return;
            }
            if (video.paused) {
                // 页面已正常暂停：接管“保持暂停”，防止播放器稍后自动续播
                userWantsPaused = true;
                userPausedUntil = Date.now() + 6000;
                repauseBudget = 8;
                lastRepauseAt = 0;
                showToast('已暂停直播');
                schedulePauseCheck();
                return;
            }
            // 页面完全没响应，或暂停后又被自动拉起：补一次暂停
            togglePlayback();
        }, 450);
    }

    // ==========================================
    //  首页视频清理
    // ==========================================
    function stopHomepageVideo(video) {
        if (!isHomepage || !video) return;
        try {
            if (!video.paused) video.pause();
            video.autoplay = false;
            video.muted = true;
            if (uiMounted) {
                if (video.hasAttribute('autoplay')) video.removeAttribute('autoplay');
                if (video.hasAttribute('src')) {
                    video.removeAttribute('src');
                    video.srcObject = null;
                } else if (video.srcObject) {
                    video.srcObject = null;
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (isHomepage) {
        const onHomepageMediaStart = (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                stopHomepageVideo(e.target);
            }
        };
        document.addEventListener('play', onHomepageMediaStart, true);
        document.addEventListener('playing', onHomepageMediaStart, true);
        document.addEventListener('loadedmetadata', onHomepageMediaStart, true);
    }

    function cleanHomepagePlayer() {
        if (!isHomepage) return;
        document.querySelectorAll('video').forEach(stopHomepageVideo);
    }

    // MutationObserver 动态清理(类名片段 → 所属配置开关,尊重用户设置)
    const OBSERVER_CLASS_LIST = [
        { cls: 'MatchFocusFullPic', key: 'removeAds' },
        { cls: 'Prompt-container', key: 'removeAds' },
        { cls: 'AdCover', key: 'removeAds' },
        { cls: 'ScreenBannerAd', key: 'removeAds' },
        { cls: 'IconCardAd', key: 'removeAds' },
        { cls: 'EnterEffect', key: 'removeActivity' },
        { cls: 'RoomActivityFloat', key: 'removeActivity' },
        { cls: 'ActivityReceivePopup', key: 'removeActivity' },
        { cls: 'FansInteractPopup', key: 'removeActivity' },
        { cls: 'FloatLayerContent', key: 'removeActivity' },
        { cls: 'TreasureBox', key: 'removeActivity' },
        { cls: 'BackgroundOpacity-layout', key: 'removeActivity' },
        { cls: 'ToolbarCardModule', key: 'removeRecommend' },
        { cls: 'InteractEntryPanel', key: 'removeRecommend' },
        { cls: 'interactive__', key: 'removeRecommend' },
        { cls: 'toolbar__', key: 'removeRecommend' }
    ];

    const OBSERVER_NOISE_SELECTORS = [
        '.layout-Player-aside', '#js-aside',
        '[class*="chatroom"]', '[class*="Chatroom"]',
        '[class*="barrage"]',
        '[class*="gift-wrap"]', '[class*="giftBar"]', '[class*="GiftBar"]',
        '[class*="danmuItem"]', '[class*="danmu-"]'
    ];
    let observerNoiseRoots = [];
    let observerNoiseRootsAt = 0;

    // 聊天/礼物/弹幕子树高频更新，但与清理逻辑无关，直接跳过
    function isNoiseMutationTarget(target) {
        if (!target || target.nodeType !== 1) return false;
        const now = Date.now();
        if (now - observerNoiseRootsAt > 4000) {
            const roots = [];
            OBSERVER_NOISE_SELECTORS.forEach(sel => {
                try {
                    document.querySelectorAll(sel).forEach(el => {
                        if (roots.length < 30 && !roots.includes(el)) roots.push(el);
                    });
                } catch (e) { /* ignore */ }
            });
            observerNoiseRoots = roots;
            observerNoiseRootsAt = now;
        }
        for (const root of observerNoiseRoots) {
            if (root === target || root.contains(target)) return true;
        }
        return false;
    }

    let observerTimer = null;
    let uiMounted = false;
    let reattachTimer = null;

    function mountUI() {
        uiMounted = true;
        if (isHomepage) cleanHomepagePlayer();
        forceRemoveElements();
        createSettingsPanel();
        createHeaderSettingsButton();
    }

    function startGuard() {
        setInterval(() => {
            if (!uiMounted || document.hidden) return;
            ensureSettingsPanel();
            if (!document.getElementById('douyu-beautify-header-btn')) createHeaderSettingsButton();
            if (isHomepage) cleanHomepagePlayer();
            syncNativeDanmakuPreference();
        }, 4000);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden || !uiMounted) return;
            forceRemoveElements();
            ensureSettingsPanel();
        });
    }

    function startObserver() {
        if (!document.body) return;
        const observer = new MutationObserver((mutations) => {
            if (document.hidden) return;
            let shouldCleanHomepage = false;
            let shouldForceRemove = false;
            let shouldReattachHeaderBtn = false;

            for (const mutation of mutations) {
                if (isNoiseMutationTarget(mutation.target)) continue;

                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.id && node.id.startsWith('douyu-beautify-')) continue;

                    if (isHomepage && (node.tagName === 'VIDEO' || node.querySelector?.('video'))) {
                        shouldCleanHomepage = true;
                    }

                    // 仅在对应功能开关开启且 UI 已就绪后隐藏，避免水合前改写 DOM 属性触发 React #418
                    if (uiMounted) {
                        const hit = OBSERVER_CLASS_LIST.find(item => typeof node.className === 'string' && node.className.includes(item.cls));
                        if (hit && config[hit.key]) {
                            hideElementByScript(node, hit.key);
                            shouldForceRemove = true;
                        }
                    }
                }

                if (uiMounted && !shouldReattachHeaderBtn) {
                    for (const node of mutation.removedNodes) {
                        if (node.nodeType === 1 && (node.id === 'douyu-beautify-header-btn' || node.querySelector?.('#douyu-beautify-header-btn'))) {
                            shouldReattachHeaderBtn = true;
                            break;
                        }
                    }
                }
            }

            if (shouldCleanHomepage) cleanHomepagePlayer();

            if (shouldForceRemove && !observerTimer) {
                observerTimer = setTimeout(() => {
                    forceRemoveElements();
                    observerTimer = null;
                }, 200);
            }

            if (shouldReattachHeaderBtn && !reattachTimer) {
                reattachTimer = setTimeout(() => {
                    reattachTimer = null;
                    createHeaderSettingsButton();
                }, 150);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==========================================
    //  设置面板 UI & 顶部导航栏按钮
    // ==========================================
    const SETTINGS_GROUPS = [
        {
            group: '界面元素清理',
            id: 'clean',
            count: 9,
            items: [
                { key: 'removeHeader', label: '精简顶部导航', desc: '仅保留搜索、关注、消息、头像' },
                { key: 'removeGiftBar', label: '移除礼物栏', desc: '隐藏礼物赠送及特效区域' },
                { key: 'removeFooter', label: '移除页脚', desc: '隐藏底部页脚与版权信息' },
                { key: 'removeAds', label: '移除广告', desc: '屏蔽全站横幅及活动广告' },
                { key: 'removeWatermark', label: '移除水印', desc: '隐藏播放器右上角水印' },
                { key: 'removeActivity', label: '移除活动与皮肤', desc: '屏蔽任务/抽奖及活动置顶皮肤背景' },
                { key: 'removeSideBanner', label: '移除侧边工具条', desc: '隐藏侧边横幅与浮动工具' },
                { key: 'removeRecommend', label: '精简下方与遮挡', desc: '移除任务大厅、游戏租号、互动横条' },
                { key: 'removeTopBar', label: '精简信息栏', desc: '移除粉丝勋章、贵族图标、主播等级' },
            ]
        },
        {
            group: '播放与功能增强',
            id: 'player',
            count: 5,
            items: [
                { key: 'playerExpand', label: '播放器扩展大窗', desc: '普通模式 16:9 居中大窗，全屏 100% 满屏' },
                { key: 'autoHighQuality', label: '自动最高画质', desc: '进入直播间自动选择最高可用画质' },
                { key: 'autoWebFullscreen', label: '自动网页全屏', desc: '进入直播间后自动切换网页全屏' },
                { key: 'hideChatPanel', label: '隐藏聊天面板', desc: '隐藏右侧聊天/弹幕列表（关闭即恢复）' },
                { key: 'hideDanmaku', label: '隐藏画面弹幕', desc: '关闭覆盖在直播画面上的滚动弹幕' },
            ]
        }
    ];

    function ensureSettingsPanel() {
        if (!document.getElementById('douyu-beautify-panel')) {
            createSettingsPanel();
        }
    }

    function updatePanelPosition() {
        const btn = document.getElementById('douyu-beautify-header-btn');
        const panel = document.getElementById('douyu-beautify-panel');
        if (!panel) return;
        if (btn && btn.offsetParent !== null) {
            const rect = btn.getBoundingClientRect();
            panel.style.top = `${Math.round(rect.bottom + 8)}px`;
            panel.style.right = `${Math.max(16, Math.round(window.innerWidth - rect.right))}px`;
            panel.style.left = 'auto';
        } else {
            panel.style.top = '60px';
            panel.style.right = '20px';
            panel.style.left = 'auto';
        }
    }

    function togglePanel(force) {
        ensureSettingsPanel();
        const panel = document.getElementById('douyu-beautify-panel');
        const overlay = document.getElementById('douyu-beautify-overlay');
        const btn = document.getElementById('douyu-beautify-header-btn');
        if (!panel) return;
        const willBeVisible = typeof force === 'boolean' ? force : !panel.classList.contains('is-visible');
        if (willBeVisible) {
            updatePanelPosition();
        }
        panel.classList.toggle('is-visible', willBeVisible);
        if (overlay) overlay.classList.toggle('is-visible', willBeVisible);
        if (btn) btn.classList.toggle('is-active', willBeVisible);
        if (!willBeVisible) cancelShortcutRecording(true);
    }

    let headerBtnRetryTimer = null;

    function createHeaderSettingsButton() {
        if (document.getElementById('douyu-beautify-header-btn') || headerBtnRetryTimer) return;
        headerBtnRetryTimer = retry(() => {
            if (document.getElementById('douyu-beautify-header-btn')) return true;

            const headerTarget = document.querySelector('.Header-right') ||
                                 document.querySelector('#js-header [class*="right__"]') ||
                                 document.querySelector('[class*="header__"] [class*="right__"]') ||
                                 document.querySelector('[class*="right__"]') ||
                                 document.querySelector('.Header-wrap .Header') ||
                                 document.querySelector('.Header');
            if (!headerTarget) return false;

            const btn = document.createElement('div');
            btn.id = 'douyu-beautify-header-btn';
            btn.title = '打开斗鱼极简美化设置';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
                <span>美化设置</span>
            `;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel();
            });

            if (headerTarget.classList.contains('Header-right') || (typeof headerTarget.className === 'string' && headerTarget.className.includes('right__'))) {
                headerTarget.insertBefore(btn, headerTarget.firstChild);
            } else {
                headerTarget.appendChild(btn);
            }
            return true;
        }, 800, 20, () => { headerBtnRetryTimer = null; });
    }

    function createSettingsPanel() {
        if (document.getElementById('douyu-beautify-panel')) return;
        if (!document.body) {
            onDomReady(createSettingsPanel);
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'douyu-beautify-overlay';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'douyu-beautify-panel';

        const tabsHtml = `
            <div class="panel-tabs">
                <button class="panel-tab is-active" data-tab="clean">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    <span>界面净化</span>
                    <span class="tab-badge">${SETTINGS_GROUPS[0].count}</span>
                </button>
                <button class="panel-tab" data-tab="player">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>播放体验</span>
                    <span class="tab-badge">${SETTINGS_GROUPS[1].count}</span>
                </button>
            </div>
        `;

        const bodyHtml = SETTINGS_GROUPS.map((group, idx) => `
            <div class="setting-group ${idx === 0 ? 'is-active' : ''}" data-tab="${group.id}">
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
                ${group.id === 'player' ? `
                    <div class="shortcut-title">快捷键（点击后按下新按键）</div>
                    ${SHORTCUT_ITEMS.map(item => `
                        <div class="shortcut-item" data-shortcut-key="${item.key}" title="点击后按下新按键">
                            <div>
                                <div class="setting-label">${item.label}</div>
                                <div class="setting-desc">${item.desc}</div>
                            </div>
                            <span class="shortcut-key">${formatShortcut(config[item.key])}</span>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `).join('');

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title-wrap">
                    <div class="panel-icon-badge">⚡</div>
                    <div>
                        <span class="panel-title">斗鱼美化设置</span>
                        <span class="panel-version">v${SCRIPT_VERSION}</span>
                    </div>
                </div>
                <button class="panel-close" id="beautify-panel-close" title="关闭">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            ${tabsHtml}
            <div class="panel-body">${bodyHtml}</div>
            <div class="panel-footer">
                <button class="reset-btn" id="beautify-reset" title="恢复为默认设置">恢复默认</button>
                <button class="apply-btn" id="beautify-apply" title="保存当前设置并刷新页面">保存并刷新</button>
            </div>
        `;
        document.body.appendChild(panel);

        // 事件绑定：点击遮罩/空白处关闭
        overlay.addEventListener('click', () => togglePanel(false));
        const closeBtn = document.getElementById('beautify-panel-close');
        if (closeBtn) closeBtn.addEventListener('click', () => togglePanel(false));

        // 选项卡切换
        panel.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                panel.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('is-active'));
                panel.querySelectorAll('.setting-group').forEach(g => g.classList.remove('is-active'));
                tab.classList.add('is-active');
                const targetGroup = panel.querySelector(`.setting-group[data-tab="${tab.dataset.tab}"]`);
                if (targetGroup) targetGroup.classList.add('is-active');
            });
        });

        // 开关变更
        panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                config[input.dataset.key] = input.checked;
                if (input.dataset.key === 'hideDanmaku') {
                    setNativeDanmaku(!input.checked);
                }
                saveConfig(config);
                applyStyles();
                forceRemoveElements();
                const label = input.closest('.setting-item')?.querySelector('.setting-label')?.textContent || '';
                showToast(`已${input.checked ? '开启' : '关闭'}: ${label}`);
            });
        });

        // 快捷键录制
        panel.querySelectorAll('[data-shortcut-key]').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = row.dataset.shortcutKey;
                if (shortcutRecording === key) {
                    cancelShortcutRecording();
                } else {
                    startShortcutRecording(key);
                }
            });
        });
        panel.addEventListener('click', (e) => {
            if (shortcutRecording && !e.target.closest('[data-shortcut-key]')) {
                cancelShortcutRecording(true);
            }
        });

        // 恢复默认设置
        document.getElementById('beautify-reset')?.addEventListener('click', () => {
            config = Object.assign({}, DEFAULT_CONFIG);
            saveConfig(config);
            panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
                input.checked = !!config[input.dataset.key];
            });
            renderShortcutRows();
            applyStyles();
            forceRemoveElements();
            showToast('已恢复为默认设置');
        });

        // 保存并刷新
        document.getElementById('beautify-apply')?.addEventListener('click', () => {
            saveConfig(config);
            location.reload();
        });

        // 窗口大小变化时更新面板位置
        window.addEventListener('resize', () => {
            if (panel.classList.contains('is-visible')) {
                updatePanelPosition();
            }
        });

        // 按下 Escape 关闭面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panel.classList.contains('is-visible')) {
                togglePanel(false);
            }
        });
    }

    // ==========================================
    //  Tampermonkey 菜单命令
    // ==========================================
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('⚡ 斗鱼美化 - 打开设置', togglePanel);
        GM_registerMenuCommand('⏯️ 播放 / 暂停直播', togglePlayback);
        GM_registerMenuCommand('💬 显示 / 隐藏弹幕', toggleDanmaku);
        GM_registerMenuCommand('🖥️ 切换全屏', toggleFullscreen);
        GM_registerMenuCommand('🖱️ 切换网页全屏', toggleWebFullscreen);
        GM_registerMenuCommand('🔄 斗鱼美化 - 恢复默认设置', () => {
            saveConfig(DEFAULT_CONFIG);
            location.reload();
        });
    }

    // ==========================================
    //  初始化运行
    // ==========================================
    onDomReady(() => {
        if (isHomepage) cleanHomepagePlayer();
        applyStyles();
        startObserver();
        startGuard();
        // 兜底挂载: 若资源阻塞导致 load 延迟太久，等待 Next.js 水合完成后再挂载设置 UI
        setTimeout(() => {
            if (!uiMounted) mountUI();
        }, 2200);
    });

    onPageLoaded(() => {
        if (isHomepage) cleanHomepagePlayer();
        // 避开 Next.js SSR 首帧水合窗口后再挂载设置按钮/面板，避免触发 React #418 及节点被冲掉
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            applyStyles();
            mountUI();
        }, 600);

        // 延迟执行自动化画质与全屏，等待播放器 UI 渲染完毕
        setTimeout(() => {
            autoHighQuality();
            autoWebFullscreen();
        }, 2000);

        // 处理懒加载内容
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            if (uiMounted) mountUI();
        }, 5000);
    });

    console.log(
        `%c ⚡ 斗鱼美化 v${SCRIPT_VERSION} 已加载 %c 顶部导航栏可直接打开设置 `,
        'background: linear-gradient(135deg, #ff6a00, #ee0979); color: #fff; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
        'background: #12121a; color: #ee0979; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #ee0979;'
    );
})();
