// ==UserScript==
// @name         纯净阅读 (PureReader) - 沉浸阅读与通用排版增强
// @namespace    https://github.com/e69d8e/tampermonkey-scripts
// @version      0.0.1
// @description  专为 CSDN、知乎、掘金、简书、博客园、微信公众号打造的纯净阅读器：免登录浏览、解除复制限制、拦截广告弹窗、外链直达、悬浮大纲目录 (TOC)、沉浸式极简阅读模式、一键导出 Markdown / PDF。
// @author       YH
// @match        *://*.csdn.net/*
// @match        *://*.zhihu.com/*
// @match        *://juejin.cn/*
// @match        *://*.jianshu.com/*
// @match        *://*.cnblogs.com/*
// @match        *://mp.weixin.qq.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zhihu.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @run-at       document-start
// @license      MIT
// @downloadURL  https://github.com/e69d8e/tampermonkey-scripts/raw/main/pure-reader/pure-reader.user.js
// @updateURL    https://github.com/e69d8e/tampermonkey-scripts/raw/main/pure-reader/pure-reader.user.js
// ==/UserScript==

(function () {
    'use strict';

    // 避免脚本在同一页面被重复执行
    if (window.__pureReaderLoaded) return;
    window.__pureReaderLoaded = true;

    // 仅在顶层窗口运行，避免在 iframe 广告或内嵌框架中重复挂载 Dock 与事件
    if (window.top !== window.self) return;

    // 跨环境安全注入 CSS (兼容缺失 GM_addStyle 的运行环境与 document-start 阶段)
    function safeAddStyle(css) {
        if (typeof GM_addStyle !== 'undefined') {
            return GM_addStyle(css);
        }
        const style = document.createElement('style');
        style.textContent = css;
        const target = document.head || document.documentElement;
        if (target) {
            target.appendChild(style);
        } else {
            // 在 document-start 阶段若根节点尚未挂载，待 DOM 出现时立即挂载以防 FOUC
            const observer = new MutationObserver(() => {
                const curTarget = document.head || document.documentElement;
                if (curTarget) {
                    curTarget.appendChild(style);
                    observer.disconnect();
                }
            });
            try {
                observer.observe(document, { childList: true });
            } catch (e) { /* ignore */ }
            document.addEventListener('DOMContentLoaded', () => {
                const curTarget = document.head || document.documentElement;
                if (curTarget && !style.parentNode) {
                    curTarget.appendChild(style);
                }
            }, { once: true });
        }
        return style;
    }

    // ==========================================
    //  1. 设计规范与调色板 (Anthropic Warm Canvas)
    // ==========================================
    const THEME = {
        primary: '#cc785c',
        primaryActive: '#a9583e',
        primaryDisabled: '#e6dfd8',
        ink: '#141413',
        body: '#3d3d3a',
        bodyStrong: '#252523',
        muted: '#6c6a64',
        mutedSoft: '#8e8b82',
        hairline: '#e6dfd8',
        hairlineSoft: '#ebe6df',
        canvas: '#faf9f5',
        surfaceSoft: '#f5f0e8',
        surfaceCard: '#efe9de',
        surfaceDark: '#181715',
        surfaceDarkElevated: '#252320',
        onPrimary: '#ffffff',
        accentTeal: '#5db8a6',
        accentAmber: '#e8a55a',
        success: '#5db872',
        shadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
    };

    // ==========================================
    //  2. 默认配置模型与持久化管理器
    // ==========================================
    const DEFAULT_CONFIG = {
        // 通用核心功能
        unblockCopy: true,          // 解除防复制限制与小尾巴劫持
        bypassRedirect: true,       // 外链直接跳转（绕过中转页）
        removeAds: true,            // 拦截广告、营销横幅与浮动挂件
        autoExpandContent: true,    // 自动展开全文/阅读全文
        blockLoginModal: true,      // 拦截未登录阻断弹窗与强制锁屏
        enableFloatingTOC: true,    // 启用悬浮大纲目录
        enableZenMode: true,        // 启用沉浸式极简阅读模式
        enableCodeCopy: true,       // 代码块一键免登录复制增强
        hideTopNav: true,           // 净化/隐藏各平台顶部导航栏与大横幅 (CSDN/掘金/博客园/简书等)
        wideArticleLayout: true,    // 宽屏大视野排版 (自适应加宽正文至 1000~1200px)

        // 沉浸阅读模式个性化配置
        zenTheme: 'cream',          // 'cream' | 'green' | 'dark' | 'white'
        zenFontSize: 17,            // px (15-24)
        zenLineHeight: 1.8,         // 行高 (1.5-2.2)
        zenMaxWidth: 1000,          // px (860-1180)
        zenFontFamily: 'sans',      // 'sans' | 'serif'

        // 平台专属特性
        csdn_pureLayout: true,
        csdn_removeRecommend: true,
        zhihu_removeYanxuan: true,
        zhihu_hideSideBar: true,
        juejin_pureLayout: true,
        jianshu_removeAppPrompt: true,
        cnblogs_removeAds: true,
        weixin_desktopOptimize: true,

        // UI 悬浮 Dock
        showFloatingDock: true
    };

    const CONFIG_KEY = 'pureReaderConfig';

    function loadConfig() {
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

    let config = loadConfig();

    // ==========================================
    //  3. 平台检测与适配器上下文
    // ==========================================
    const host = window.location.hostname;
    const isCSDN = host.includes('csdn.net');
    const isZhihu = host.includes('zhihu.com');
    const isJuejin = host.includes('juejin.cn');
    const isJianshu = host.includes('jianshu.com');
    const isCnblogs = host.includes('cnblogs.com');
    const isWeixin = host.includes('mp.weixin.qq.com');

    // CSDN 前置劫持与反强制重定向防御护盾：
    // 1. 置空全局代码块 AI 推广配置，从源头阻止广告按钮生成
    // 2. 伪造/桩化 window.csdn.loginBox 与 userLogin，利用 CSDN 自带检查提前终止登录弹窗与倒计时重定向
    // 3. 拦截 Location.prototype.replace / assign 与 window.open 对 passport.csdn.net 的强制跳转
    // 4. 补齐 UserName 访客 Cookie，防止 CSDN 客户端权限检测失败强跳登录页
    if (isCSDN) {
        try {
            const patchScript = document.createElement('script');
            patchScript.textContent = `
                (function() {
                    // 1. 置空代码块 AI 推广配置
                    try {
                        Object.defineProperty(window, 'codeAiAbStyle', {
                            get: function() { return ''; },
                            set: function() {},
                            configurable: true
                        });
                        Object.defineProperty(window, 'codeAiAbObjStyle', {
                            get: function() { return '{}'; },
                            set: function() {},
                            configurable: true
                        });
                    } catch (e) {
                        window.codeAiAbStyle = '';
                        window.codeAiAbObjStyle = '{}';
                    }

                    // 2. 补齐免登录 Cookie 凭据，阻止客户端触发未登录重定向
                    try {
                        if (!document.cookie.includes('UserName=')) {
                            document.cookie = 'UserName=pure_reader_guest; path=/; domain=.csdn.net';
                        }
                    } catch(e) {}

                    // 3. 重定向防御：拦截 Location.prototype.replace / assign 与 window.open
                    try {
                        const origReplace = Location.prototype.replace;
                        Location.prototype.replace = function(url) {
                            if (typeof url === 'string' && (url.includes('passport.csdn.net') || url.includes('/account/login') || url.includes('type=login'))) {
                                console.warn('[PureReader] 拦截 CSDN location.replace 登录跳转:', url);
                                return;
                            }
                            return origReplace.apply(this, arguments);
                        };

                        const origAssign = Location.prototype.assign;
                        Location.prototype.assign = function(url) {
                            if (typeof url === 'string' && (url.includes('passport.csdn.net') || url.includes('/account/login') || url.includes('type=login'))) {
                                console.warn('[PureReader] 拦截 CSDN location.assign 登录跳转:', url);
                                return;
                            }
                            return origAssign.apply(this, arguments);
                        };

                        const origOpen = window.open;
                        window.open = function(url) {
                            if (typeof url === 'string' && url.includes('passport.csdn.net')) {
                                console.warn('[PureReader] 拦截 CSDN window.open 登录跳转:', url);
                                return null;
                            }
                            return origOpen.apply(this, arguments);
                        };
                    } catch(e) {}

                    // 4. 桩化 window.csdn.loginBox 与 userLogin
                    // CSDN 官方 csdn-login-box.js 首行执行：if(window.csdn&&window.csdn.loginBox&&window.csdn.loginBox.show)return void void 0;
                    // 提前挂载桩函数使 CSDN 核心登录脚本整体静默退出，彻底根除弹窗渲染、轮询与倒计时重定向
                    const dummyLoginBox = {
                        show: function() { return false; },
                        showTip: function() { return false; },
                        showAutoTip: function() { return false; },
                        key: function() { return false; },
                        close: function() { return false; },
                        setlogin: function() { return false; },
                        loginout: function() { return false; },
                        self: undefined,
                        self2: undefined
                    };
                    const dummyUserLogin = {
                        checkUserStatus: function(cb) {
                            if (typeof cb === 'function') cb();
                            return true;
                        },
                        getUserStatus: function(cb) {
                            if (typeof cb === 'function') cb();
                            return true;
                        },
                        show: function() { return false; }
                    };

                    window.loginUrl = 'javascript:void(0);';
                    window.csdn = window.csdn || {};
                    window.csdn.loginBox = dummyLoginBox;
                    window.csdn.userLogin = dummyUserLogin;

                    let internalCSDN = window.csdn;
                    try {
                        Object.defineProperty(window, 'csdn', {
                            get: function() { return internalCSDN; },
                            set: function(v) {
                                internalCSDN = v || {};
                                if (!internalCSDN.loginBox) internalCSDN.loginBox = dummyLoginBox;
                                else internalCSDN.loginBox.show = dummyLoginBox.show;
                                if (!internalCSDN.userLogin) internalCSDN.userLogin = dummyUserLogin;
                            },
                            configurable: true
                        });
                    } catch(e) {}
                })();
            `;
            (document.head || document.documentElement || document).appendChild(patchScript);
            patchScript.remove();
        } catch (e) { /* ignore */ }
    }

    // ==========================================
    //  4. 样式注入引擎 (document-start 防闪烁)
    // ==========================================
    function injectStartCSS() {
        const rules = [];

        // 全局基础抗阻断样式（解除选择限制）
        if (config.unblockCopy) {
            rules.push(`
                *, body, article, main, .article-content, #article_content,
                #js_content, #js_content *, .rich_media_content, .rich_media_content *,
                ._2rhmJa, ._2rhmJa *, #cnblogs_post_body, #cnblogs_post_body *,
                .RichContent, .post_body, pre, code {
                    -webkit-user-select: text !important;
                    user-select: text !important;
                }
            `);
        }

        // CSDN 专有去广告、防遮罩、顶部栏净化、代码块广告过滤与展开样式
        if (isCSDN) {
            if (config.hideTopNav || config.removeAds) {
                rules.push(`
                    #csdn-toolbar, .csdn-toolbar, div[id="csdn-toolbar"],
                    .toolbar-inside, #csdn-toolbar-profile-box, .toolbar-advert {
                        display: none !important;
                    }
                    body {
                        padding-top: 0 !important;
                    }
                `);
            }
            if (config.removeAds || config.autoExpandContent || config.blockLoginModal) {
                rules.push(`
                    #article_content, div.article_content {
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    .hide-article-box, .btn-readmore, #btn-readmore, .btn_readmore,
                    .simple-vip-paywall, .vip-mask, .column-mask, .follow-read-box,
                    #getVipUrl, .openvippay,
                    .passport-login-container, .passport-login-container2,
                    .passport-login-mark, .passport-login-mark2,
                    .passport-login-tip-container, #passportbox, #passportbox2, #passportbox3,
                    div[id*="passport"], iframe[src*="passport"],
                    .login-mark, .login-box, .opt-box_btmbox,
                    .aside-box.kind_person, .recommend-box, #treeSkill,
                    .recommend-right, .fourth_column, .blog_container_aside,
                    #rightAside, .csdn-side-toolbar, .left-toolbox,
                    .csdn-shop-window, .column-advert-box, .toolbar-advert, .feed-advert, [id^="kp_box_"], [id^="ad-"],
                    .user-desc.user-desc-font, .blog-footer-bottom,
                    /* CSDN 代码块广告、码道推广、AI写代码与折叠遮罩 */
                    .btn-code-notes, .code-annotation, .ins-code-runner-btn,
                    #codeBtnRun, .code-top-advert, [class*="code-ai"], [class*="ai-code"],
                    [id*="code-ai"], [data-report-click*="ai_code"],
                    [data-report-view*="3001.10436"], [data-report-click*="3001.10436"],
                    [data-title*="用码道"], [data-title*="Token"],
                    a[href*="codeartsco"], a[href*="inscode.net"], a[href*="trae.com.cn"],
                    a[href*="codebuddy.cn"], a[href*="lobsterai"],
                    .hide-pre-bar, .look-more-pre {
                        display: none !important;
                    }
                    /* 代码块默认全量展开，无需点击展开 */
                    pre.set-code-hide, pre.set-code-height {
                        height: auto !important;
                        max-height: none !important;
                    }
                `);
            }
            if (config.csdn_pureLayout || config.wideArticleLayout) {
                const csdnMaxWidth = config.wideArticleLayout ? '1200px' : '980px';
                rules.push(`
                    .main_father {
                        display: block !important;
                    }
                    .main_father div#mainBox, div#mainBox {
                        width: 100% !important;
                        max-width: ${csdnMaxWidth} !important;
                        margin: 16px auto 0 !important;
                        float: none !important;
                        box-sizing: border-box !important;
                    }
                    .main_father #mainBox main, div#mainBox main {
                        width: 100% !important;
                        max-width: 100% !important;
                        float: none !important;
                        box-sizing: border-box !important;
                    }
                    .nodename, .article-type {
                        display: inline-block !important;
                    }
                `);
            }
        }

        // 知乎去弹窗、去登录遮罩、吸顶栏净化、去广告与版式居中
        if (isZhihu) {
            if (config.hideTopNav) {
                rules.push(`
                    .AppHeader, header.AppHeader {
                        display: none !important;
                    }
                    .Topstory-container, .QuestionPage {
                        padding-top: 16px !important;
                    }
                `);
            }
            if (config.blockLoginModal) {
                rules.push(`
                    html.Modal-open, body.Modal-open {
                        overflow: auto !important;
                        position: static !important;
                        height: auto !important;
                    }
                    .Modal-wrapper, .Modal-enter-done, .sign-flow-modal,
                    .SignFlowModal, .SignFlowModal-wrap, .SignFlow-content,
                    .OpenInAppButton, .css-1ynzxqw, .css-1m8koxr, .css-1p2r0e3 {
                        display: none !important;
                    }
                `);
            }
            if (config.removeAds) {
                rules.push(`
                    .TopstoryItem--advertCard, .Banner-ad, .Pc-card, .Ecommerce-ad,
                    .ZPR-Card, .Sticky--holder, [data-za-detail-view-path-module="RightSideBar"] {
                        display: none !important;
                    }
                `);
            }
            if (config.zhihu_removeYanxuan) {
                rules.push(`
                    .ZhihuYanxuan, .KfeCollection-PcCollegeCard-root,
                    .CommonCard-RecommendColumn {
                        display: none !important;
                    }
                `);
            }
            if (config.autoExpandContent) {
                rules.push(`
                    .RichContent--unescapable.is-collapsed .RichContent-inner {
                        max-height: none !important;
                        mask-image: none !important;
                        -webkit-mask-image: none !important;
                    }
                    .RichContent--unescapable.is-collapsed .ContentItem-expandButton {
                        display: none !important;
                    }
                `);
            }
            if (config.zhihu_hideSideBar || config.wideArticleLayout) {
                const zhihuMaxWidth = config.wideArticleLayout ? '1060px' : '900px';
                rules.push(`
                    /* 隐藏知乎侧边栏与冗余浮动 */
                    .Question-sideColumn, .GlobalWrite-nav, .QuestionPage-sideColumn {
                        display: none !important;
                    }

                    /* 1. 知乎专栏 (zhuanlan.zhihu.com) 宽屏排版 */
                    .Post-NormalMain, .Post-NormalSub, .Post-Main, .Post-Header,
                    .Post-content, article.Post-Main, .Post-NormalMain > div {
                        width: 100% !important;
                        max-width: ${zhihuMaxWidth} !important;
                        margin: 0 auto !important;
                        box-sizing: border-box !important;
                    }

                    /* 2. 知乎问答与首页 (zhihu.com) 宽屏排版 */
                    .QuestionPage, .Question-main, .QuestionHeader-content, .Topstory-container {
                        width: 100% !important;
                        max-width: ${zhihuMaxWidth} !important;
                        margin: 0 auto !important;
                        justify-content: center !important;
                        box-sizing: border-box !important;
                    }
                    .Question-mainColumn, .Topstory-mainColumn {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        float: none !important;
                        flex: 1 1 auto !important;
                        box-sizing: border-box !important;
                    }
                    .QuestionHeader, .QuestionHeader-footer {
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                `);
            }
        }

        // 掘金去广告、吸顶导航栏净化与纯净布局
        if (isJuejin) {
            if (config.hideTopNav || config.removeAds) {
                rules.push(`
                    header.main-header, .main-header-box, .header-container,
                    header.juejin-header, nav.main-nav {
                        display: none !important;
                    }
                    .view-container {
                        padding-top: 0 !important;
                        margin-top: 0 !important;
                    }
                    main.container {
                        margin-top: 16px !important;
                    }
                `);
            }
            if (config.removeAds) {
                rules.push(`
                    .sidebar, .extension, .article-suspended-panel, .suspension-panel,
                    .ai-assistant-notification,
                    .recommended-area, .author-info-block, .index-book-banner,
                    .bottom-login-guide, .vip-entry, .article-banner,
                    .sidebar-block.pure {
                        display: none !important;
                    }
                `);
            }
            if (config.juejin_pureLayout || config.wideArticleLayout) {
                const juejinMaxWidth = config.wideArticleLayout ? '1050px' : '880px';
                const juejinContainerWidth = config.wideArticleLayout ? '1120px' : '960px';
                rules.push(`
                    main.container, .container.main-container, .view-container {
                        width: 100% !important;
                        max-width: ${juejinContainerWidth} !important;
                        margin: 0 auto !important;
                        justify-content: center !important;
                        box-sizing: border-box !important;
                    }
                    .view.column-view.post-view, .view.column-view {
                        width: 100% !important;
                        max-width: 100% !important;
                        justify-content: center !important;
                        display: flex !important;
                        box-sizing: border-box !important;
                    }
                    .main-area, .main-area.article-area {
                        width: 100% !important;
                        max-width: ${juejinMaxWidth} !important;
                        margin: 0 auto !important;
                        flex: 1 1 auto !important;
                        box-sizing: border-box !important;
                    }
                    article, .article-viewer, .markdown-body {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                `);
            }
        }

        // 简书去推广、顶部导航栏净化与居中排版
        if (isJianshu) {
            if (config.hideTopNav || config.removeAds) {
                rules.push(`
                    header, nav.navbar, nav._213wzc, nav.navbar-fixed-top, div._1OyPqC {
                        display: none !important;
                    }
                    body, ._3VRLsv, ._213wzc {
                        padding-top: 0 !important;
                    }
                    ._3Pnjry {
                        margin-top: 16px !important;
                    }
                `);
            }
            if (config.removeAds) {
                rules.push(`
                    .download-app-guidance, .call-app-btn, aside, footer,
                    .note-comment, .recommended-notes, .ant-modal-root,
                    [class*="ad-"], .app-open-guide {
                        display: none !important;
                    }
                `);
            }
            if (config.jianshu_removeAppPrompt || config.wideArticleLayout) {
                const jianshuMaxWidth = config.wideArticleLayout ? '1000px' : '860px';
                rules.push(`
                    div._3VRLsv {
                        width: 100% !important;
                        max-width: ${jianshuMaxWidth} !important;
                        margin: 0 auto !important;
                        justify-content: center !important;
                        box-sizing: border-box !important;
                    }
                    div._gp-ck, section.ouvJEz, section, article._2rhmJa, article, ._3Pnjry {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        box-sizing: border-box !important;
                    }
                `);
            }
        }

        // 博客园去广告、官方顶部栏与博主大头图横幅净化
        if (isCnblogs) {
            if (config.hideTopNav || config.cnblogs_removeAds) {
                rules.push(`
                    #top_nav, .navbar.forpc, #blog-navbar, .navbar-custom,
                    #header, #blogHeader, #navigator, #blogTitle, #header-wrap,
                    .custom-searchbar, .custom-toolbar {
                        display: none !important;
                    }
                    #home {
                        padding-top: 0 !important;
                        margin-top: 0 !important;
                    }
                    #main {
                        padding-top: 10px !important;
                    }
                `);
            }
            if (config.cnblogs_removeAds || config.wideArticleLayout) {
                const cnblogsMaxWidth = config.wideArticleLayout ? '1140px' : '950px';
                rules.push(`
                    #cnblogs_c1, #cnblogs_c2, #cnblogs_b1, #cnblogs_b2,
                    #ad_t2, #under_post_news, #under_post_kb, #side_banner,
                    #opt_under_post, #sideBar, #left-side {
                        display: none !important;
                    }
                    #home {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    #main {
                        width: 100% !important;
                        max-width: 100% !important;
                        justify-content: center !important;
                        display: flex !important;
                        box-sizing: border-box !important;
                    }
                    #mainContent {
                        flex: 1 1 auto !important;
                        flex-grow: 1 !important;
                        flex-basis: auto !important;
                        width: 100% !important;
                        max-width: ${cnblogsMaxWidth} !important;
                        margin: 0 auto !important;
                        float: none !important;
                        box-sizing: border-box !important;
                    }
                    .forFlow, #topics, .post, .postBody, #cnblogs_post_body {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                `);
            }
        }

        // 微信公众号桌面端体验优化
        if (isWeixin && (config.weixin_desktopOptimize || config.wideArticleLayout)) {
            const weixinMaxWidth = config.wideArticleLayout ? '980px' : '820px';
            rules.push(`
                #js_pc_qr_code, .qr_code_pc_outer, .rich_media_area_extra,
                .related_article_box, .reward_area, .profile_container {
                    display: none !important;
                }
                .rich_media_area_primary,
                .rich_media_area_primary_inner,
                .rich_media_wrp,
                #img-content,
                .rich_media_content {
                    width: 100% !important;
                    max-width: ${weixinMaxWidth} !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                    box-sizing: border-box !important;
                }
            `);
        }

        // 统一注入
        if (rules.length > 0) {
            safeAddStyle(rules.join('\n'));
        }
    }

    injectStartCSS();

    // ==========================================
    //  5. 核心拦截器：防复制解禁与剪贴板净化
    // ==========================================
    function setupCopyGuard() {
        if (!config.unblockCopy) return;

        // 1. 捕获阶段拦截 copy 事件，剔除版权小尾巴
        document.addEventListener('copy', function (e) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const text = selection.toString();
            if (!text || text.length === 0) return;

            // 清洗常见的版权声明小尾巴
            let cleanText = text
                .replace(/\n*————————————————\n*版权声明：本文为.*?\n*原文链接：.*$/gis, '')
                .replace(/\n*著作权归作者所有.*$/gis, '')
                .replace(/\n*作者：.*?\n*链接：.*?\n*来源：知乎.*$/gis, '')
                .replace(/\n*商业转载请联系作者获得授权.*$/gis, '')
                .replace(/\n*来源：简书.*$/gis, '')
                .replace(/\n*本作品采用.*许可协议.*$/gis, '');

            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', cleanText);
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(cleanText, 'text');
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);

        // 2. 清除 DOM 节点上的防复制/防右键限制
        function unlockElements() {
            const blockedAttributes = ['oncopy', 'onselectstart', 'oncontextmenu', 'oncut'];
            blockedAttributes.forEach(attr => {
                if (document[attr]) document[attr] = null;
                if (document.body && document.body[attr]) document.body[attr] = null;
            });
            document.querySelectorAll('[style*="user-select"], #js_content').forEach(el => {
                el.style.userSelect = 'text';
                el.style.webkitUserSelect = 'text';
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', unlockElements);
        } else {
            unlockElements();
        }
    }

    setupCopyGuard();

    // ==========================================
    //  6. 核心拦截器：外链直达拦截器
    // ==========================================
    function setupLinkGuard() {
        if (!config.bypassRedirect) return;

        function resolveRealUrl(href) {
            if (!href) return null;
            try {
                const url = new URL(href, window.location.href);

                // 知乎: link.zhihu.com/?target=...
                if (url.hostname === 'link.zhihu.com' && url.searchParams.has('target')) {
                    return decodeURIComponent(url.searchParams.get('target'));
                }
                // CSDN: link.csdn.net/?target=...
                if (url.hostname === 'link.csdn.net' && url.searchParams.has('target')) {
                    return decodeURIComponent(url.searchParams.get('target'));
                }
                // 掘金: link.juejin.cn/?target=...
                if (url.hostname === 'link.juejin.cn' && url.searchParams.has('target')) {
                    return decodeURIComponent(url.searchParams.get('target'));
                }
                // 简书: links.jianshu.com/go?to=...
                if (url.hostname.includes('jianshu.com') && url.pathname.includes('/go') && url.searchParams.has('to')) {
                    return decodeURIComponent(url.searchParams.get('to'));
                }
            } catch (e) {
                return null;
            }
            return null;
        }

        // 1. 捕获阶段点击事件代理
        document.addEventListener('click', function (e) {
            const anchor = e.target.closest('a');
            if (!anchor) return;
            const realUrl = resolveRealUrl(anchor.href);
            if (realUrl) {
                e.preventDefault();
                e.stopPropagation();
                window.open(realUrl, '_blank', 'noopener,noreferrer');
            }
        }, true);

        // 2. 静态链接直接覆写 href
        function rewriteExistingLinks() {
            const links = document.querySelectorAll('a[href*="target="], a[href*="to="]');
            links.forEach(a => {
                const real = resolveRealUrl(a.href);
                if (real) {
                    a.href = real;
                    a.setAttribute('rel', 'noopener noreferrer');
                }
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', rewriteExistingLinks);
        } else {
            rewriteExistingLinks();
        }
    }

    setupLinkGuard();

    // ==========================================
    //  7. 平台专有 DOM 处理逻辑
    // ==========================================
    function setupPlatformFixes() {
        // --- CSDN 修复 ---
        if (isCSDN) {
            function cleanCSDN() {
                // 自动展开全文：直接移除阅读更多按钮与折叠遮罩，严禁调用 .click() 避免触发 CSDN 强制登录拦截
                const readMoreBtns = document.querySelectorAll('.btn-readmore, #btn-readmore, .btn_readmore, #getVipUrl, .openvippay');
                readMoreBtns.forEach(btn => btn.remove());

                const articleBox = document.querySelector('#article_content, div.article_content');
                if (articleBox) {
                    articleBox.style.setProperty('height', 'auto', 'important');
                    articleBox.style.setProperty('max-height', 'none', 'important');
                    articleBox.style.setProperty('overflow', 'visible', 'important');
                }
                const hideBoxes = document.querySelectorAll('.hide-article-box, .simple-vip-paywall, .vip-mask, .column-mask, .follow-read-box');
                hideBoxes.forEach(box => box.remove());

                // 移除代码块推广、AI写代码、码道 Token 广告节点
                document.querySelectorAll(`
                    .btn-code-notes,
                    [data-report-click*="3001.10436"],
                    [data-report-view*="3001.10436"],
                    a[href*="codeartsco"],
                    a[href*="inscode.net"],
                    a[href*="trae.com.cn"],
                    a[href*="codebuddy.cn"],
                    a[href*="lobsterai"],
                    #codeBtnRun,
                    .ins-code-runner-btn,
                    .code-top-advert,
                    .code-annotation
                `).forEach(el => el.remove());

                // 代码块免登录一键复制与展开
                document.querySelectorAll('pre').forEach(pre => {
                    // 自动展开折叠代码块
                    if (pre.classList.contains('set-code-hide') || pre.classList.contains('set-code-height')) {
                        pre.classList.remove('set-code-hide', 'set-code-height');
                        pre.classList.add('set-code-show');
                        pre.style.height = 'auto';
                        pre.style.maxHeight = 'none';
                    }
                    const lookMore = pre.querySelector('.hide-pre-bar, .look-more-pre');
                    if (lookMore) lookMore.remove();

                    // 清理代码块顶栏/底栏中的营销文本与按钮（如“用码道免费领 1 个月 Token”）
                    pre.querySelectorAll('.opt-box > *:not(.hljs-button), .box-highline > *:not(.hljs-button), button:not(.hljs-button), a, span').forEach(node => {
                        if (node.classList.contains('hljs-button')) return;
                        const txt = (node.innerText || node.textContent || '').trim();
                        if (txt && /用码道|免费领.*Token|AI写代码|获取完整项目代码|AI生成项目|AI编程工具|Lobster/i.test(txt)) {
                            node.remove();
                        }
                    });

                    // 代码块免登录一键复制
                    if (config.enableCodeCopy) {
                        pre.style.userSelect = 'text';
                        const code = pre.querySelector('code');
                        if (code) code.style.userSelect = 'text';

                        // 查找或替换现存复制按钮
                        const copyBtn = pre.querySelector('.hljs-button, [data-title*="复制"]');
                        if (copyBtn && !copyBtn.dataset.pureAttached) {
                            copyBtn.dataset.pureAttached = 'true';
                            copyBtn.removeAttribute('onclick');
                            copyBtn.setAttribute('data-title', '一键复制代码');

                            // 克隆节点以清除 CSDN 绑定的登录事件
                            const newBtn = copyBtn.cloneNode(true);
                            copyBtn.parentNode.replaceChild(newBtn, copyBtn);

                            newBtn.addEventListener('click', function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                const targetCode = pre.querySelector('code') || pre;
                                const textToCopy = targetCode.innerText || targetCode.textContent;
                                copyToClipboard(textToCopy);
                                showToast('代码复制成功！');
                            });
                        }
                    }
                });

                // 顶部工具栏与多余内边距净化
                if (config.hideTopNav) {
                    const csdnToolbar = document.querySelector('#csdn-toolbar, .csdn-toolbar');
                    if (csdnToolbar) csdnToolbar.remove();
                    if (document.body && document.body.style.paddingTop) {
                        document.body.style.paddingTop = '0px';
                    }
                }
            }

            document.addEventListener('DOMContentLoaded', cleanCSDN);
            window.addEventListener('load', cleanCSDN);
            setInterval(cleanCSDN, 1500);

            // 监听 DOM 变化以实现毫秒级快速清理
            try {
                const csdnObserver = new MutationObserver(cleanCSDN);
                csdnObserver.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) { /* ignore */ }

            // 拦截文章阅读区域内诱导或强制跳转 passport.csdn.net 登录页的链接点击
            if (config.blockLoginModal) {
                document.addEventListener('click', function (e) {
                    const a = e.target.closest('a');
                    if (a && a.href && a.href.includes('passport.csdn.net')) {
                        // 允许用户在顶部工具栏中主动点击登录
                        if (a.closest('#csdn-toolbar, .csdn-toolbar')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        console.warn('[PureReader] 拦截 CSDN 强制登录页跳转:', a.href);
                    }
                }, true);
            }
        }

        // --- 知乎 修复 ---
        if (isZhihu) {
            function cleanZhihu() {
                // 拦截并摧毁登录弹窗与锁屏
                if (config.blockLoginModal) {
                    const modals = document.querySelectorAll('.Modal-wrapper, .sign-flow-modal, .SignFlowModal');
                    modals.forEach(m => m.remove());
                    document.documentElement.classList.remove('Modal-open');
                    document.body.classList.remove('Modal-open');
                    document.documentElement.style.overflow = 'auto';
                    document.body.style.overflow = 'auto';
                }

                // 移除侧栏以腾出宽屏排版空间
                if (config.zhihu_hideSideBar || config.wideArticleLayout) {
                    const side = document.querySelector('.Question-sideColumn, .GlobalWrite-nav');
                    if (side) side.remove();
                    const rightBar = document.querySelector('.QuestionPage-sideColumn');
                    if (rightBar) rightBar.remove();
                }

                // 自动展开折叠回答
                if (config.autoExpandContent) {
                    document.querySelectorAll('.ContentItem-expandButton').forEach(btn => {
                        // 避免重复点击
                        if (!btn.dataset.pureClicked) {
                            btn.dataset.pureClicked = 'true';
                            btn.click();
                        }
                    });
                }
            }

            document.addEventListener('DOMContentLoaded', cleanZhihu);
            window.addEventListener('load', cleanZhihu);
            // 滚动时知乎可能会异步挂载弹窗，使用 MutationObserver
            try {
                const observer = new MutationObserver(cleanZhihu);
                observer.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) { /* ignore */ }
        }

        // --- 掘金 修复 ---
        if (isJuejin) {
            function cleanJuejin() {
                if (config.hideTopNav) {
                    const h = document.querySelector('header.main-header, .main-header-box, .header-container, header.juejin-header');
                    if (h) h.remove();
                    const viewContainer = document.querySelector('.view-container');
                    if (viewContainer) {
                        viewContainer.style.paddingTop = '0px';
                        viewContainer.style.marginTop = '0px';
                    }
                }
                if (config.removeAds || config.juejin_pureLayout || config.wideArticleLayout) {
                    const suspension = document.querySelector('.suspension-panel');
                    if (suspension) suspension.remove();
                    const sb = document.querySelector('.sidebar');
                    if (sb) sb.remove();
                }
            }
            document.addEventListener('DOMContentLoaded', cleanJuejin);
            window.addEventListener('load', cleanJuejin);
            try {
                const juejinObserver = new MutationObserver(cleanJuejin);
                juejinObserver.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) { /* ignore */ }
        }

        // --- 简书 修复 ---
        if (isJianshu) {
            function cleanJianshu() {
                if (config.hideTopNav) {
                    const nav = document.querySelector('header, nav.navbar, nav._213wzc, nav.navbar-fixed-top');
                    if (nav) nav.remove();
                    if (document.body) document.body.style.paddingTop = '0px';
                }
                if (config.removeAds || config.jianshu_removeAppPrompt || config.wideArticleLayout) {
                    const aside = document.querySelector('aside');
                    if (aside) aside.remove();
                }
                if (config.autoExpandContent) {
                    const btn = document.querySelector('.collapse-free-content .read-more, .collapse-free-content button');
                    if (btn) btn.click();
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', cleanJianshu);
            } else {
                cleanJianshu();
            }
            window.addEventListener('load', cleanJianshu);
            try {
                const jianshuObserver = new MutationObserver(cleanJianshu);
                jianshuObserver.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) { /* ignore */ }
        }

        // --- 博客园 修复 ---
        if (isCnblogs) {
            function cleanCnblogs() {
                if (config.hideTopNav) {
                    const topNav = document.querySelector('#top_nav');
                    if (topNav) topNav.remove();
                    const header = document.querySelector('#header, #blogHeader');
                    if (header) header.remove();
                }
                if (config.cnblogs_removeAds || config.wideArticleLayout) {
                    const sb = document.querySelector('#sideBar, #left-side');
                    if (sb) sb.remove();
                }
            }
            document.addEventListener('DOMContentLoaded', cleanCnblogs);
            window.addEventListener('load', cleanCnblogs);
        }
    }

    setupPlatformFixes();

    // ==========================================
    //  8. 工具函数：剪贴板与轻提示 (Toast)
    // ==========================================
    function copyToClipboard(text) {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text, 'text');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    }

    function showToast(msg, duration = 2200) {
        let toast = document.getElementById('pure-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pure-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('pure-show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('pure-show');
        }, duration);
    }

    // ==========================================
    //  9. 正文提取与元数据解析器
    // ==========================================
    function extractArticleData() {
        let title = document.title || 'Untitled Article';
        let contentEl = null;

        if (isCSDN) {
            title = document.querySelector('#articleContentId')?.innerText || document.title;
            contentEl = document.querySelector('#article_content');
        } else if (isZhihu) {
            // 知乎专栏或问答
            title = document.querySelector('.Post-Title')?.innerText ||
                    document.querySelector('.QuestionHeader-title')?.innerText ||
                    document.title;
            contentEl = document.querySelector('.Post-RichTextContainer') ||
                        document.querySelector('.RichContent-inner') ||
                        document.querySelector('.QuestionAnswer-content');
        } else if (isJuejin) {
            title = document.querySelector('.article-title')?.innerText || document.title;
            contentEl = document.querySelector('.article-viewer.markdown-body') ||
                        document.querySelector('.markdown-body') ||
                        document.querySelector('.article-viewer') ||
                        document.querySelector('article .main') ||
                        document.querySelector('.article-content') ||
                        document.querySelector('.main-area article');
        } else if (isJianshu) {
            title = document.querySelector('h1')?.innerText || document.title;
            contentEl = document.querySelector('article') || document.querySelector('._2rhmJa');
        } else if (isCnblogs) {
            title = document.querySelector('#cb_post_title_url')?.innerText || document.title;
            contentEl = document.querySelector('#cnblogs_post_body');
        } else if (isWeixin) {
            title = document.querySelector('#activity-name')?.innerText || document.title;
            contentEl = document.querySelector('#js_content');
        }

        // 通用降级查找
        if (!contentEl) {
            contentEl = document.querySelector('article') ||
                        document.querySelector('main') ||
                        document.querySelector('.article') ||
                        document.querySelector('.post-content');
        }

        title = title.replace(/[-_][\s\S]*$/, '').trim();
        return { title, contentEl };
    }

    // ==========================================
    //  10. 悬浮智能大纲目录 (Floating TOC)
    // ==========================================
    class FloatingTOC {
        constructor() {
            this.container = null;
            this.headings = [];
            this.isOpen = false;
        }

        init() {
            if (!config.enableFloatingTOC) return;
            const { contentEl } = extractArticleData();
            if (!contentEl) return;

            const elements = contentEl.querySelectorAll('h1, h2, h3, h4');
            if (elements.length < 2) return; // 标题过少不生成目录

            this.headings = Array.from(elements).map((el, index) => {
                const id = el.id || `pure-toc-h-${index}`;
                el.id = id;
                return {
                    id,
                    level: parseInt(el.tagName.substring(1), 10),
                    text: el.innerText.trim(),
                    el
                };
            });

            this.render();
            this.bindScrollHighlight();
        }

        render() {
            document.querySelectorAll('#pure-toc-panel').forEach(el => el.remove());

            this.container = document.createElement('div');
            this.container.id = 'pure-toc-panel';
            this.container.innerHTML = `
                <div class="pure-toc-header">
                    <div class="pure-toc-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h14"/></svg>
                        文章大纲 (${this.headings.length})
                    </div>
                    <button class="pure-toc-close" title="收起大纲">&times;</button>
                </div>
                <div class="pure-toc-list">
                    ${this.headings.map(h => `
                        <a href="#${h.id}" class="pure-toc-item pure-toc-l${h.level}" data-id="${h.id}">
                            ${h.text}
                        </a>
                    `).join('')}
                </div>
            `;

            document.body.appendChild(this.container);

            this.container.querySelector('.pure-toc-close').addEventListener('click', () => {
                this.toggle(false);
            });

            this.container.querySelectorAll('.pure-toc-item').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = link.getAttribute('data-id');
                    const targetEl = document.getElementById(id);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }

        bindScrollHighlight() {
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        this.updateActiveItem();
                        ticking = false;
                    });
                    ticking = true;
                }
            });
        }

        updateActiveItem() {
            if (!this.container) return;
            const scrollY = window.scrollY + 100;
            let current = null;

            for (let i = 0; i < this.headings.length; i++) {
                const h = this.headings[i];
                if (h.el.offsetTop <= scrollY) {
                    current = h;
                } else {
                    break;
                }
            }

            this.container.querySelectorAll('.pure-toc-item').forEach(a => {
                a.classList.remove('pure-active');
            });

            if (current) {
                const activeA = this.container.querySelector(`.pure-toc-item[data-id="${current.id}"]`);
                if (activeA) {
                    activeA.classList.add('pure-active');
                    activeA.scrollIntoView({ block: 'nearest' });
                }
            }
        }

        toggle(forceState) {
            this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
            if (!this.container) this.init();
            if (this.container) {
                this.container.classList.toggle('pure-toc-show', this.isOpen);
            }
        }
    }

    const tocInstance = new FloatingTOC();

    // ==========================================
    //  11. 沉浸式极简阅读模式 (Zen Reader Mode)
    // ==========================================
    class ZenReader {
        constructor() {
            this.overlay = null;
            this.isActive = false;
        }

        open() {
            const { title, contentEl } = extractArticleData();
            if (!contentEl) {
                showToast('未找到文章正文，无法开启沉浸阅读');
                return;
            }

            if (!this.overlay) {
                this.createOverlay();
            }

            // 克隆并净化正文
            const clone = contentEl.cloneNode(true);
            this.sanitizeContent(clone);

            const titleEl = this.overlay.querySelector('.pure-zen-title');
            const bodyEl = this.overlay.querySelector('.pure-zen-content');
            titleEl.textContent = title;
            bodyEl.innerHTML = '';
            bodyEl.appendChild(clone);

            this.applyPreferences();
            this.overlay.classList.add('pure-zen-active');
            document.documentElement.style.overflow = 'hidden';
            this.isActive = true;
            showToast('已进入沉浸阅读模式 (按 ESC 或快捷键退出)');
        }

        close() {
            if (!this.overlay) return;
            this.overlay.classList.remove('pure-zen-active');
            document.documentElement.style.overflow = '';
            this.isActive = false;
        }

        toggle() {
            if (this.isActive) {
                this.close();
            } else {
                this.open();
            }
        }

        sanitizeContent(root) {
            // 剔除所有脚本、无用按钮、广告、外链推荐或宿主元数据
            const junkSelectors = [
                'script', 'style', 'iframe', '.hide-article-box', '.btn-readmore',
                '.hljs-button', '.reward-area', '.recommend-box', '.comment-box',
                '.like-btn', '.share-box', '.advert', '[class*="ad-"]',
                '.article-title', '.author-info-block', '.article-banner', '.extension-banner',
                '.tag-list-box', '.suspension-panel'
            ];
            root.querySelectorAll(junkSelectors.join(',')).forEach(el => el.remove());

            // 还原图片懒加载 src
            root.querySelectorAll('img').forEach(img => {
                const realSrc = img.getAttribute('data-src') ||
                                img.getAttribute('data-original') ||
                                img.getAttribute('data-actualsrc') ||
                                img.getAttribute('origin-src');
                if (realSrc) img.src = realSrc;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            });
        }

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'pure-zen-overlay';
            this.overlay.innerHTML = `
                <div class="pure-zen-toolbar">
                    <div class="pure-zen-brand">
                        <span class="pure-zen-logo">PureRead</span>
                        <span class="pure-zen-badge">沉浸阅读</span>
                    </div>
                    <div class="pure-zen-controls">
                        <!-- 主题色切换 -->
                        <div class="pure-zen-themes">
                            <button class="pure-theme-btn cream ${config.zenTheme === 'cream' ? 'active' : ''}" data-theme="cream" title="暖色羊皮纸"></button>
                            <button class="pure-theme-btn green ${config.zenTheme === 'green' ? 'active' : ''}" data-theme="green" title="清新护眼绿"></button>
                            <button class="pure-theme-btn white ${config.zenTheme === 'white' ? 'active' : ''}" data-theme="white" title="纯白极简"></button>
                            <button class="pure-theme-btn dark ${config.zenTheme === 'dark' ? 'active' : ''}" data-theme="dark" title="深邃暗黑"></button>
                        </div>
                        <div class="pure-zen-divider"></div>
                        <!-- 字号调节 -->
                        <button class="pure-zen-btn" id="pure-font-dec" title="缩小字号">A-</button>
                        <span class="pure-font-val">${config.zenFontSize}px</span>
                        <button class="pure-zen-btn" id="pure-font-inc" title="放大字号">A+</button>
                        <div class="pure-zen-divider"></div>
                        <!-- 宽度调节 -->
                        <button class="pure-zen-btn" id="pure-width-toggle" title="切换版芯宽度">宽度</button>
                        <!-- 退出 -->
                        <button class="pure-zen-btn pure-zen-close-btn" title="退出沉浸模式 (ESC)">✕ 退出</button>
                    </div>
                </div>
                <div class="pure-zen-scroll-area">
                    <div class="pure-zen-container">
                        <h1 class="pure-zen-title"></h1>
                        <div class="pure-zen-content"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.overlay);
            this.bindEvents();
        }

        applyPreferences() {
            if (!this.overlay) return;
            this.overlay.setAttribute('data-theme', config.zenTheme);
            const container = this.overlay.querySelector('.pure-zen-container');
            const fontVal = this.overlay.querySelector('.pure-font-val');

            container.style.fontSize = `${config.zenFontSize}px`;
            container.style.lineHeight = `${config.zenLineHeight}`;
            container.style.maxWidth = `${config.zenMaxWidth}px`;
            if (fontVal) fontVal.textContent = `${config.zenFontSize}px`;
        }

        bindEvents() {
            // 关闭按钮
            this.overlay.querySelector('.pure-zen-close-btn').addEventListener('click', () => this.close());

            // 快捷键 ESC 退出
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isActive) {
                    this.close();
                }
            });

            // 主题切换
            this.overlay.querySelectorAll('.pure-theme-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const theme = btn.getAttribute('data-theme');
                    config.zenTheme = theme;
                    saveConfig(config);
                    this.overlay.querySelectorAll('.pure-theme-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.applyPreferences();
                });
            });

            // 字号调节
            this.overlay.querySelector('#pure-font-inc').addEventListener('click', () => {
                if (config.zenFontSize < 26) {
                    config.zenFontSize += 1;
                    saveConfig(config);
                    this.applyPreferences();
                }
            });
            this.overlay.querySelector('#pure-font-dec').addEventListener('click', () => {
                if (config.zenFontSize > 14) {
                    config.zenFontSize -= 1;
                    saveConfig(config);
                    this.applyPreferences();
                }
            });

            // 宽度切换
            this.overlay.querySelector('#pure-width-toggle').addEventListener('click', () => {
                const widths = [860, 1000, 1180];
                let currentIndex = widths.indexOf(config.zenMaxWidth);
                if (currentIndex === -1) currentIndex = 1;
                const nextIndex = (currentIndex + 1) % widths.length;
                config.zenMaxWidth = widths[nextIndex];
                saveConfig(config);
                this.applyPreferences();
                showToast(`版芯宽度已切换为 ${config.zenMaxWidth}px`);
            });
        }
    }

    const zenInstance = new ZenReader();

    // ==========================================
    //  12. 文章导出引擎 (Markdown & Print PDF)
    // ==========================================
    const Exporter = {
        exportMarkdown() {
            const { title, contentEl } = extractArticleData();
            if (!contentEl) {
                showToast('未找到正文内容，无法导出');
                return;
            }

            const mdContent = `# ${title}\n\n` +
                              `> 导出日期：${new Date().toLocaleDateString()} | 来源：[${document.title}](${window.location.href})\n\n---\n\n` +
                              Exporter.htmlToMarkdown(contentEl.cloneNode(true));

            // 创建 Blob 下载
            const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('Markdown 文件导出成功！');
        },

        htmlToMarkdown(node) {
            // 递归转换常用 HTML 标签至 Markdown
            function walk(el) {
                if (!el) return '';
                if (el.nodeType === Node.TEXT_NODE) {
                    return el.textContent;
                }
                if (el.nodeType !== Node.ELEMENT_NODE) return '';

                const tag = el.tagName.toLowerCase();

                // 忽略不可见或无用节点
                if (['script', 'style', 'noscript', 'button'].includes(tag)) return '';

                // 处理代码块
                if (tag === 'pre') {
                    const code = el.querySelector('code');
                    const lang = (code && (code.className.match(/language-(\w+)/) || code.className.match(/lang-(\w+)/)))?.[1] || '';
                    const text = (code ? code.innerText : el.innerText).trim();
                    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
                }
                if (tag === 'code' && el.parentNode.tagName.toLowerCase() !== 'pre') {
                    return ` \`${el.innerText.trim()}\` `;
                }

                // 处理标题
                if (/^h[1-6]$/.test(tag)) {
                    const level = parseInt(tag[1], 10);
                    const prefix = '#'.repeat(level);
                    return `\n\n${prefix} ${el.innerText.trim()}\n\n`;
                }

                // 处理排版标签
                if (tag === 'p') {
                    let childrenText = Array.from(el.childNodes).map(walk).join('');
                    return `\n\n${childrenText.trim()}\n\n`;
                }
                if (tag === 'strong' || tag === 'b') {
                    return `**${Array.from(el.childNodes).map(walk).join('').trim()}**`;
                }
                if (tag === 'em' || tag === 'i') {
                    return `*${Array.from(el.childNodes).map(walk).join('').trim()}*`;
                }
                if (tag === 'del' || tag === 's') {
                    return `~~${Array.from(el.childNodes).map(walk).join('').trim()}~~`;
                }
                if (tag === 'blockquote') {
                    const text = Array.from(el.childNodes).map(walk).join('').trim();
                    return `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n`;
                }

                // 链接与图片
                if (tag === 'a') {
                    const href = el.getAttribute('href');
                    const text = Array.from(el.childNodes).map(walk).join('').trim() || href;
                    return href ? `[${text}](${href})` : text;
                }
                if (tag === 'img') {
                    const src = el.getAttribute('data-src') || el.getAttribute('data-original') || el.src;
                    const alt = el.getAttribute('alt') || 'image';
                    return src ? `\n\n![${alt}](${src})\n\n` : '';
                }

                // 列表
                if (tag === 'li') {
                    return `\n- ${Array.from(el.childNodes).map(walk).join('').trim()}`;
                }

                return Array.from(el.childNodes).map(walk).join('');
            }

            return walk(node)
                .split('\n')
                .map(line => line.trim())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        },

        printPDF() {
            showToast('准备打印/导出 PDF...');
            setTimeout(() => {
                window.print();
            }, 300);
        }
    };

    // ==========================================
    //  13. UI 组件：悬浮工具坞 (Floating Dock) & 设置面板
    // ==========================================
    class SettingsUI {
        constructor() {
            this.dock = null;
            this.modal = null;
        }

        init() {
            this.injectCSS();
            if (config.showFloatingDock) {
                this.renderDock();
            }
            this.renderModal();
            this.bindGlobalKeys();
            this.registerTampermonkeyMenu();
        }

        injectCSS() {
            safeAddStyle(`
                /* Toast 提示 */
                #pure-toast {
                    position: fixed;
                    bottom: 36px;
                    left: 50%;
                    transform: translateX(-50%) translateY(20px);
                    background: ${THEME.surfaceDarkElevated};
                    color: ${THEME.canvas};
                    padding: 9px 20px;
                    border-radius: 999px;
                    font-size: 13.5px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.18);
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 2147483647;
                }
                #pure-toast.pure-show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }

                /* 全局控件强样式隔离：重置宿主网页针对 button, input, svg 等的样式污染 */
                #pure-dock, #pure-dock *,
                #pure-zen-overlay, #pure-zen-overlay *,
                #pure-toc-panel, #pure-toc-panel *,
                #pure-modal-mask, #pure-modal-mask *,
                #pure-toast {
                    box-sizing: border-box !important;
                    letter-spacing: normal !important;
                }

                /* 悬浮工具坞 */
                #pure-dock {
                    position: fixed;
                    right: 20px;
                    bottom: 75px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    background: rgba(250, 249, 245, 0.88);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid ${THEME.hairline};
                    border-radius: 28px;
                    padding: 8px 6px;
                    margin: 0 !important;
                    box-shadow: ${THEME.shadow};
                    z-index: 2147483630;
                    transition: all 0.2s ease;
                    user-select: none;
                }
                #pure-dock .pure-dock-btn {
                    width: 38px !important;
                    min-width: 38px !important;
                    max-width: 38px !important;
                    height: 38px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                    border-radius: 50% !important;
                    border: none !important;
                    outline: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background: transparent;
                    color: ${THEME.body};
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer;
                    transition: all 0.18s ease;
                    position: relative;
                    flex-shrink: 0 !important;
                    line-height: normal !important;
                }
                #pure-dock .pure-dock-btn + .pure-dock-btn {
                    margin-left: 0 !important;
                }
                #pure-dock .pure-dock-btn:hover {
                    background: ${THEME.surfaceCard};
                    color: ${THEME.primary};
                    transform: scale(1.08);
                }
                #pure-dock .pure-dock-btn svg,
                #pure-dock .pure-dock-btn svg * {
                    width: 19px !important;
                    height: 19px !important;
                    stroke-width: 2;
                    pointer-events: none;
                }
                #pure-dock .pure-dock-divider {
                    width: 22px;
                    height: 1px;
                    background: ${THEME.hairline};
                    margin: 2px 0 !important;
                    padding: 0 !important;
                }

                /* 悬浮大纲面板 */
                #pure-toc-panel {
                    position: fixed;
                    top: 80px;
                    right: 75px;
                    width: 290px;
                    max-height: calc(100vh - 140px);
                    background: rgba(250, 249, 245, 0.94);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid ${THEME.hairline};
                    border-radius: 14px;
                    box-shadow: ${THEME.shadow};
                    display: flex;
                    flex-direction: column;
                    z-index: 2147483635;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateX(15px);
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                #pure-toc-panel.pure-toc-show {
                    opacity: 1;
                    pointer-events: auto;
                    transform: translateX(0);
                }
                .pure-toc-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-bottom: 1px solid ${THEME.hairline};
                }
                .pure-toc-title {
                    font-size: 13.5px;
                    font-weight: 600;
                    color: ${THEME.ink};
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .pure-toc-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    color: ${THEME.muted};
                    cursor: pointer;
                    line-height: 1;
                }
                .pure-toc-list {
                    padding: 8px 10px 14px 10px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .pure-toc-item {
                    font-size: 13px;
                    color: ${THEME.body};
                    text-decoration: none;
                    padding: 5px 8px;
                    border-radius: 6px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    transition: all 0.15s ease;
                }
                .pure-toc-item:hover {
                    background: ${THEME.surfaceCard};
                    color: ${THEME.primary};
                }
                .pure-toc-item.pure-active {
                    background: rgba(204, 120, 92, 0.12);
                    color: ${THEME.primary};
                    font-weight: 600;
                }
                .pure-toc-l2 { padding-left: 16px; font-size: 12.5px; opacity: 0.9; }
                .pure-toc-l3 { padding-left: 26px; font-size: 12px; opacity: 0.8; }
                .pure-toc-l4 { padding-left: 36px; font-size: 11.5px; opacity: 0.7; }

                /* 沉浸式极简阅读视图 */
                #pure-zen-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483640;
                    display: none;
                    flex-direction: column;
                    transition: background-color 0.25s ease;
                }
                #pure-zen-overlay.pure-zen-active {
                    display: flex;
                }
                .pure-zen-toolbar {
                    height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 28px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                    user-select: none;
                }
                .pure-zen-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .pure-zen-logo {
                    font-size: 16px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    color: ${THEME.primary};
                }
                .pure-zen-badge {
                    font-size: 11.5px;
                    padding: 2px 7px;
                    border-radius: 99px;
                    background: rgba(204, 120, 92, 0.12);
                    color: ${THEME.primary};
                }
                .pure-zen-controls {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .pure-zen-themes {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .pure-theme-btn {
                    width: 20px !important;
                    min-width: 20px !important;
                    max-width: 20px !important;
                    height: 20px !important;
                    min-height: 20px !important;
                    max-height: 20px !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border-radius: 50% !important;
                    border: 2px solid transparent !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                    cursor: pointer;
                    transition: transform 0.15s;
                    flex-shrink: 0 !important;
                    display: inline-block !important;
                    line-height: 1 !important;
                }
                .pure-theme-btn + .pure-theme-btn {
                    margin-left: 0 !important;
                }
                .pure-theme-btn:hover { transform: scale(1.15); }
                .pure-theme-btn.active { border-color: ${THEME.primary} !important; transform: scale(1.15); }
                .pure-theme-btn.cream { background: #fbf9f4 !important; border: 1px solid #dcd8cf !important; }
                .pure-theme-btn.green { background: #edf5ec !important; border: 1px solid #c9dcc8 !important; }
                .pure-theme-btn.white { background: #ffffff !important; border: 1px solid #dcd8cf !important; }
                .pure-theme-btn.dark { background: #1a1a19 !important; border: 1px solid #333330 !important; }

                .pure-zen-divider {
                    width: 1px;
                    height: 18px;
                    background: rgba(0, 0, 0, 0.1);
                    margin: 0 4px !important;
                    padding: 0 !important;
                }
                .pure-zen-btn {
                    background: none;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    padding: 4px 9px !important;
                    margin: 0 !important;
                    border-radius: 6px !important;
                    font-size: 12.5px !important;
                    cursor: pointer;
                    color: inherit !important;
                    transition: all 0.15s ease;
                    box-sizing: border-box !important;
                    line-height: normal !important;
                    height: auto !important;
                    flex-shrink: 0 !important;
                    outline: none !important;
                }
                .pure-zen-btn + .pure-zen-btn {
                    margin-left: 0 !important;
                }
                .pure-zen-btn:hover {
                    border-color: ${THEME.primary} !important;
                    color: ${THEME.primary} !important;
                }
                .pure-font-val {
                    font-size: 12.5px !important;
                    min-width: 36px;
                    text-align: center;
                    margin: 0 4px !important;
                    padding: 0 !important;
                    line-height: normal !important;
                }
                .pure-zen-scroll-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 48px 24px 80px 24px;
                    scroll-behavior: smooth;
                }
                .pure-zen-container {
                    margin: 0 auto;
                    transition: max-width 0.2s ease, font-size 0.2s ease;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                }
                .pure-zen-title {
                    font-size: 1.85em;
                    line-height: 1.35;
                    font-weight: 700;
                    margin-bottom: 28px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                }
                .pure-zen-content p {
                    margin-bottom: 1.5em;
                }
                .pure-zen-content img {
                    display: block;
                    max-width: 100%;
                    margin: 24px auto;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
                }
                .pure-zen-content pre {
                    background: rgba(0, 0, 0, 0.04);
                    padding: 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                    font-size: 0.9em;
                    line-height: 1.5;
                    margin: 20px 0;
                    font-family: "JetBrains Mono", Consolas, Monaco, monospace;
                }

                /* 主题着色 */
                #pure-zen-overlay[data-theme="cream"] { background: #fbf9f4; color: #2d2b28; }
                #pure-zen-overlay[data-theme="green"] { background: #edf5ec; color: #243324; }
                #pure-zen-overlay[data-theme="white"] { background: #ffffff; color: #1a1a1a; }
                #pure-zen-overlay[data-theme="dark"] { background: #161615; color: #dcdad5; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-toolbar { border-bottom-color: #262524; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-btn { border-color: #333330; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-divider { background: #333330; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-title { border-bottom-color: #262524; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content pre { background: #222220; color: #e6e4df; }

                /* 设置模态面板 (Anthropic Warm Style) */
                #pure-modal-mask {
                    position: fixed;
                    inset: 0;
                    background: rgba(20, 20, 19, 0.4);
                    backdrop-filter: blur(4px);
                    z-index: 2147483645;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    animation: pureFadeIn 0.2s ease;
                }
                #pure-modal-mask.pure-modal-show {
                    display: flex;
                }
                #pure-modal {
                    width: 520px;
                    max-width: 92vw;
                    background: ${THEME.canvas};
                    border: 1px solid ${THEME.hairline};
                    border-radius: 16px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.16);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .pure-modal-header {
                    padding: 16px 22px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid ${THEME.hairline};
                }
                .pure-modal-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: ${THEME.ink};
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .pure-modal-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: ${THEME.muted};
                    cursor: pointer;
                }
                .pure-modal-body {
                    padding: 18px 22px;
                    max-height: 68vh;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                .pure-group-title {
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    font-weight: 600;
                    color: ${THEME.muted};
                    margin-bottom: 8px;
                }
                .pure-setting-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid ${THEME.hairlineSoft};
                }
                .pure-setting-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .pure-setting-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: ${THEME.ink};
                }
                .pure-setting-desc {
                    font-size: 12px;
                    color: ${THEME.muted};
                }
                /* Switch 开关 */
                .pure-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                    flex-shrink: 0;
                }
                .pure-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .pure-slider {
                    position: absolute;
                    cursor: pointer;
                    inset: 0;
                    background-color: #d1cdc7;
                    transition: .25s;
                    border-radius: 24px;
                }
                .pure-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .25s;
                    border-radius: 50%;
                }
                input:checked + .pure-slider {
                    background-color: ${THEME.primary};
                }
                input:checked + .pure-slider:before {
                    transform: translateX(20px);
                }

                .pure-modal-footer {
                    padding: 12px 22px;
                    background: ${THEME.surfaceSoft};
                    border-top: 1px solid ${THEME.hairline};
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .pure-btn-primary {
                    background: ${THEME.primary};
                    color: white;
                    border: none;
                    padding: 7px 16px;
                    border-radius: 8px;
                    font-size: 13.5px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .pure-btn-primary:hover { background: ${THEME.primaryActive}; }

                @keyframes pureFadeIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }

                /* 打印优化 */
                @media print {
                    #pure-dock, #pure-toc-panel, #pure-modal-mask,
                    .csdn-side-toolbar, #rightAside, .Question-sideColumn,
                    .sidebar, aside, footer {
                        display: none !important;
                    }
                }
            `);
        }

        renderDock() {
            document.querySelectorAll('#pure-dock').forEach(el => el.remove());
            this.dock = document.createElement('div');
            this.dock.id = 'pure-dock';
            this.dock.innerHTML = `
                <!-- 沉浸阅读 -->
                <button class="pure-dock-btn" id="pure-dock-zen" title="沉浸阅读模式 (Alt+R)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </button>
                <!-- 大纲目录 -->
                <button class="pure-dock-btn" id="pure-dock-toc" title="文章大纲 (Alt+T)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h10M4 18h14"/></svg>
                </button>
                <div class="pure-dock-divider"></div>
                <!-- 导出 Markdown -->
                <button class="pure-dock-btn" id="pure-dock-md" title="导出 Markdown">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <!-- 打印 / PDF -->
                <button class="pure-dock-btn" id="pure-dock-pdf" title="打印 / 存为 PDF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
                <div class="pure-dock-divider"></div>
                <!-- 设置面板 -->
                <button class="pure-dock-btn" id="pure-dock-settings" title="阅读设置">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
            `;
            document.body.appendChild(this.dock);

            // 绑定 Dock 事件
            this.dock.querySelector('#pure-dock-zen').addEventListener('click', () => zenInstance.toggle());
            this.dock.querySelector('#pure-dock-toc').addEventListener('click', () => tocInstance.toggle());
            this.dock.querySelector('#pure-dock-md').addEventListener('click', () => Exporter.exportMarkdown());
            this.dock.querySelector('#pure-dock-pdf').addEventListener('click', () => Exporter.printPDF());
            this.dock.querySelector('#pure-dock-settings').addEventListener('click', () => this.openModal());
        }

        renderModal() {
            document.querySelectorAll('#pure-modal-mask').forEach(el => el.remove());
            this.modal = document.createElement('div');
            this.modal.id = 'pure-modal-mask';
            this.modal.innerHTML = `
                <div id="pure-modal">
                    <div class="pure-modal-header">
                        <div class="pure-modal-title">
                            <span style="color:${THEME.primary}; font-weight:700;">PureRead</span> 纯净阅读设置
                        </div>
                        <button class="pure-modal-close">&times;</button>
                    </div>
                    <div class="pure-modal-body">
                        <div>
                            <div class="pure-group-title">通用阅读增强</div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">解除复制限制与版权小尾巴</div>
                                    <div class="pure-setting-desc">阻止平台强加版权后缀，恢复自由选中和复制</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="unblockCopy" ${config.unblockCopy ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">外链直达跳转</div>
                                    <div class="pure-setting-desc">跳过知乎/CSDN/掘金的“即将离开”中转确认页</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="bypassRedirect" ${config.bypassRedirect ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">拦截广告与营销横幅</div>
                                    <div class="pure-setting-desc">移除页面广告、推荐位、侧栏横幅与弹窗</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="removeAds" ${config.removeAds ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">自动展开全文</div>
                                    <div class="pure-setting-desc">自动点击“展开阅读全文”无需手动翻阅</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="autoExpandContent" ${config.autoExpandContent ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">拦截未登录遮罩与弹窗</div>
                                    <div class="pure-setting-desc">阻止免登录浏览时的全屏登录弹窗阻断</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="blockLoginModal" ${config.blockLoginModal ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">代码块免登录一键复制</div>
                                    <div class="pure-setting-desc">解除 CSDN 等代码块的“登录后复制”强制要求</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="enableCodeCopy" ${config.enableCodeCopy ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                        </div>

                        <div>
                            <div class="pure-group-title">界面与交互</div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">显示右下角悬浮工具坞 (Dock)</div>
                                    <div class="pure-setting-desc">常驻右下角，提供快速沉浸阅读与大纲访问</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="showFloatingDock" ${config.showFloatingDock ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">启用智能悬浮大纲 (TOC)</div>
                                    <div class="pure-setting-desc">自动扫描提取长文 H1-H4 目录</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="enableFloatingTOC" ${config.enableFloatingTOC ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">净化/隐藏平台顶部导航栏</div>
                                    <div class="pure-setting-desc">移除 CSDN、掘金、博客园、简书等臃肿的吸顶栏与头部横幅</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="hideTopNav" ${config.hideTopNav ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">宽屏大视野排版 (自适应加宽)</div>
                                    <div class="pure-setting-desc">将各平台正文宽度拓宽至 1000~1200px，大幅提升长代码与表格的阅读舒适度</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="wideArticleLayout" ${config.wideArticleLayout ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                        </div>
                    </div>
                    <div class="pure-modal-footer">
                        <button class="pure-btn-primary" id="pure-save-btn">保存并生效</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.modal);

            this.modal.querySelector('.pure-modal-close').addEventListener('click', () => this.closeModal());
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });

            this.modal.querySelector('#pure-save-btn').addEventListener('click', () => {
                this.modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
                    const key = input.getAttribute('data-key');
                    if (key) config[key] = input.checked;
                });
                saveConfig(config);
                this.closeModal();
                showToast('设置已保存！');
                setTimeout(() => window.location.reload(), 600);
            });
        }

        openModal() {
            if (this.modal) this.modal.classList.add('pure-modal-show');
        }

        closeModal() {
            if (this.modal) this.modal.classList.remove('pure-modal-show');
        }

        bindGlobalKeys() {
            window.addEventListener('keydown', (e) => {
                // Alt + R: 沉浸阅读
                if (e.altKey && (e.key === 'r' || e.key === 'R')) {
                    e.preventDefault();
                    zenInstance.toggle();
                }
                // Alt + T: 大纲
                if (e.altKey && (e.key === 't' || e.key === 'T')) {
                    e.preventDefault();
                    tocInstance.toggle();
                }
            });
        }

        registerTampermonkeyMenu() {
            if (typeof GM_registerMenuCommand !== 'undefined') {
                GM_registerMenuCommand('📖 沉浸阅读模式 (Alt+R)', () => zenInstance.toggle());
                GM_registerMenuCommand('📑 文章大纲目录 (Alt+T)', () => tocInstance.toggle());
                GM_registerMenuCommand('📥 导出为 Markdown', () => Exporter.exportMarkdown());
                GM_registerMenuCommand('🖨️ 打印 / 存为 PDF', () => Exporter.printPDF());
                GM_registerMenuCommand('⚙️ 打开纯净阅读设置', () => this.openModal());
            }
        }
    }

    // ==========================================
    //  14. 入口初始化
    // ==========================================
    const ui = new SettingsUI();

    function onDOMLoaded() {
        ui.init();
        if (config.enableFloatingTOC) {
            setTimeout(() => tocInstance.init(), 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMLoaded);
    } else {
        onDOMLoaded();
    }

})();
