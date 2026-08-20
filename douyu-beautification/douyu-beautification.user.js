// ==UserScript==
// @name         斗鱼直播美化 - 极简纯净版
// @namespace    https://github.com/douyu-beautification
// @version      1.3.0
// @description  斗鱼直播间极简美化：移除广告、礼物栏、侧边推荐、活动弹窗等冗余元素，保留纯净的直播观看体验。支持自动最高画质、顶栏设置按钮、设置即时热生效。
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

    // ==========================================
    //  配置管理
    // ==========================================
    const DEFAULT_CONFIG = {
        removeHeader: true,         // 精简顶部导航栏
        removeAside: true,          // 移除右侧边栏（聊天区域）
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
        darkMode: true,             // 暗黑模式增强
        showChatPanel: false,       // 显示聊天面板（覆盖 removeAside）
        playerExpand: true,         // 播放器扩展全屏大窗
    };

    const CONFIG_KEY = 'douyuBeautifyConfig';

    function getConfig() {
        if (typeof GM_getValue !== 'undefined') {
            const saved = GM_getValue(CONFIG_KEY, null);
            return Object.assign({}, DEFAULT_CONFIG, saved || {});
        }
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
            return Object.assign({}, DEFAULT_CONFIG, saved || {});
        } catch (e) {
            return Object.assign({}, DEFAULT_CONFIG);
        }
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
        homepagePlayer: [
            '.IndexPlayer', '.IndexModule-player', '.layout-Main-player',
            '.LivePlayer-index', '.FeaturedPlayer', '[class*="index-player"]',
            '[class*="IndexPlayer"]', '[class*="HomeLive"]', '[class*="home-live"]',
            '[class*="HomePlayer"]', '[class*="home-player"]', '[class*="player-wrapper__"]',
            '[class*="player-component__"]', '[class*="player-parallax__"]',
            '[class*="switcher__"]', '[class*="switcherTabs__"]',
            '[class*="backgroundHolder__"]', '[class*="backgroundHolderBlur__"]',
            '[class*="backgroundHandleWrapper__"]', '[class*="backgroundHandle__"]'
        ],
        controlBar: '[class*="ControlBar"], [class*="controlbar"]',
        controlBarRight: '[class*="ControlBar"] [class*="right-"], [class*="controlbar"] [class*="right"]',
        qualityRate: '[class*="rate-"], [class*="rate"]',
        qualityList: '[class*="rate-"] ul > li, [class*="tipItem-"] ul > li, .tipitem, [class*="QualityItem"]',
        danmuWrap: '[class*="showdanmuWrap"]',
        volumeWrap: '[class*="volume-"]',
        video: 'video'
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
            `);
        }

        // ---- 右侧边栏（弹幕/聊天区域） ----
        if (config.removeAside && !config.showChatPanel) {
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
            rules.push(`
                /* ==================== 全屏 / 网页全屏模式 (100% 充满屏幕，0px 留白) ==================== */
                body.is-fullScreenPage,
                body.is-fullScreen,
                body[class*="wfs"],
                body[class*="fullscreen"] {
                    overflow: hidden !important;
                }

                body.is-fullScreenPage [class*="stage__"],
                body.is-fullScreen [class*="stage__"],
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

                body.is-fullScreenPage [class*="player__jsy1T"],
                body.is-fullScreen [class*="player__jsy1T"],
                body[class*="wfs"] [class*="player__jsy1T"],
                body[class*="fullscreen"] [class*="player__jsy1T"],
                body.is-fullScreenPage [class*="player__"],
                body.is-fullScreen [class*="player__"],
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

                body.is-fullScreenPage [class*="stream__T55I3"],
                body.is-fullScreen [class*="stream__T55I3"],
                body[class*="wfs"] [class*="stream__T55I3"],
                body.is-fullScreenPage [class*="stream__"],
                body.is-fullScreen [class*="stream__"],
                :fullscreen [class*="stream__"] {
                    inset: 0 !important;
                    top: 0 !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                }

                body.is-fullScreenPage [class*="video__VfhVg"],
                body.is-fullScreen [class*="video__VfhVg"],
                body.is-fullScreenPage [class*="video__"],
                body.is-fullScreen [class*="video__"],
                body.is-fullScreenPage #js-player-video,
                body.is-fullScreen #js-player-video,
                body.is-fullScreenPage #js-player-video-case,
                body.is-fullScreen #js-player-video-case,
                body.is-fullScreenPage video,
                body.is-fullScreen video,
                body.is-fullScreenPage #__video2,
                body.is-fullScreen #__video2 {
                    width: 100% !important;
                    height: 100% !important;
                    inset: 0 !important;
                    object-fit: contain !important;
                }

                body.is-fullScreenPage [class*="case__"],
                body.is-fullScreen [class*="case__"],
                body[class*="wfs"] [class*="case__"] {
                    bottom: 0 !important;
                    position: absolute !important;
                    width: 100% !important;
                    left: 0 !important;
                    right: 0 !important;
                }

                /* ==================== 非全屏普通模式 (16:9 比例自适应居中大窗，不遮顶、不切边) ==================== */
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="playerWrap__"] {
                    display: flex !important;
                    justify-content: center !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                    margin-top: 64px !important;
                    padding: 0 !important;
                    top: 0 !important;
                }

                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="playerWrap__"] > div:not([class*="playerBackground"]):not(#js-account-security) {
                    display: flex !important;
                    justify-content: center !important;
                    width: 100% !important;
                }

                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="stage__"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) #js-player-main,
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="main__a3F0Y"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="main__"] {
                    display: flex !important;
                    justify-content: center !important;
                    width: auto !important;
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    height: calc(100vh - 74px) !important;
                    max-height: calc(100vh - 74px) !important;
                }

                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="player__jsy1T"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="player__"] {
                    width: calc((100vh - 74px) * 16 / 9) !important;
                    max-width: 95vw !important;
                    height: calc(100vh - 74px) !important;
                    max-height: calc(100vh - 74px) !important;
                    position: relative !important;
                    margin: 0 auto !important;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5) !important;
                    border-radius: 8px !important;
                    overflow: hidden !important;
                }

                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="stream__T55I3"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="stream__"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="video__VfhVg"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) [class*="video__"],
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) #js-player-video,
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) #js-player-video-case,
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) video,
                body:not(.is-fullScreenPage):not(.is-fullScreen):not([class*="wfs"]):not([class*="fullscreen"]) #__video2 {
                    width: 100% !important;
                    height: 100% !important;
                    inset: 0 !important;
                    object-fit: contain !important;
                    border-radius: 8px !important;
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
                gap: 5px !important;
                height: 32px !important;
                padding: 0 12px !important;
                margin: 14px 8px !important;
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
                z-index: 100 !important;
            }
            #douyu-beautify-header-btn:hover {
                background: rgba(238, 9, 121, 0.2) !important;
                border-color: rgba(238, 9, 121, 0.5) !important;
                color: #fff !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 12px rgba(238, 9, 121, 0.25) !important;
            }
            #douyu-beautify-header-btn svg {
                width: 14px !important;
                height: 14px !important;
                fill: #ff6a00 !important;
                transition: transform 0.3s ease !important;
            }
            #douyu-beautify-header-btn:hover svg {
                transform: rotate(45deg) !important;
            }

            /* ========== 设置面板 ========== */
            #douyu-beautify-panel {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%) scale(0.95);
                z-index: 999999; width: 440px; max-height: 85vh;
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
                padding: 18px 24px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            #douyu-beautify-panel .panel-header h3 {
                margin: 0; font-size: 17px; font-weight: 700;
                background: linear-gradient(135deg, #ff6a00, #ee0979);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                background-clip: text; letter-spacing: 0.5px;
            }
            #douyu-beautify-panel .panel-close {
                width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                border: none; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
                border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s ease; line-height: 1;
            }
            #douyu-beautify-panel .panel-close:hover { background: rgba(255,59,48,0.2); color: #ff3b30; }
            #douyu-beautify-panel .panel-body { padding: 14px 24px 20px; overflow-y: auto; max-height: 60vh; }
            #douyu-beautify-panel .setting-group { margin-bottom: 12px; }
            #douyu-beautify-panel .setting-group-title {
                font-size: 11px; font-weight: 600; text-transform: uppercase;
                letter-spacing: 1.5px; color: rgba(255,255,255,0.35); margin-bottom: 8px; padding-left: 2px;
            }
            #douyu-beautify-panel .setting-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 9px 12px; margin-bottom: 3px; border-radius: 10px; transition: background 0.2s ease;
            }
            #douyu-beautify-panel .setting-item:hover { background: rgba(255,255,255,0.04); }
            #douyu-beautify-panel .setting-label { font-size: 13.5px; color: rgba(255,255,255,0.85); font-weight: 500; }
            #douyu-beautify-panel .setting-desc { font-size: 11px; color: rgba(255,255,255,0.38); margin-top: 2px; }
            #douyu-beautify-panel .toggle-switch { position: relative; width: 42px; height: 22px; flex-shrink: 0; margin-left: 12px; }
            #douyu-beautify-panel .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
            #douyu-beautify-panel .toggle-slider {
                position: absolute; cursor: pointer; inset: 0;
                background: rgba(255,255,255,0.12); border-radius: 11px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #douyu-beautify-panel .toggle-slider::before {
                position: absolute; content: ''; height: 16px; width: 16px;
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
            #douyu-beautify-panel .panel-footer .hint { font-size: 11px; color: rgba(255,255,255,0.45); }
            #douyu-beautify-panel .panel-footer .apply-btn {
                padding: 6px 18px; border: none; border-radius: 8px;
                background: linear-gradient(135deg, #ff6a00, #ee0979);
                color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
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

            /* ========== 聊天面板 ========== */
            .layout-Player-aside.beautified-chat, [class*="sidebar__"].beautified-chat {
                background: rgba(18,18,26,0.95) !important;
                border-left: 1px solid rgba(255,255,255,0.06) !important;
            }

            /* ========== Toast ========== */
            #douyu-beautify-toast {
                position: fixed; top: 20px; left: 50%;
                transform: translateX(-50%) translateY(-100px);
                z-index: 9999999; padding: 9px 20px;
                background: rgba(18,18,26,0.95); backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
                color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                pointer-events: none;
            }
            #douyu-beautify-toast.is-visible { transform: translateX(-50%) translateY(0); }
        `;
    }

    // ==========================================
    //  样式引擎与即时应用
    // ==========================================
    let dynamicStyleEl = null;

    function applyStyles() {
        const cssText = generateBaseCSS() + '\n' + generateHideCSS();
        if (dynamicStyleEl) {
            dynamicStyleEl.textContent = cssText;
        } else {
            if (typeof GM_addStyle !== 'undefined') {
                dynamicStyleEl = GM_addStyle(cssText);
            } else {
                dynamicStyleEl = document.createElement('style');
                dynamicStyleEl.textContent = cssText;
                (document.head || document.documentElement).appendChild(dynamicStyleEl);
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

    function retry(fn, interval = 1000, maxAttempts = 20) {
        let attempts = 0;
        const timer = setInterval(() => {
            if (fn() || ++attempts >= maxAttempts) clearInterval(timer);
        }, interval);
    }

    // ==========================================
    //  Toast 提示
    // ==========================================
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
        toastTimer = setTimeout(() => toast?.classList.remove('is-visible'), duration);
    }

    // ==========================================
    //  JS 辅助隐藏（针对复杂/动态节点）
    // ==========================================
    const JS_REMOVE_SELECTORS = {
        removeAds: [
            '.MatchFocusFullPic', '.DropMenuList-ad', '.DropPane-ad',
            '.CloudGameLink', '.AdCover', '.google-auto-placed',
            '.adsbygoogle', '.ScreenBannerAd', 'section.layout-Banner'
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

    function forceRemoveElements() {
        Object.entries(JS_REMOVE_SELECTORS).forEach(([key, selectors]) => {
            if (config[key]) {
                selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => {
                    if (el.classList.contains('playerWrap__') || el.querySelector?.('video')) return;
                    el.style.display = 'none';
                }));
            }
        });
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

    function autoHighQuality() {
        if (!config.autoHighQuality) return;

        retry(() => {
            const rateContainer = document.querySelector(SELECTORS.qualityRate);
            if (rateContainer) {
                const items = rateContainer.querySelectorAll('ul > li');
                if (items.length > 0) {
                    const highest = items[0];
                    if (!highest.className.includes('selected')) {
                        highest.click();
                    }
                    return true;
                }
            }

            const qualityBtns = document.querySelectorAll('.tipitem, [class*="QualityItem"], [class*="quality-item"]');
            if (qualityBtns.length > 0) {
                qualityBtns[0].click();
                return true;
            }

            const qualitySelector = document.querySelector('[class*="QualitySwitch"], [class*="quality-switch"]');
            if (qualitySelector) {
                qualitySelector.click();
                setTimeout(() => {
                    const tipItems = document.querySelectorAll('.tipitem, [class*="QualityItem"]');
                    if (tipItems.length > 0) tipItems[0].click();
                }, 300);
                return true;
            }

            return false;
        }, 1200, 15);
    }

    function autoWebFullscreen() {
        if (!config.autoWebFullscreen) return;

        retry(() => {
            const isAlreadyWfs = document.body.classList.contains('is-fullScreenPage') ||
                                 document.body.className.includes('wfs') ||
                                 document.body.className.includes('fullscreen');
            if (isAlreadyWfs) return true;

            const btn = getWebFullscreenButton();
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        }, 1000, 20);
    }

    // ==========================================
    //  首页视频清理
    // ==========================================
    function cleanHomepagePlayer() {
        if (!isHomepage) return;

        document.querySelectorAll('video').forEach(video => {
            try {
                video.pause();
                video.muted = true;
                video.src = '';
                video.srcObject = null;
                video.load();
            } catch (e) { /* ignore */ }
        });

        SELECTORS.homepagePlayer.forEach(sel => {
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

    // ==========================================
    //  MutationObserver 动态清理
    // ==========================================
    const OBSERVER_CLASS_LIST = [
        'MatchFocusFullPic', 'Prompt-container', 'AdCover',
        'ScreenBannerAd', 'EnterEffect', 'RoomActivityFloat',
        'ActivityReceivePopup', 'FansInteractPopup', 'FloatLayerContent',
        'ToolbarCardModule', 'InteractEntryPanel', 'TreasureBox',
        'BackgroundOpacity-layout', 'interactive__', 'toolbar__'
    ];

    let observerTimer = null;
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCleanHomepage = false;
            let shouldForceRemove = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;

                    if (isHomepage && (
                        node.tagName === 'VIDEO' ||
                        node.querySelector?.('video') ||
                        SELECTORS.homepagePlayer.some(sel => {
                            try {
                                return (node.matches && node.matches(sel)) || (node.querySelector && node.querySelector(sel));
                            } catch (e) {
                                return false;
                            }
                        })
                    )) {
                        shouldCleanHomepage = true;
                    }

                    if (OBSERVER_CLASS_LIST.some(cls => (typeof node.className === 'string' && node.className.includes(cls)))) {
                        node.style.display = 'none';
                        shouldForceRemove = true;
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
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==========================================
    //  设置面板 UI & 顶部导航栏按钮
    // ==========================================
    const SETTINGS_GROUPS = [
        {
            group: '界面元素清理',
            items: [
                { key: 'removeHeader', label: '精简顶部导航', desc: '仅保留搜索、关注、消息、头像' },
                { key: 'removeAside', label: '移除右侧边栏', desc: '隐藏弹幕/聊天区域' },
                { key: 'removeGiftBar', label: '移除礼物栏', desc: '隐藏礼物赠送及特效区域' },
                { key: 'removeFooter', label: '移除页脚', desc: '隐藏底部页脚与版权信息' },
                { key: 'removeAds', label: '移除广告', desc: '屏蔽全站横幅及活动广告' },
                { key: 'removeWatermark', label: '移除水印', desc: '隐藏播放器右上角水印' },
                { key: 'removeActivity', label: '移除活动弹窗与皮肤', desc: '屏蔽任务/抽奖及活动置顶皮肤背景' },
                { key: 'removeSideBanner', label: '移除侧边横幅与浮动工具', desc: '隐藏浮动按钮和侧边工具条' },
                { key: 'removeRecommend', label: '精简视频下方与遮挡', desc: '移除任务大厅、游戏租号、互动横条等' },
                { key: 'removeTopBar', label: '精简信息栏', desc: '移除粉丝勋章、贵族图标、主播等级等' },
            ]
        },
        {
            group: '功能与播放增强',
            items: [
                { key: 'playerExpand', label: '播放器扩展大窗', desc: '非全屏自适应 16:9 居中，全屏 100% 满屏' },
                { key: 'autoHighQuality', label: '自动最高画质', desc: '进入直播间自动选择最高可用画质' },
                { key: 'autoWebFullscreen', label: '自动网页全屏', desc: '进入直播间后自动切换网页全屏' },
                { key: 'showChatPanel', label: '保留聊天面板', desc: '保留右侧弹幕聊天区（覆盖侧边栏移除）' },
            ]
        }
    ];

    let panelVisible = false;

    function togglePanel() {
        panelVisible = !panelVisible;
        const panel = document.getElementById('douyu-beautify-panel');
        const overlay = document.getElementById('douyu-beautify-overlay');
        if (panel) panel.classList.toggle('is-visible', panelVisible);
        if (overlay) overlay.classList.toggle('is-visible', panelVisible);
    }

    function createHeaderSettingsButton() {
        retry(() => {
            if (document.getElementById('douyu-beautify-header-btn')) return true;

            const headerTarget = document.querySelector('.Header-right, [class*="right__"], .Header-wrap, #js-header');
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

            btn.addEventListener('click', togglePanel);
            headerTarget.insertBefore(btn, headerTarget.firstChild);
            return true;
        }, 800, 15);
    }

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
                <span class="hint">随时点击顶部“美化设置”打开</span>
                <button class="apply-btn" id="beautify-apply">保存并刷新</button>
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
                applyStyles();
                forceRemoveElements();
                showToast(`已${input.checked ? '开启' : '关闭'}: ${input.closest('.setting-item').querySelector('.setting-label').textContent}`);
            });
        });

        document.getElementById('beautify-apply').addEventListener('click', () => {
            saveConfig(config);
            location.reload();
        });
    }

    // ==========================================
    //  Tampermonkey 菜单命令
    // ==========================================
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('⚡ 斗鱼美化 - 打开设置', togglePanel);
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
        forceRemoveElements();
        createSettingsPanel();
        createHeaderSettingsButton();
        startObserver();
    });

    onPageLoaded(() => {
        if (isHomepage) cleanHomepagePlayer();
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            forceRemoveElements();
            applyStyles();
            createHeaderSettingsButton();
        }, 500);

        // 延迟执行自动化画质与全屏，等待播放器 UI 渲染完毕
        setTimeout(() => {
            autoHighQuality();
            autoWebFullscreen();
        }, 2000);

        // 处理懒加载内容
        setTimeout(() => {
            if (isHomepage) cleanHomepagePlayer();
            forceRemoveElements();
            createHeaderSettingsButton();
        }, 5000);
    });

    console.log(
        '%c ⚡ 斗鱼美化 v1.3.0 已加载 %c 顶部导航栏可直接打开设置 ',
        'background: linear-gradient(135deg, #ff6a00, #ee0979); color: #fff; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
        'background: #12121a; color: #ee0979; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #ee0979;'
    );
})();
