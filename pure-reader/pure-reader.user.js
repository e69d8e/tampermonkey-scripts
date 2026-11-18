// ==UserScript==
// @name         纯净阅读 (PureReader) - 沉浸阅读与通用排版增强
// @namespace    https://github.com/e69d8e/tampermonkey-scripts
// @version      0.1.0
// @description  支持 CSDN、知乎、掘金、简书、博客园、微信公众号深度净化，并内置全网兜底通用阅读模式（轻量启发式正文识别、沉浸阅读、悬浮大纲、Markdown/PDF 导出）与可视化元素橡皮擦（按域名持久隐藏干扰元素）。
// @author       YH
// @match        http://*/*
// @match        https://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zhihu.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @run-at       document-start
// @noframes
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
    function safeAddStyle(css, id) {
        if (typeof GM_addStyle !== 'undefined') {
            try {
                const el = GM_addStyle(css);
                if (el && id && !el.id) el.id = id;
                return el;
            } catch (e) { /* 回退至 DOM/MutationObserver 挂载 */ }
        }
        const style = document.createElement('style');
        if (id) style.id = id;
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

        // 全网通用阅读模式 (Universal Fallback)
        enableUniversalFallback: true,  // 在未知域名启用启发式正文识别与阅读套件
        universalDockMode: 'auto',      // 'auto' | 'always' | 'manual'
        ignoredDockDomains: [],         // 不自动展示悬浮工具坞的域名列表

        // UI 悬浮 Dock
        showFloatingDock: true
    };

    const CONFIG_KEY = 'pureReaderConfig';
    const ZAPPER_RULES_KEY = 'pureReaderZapperRules';

    function loadConfig() {
        let merged = null;
        if (typeof GM_getValue !== 'undefined') {
            const saved = GM_getValue(CONFIG_KEY, null);
            merged = Object.assign({}, DEFAULT_CONFIG, saved || {});
        } else {
            try {
                const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
                merged = Object.assign({}, DEFAULT_CONFIG, saved || {});
            } catch (e) {
                merged = Object.assign({}, DEFAULT_CONFIG);
            }
        }
        if (!Array.isArray(merged.ignoredDockDomains)) {
            merged.ignoredDockDomains = [];
        }
        if (!['auto', 'always', 'manual'].includes(merged.universalDockMode)) {
            merged.universalDockMode = 'auto';
        }
        return merged;
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
    //  3. 平台检测、Zapper 规则存储与上下文
    // ==========================================
    const host = window.location.hostname;
    const isCSDN = host.includes('csdn.net');
    const isZhihu = host.includes('zhihu.com');
    const isJuejin = host.includes('juejin.cn');
    const isJianshu = host.includes('jianshu.com');
    const isCnblogs = host.includes('cnblogs.com');
    const isWeixin = host.includes('mp.weixin.qq.com');
    const isKnownPlatform = isCSDN || isZhihu || isJuejin || isJianshu || isCnblogs || isWeixin;

    const ZapperStore = {
        loadAll() {
            let raw = null;
            if (typeof GM_getValue !== 'undefined') {
                raw = GM_getValue(ZAPPER_RULES_KEY, null);
            } else {
                try {
                    raw = JSON.parse(localStorage.getItem(ZAPPER_RULES_KEY));
                } catch (e) {
                    raw = null;
                }
            }
            return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        },
        saveAll(map) {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(ZAPPER_RULES_KEY, map);
            }
            try {
                localStorage.setItem(ZAPPER_RULES_KEY, JSON.stringify(map));
            } catch (e) { /* ignore */ }
        },
        getForHost(targetHost = host) {
            const map = this.loadAll();
            const list = map[targetHost];
            return Array.isArray(list) ? list.slice() : [];
        },
        addRule(selector, label, targetHost = host) {
            const cleanSel = String(selector || '').trim();
            if (!cleanSel) return false;
            const map = this.loadAll();
            const list = Array.isArray(map[targetHost]) ? map[targetHost].slice() : [];
            if (list.some(r => r && r.selector === cleanSel)) {
                return false;
            }
            list.push({
                selector: cleanSel,
                label: String(label || cleanSel).slice(0, 80),
                createdAt: Date.now()
            });
            map[targetHost] = list;
            this.saveAll(map);
            return true;
        },
        removeRule(selector, targetHost = host) {
            const map = this.loadAll();
            const list = Array.isArray(map[targetHost]) ? map[targetHost] : [];
            const next = list.filter(r => r && r.selector !== selector);
            if (next.length === 0) {
                delete map[targetHost];
            } else {
                map[targetHost] = next;
            }
            this.saveAll(map);
        },
        clearHost(targetHost = host) {
            const map = this.loadAll();
            if (map[targetHost]) {
                delete map[targetHost];
                this.saveAll(map);
            }
        },
        getTotalHostCount() {
            const map = this.loadAll();
            return Object.keys(map).filter(k => Array.isArray(map[k]) && map[k].length > 0).length;
        }
    };

    function isAuthPage() {
        const path = window.location.pathname || '';
        return /^(passport|accounts|auth|sso|login|oauth)\./i.test(host) ||
               host.includes('passport.') ||
               /^\/(signin|login|signup|register|account\/login|oauth|auth\/login)\b/i.test(path);
    }

    function isPureUiElement(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.id && node.id.startsWith('pure-')) return true;
        return !!node.closest?.('#pure-dock, #pure-toc-panel, #pure-zen-overlay, #pure-modal-mask, #pure-zapper-hud, #pure-zapper-highlight, #pure-toast');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeMediaUrl(src) {
        if (!src) return '';
        const trimmed = src.trim();
        return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    }

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
        if (isAuthPage() || window.__pureStartCssInjected) return;
        window.__pureStartCssInjected = true;
        const rules = [];

        // 全局基础抗阻断样式：已知平台全覆盖，未知域名仅聚焦语义阅读容器，避免影响 Web 应用交互控件
        if (config.unblockCopy) {
            if (isKnownPlatform) {
                rules.push(`
                    html, body, article, main, .article-content, #article_content,
                    #js_content, #js_content *, .rich_media_content, .rich_media_content *,
                    ._2rhmJa, ._2rhmJa *, #cnblogs_post_body, #cnblogs_post_body *,
                    .RichContent, .RichContent *, .post_body, .post_body *,
                    .markdown-body, .markdown-body *, pre, pre *, code, code * {
                        -webkit-user-select: text !important;
                        user-select: text !important;
                    }
                `);
            } else {
                rules.push(`
                    article, article *, main, .article-content, .post-content,
                    .entry-content, .post-body, .prose, [itemprop="articleBody"],
                    .markdown-body, .markdown-body *, pre, pre *, code, code * {
                        -webkit-user-select: text !important;
                        user-select: text !important;
                    }
                `);
            }
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
                    .OpenInAppButton, .css-woosw9, .KanshanCornerButton,
                    .CornerButtons--kanshan, .css-1ynzxqw, .css-1m8koxr, .css-1p2r0e3 {
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
                    .QuestionHeader, .QuestionHeader-footer, .QuestionHeader-footer-inner {
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .QuestionHeader-main {
                        width: auto !important;
                        flex: 1 1 auto !important;
                        min-width: 0 !important;
                        padding-left: 0 !important;
                    }
                    .QuestionHeader-side {
                        flex-shrink: 0 !important;
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
                `);
            }
            if (config.removeAds) {
                rules.push(`
                    .download-app-guidance, .call-app-btn, aside, footer,
                    .note-comment, .recommended-notes, .ant-modal-root,
                    ._3Pnjry, [class^="ad-"], [class*=" ad-"], [class*="-ad-"],
                    [class$="-ad"], .app-open-guide {
                        display: none !important;
                    }
                `);
            }
            if (config.jianshu_removeAppPrompt || config.wideArticleLayout) {
                const jianshuMaxWidth = config.wideArticleLayout ? '1000px' : '860px';
                rules.push(`
                    ._3Pnjry {
                        display: none !important;
                    }
                    div._3VRLsv {
                        width: 100% !important;
                        max-width: ${jianshuMaxWidth} !important;
                        margin: 0 auto !important;
                        justify-content: center !important;
                        box-sizing: border-box !important;
                    }
                    div._gp-ck, section.ouvJEz, article._2rhmJa {
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

    let zapperStyleEl = null;
    let zapperStaticInjected = false;
    const ZAPPER_NOT_UI = ':not(#pure-dock):not(#pure-toc-panel):not(#pure-zen-overlay):not(#pure-modal-mask):not(#pure-zapper-hud):not(#pure-zapper-highlight):not(#pure-toast)';

    function applyZapperCSS() {
        if (isAuthPage()) return { liveUpdated: true };
        const rules = ZapperStore.getForHost();
        const cssLines = [];
        for (const rule of rules) {
            if (!rule || typeof rule.selector !== 'string') continue;
            const sel = rule.selector.trim();
            if (!sel || /^(html|body|\*)$/i.test(sel) || sel.includes(',')) continue;
            cssLines.push(`${sel}${ZAPPER_NOT_UI} { display: none !important; visibility: hidden !important; }`);
        }
        const css = cssLines.join('\n');

        if (zapperStyleEl && 'textContent' in zapperStyleEl) {
            zapperStyleEl.textContent = css;
            return { liveUpdated: true };
        }
        if (!css) {
            return { liveUpdated: !zapperStaticInjected };
        }

        const el = safeAddStyle(css, 'pure-zapper-style');
        if (el && 'textContent' in el) {
            zapperStyleEl = el;
            return { liveUpdated: true };
        }
        zapperStaticInjected = true;
        return { liveUpdated: false };
    }

    injectStartCSS();
    applyZapperCSS();

    // ==========================================
    //  5. 核心拦截器：防复制解禁与剪贴板净化
    // ==========================================
    function setupCopyGuard() {
        if (!config.unblockCopy || isAuthPage() || window.__pureCopyGuardBound) return;
        window.__pureCopyGuardBound = true;

        // 1. 捕获阶段优先于宿主事件拦截 copy，阻断版权后缀篡改，同时尽量保留富文本剪贴板数据
        window.addEventListener('copy', function (e) {
            if (isPureUiElement(e.target)) return;
            const active = e.target;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                return;
            }

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const text = selection.toString();
            if (!text || text.length === 0) return;

            // 清洗选区文本本身含有的版权声明小尾巴
            const cleanText = text
                .replace(/\n*————————————————\n*版权声明：本文为.*?\n*原文链接：.*$/gis, '')
                .replace(/\n*著作权归作者所有.*$/gis, '')
                .replace(/\n*作者：.*?\n*链接：.*?\n*来源：知乎.*$/gis, '')
                .replace(/\n*商业转载请联系作者获得授权.*$/gis, '')
                .replace(/\n*来源：简书.*$/gis, '')
                .replace(/\n*本作品采用.*许可协议.*$/gis, '');

            // 已知平台或文本确实存在小尾巴时才阻断宿主 copy 监听器，避免干扰未知 Web 应用（如表格/设计工具）自身剪贴板逻辑
            const insideArticle = !!(e.target && e.target.closest?.('article, .article-content, .post-content, .entry-content, .prose, [itemprop="articleBody"]'));
            if (isKnownPlatform || cleanText !== text || insideArticle) {
                e.stopImmediatePropagation();
            }

            // 仅在选区内容确实被净化改写时才接管 text/plain；否则放行浏览器原生富文本复制
            if (cleanText !== text) {
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', cleanText);
                    e.preventDefault();
                } else if (typeof GM_setClipboard !== 'undefined') {
                    GM_setClipboard(cleanText, 'text');
                    e.preventDefault();
                }
            }
        }, true);

        // 2. 清除 DOM 节点上的防复制/防右键限制（未知域名仅对静态阅读容器温和解锁）
        function unlockElements() {
            if (isKnownPlatform) {
                const blockedAttributes = ['oncopy', 'onselectstart', 'oncontextmenu', 'oncut'];
                blockedAttributes.forEach(attr => {
                    if (document[attr]) document[attr] = null;
                    if (document.body && document.body[attr]) document.body[attr] = null;
                });
                document.querySelectorAll('[style*="user-select"], #js_content').forEach(el => {
                    el.style.userSelect = 'text';
                    el.style.webkitUserSelect = 'text';
                });
            } else {
                document.querySelectorAll('article [style*="user-select"], .post-content [style*="user-select"], .entry-content [style*="user-select"]').forEach(el => {
                    el.style.userSelect = 'text';
                    el.style.webkitUserSelect = 'text';
                });
            }
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
        if (!config.bypassRedirect || isAuthPage()) return;

        function resolveRealUrl(href) {
            if (!href) return null;
            try {
                const url = new URL(href, window.location.href);
                let raw = null;

                // 知乎 / CSDN / 掘金: link.* /?target=...  |  简书: links.jianshu.com/go?to=...
                if (
                    (url.hostname === 'link.zhihu.com' ||
                     url.hostname === 'link.csdn.net' ||
                     url.hostname === 'link.juejin.cn') &&
                    url.searchParams.has('target')
                ) {
                    raw = url.searchParams.get('target');
                } else if (
                    url.hostname.includes('jianshu.com') &&
                    url.pathname.includes('/go') &&
                    url.searchParams.has('to')
                ) {
                    raw = url.searchParams.get('to');
                }

                if (!raw) return null;
                // URLSearchParams.get 已完成一次解码；仅在上游存在二次编码时再解一次，避免破坏 %25/%26 参数
                const candidate = /^https?%3A/i.test(raw) ? decodeURIComponent(raw) : raw;
                const parsed = new URL(candidate);
                return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null;
            } catch (e) {
                return null;
            }
        }

        function rewriteAnchor(anchor) {
            if (!anchor || anchor.dataset.pureDirect === 'true') return null;
            const realUrl = resolveRealUrl(anchor.href);
            if (realUrl) {
                anchor.href = realUrl;
                anchor.setAttribute('rel', 'noopener noreferrer');
                anchor.dataset.pureDirect = 'true';
            }
            return realUrl;
        }

        // 1. 捕获阶段点击事件代理
        document.addEventListener('click', function (e) {
            const anchor = e.target.closest?.('a');
            if (!anchor) return;
            const realUrl = resolveRealUrl(anchor.href);
            if (realUrl) {
                e.preventDefault();
                e.stopPropagation();
                window.open(realUrl, '_blank', 'noopener,noreferrer');
            }
        }, true);

        // 2. 鼠标悬停/聚焦时惰性改写动态注入的跳转链接
        const onLazyRewrite = (e) => {
            const anchor = e.target.closest?.('a');
            if (anchor) rewriteAnchor(anchor);
        };
        document.addEventListener('mouseover', onLazyRewrite, true);
        document.addEventListener('focusin', onLazyRewrite, true);

        // 3. 静态链接直接覆写 href（仅已知平台在初始化时主动扫描，未知站点依赖点击/悬停懒改写）
        function rewriteExistingLinks() {
            if (!isKnownPlatform) return;
            document.querySelectorAll('a[href*="target="], a[href*="to="]').forEach(rewriteAnchor);
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
    // 高频 DOM 变更合并执行:平台清理函数包含大量 querySelectorAll,
    // 直接挂在 MutationObserver 上会在动态页面造成明显卡顿
    function debounce(fn, wait) {
        let timer = null;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, wait);
        };
    }

    function observeNonPureMutations(callback, wait = 250) {
        const debounced = debounce(callback, wait);
        try {
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (!isPureUiElement(m.target)) {
                        debounced();
                        return;
                    }
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            return observer;
        } catch (e) {
            return null;
        }
    }

    function hideIfVisible(el) {
        if (el && el.style.display !== 'none') {
            el.style.display = 'none';
        }
    }

    function setupPlatformFixes() {
        if (isAuthPage() || window.__purePlatformFixed) return;
        window.__purePlatformFixed = true;

        // --- CSDN 修复 ---
        if (isCSDN) {
            function cleanCSDN() {
                if (isAuthPage()) return;
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

                // 代码块免登录一键复制与展开（仅处理尚未标记的 pre，避免全量回流）
                document.querySelectorAll('pre:not([data-pure-processed="true"])').forEach(pre => {
                    pre.dataset.pureProcessed = 'true';

                    // 自动展开折叠代码块
                    if (pre.classList.contains('set-code-hide') || pre.classList.contains('set-code-height')) {
                        pre.classList.remove('set-code-hide', 'set-code-height');
                        pre.classList.add('set-code-show');
                        pre.style.height = 'auto';
                        pre.style.maxHeight = 'none';
                    }
                    const lookMore = pre.querySelector('.hide-pre-bar, .look-more-pre');
                    if (lookMore) lookMore.remove();

                    // 清理代码块工具栏中的营销按钮/文案（跳过 code 内部高亮 span）
                    pre.querySelectorAll('.opt-box > *:not(.hljs-button), .box-highline > *:not(.hljs-button), pre > button:not(.hljs-button), .opt-box a').forEach(node => {
                        if (node.classList.contains('hljs-button')) return;
                        const txt = (node.textContent || '').trim();
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
            // 兜底轮询:仅在存在未处理 pre 或遮罩且页面可见时轻扫一次
            setInterval(() => {
                if (!document.hidden && !isAuthPage()) cleanCSDN();
            }, 2500);

            observeNonPureMutations(cleanCSDN, 250);

            // 拦截文章阅读区域内诱导或强制跳转 passport.csdn.net 登录页的链接点击
            if (config.blockLoginModal) {
                document.addEventListener('click', function (e) {
                    const a = e.target.closest?.('a');
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
                if (isAuthPage()) return;
                // 拦截并隐藏登录弹窗与锁屏
                if (config.blockLoginModal) {
                    // 仅隐藏而非移除:知乎为 React 应用,外部移除其受管节点可能引发渲染异常
                    document.querySelectorAll('.Modal-wrapper, .sign-flow-modal, .SignFlowModal, .css-woosw9, .KanshanCornerButton, .CornerButtons--kanshan')
                        .forEach(hideIfVisible);
                    // 兜底识别滚动后挂载的右下角固定登录催促卡（防止哈希类名轮换）
                    document.querySelectorAll('body > div').forEach(el => {
                        if (isPureUiElement(el) || el.style.display === 'none') return;
                        const txt = el.textContent || '';
                        if (txt.includes('登录即可查看') && txt.includes('立即登录/注册') && txt.length < 300) {
                            const cs = getComputedStyle(el);
                            if (cs.position === 'fixed') {
                                el.style.display = 'none';
                            }
                        }
                    });
                    document.documentElement.classList.remove('Modal-open');
                    document.body.classList.remove('Modal-open');
                    if (document.documentElement.style.overflow !== 'auto') {
                        document.documentElement.style.overflow = 'auto';
                    }
                    if (document.body && document.body.style.overflow !== 'auto') {
                        document.body.style.overflow = 'auto';
                    }
                }

                // 隐藏侧栏以腾出宽屏排版空间 (同上,不物理移除受管节点)
                if (config.zhihu_hideSideBar || config.wideArticleLayout) {
                    document.querySelectorAll('.Question-sideColumn, .GlobalWrite-nav, .QuestionPage-sideColumn')
                        .forEach(hideIfVisible);
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
            observeNonPureMutations(cleanZhihu, 250);
        }

        // --- 掘金 修复 ---
        if (isJuejin) {
            function cleanJuejin() {
                if (isAuthPage()) return;
                // 掘金为 Vue 应用,受管节点仅隐藏不移除,避免外部删除引发渲染异常
                if (config.hideTopNav) {
                    hideIfVisible(document.querySelector('header.main-header, .main-header-box, .header-container, header.juejin-header'));
                    const viewContainer = document.querySelector('.view-container');
                    if (viewContainer) {
                        if (viewContainer.style.paddingTop !== '0px') viewContainer.style.paddingTop = '0px';
                        if (viewContainer.style.marginTop !== '0px') viewContainer.style.marginTop = '0px';
                    }
                }
                if (config.removeAds || config.juejin_pureLayout || config.wideArticleLayout) {
                    hideIfVisible(document.querySelector('.suspension-panel'));
                    hideIfVisible(document.querySelector('.sidebar'));
                }
            }
            document.addEventListener('DOMContentLoaded', cleanJuejin);
            window.addEventListener('load', cleanJuejin);
            observeNonPureMutations(cleanJuejin, 300);
        }

        // --- 简书 修复 ---
        if (isJianshu) {
            function cleanJianshu() {
                if (isAuthPage()) return;
                // 简书为 React 应用,受管节点仅隐藏不移除
                if (config.hideTopNav) {
                    hideIfVisible(document.querySelector('header, nav.navbar, nav._213wzc, nav.navbar-fixed-top'));
                    if (document.body && document.body.style.paddingTop !== '0px') {
                        document.body.style.paddingTop = '0px';
                    }
                }
                if (config.removeAds || config.jianshu_removeAppPrompt || config.wideArticleLayout) {
                    document.querySelectorAll('aside, ._3Pnjry').forEach(hideIfVisible);
                }
                if (config.autoExpandContent) {
                    document.querySelectorAll('.collapse-free-content .read-more, .collapse-free-content button').forEach(btn => {
                        // 标记已点击,避免 MutationObserver 触发期间反复点击
                        if (!btn.dataset.pureClicked) {
                            btn.dataset.pureClicked = 'true';
                            btn.click();
                        }
                    });
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', cleanJianshu);
            } else {
                cleanJianshu();
            }
            window.addEventListener('load', cleanJianshu);
            observeNonPureMutations(cleanJianshu, 250);
        }

        // --- 博客园 修复 ---
        if (isCnblogs) {
            function cleanCnblogs() {
                // #top_nav/#header/#sideBar 等结构节点仅由 CSS 隐藏、不做物理移除:
                // 实测移除后博客园官方脚本 NavbarSearchManager 会因节点缺失抛 TypeError
                if (config.cnblogs_removeAds || config.wideArticleLayout) {
                    document.querySelectorAll(`
                        #cnblogs_c1, #cnblogs_c2, #cnblogs_b1, #cnblogs_b2,
                        #ad_t2, #under_post_news, #under_post_kb, #side_banner, #opt_under_post
                    `).forEach(el => el.remove());
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
    //  9. 正文提取与元数据解析器 (含通用启发式兜底)
    // ==========================================
    function findArticleElement(selectors) {
        for (const sel of selectors) {
            const matches = document.querySelectorAll(sel);
            for (const el of matches) {
                if (!isPureUiElement(el)) {
                    return el;
                }
            }
        }
        return null;
    }

    const UniversalExtractor = {
        CJK_REGEX: /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g,
        PUNCT_REGEX: /[,，.。;；:：!！?？、]/g,
        SKIP_TAGS: new Set([
            'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS',
            'TEMPLATE', 'DIALOG', 'NAV', 'HEADER', 'FOOTER', 'ASIDE',
            'FORM', 'SELECT', 'TEXTAREA', 'BUTTON'
        ]),
        BLOCK_CHILD_SELECTOR: 'p, div, article, section, ul, ol, table, blockquote, pre, h1, h2, h3, h4, h5, h6',
        HARD_REJECT_REGEX: /(^|[-_.\s])(comments?|comment-list|comment-section|comment-box|disqus|giscus|utterances|sidebar|side-bar|navbar|nav-bar|breadcrumbs?|cookie-banner|gdpr|newsletter|subscribe-box|subscription-widget|related-posts?|recommended-posts?|share-buttons?|social-share|ad-container|advert(?:isement)?|footer|masthead)($|[-_.\s])/i,
        SOFT_UNLIKELY_REGEX: /\b(banner|combx|community|extra|foot|header|menu|nav|outbrain|pager|pagination|popup|modal|promo|related|recommend|remark|share|shoutbox|skyscraper|sponsor|tags?|toolbar|widget)\b/i,
        OK_MAYBE_REGEX: /\b(and|article|body|column|content|entry|hentry|main|markdown|page|post|prose|read|story|text)\b/i,
        POSITIVE_CLASS_REGEX: /(article|body|content|entry|hentry|main|page|post|text|blog|story|prose|markdown|rich_media|articleBody)/i,
        NEGATIVE_CLASS_REGEX: /(combx|comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget|nav|menu|recommend|author-card|subscribe|newsletter)/i,

        _cache: null,

        clearCache() {
            this._cache = null;
        },

        getWeightedLength(str) {
            if (!str) return 0;
            const normalized = str.replace(/\s+/g, ' ').trim();
            if (!normalized) return 0;
            const cjkMatches = normalized.match(this.CJK_REGEX);
            const cjkCount = cjkMatches ? cjkMatches.length : 0;
            return normalized.length + cjkCount * 1.5;
        },

        getSignature(el) {
            if (!el || el.nodeType !== 1) return '';
            const cls = typeof el.className === 'string' ? el.className : '';
            const id = el.id || '';
            const role = el.getAttribute('role') || '';
            const itemprop = el.getAttribute('itemprop') || '';
            return `${id} ${cls} ${role} ${itemprop}`;
        },

        isHiddenElement(el) {
            if (!el || el.nodeType !== 1) return true;
            if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
            if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) return true;
            try {
                const cs = window.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') return true;
            } catch (e) { /* ignore */ }
            return false;
        },

        isHardRejected(el) {
            if (!el || el.nodeType !== 1) return true;
            if (isPureUiElement(el) || this.SKIP_TAGS.has(el.tagName)) return true;
            const sig = this.getSignature(el);
            return this.HARD_REJECT_REGEX.test(sig);
        },

        isUnlikelyNode(el) {
            if (this.isHardRejected(el)) return true;
            if (this.isHiddenElement(el)) return true;
            const sig = this.getSignature(el);
            if (!sig.trim()) return false;
            return this.SOFT_UNLIKELY_REGEX.test(sig) && !this.OK_MAYBE_REGEX.test(sig);
        },

        getLinkDensity(el) {
            const totalText = this.getWeightedLength(el.textContent || '');
            if (totalText === 0) return 0;
            let linkText = 0;
            const links = el.querySelectorAll('a');
            for (let i = 0; i < links.length; i++) {
                const a = links[i];
                const href = a.getAttribute('href') || '';
                const txt = (a.textContent || '').trim();
                if (href.startsWith('#') && txt.length <= 3) continue;
                linkText += this.getWeightedLength(txt);
            }
            return Math.min(1, linkText / totalText);
        },

        getClassWeight(el) {
            let weight = 0;
            if (el.tagName === 'ARTICLE') weight += 25;
            else if (el.tagName === 'MAIN') weight += 15;
            else if (el.tagName === 'SECTION' || el.tagName === 'DIV') weight += 5;
            else if (el.tagName === 'TD') weight -= 5;

            const sig = this.getSignature(el);
            if (this.POSITIVE_CLASS_REGEX.test(sig)) weight += 25;
            if (this.NEGATIVE_CLASS_REGEX.test(sig)) weight -= 25;
            return weight;
        },

        getDirectInlineText(el) {
            let buf = '';
            const children = el.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    buf += ' ' + child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName;
                    if (['SPAN', 'STRONG', 'B', 'EM', 'I', 'A', 'CODE', 'SMALL', 'MARK', 'FONT', 'SUB', 'SUP'].includes(tag)) {
                        buf += ' ' + child.textContent;
                    }
                }
            }
            return buf.replace(/\s+/g, ' ').trim();
        },

        collectBlocks(root) {
            const blocks = [];
            const walk = (el) => {
                if (!el || el.nodeType !== 1) return;
                if (this.isUnlikelyNode(el)) return;

                const tag = el.tagName;
                if (tag === 'P' || tag === 'PRE') {
                    blocks.push({ el, type: tag });
                    return;
                }
                if (tag === 'BLOCKQUOTE') {
                    if (!el.querySelector('p')) {
                        blocks.push({ el, type: 'BLOCKQUOTE' });
                        return;
                    }
                }
                if (tag === 'LI') {
                    if (!el.querySelector('p')) {
                        blocks.push({ el, type: 'LI' });
                        return;
                    }
                }
                if (tag === 'DIV' || tag === 'TD' || tag === 'SECTION' || tag === 'ARTICLE') {
                    const hasBlockChild = !!el.querySelector(this.BLOCK_CHILD_SELECTOR);
                    if (!hasBlockChild && (tag === 'DIV' || tag === 'TD')) {
                        blocks.push({ el, type: tag });
                        return;
                    }
                    // 兼容旧式博客/文章直接将裸文本与 <br> 混合写在容器内的情况
                    if (hasBlockChild) {
                        const directText = this.getDirectInlineText(el);
                        if (this.getWeightedLength(directText) >= 40) {
                            blocks.push({ el, type: 'DIRECT_TEXT', textOverride: directText });
                        }
                    }
                }

                const kids = el.children;
                for (let i = 0; i < kids.length; i++) {
                    walk(kids[i]);
                }
            };
            walk(root);
            return blocks;
        },

        scoreCandidates() {
            if (!document.body) return [];
            const blocks = this.collectBlocks(document.body);
            const candidates = new Map();

            const ensureCandidate = (el) => {
                let entry = candidates.get(el);
                if (!entry) {
                    entry = {
                        el,
                        score: 0,
                        paraCount: 0,
                        totalWeightedText: 0,
                        linkDensity: 0,
                        finalScore: 0
                    };
                    candidates.set(el, entry);
                }
                return entry;
            };

            for (let i = 0; i < blocks.length; i++) {
                const blk = blocks[i];
                const rawText = blk.textOverride !== undefined ? blk.textOverride : (blk.el.textContent || '');
                const weightedLen = this.getWeightedLength(rawText);
                const minLen = blk.type === 'PRE' ? 40 : 25;
                if (weightedLen < minLen) continue;

                const blockLinkDensity = blk.type === 'DIRECT_TEXT' ? 0 : this.getLinkDensity(blk.el);
                if (blockLinkDensity > 0.55) continue;

                const punctCount = (rawText.match(this.PUNCT_REGEX) || []).length;
                let blockScore = 1 + Math.min(punctCount, 12) + Math.min(Math.floor(weightedLen / 100), 3);

                if (blk.type === 'BLOCKQUOTE') blockScore *= 0.85;
                else if (blk.type === 'PRE') blockScore = Math.min(blockScore, 6) * 0.55;
                else if (blk.type === 'LI') blockScore *= (weightedLen >= 45 && punctCount >= 1) ? 0.65 : 0.25;
                else if (blk.type === 'DIV' || blk.type === 'TD' || blk.type === 'DIRECT_TEXT') blockScore *= 0.85;

                const isSubstantialProse = weightedLen >= 40 && blk.type !== 'PRE' && (blk.type !== 'LI' || punctCount >= 1);

                // 向上传播得分至 3 层祖先容器 (1, 1/2, 1/3)
                const ancestors = [];
                let cur = blk.type === 'DIRECT_TEXT' ? blk.el : blk.el.parentElement;
                while (cur && cur !== document.body && cur !== document.documentElement && ancestors.length < 3) {
                    if (!this.isHardRejected(cur) && !isPureUiElement(cur)) {
                        ancestors.push(cur);
                    }
                    cur = cur.parentElement;
                }

                for (let level = 0; level < ancestors.length; level++) {
                    const divider = level === 0 ? 1 : level === 1 ? 2 : 3;
                    const entry = ensureCandidate(ancestors[level]);
                    entry.score += blockScore / divider;
                    entry.totalWeightedText += weightedLen;
                    if (isSubstantialProse) {
                        entry.paraCount += 1;
                    }
                }
            }

            const list = [];
            candidates.forEach((entry) => {
                const classWeight = this.getClassWeight(entry.el);
                entry.linkDensity = this.getLinkDensity(entry.el);
                const raw = entry.score + classWeight;
                entry.finalScore = entry.linkDensity > 0.6
                    ? raw * (1 - entry.linkDensity) * 0.2
                    : raw * (1 - entry.linkDensity);
                if (entry.finalScore > 0) {
                    list.push(entry);
                }
            });

            list.sort((a, b) => b.finalScore - a.finalScore);
            return list;
        },

        pickTighterWinner(sortedCandidates) {
            if (!sortedCandidates.length) return null;
            let winner = sortedCandidates[0];
            let changed = true;
            let guard = 0;

            // 若外层容器（如页面级布局壳）仅靠微小分数优势胜出，优先下钻到涵盖绝大部分正文的内层容器
            while (changed && guard < 4) {
                changed = false;
                guard += 1;
                for (let i = 0; i < sortedCandidates.length; i++) {
                    const cand = sortedCandidates[i];
                    if (cand === winner) continue;
                    if (
                        winner.el.contains(cand.el) &&
                        cand.finalScore >= winner.finalScore * 0.85 &&
                        cand.totalWeightedText >= winner.totalWeightedText * 0.78 &&
                        cand.paraCount >= 2
                    ) {
                        winner = cand;
                        changed = true;
                        break;
                    }
                }
            }

            // 若仅命中多 <section> 文章中的单一章节，向上合并至涵盖完整正文的语义父容器（优先 <article>）
            let parentMatch = null;
            for (let i = 0; i < sortedCandidates.length; i++) {
                const cand = sortedCandidates[i];
                if (cand === winner || cand.el === document.body || cand.el === document.documentElement) continue;
                if (
                    cand.el.contains(winner.el) &&
                    cand.linkDensity <= 0.42 &&
                    cand.totalWeightedText >= winner.totalWeightedText * 1.25 &&
                    (cand.el.tagName === 'ARTICLE' || winner.el.tagName === 'SECTION') &&
                    cand.finalScore >= 20 &&
                    !this.isMultiArticleFeed(cand.el)
                ) {
                    if (!parentMatch || (cand.el.tagName === 'ARTICLE' && parentMatch.el.tagName !== 'ARTICLE')) {
                        parentMatch = cand;
                    }
                }
            }
            if (parentMatch) {
                winner = parentMatch;
            }
            return winner;
        },

        isMultiArticleFeed(el) {
            if (!el || el.tagName === 'ARTICLE') return false;
            const nestedArticles = el.querySelectorAll('article');
            if (nestedArticles.length < 3) return false;
            let cardCount = 0;
            for (let i = 0; i < nestedArticles.length; i++) {
                if (nestedArticles[i].querySelector('h1 a, h2 a, h3 a')) {
                    cardCount += 1;
                }
            }
            return cardCount >= 3;
        },

        extractBestTitle(contentEl) {
            const rawDocTitle = (document.title || 'Untitled Article').trim();
            const isValidHeading = (txt) => txt && txt.length >= 3 && txt.length <= 220;

            // 1. 优先从正文容器内或邻近祖先寻找主标题 <h1>
            const scopes = [];
            if (contentEl) scopes.push(contentEl);
            if (contentEl && contentEl.parentElement) scopes.push(contentEl.parentElement);
            if (document.body) scopes.push(document.body);

            for (const scope of scopes) {
                const h1List = scope.querySelectorAll('h1');
                for (let i = 0; i < h1List.length; i++) {
                    const h1 = h1List[i];
                    if (isPureUiElement(h1) || this.isHiddenElement(h1)) continue;
                    if (h1.closest('nav, footer, aside')) continue;
                    const txt = (h1.innerText || h1.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!isValidHeading(txt)) continue;
                    // 若 h1 在全页作用域且位于 <header> 顶部导航标识中，仅当与 document.title 匹配时采纳
                    if (scope === document.body && h1.closest('header') && !rawDocTitle.toLowerCase().includes(txt.toLowerCase().slice(0, 12))) {
                        continue;
                    }
                    return txt;
                }
            }

            // 2. 尝试 OpenGraph 标题（仅当与当前 document.title 有语义重叠，防止 SPA 路由切换后 meta 滞后）
            const ogMeta = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
            const ogTitle = ogMeta ? (ogMeta.getAttribute('content') || '').trim() : '';
            if (ogTitle && ogTitle.length >= 4 && rawDocTitle.toLowerCase().includes(ogTitle.toLowerCase().slice(0, 10))) {
                return ogTitle;
            }

            // 3. 清洗 document.title 末尾的站点名称后缀
            const parts = rawDocTitle.split(/\s+(?:\||—|–|-|·)\s+/);
            if (parts.length >= 2) {
                const candidate = parts.slice(0, -1).join(' - ').trim();
                if (this.getWeightedLength(candidate) >= 6) {
                    return candidate;
                }
            }
            return rawDocTitle;
        },

        extract(options = {}) {
            const strict = Boolean(options.strict);
            const now = Date.now();
            const href = window.location.href;
            const nodeCount = document.body ? document.body.getElementsByTagName('*').length : 0;

            if (
                this._cache &&
                this._cache.href === href &&
                this._cache.strict === strict &&
                this._cache.nodeCount === nodeCount &&
                now - this._cache.timestamp < 800
            ) {
                return this._cache.result;
            }

            const sorted = this.scoreCandidates();
            const winner = this.pickTighterWinner(sorted);

            let contentEl = null;
            let isArticle = false;
            let score = 0;

            if (winner) {
                score = winner.finalScore;
                if (strict) {
                    const enoughParas = winner.paraCount >= 3 || (winner.paraCount >= 2 && winner.totalWeightedText >= 800);
                    const passesGate = (
                        winner.finalScore >= 22 &&
                        winner.totalWeightedText >= 450 &&
                        enoughParas &&
                        winner.linkDensity <= 0.45 &&
                        !this.isMultiArticleFeed(winner.el)
                    );
                    if (passesGate) {
                        contentEl = winner.el;
                        isArticle = true;
                    }
                } else {
                    if (winner.finalScore >= 5 && winner.totalWeightedText >= 100) {
                        contentEl = winner.el;
                        isArticle = true;
                    }
                }
            }

            // 手动触发模式下若启发式得分不足，回退至语义标签定位
            if (!contentEl && !strict) {
                contentEl = findArticleElement([
                    'article', 'main', '[itemprop="articleBody"]',
                    '.post-content', '.entry-content', '.article-content', '.markdown-body'
                ]);
                if (contentEl && this.getWeightedLength(contentEl.textContent || '') < 60) {
                    contentEl = null;
                }
            }

            const title = this.extractBestTitle(contentEl);
            const result = { title, contentEl, isArticle, score, source: 'universal' };
            this._cache = { href, strict, nodeCount, timestamp: now, result };
            return result;
        }
    };

    function extractArticleData(options = {}) {
        const strict = Boolean(options.strict);
        let title = document.title || 'Untitled Article';
        let contentEl = null;

        if (isKnownPlatform) {
            if (isCSDN) {
                title = document.querySelector('#articleContentId')?.innerText || document.title;
                contentEl = findArticleElement(['#article_content']);
            } else if (isZhihu) {
                // 知乎专栏或问答
                title = document.querySelector('.Post-Title')?.innerText ||
                        document.querySelector('.QuestionHeader-title')?.innerText ||
                        document.title;
                contentEl = findArticleElement(['.Post-RichTextContainer', '.RichContent-inner', '.QuestionAnswer-content']);
            } else if (isJuejin) {
                title = document.querySelector('.article-title')?.innerText || document.title;
                contentEl = findArticleElement([
                    '.article-viewer.markdown-body', '.markdown-body', '.article-viewer',
                    'article .main', '.article-content', '.main-area article'
                ]);
            } else if (isJianshu) {
                title = document.querySelector('h1')?.innerText || document.title;
                contentEl = findArticleElement(['article._2rhmJa', 'article', '._2rhmJa']);
            } else if (isCnblogs) {
                title = document.querySelector('#cb_post_title_url')?.innerText || document.title;
                contentEl = findArticleElement(['#cnblogs_post_body']);
            } else if (isWeixin) {
                title = document.querySelector('#activity-name')?.innerText || document.title;
                contentEl = findArticleElement(['#js_content']);
            }

            if (!contentEl && !strict) {
                contentEl = findArticleElement(['article', 'main', '.article', '.post-content']);
            }

            // 仅剥离已知的平台来源后缀,避免误伤标题中原本就含连字符/下划线的内容
            const cleaned = title.replace(/\s*[-–—_]\s*(CSDN博客|CSDN|博客园|稀土掘金|掘金|简书|知乎|微信公众号平台|微信开放社区)\s*$/i, '').trim();
            return { title: cleaned || title, contentEl, isArticle: Boolean(contentEl), source: 'platform' };
        }

        // 未知域名走全网兜底启发式提取引擎
        if (!config.enableUniversalFallback && !options.force) {
            return { title, contentEl: null, isArticle: false, source: 'disabled' };
        }
        return UniversalExtractor.extract({ strict });
    }

    // 共享图片解析与正文净化助手（ZenReader 与 Exporter 共用）
    function pickBestFromSrcset(srcset) {
        if (!srcset || /^\s*data:/i.test(srcset)) return '';
        const candidates = srcset.split(',').map(part => part.trim()).filter(Boolean);
        if (candidates.length === 0) return '';
        const last = candidates[candidates.length - 1].split(/\s+/)[0];
        return last || '';
    }

    function resolveBestImageSrc(img) {
        if (!img) return '';
        const attrOrder = [
            'data-original-src', 'data-src', 'data-actualsrc',
            'data-lazy-src', 'data-original', 'origin-src'
        ];
        for (const attr of attrOrder) {
            const val = img.getAttribute(attr);
            if (val && !/^\s*data:image\/(gif|svg\+xml)/i.test(val)) {
                return normalizeMediaUrl(val);
            }
        }
        const dataSrcset = pickBestFromSrcset(img.getAttribute('data-srcset'));
        if (dataSrcset) return normalizeMediaUrl(dataSrcset);

        const srcset = pickBestFromSrcset(img.getAttribute('srcset'));
        if (srcset) return normalizeMediaUrl(srcset);

        const picture = img.closest?.('picture');
        if (picture) {
            const sourceEl = picture.querySelector('source[srcset], source[data-srcset]');
            if (sourceEl) {
                const picUrl = pickBestFromSrcset(sourceEl.getAttribute('data-srcset') || sourceEl.getAttribute('srcset'));
                if (picUrl) return normalizeMediaUrl(picUrl);
            }
        }

        const rawSrc = img.getAttribute('src');
        if (rawSrc && !/^\s*data:image\/(gif|svg\+xml)/i.test(rawSrc)) {
            return normalizeMediaUrl(rawSrc);
        }
        return normalizeMediaUrl(rawSrc || '');
    }

    function resolveAbsoluteUrl(rawUrl) {
        if (!rawUrl) return '';
        const trimmed = rawUrl.trim();
        if (!trimmed || trimmed.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(trimmed)) {
            return trimmed;
        }
        try {
            return new URL(normalizeMediaUrl(trimmed), window.location.href).href;
        } catch (e) {
            return trimmed;
        }
    }

    function matchesActiveZapper(el) {
        if (!el || el.nodeType !== 1) return false;
        const rules = ZapperStore.getForHost();
        for (let i = 0; i < rules.length; i++) {
            const sel = rules[i]?.selector;
            if (!sel) continue;
            try {
                if (el.matches(sel)) return true;
            } catch (e) { /* ignore invalid selector */ }
        }
        return false;
    }

    function stripNoiseAndZappedFromClone(root, articleTitle = '') {
        if (!root) return;

        // 1. 同步移除当前域名已被 Element Zapper 隐藏的元素
        const zapperRules = ZapperStore.getForHost();
        for (let i = 0; i < zapperRules.length; i++) {
            const sel = zapperRules[i]?.selector;
            if (!sel) continue;
            try {
                root.querySelectorAll(sel).forEach(el => el.remove());
            } catch (e) { /* ignore */ }
        }

        // 2. 剔除脚本、广告、评论区、推荐流、订阅框、代码头装饰与宿主元数据
        const junkSelectors = [
            'script', 'style', 'noscript', 'iframe', 'nav', 'form', 'aside',
            'footer:not(blockquote footer)', '[hidden]', '[aria-hidden="true"]',
            '.hide-article-box', '.btn-readmore', '.hljs-button', '.reward-area',
            '.recommend-box', '.comment-box', '.comments', '#comments',
            '.comment-list', '.comment-section', '#disqus_thread', '.disqus_thread',
            '.giscus', '.utterances', '.related-posts', '.recommended-posts',
            '.post-navigation', '.share-buttons', '.social-share', '.like-btn',
            '.share-box', '.subscribe-widget', '.subscription-widget', '.newsletter-form',
            '.advert', '[class^="ad-"]', '[class*=" ad-"]', '[class*="-ad-"]', '[class$="-ad"]',
            '.article-title', '.author-info-block', '.article-banner', '.extension-banner',
            '.tag-list-box', '.suspension-panel', '.image-container-fill',
            '.code-block-extension-header', '.pre-numbering', '.line-numbers-rows'
        ];
        root.querySelectorAll(junkSelectors.join(',')).forEach(el => el.remove());

        // 3. 若正文容器内部自带与文章标题一致的 <h1>，避免在 Zen Mode / Markdown 中重复出现双标题
        const normTitle = String(articleTitle || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (normTitle) {
            root.querySelectorAll('h1').forEach(h1 => {
                const h1Txt = (h1.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (h1Txt && h1Txt === normTitle) {
                    h1.remove();
                }
            });
        }

        // 4. 针对未知站点的启发式噪声清理：疑似评论/分享/推广块且高链接密度、少正文段落时安全剥离
        const suspectBlocks = root.querySelectorAll('div, section');
        for (let i = suspectBlocks.length - 1; i >= 0; i--) {
            const blk = suspectBlocks[i];
            if (!blk.parentNode) continue;
            const sig = UniversalExtractor.getSignature(blk);
            if (!sig.trim()) continue;
            if (UniversalExtractor.HARD_REJECT_REGEX.test(sig) ||
                (UniversalExtractor.SOFT_UNLIKELY_REGEX.test(sig) && !UniversalExtractor.OK_MAYBE_REGEX.test(sig))) {
                const linkDensity = UniversalExtractor.getLinkDensity(blk);
                const pCount = blk.querySelectorAll('p').length;
                if ((linkDensity > 0.35 && pCount < 2) || UniversalExtractor.HARD_REJECT_REGEX.test(sig)) {
                    blk.remove();
                }
            }
        }
    }

    // ==========================================
    //  10. 悬浮智能大纲目录 (Floating TOC)
    // ==========================================
    class FloatingTOC {
        constructor() {
            this.container = null;
            this.headings = [];
            this.isOpen = false;
            this.scrollBound = false;
        }

        clearPanel() {
            document.querySelectorAll('#pure-toc-panel').forEach(el => el.remove());
            this.container = null;
            this.headings = [];
        }

        syncDockState() {
            const tocBtn = document.getElementById('pure-dock-toc');
            if (tocBtn) {
                tocBtn.classList.toggle('pure-dock-active', this.isOpen && !!this.container);
            }
        }

        init(options = {}) {
            if (!config.enableFloatingTOC || isAuthPage()) {
                this.clearPanel();
                this.syncDockState();
                return false;
            }
            const { contentEl } = extractArticleData({
                strict: Boolean(options.strict),
                force: Boolean(options.force)
            });
            if (!contentEl) {
                this.clearPanel();
                this.syncDockState();
                return false;
            }

            const elements = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4')).filter(el => {
                if (isPureUiElement(el) || UniversalExtractor.isHiddenElement(el) || matchesActiveZapper(el)) {
                    return false;
                }
                if (el.closest('nav, aside, footer, form, .comments, #comments, .related-posts, .recommended-posts, .newsletter-form, .subscribe-widget, .subscription-widget, .share-buttons, .social-share, .comment-box, .comment-list, .comment-section, #disqus_thread, .disqus_thread, .giscus, .utterances, [aria-hidden="true"]')) {
                    return false;
                }
                for (let anc = el.parentElement; anc && anc !== contentEl && anc !== document.body && anc !== document.documentElement; anc = anc.parentElement) {
                    if (UniversalExtractor.HARD_REJECT_REGEX.test(UniversalExtractor.getSignature(anc))) {
                        return false;
                    }
                }
                const txt = (el.innerText || el.textContent || '').trim();
                return txt.length > 0;
            });

            if (elements.length < 2) {
                this.clearPanel();
                this.isOpen = false;
                this.syncDockState();
                return false; // 标题过少不生成目录
            }

            this.headings = elements.map((el, index) => {
                const id = el.id || `pure-toc-h-${index}`;
                el.id = id;
                return {
                    id,
                    level: parseInt(el.tagName.substring(1), 10),
                    text: (el.innerText || el.textContent || '').trim(),
                    el
                };
            });

            this.render();
            this.bindScrollHighlight();
            this.syncDockState();
            return true;
        }

        refresh(options = {}) {
            const wasOpen = this.isOpen;
            const ok = this.init(options);
            if (ok && wasOpen && this.container) {
                this.container.classList.add('pure-toc-show');
            }
            this.syncDockState();
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
                        <a href="#${escapeHtml(h.id)}" class="pure-toc-item pure-toc-l${h.level}" data-id="${escapeHtml(h.id)}">
                            ${escapeHtml(h.text)}
                        </a>
                    `).join('')}
                </div>
            `;

            document.body.appendChild(this.container);
            this.container.classList.toggle('pure-toc-show', this.isOpen);

            this.container.querySelector('.pure-toc-close').addEventListener('click', () => {
                this.toggle(false);
            });

            this.container.querySelectorAll('.pure-toc-item').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = link.getAttribute('data-id');
                    const targetEl = id ? document.getElementById(id) : null;
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }

        bindScrollHighlight() {
            if (this.scrollBound) return;
            this.scrollBound = true;
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        this.updateActiveItem();
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }

        updateActiveItem() {
            if (!this.container || !this.isOpen) return;
            let current = null;

            // 用视口相对位置判定:标题位于定位祖先内时 offsetTop 并非文档偏移,会算错高亮
            for (let i = 0; i < this.headings.length; i++) {
                const h = this.headings[i];
                if (h.el.getBoundingClientRect().top <= 120) {
                    current = h;
                } else {
                    break;
                }
            }

            this.container.querySelectorAll('.pure-toc-item').forEach(a => {
                a.classList.remove('pure-active');
            });

            if (current) {
                const items = this.container.querySelectorAll('.pure-toc-item');
                for (const activeA of items) {
                    if (activeA.getAttribute('data-id') === current.id) {
                        activeA.classList.add('pure-active');
                        activeA.scrollIntoView({ block: 'nearest' });
                        break;
                    }
                }
            }
        }

        toggle(forceState) {
            if (isAuthPage()) return;
            const nextOpen = forceState !== undefined ? forceState : !this.isOpen;
            if (nextOpen && !this.container) {
                const ok = this.init({ strict: false, force: true });
                if (!ok) {
                    this.isOpen = false;
                    this.syncDockState();
                    showToast('当前文章暂无多级大纲目录');
                    return;
                }
            }
            this.isOpen = nextOpen;
            if (this.container) {
                this.container.classList.toggle('pure-toc-show', this.isOpen);
                if (this.isOpen) this.updateActiveItem();
            }
            this.syncDockState();
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
            if (typeof zapperInstance !== 'undefined' && zapperInstance.isActive) {
                zapperInstance.stop();
            }
            const { title, contentEl } = extractArticleData({ strict: false, force: true });
            if (!contentEl) {
                showToast('未找到文章正文，无法开启沉浸阅读');
                return;
            }

            if (!this.overlay) {
                this.createOverlay();
            }

            // 克隆并净化正文
            const clone = contentEl.cloneNode(true);
            this.sanitizeContent(clone, title);

            const titleEl = this.overlay.querySelector('.pure-zen-title');
            const bodyEl = this.overlay.querySelector('.pure-zen-content');
            titleEl.textContent = title;
            bodyEl.innerHTML = '';
            bodyEl.appendChild(clone);

            this.applyPreferences();
            this.overlay.classList.add('pure-zen-active');
            document.documentElement.style.overflow = 'hidden';
            this.isActive = true;
            // 目录面板层级低于遮罩,开着也看不到,进入沉浸模式时顺手收起
            if (tocInstance.container && tocInstance.isOpen) tocInstance.toggle(false);
            showToast('已进入沉浸阅读模式 (按 ESC 或快捷键退出)');
        }

        close() {
            if (!this.overlay) return;
            this.overlay.classList.remove('pure-zen-active');
            const bodyEl = this.overlay.querySelector('.pure-zen-content');
            if (bodyEl) bodyEl.innerHTML = '';
            document.documentElement.style.overflow = '';
            this.isActive = false;
        }

        toggle() {
            if (isAuthPage()) return;
            if (this.isActive) {
                this.close();
            } else {
                this.open();
            }
        }

        sanitizeContent(root, articleTitle = '') {
            stripNoiseAndZappedFromClone(root, articleTitle);

            // 清除简书等平台占位容器的绝对定位与高度限制，避免移除 .image-container-fill 后图片被 0px 容器裁切
            root.querySelectorAll('.image-package, .image-container, .image-view, .image-view-maintain').forEach(wrap => {
                wrap.style.position = 'static';
                wrap.style.width = 'auto';
                wrap.style.height = 'auto';
                wrap.style.maxWidth = '100%';
                wrap.style.maxHeight = 'none';
                wrap.style.paddingBottom = wrap.classList.contains('image-package') ? '12px' : '0';
                wrap.style.overflow = 'visible';
                wrap.style.backgroundColor = 'transparent';
            });

            root.querySelectorAll('img').forEach(img => {
                const realSrc = resolveBestImageSrc(img);
                if (realSrc) {
                    img.setAttribute('src', realSrc);
                    img.removeAttribute('srcset');
                }
                img.classList.remove('image-loading', 'lazyload', 'lazy');
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.visibility = 'visible';
                img.style.opacity = '1';
                img.style.filter = 'none';
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
            const { title, contentEl } = extractArticleData({ strict: false, force: true });
            if (!contentEl) {
                showToast('未找到正文内容，无法导出');
                return;
            }

            const clone = contentEl.cloneNode(true);
            stripNoiseAndZappedFromClone(clone, title);

            const mdContent = `# ${title}\n\n` +
                              `> 导出日期：${new Date().toLocaleDateString()} | 来源：[${document.title}](${window.location.href})\n\n---\n\n` +
                              Exporter.htmlToMarkdown(clone);

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
            function extractPreText(preEl) {
                const preClone = preEl.cloneNode(true);
                const langHint = preClone.querySelector('.code-block-extension-codeLanguage')?.textContent?.trim() || '';
                preClone.querySelectorAll(
                    '.code-block-extension-header, .pre-numbering, .hljs-button, .opt-box, .box-highline, .line-numbers-rows, button'
                ).forEach(n => n.remove());

                const codeEl = preClone.querySelector('code');
                const lang = (
                    codeEl?.getAttribute('lang') ||
                    codeEl?.getAttribute('data-language') ||
                    codeEl?.getAttribute('data-lang') ||
                    preClone.getAttribute('data-language') ||
                    preClone.getAttribute('data-lang') ||
                    (codeEl?.className?.match(/(?:language|lang)-([\w+-]+)/) || [])[1] ||
                    (preClone.className?.match(/(?:language|lang)-([\w+-]+)/) || [])[1] ||
                    langHint
                ).trim();

                const target = codeEl || preClone;
                target.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                // 某些编辑器用 div/p 包裹单行代码，在离屏克隆节点中需显式保留行尾换行
                target.querySelectorAll('div, p').forEach(lineEl => {
                    if (!lineEl.textContent.endsWith('\n')) {
                        lineEl.append('\n');
                    }
                });
                const text = (target.textContent || '').replace(/\r\n/g, '\n').replace(/\n+$/, '').replace(/^\n+/, '');
                return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
            }

            function renderTable(tableEl, depth) {
                const rows = Array.from(tableEl.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                const matrix = rows.map(tr =>
                    Array.from(tr.children)
                        .filter(cell => cell.tagName === 'TH' || cell.tagName === 'TD')
                        .map(cell => Array.from(cell.childNodes).map(n => walk(n, depth)).join('').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim())
                ).filter(row => row.length > 0);
                if (matrix.length === 0) return '';
                const colCount = Math.max(...matrix.map(r => r.length));
                const padRow = (r) => {
                    const out = r.slice();
                    while (out.length < colCount) out.push('');
                    return `| ${out.join(' | ')} |`;
                };
                const header = padRow(matrix[0]);
                const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
                const body = matrix.slice(1).map(padRow);
                return `\n\n${[header, separator, ...body].join('\n')}\n\n`;
            }

            // 递归转换常用 HTML 标签至 Markdown;depth 用于嵌套列表缩进
            function walk(el, depth) {
                depth = depth || 0;
                if (!el) return '';
                if (el.nodeType === Node.TEXT_NODE) {
                    // 规范化源码缩进与换行,输出更干净的 Markdown
                    return el.textContent.replace(/\s+/g, ' ');
                }
                if (el.nodeType !== Node.ELEMENT_NODE) return '';

                const tag = el.tagName.toLowerCase();

                // 忽略不可见或无用节点
                if (['script', 'style', 'noscript', 'button'].includes(tag)) return '';
                if (el.classList?.contains('code-block-extension-header')) return '';

                // 处理代码块
                if (tag === 'pre') {
                    return extractPreText(el);
                }
                if (tag === 'code' && el.parentNode?.tagName?.toLowerCase() !== 'pre') {
                    return ` \`${(el.textContent || '').trim()}\` `;
                }

                // 处理分隔线、换行与表格
                if (tag === 'hr') return '\n\n---\n\n';
                if (tag === 'br') return '\n';
                if (tag === 'table') return renderTable(el, depth);

                // 处理标题
                if (/^h[1-6]$/.test(tag)) {
                    const level = parseInt(tag[1], 10);
                    const prefix = '#'.repeat(level);
                    return `\n\n${prefix} ${(el.innerText || el.textContent || '').trim()}\n\n`;
                }

                // 处理排版标签
                if (tag === 'p') {
                    const childrenText = Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim();
                    if (!childrenText) return '';
                    // 列表项内嵌套的 p 不额外插入双空行，防止打断列表连续性
                    return el.closest('li') ? `${childrenText}\n` : `\n\n${childrenText}\n\n`;
                }
                if (tag === 'strong' || tag === 'b') {
                    return `**${Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim()}**`;
                }
                if (tag === 'em' || tag === 'i') {
                    return `*${Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim()}*`;
                }
                if (tag === 'del' || tag === 's') {
                    return `~~${Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim()}~~`;
                }
                if (tag === 'blockquote') {
                    const text = Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim();
                    return `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n`;
                }

                // 链接、图片与图注
                if (tag === 'a') {
                    const href = resolveAbsoluteUrl(el.getAttribute('href'));
                    const text = Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim() || href;
                    return href ? `[${text}](${href})` : text;
                }
                if (tag === 'img') {
                    const src = resolveAbsoluteUrl(resolveBestImageSrc(el));
                    const alt = (el.getAttribute('alt') || 'image').trim();
                    return src ? `\n\n![${alt}](${src})\n\n` : '';
                }
                if (tag === 'figcaption') {
                    const caption = Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim();
                    return caption ? `\n\n*${caption}*\n\n` : '';
                }

                // 列表:由容器统一编号与缩进,li 仅负责拼接自身内容
                if (tag === 'ul' || tag === 'ol') {
                    const indent = '  '.repeat(depth);
                    const items = Array.from(el.children).filter(child => child.tagName.toLowerCase() === 'li');
                    const lines = items.map((li, i) => {
                        const marker = tag === 'ol' ? `${i + 1}. ` : '- ';
                        const inner = Array.from(li.childNodes).map(n => walk(n, depth + 1)).join('').trim();
                        return indent + marker + inner;
                    });
                    return `\n\n${lines.join('\n')}\n\n`;
                }
                if (tag === 'li') {
                    return Array.from(el.childNodes).map(n => walk(n, depth)).join('').trim();
                }

                return Array.from(el.childNodes).map(n => walk(n, depth)).join('');
            }

            // 先去除每行行尾空白，再折叠多余空行，避免纯空白字符行阻碍 \n{3,} 合并
            return walk(node)
                .split('\n')
                .map(line => line.replace(/\s+$/, ''))
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
    //  13. 可视化元素橡皮擦 (Element Zapper)
    // ==========================================
    class ElementZapper {
        constructor() {
            this.isActive = false;
            this.hud = null;
            this.highlightBox = null;
            this.targetEl = null;
            this.depthStack = [];
            this.undoStack = [];
            this.currentInfo = null;
            this.articleEl = null;
            this.rafId = null;
            this.lastPointer = { x: 0, y: 0 };

            this._onMouseMove = this.handleMouseMove.bind(this);
            this._onPointerBlock = this.handlePointerBlock.bind(this);
            this._onClick = this.handleClick.bind(this);
            this._onContextMenu = this.handleContextMenu.bind(this);
            this._onKeyDown = this.handleKeyDown.bind(this);
            this._onScroll = this.handleScroll.bind(this);
        }

        cssEscape(str) {
            if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
                return CSS.escape(str);
            }
            return String(str).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
        }

        isStableId(id) {
            if (!id || id.startsWith('pure-')) return false;
            if (/^(ember|react|mui|radix|headlessui|yui|ext-gen|select2|__next|js-|j_id)[-_:\d]/i.test(id)) return false;
            if (/^:[a-z0-9]+:$/i.test(id)) return false;
            if (/^[a-f0-9]{8,}$/i.test(id) || /\d{5,}/.test(id)) return false;
            return true;
        }

        getStableClasses(el) {
            if (!el || !el.classList) return [];
            const out = [];
            const dynamicClassRe = /^(css|sc|jsx|emotion)-[a-z0-9_-]+$|^_[a-zA-Z0-9]{4,}$|__[a-zA-Z0-9]{4,}$|^[a-z]{1,2}[0-9a-f]{5,}$/i;
            const utilityClassRe = /^(w|h|min-w|max-w|min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|flex|inline-flex|grid|block|inline|inline-block|hidden|text|leading|tracking|font|bg|border|rounded|shadow|gap|space-[xy]|items|justify|self|place|relative|absolute|fixed|sticky|inset|top|bottom|left|right|z|col|row|overflow|transition|duration|ease|cursor|opacity|pointer-events|select|sr-only)(?:-|$)/;
            const prefixVariantRe = /^(hover|focus|active|dark|sm|md|lg|xl|2xl):/;

            for (let i = 0; i < el.classList.length; i++) {
                const cls = el.classList[i];
                if (!cls || cls.startsWith('pure-')) continue;
                if (dynamicClassRe.test(cls) || utilityClassRe.test(cls) || prefixVariantRe.test(cls)) continue;
                if (cls.length <= 2 || /^\d+$/.test(cls)) continue;
                out.push(cls);
            }
            return out;
        }

        isSafeMatch(selector, clickedEl) {
            if (!selector || /^(html|body|\*)$/i.test(selector) || selector.includes(',')) return false;
            let list;
            try {
                list = document.querySelectorAll(selector);
            } catch (e) {
                return false;
            }
            if (!list || list.length === 0) return false;
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                if (node === document.documentElement || node === document.body) return false;
                if (isPureUiElement(node) || node.querySelector('#pure-dock, #pure-zapper-hud')) return false;
                if (this.articleEl && node !== clickedEl && (node === this.articleEl || node.contains(this.articleEl))) {
                    return false;
                }
            }
            return true;
        }

        countMatches(selector) {
            try {
                return document.querySelectorAll(selector).length;
            } catch (e) {
                return 0;
            }
        }

        generateSelector(el) {
            if (!el || el === document.body || el === document.documentElement) {
                return { selector: '', matchCount: 0, label: '' };
            }

            const tag = el.tagName.toLowerCase();

            // 1. 优先尝试稳定语义 ID
            if (this.isStableId(el.id)) {
                const sel = `#${this.cssEscape(el.id)}`;
                if (this.isSafeMatch(sel, el) && this.countMatches(sel) === 1) {
                    return { selector: sel, matchCount: 1, label: this.buildLabel(el, sel) };
                }
            }

            // 2. 尝试语义化属性 (data-testid / data-component / aria-label 等)
            const attrCandidates = ['data-testid', 'data-test', 'data-component', 'data-module', 'data-widget', 'data-ad-slot'];
            for (const attr of attrCandidates) {
                const val = el.getAttribute(attr);
                if (val && val.length <= 60) {
                    const sel = `${tag}[${attr}="${this.cssEscape(val)}"]`;
                    const cnt = this.countMatches(sel);
                    if (cnt >= 1 && cnt <= 3 && this.isSafeMatch(sel, el)) {
                        return { selector: sel, matchCount: cnt, label: this.buildLabel(el, sel) };
                    }
                }
            }
            if (['ASIDE', 'NAV', 'SECTION', 'HEADER', 'FOOTER'].includes(el.tagName) || el.getAttribute('role')) {
                const aria = el.getAttribute('aria-label');
                if (aria && aria.length <= 48) {
                    const sel = `${tag}[aria-label="${this.cssEscape(aria)}"]`;
                    const cnt = this.countMatches(sel);
                    if (cnt >= 1 && cnt <= 2 && this.isSafeMatch(sel, el)) {
                        return { selector: sel, matchCount: cnt, label: this.buildLabel(el, sel) };
                    }
                }
            }

            // 3. 尝试标签 + 稳定语义类名（适合跨文章页复用的侧栏/横幅/弹窗）
            const classes = this.getStableClasses(el);
            if (classes.length > 0) {
                const singleSel = `${tag}.${this.cssEscape(classes[0])}`;
                const singleCnt = this.countMatches(singleSel);
                if (singleCnt >= 1 && singleCnt <= 4 && this.isSafeMatch(singleSel, el)) {
                    return { selector: singleSel, matchCount: singleCnt, label: this.buildLabel(el, singleSel) };
                }
                if (classes.length >= 2) {
                    const pairSel = `${tag}.${this.cssEscape(classes[0])}.${this.cssEscape(classes[1])}`;
                    const pairCnt = this.countMatches(pairSel);
                    if (pairCnt >= 1 && pairCnt <= 4 && this.isSafeMatch(pairSel, el)) {
                        return { selector: pairSel, matchCount: pairCnt, label: this.buildLabel(el, pairSel) };
                    }
                }
            }

            // 4. 沿父链向上构建紧凑锚定路径
            const segments = [];
            let cur = el;
            let depth = 0;
            while (cur && cur !== document.body && cur !== document.documentElement && depth < 5) {
                const curTag = cur.tagName.toLowerCase();
                let seg = curTag;

                if (cur !== el && this.isStableId(cur.id)) {
                    seg = `#${this.cssEscape(cur.id)}`;
                    segments.unshift(seg);
                    const path = segments.join(' > ');
                    if (this.isSafeMatch(path, el)) {
                        return { selector: path, matchCount: this.countMatches(path), label: this.buildLabel(el, path) };
                    }
                    break;
                }

                const curClasses = this.getStableClasses(cur);
                if (curClasses.length > 0) {
                    seg = `${curTag}.${this.cssEscape(curClasses[0])}`;
                }

                // 若同级存在多个同类标签或路径匹配数过多，补充 :nth-of-type 确保精确性
                const parent = cur.parentElement;
                if (parent) {
                    const sameTagSiblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
                    if (sameTagSiblings.length > 1) {
                        const idx = sameTagSiblings.indexOf(cur) + 1;
                        if (curClasses.length === 0 || parent.querySelectorAll(`:scope > ${seg}`).length > 1) {
                            seg = `${seg}:nth-of-type(${idx})`;
                        }
                    }
                }

                segments.unshift(seg);
                const candidatePath = segments.join(' > ');
                const cnt = this.countMatches(candidatePath);
                if (cnt >= 1 && cnt <= 2 && this.isSafeMatch(candidatePath, el)) {
                    return { selector: candidatePath, matchCount: cnt, label: this.buildLabel(el, candidatePath) };
                }

                if (['MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV'].includes(cur.tagName)) {
                    break;
                }
                cur = cur.parentElement;
                depth += 1;
            }

            const finalPath = `body > ${segments.join(' > ')}`;
            if (this.isSafeMatch(finalPath, el)) {
                return { selector: finalPath, matchCount: this.countMatches(finalPath), label: this.buildLabel(el, finalPath) };
            }
            const fallbackPath = segments.join(' > ');
            return {
                selector: this.isSafeMatch(fallbackPath, el) ? fallbackPath : '',
                matchCount: this.countMatches(fallbackPath),
                label: this.buildLabel(el, fallbackPath)
            };
        }

        buildLabel(el, selector) {
            const tag = el.tagName.toLowerCase();
            const idPart = this.isStableId(el.id) ? `#${el.id}` : '';
            const cls = this.getStableClasses(el)[0];
            const clsPart = cls ? `.${cls}` : '';
            const snippet = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 18);
            const base = `${tag}${idPart}${clsPart}` || selector;
            return snippet ? `${base} “${snippet}${snippet.length >= 18 ? '…' : ''}”` : base;
        }

        start() {
            if (isAuthPage() || this.isActive) return;
            if (zenInstance.isActive) zenInstance.close();
            if (ui.modal && ui.modal.classList.contains('pure-modal-show')) ui.closeModal();

            this.isActive = true;
            this.targetEl = null;
            this.depthStack = [];
            this.currentInfo = null;
            this.articleEl = extractArticleData({ strict: false }).contentEl || null;

            document.documentElement.classList.add('pure-zapper-active');
            this.createUI();
            this.bindEvents();
            this.updateHUD();
            showToast('已进入元素橡皮擦模式：点击元素隐藏，↑↓ 调整层级，ESC 退出');
        }

        stop() {
            if (!this.isActive) return;
            this.isActive = false;
            this.targetEl = null;
            this.depthStack = [];
            this.currentInfo = null;
            this.articleEl = null;
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            document.documentElement.classList.remove('pure-zapper-active');
            this.unbindEvents();
            if (this.highlightBox) {
                this.highlightBox.remove();
                this.highlightBox = null;
            }
            if (this.hud) {
                this.hud.remove();
                this.hud = null;
            }
            ui.syncDockState();
        }

        toggle() {
            if (isAuthPage() || zenInstance.isActive) return;
            if (this.isActive) this.stop();
            else this.start();
        }

        createUI() {
            document.querySelectorAll('#pure-zapper-highlight, #pure-zapper-hud').forEach(el => el.remove());

            this.highlightBox = document.createElement('div');
            this.highlightBox.id = 'pure-zapper-highlight';
            document.body.appendChild(this.highlightBox);

            this.hud = document.createElement('div');
            this.hud.id = 'pure-zapper-hud';
            this.hud.innerHTML = `
                <div class="pure-zapper-top">
                    <div class="pure-zapper-brand">
                        <span class="pure-zapper-badge">🧹 元素橡皮擦</span>
                        <span class="pure-zapper-host">${escapeHtml(host)}</span>
                        <span class="pure-zapper-count" id="pure-zapper-rule-count"></span>
                    </div>
                    <div class="pure-zapper-actions">
                        <button class="pure-zapper-btn" id="pure-zap-up" title="扩大选区至父元素 (↑)">↑ 扩大</button>
                        <button class="pure-zapper-btn" id="pure-zap-down" title="缩小选区至子元素 (↓)">↓ 缩小</button>
                        <button class="pure-zapper-btn" id="pure-zap-undo" title="撤销上一次隐藏 (Ctrl/Cmd+Z)">↶ 撤销</button>
                        <button class="pure-zapper-btn pure-zapper-exit" id="pure-zap-exit" title="退出橡皮擦 (ESC / 右键)">✕ 完成</button>
                    </div>
                </div>
                <div class="pure-zapper-preview">
                    <code class="pure-zapper-selector" id="pure-zapper-sel-preview">移动鼠标选择页面上的干扰元素，点击即按域名隐藏</code>
                    <span class="pure-zapper-matches" id="pure-zapper-match-badge"></span>
                </div>
            `;
            document.body.appendChild(this.hud);

            this.hud.querySelector('#pure-zap-up').addEventListener('click', () => this.stepUp());
            this.hud.querySelector('#pure-zap-down').addEventListener('click', () => this.stepDown());
            this.hud.querySelector('#pure-zap-undo').addEventListener('click', () => this.undoLast());
            this.hud.querySelector('#pure-zap-exit').addEventListener('click', () => this.stop());
        }

        bindEvents() {
            document.addEventListener('mousemove', this._onMouseMove, true);
            document.addEventListener('mousedown', this._onPointerBlock, true);
            document.addEventListener('mouseup', this._onPointerBlock, true);
            document.addEventListener('pointerdown', this._onPointerBlock, true);
            document.addEventListener('click', this._onClick, true);
            document.addEventListener('contextmenu', this._onContextMenu, true);
            window.addEventListener('keydown', this._onKeyDown, true);
            window.addEventListener('scroll', this._onScroll, true);
        }

        unbindEvents() {
            document.removeEventListener('mousemove', this._onMouseMove, true);
            document.removeEventListener('mousedown', this._onPointerBlock, true);
            document.removeEventListener('mouseup', this._onPointerBlock, true);
            document.removeEventListener('pointerdown', this._onPointerBlock, true);
            document.removeEventListener('click', this._onClick, true);
            document.removeEventListener('contextmenu', this._onContextMenu, true);
            window.removeEventListener('keydown', this._onKeyDown, true);
            window.removeEventListener('scroll', this._onScroll, true);
        }

        pickElementAtPoint(x, y) {
            if (typeof document.elementsFromPoint === 'function') {
                const stack = document.elementsFromPoint(x, y);
                for (let i = 0; i < stack.length; i++) {
                    const el = stack[i];
                    if (!el || isPureUiElement(el)) continue;
                    if (el === document.documentElement || el === document.body) continue;
                    return el;
                }
                return null;
            }
            const el = document.elementFromPoint(x, y);
            if (!el || isPureUiElement(el) || el === document.documentElement || el === document.body) return null;
            return el;
        }

        handleMouseMove(e) {
            if (!this.isActive) return;
            this.lastPointer = { x: e.clientX, y: e.clientY };
            if (isPureUiElement(e.target)) return;
            if (this.rafId) return;
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                if (!this.isActive) return;
                const el = this.pickElementAtPoint(this.lastPointer.x, this.lastPointer.y);
                if (el && el !== this.targetEl) {
                    this.depthStack = [];
                    this.selectTarget(el);
                }
            });
        }

        handleScroll() {
            if (!this.isActive || !this.targetEl) return;
            this.updateHighlightRect();
        }

        handlePointerBlock(e) {
            if (!this.isActive || isPureUiElement(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        handleClick(e) {
            if (!this.isActive) return;
            if (isPureUiElement(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (e.button === 0) {
                this.zapCurrent();
            }
        }

        handleContextMenu(e) {
            if (!this.isActive || isPureUiElement(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            this.stop();
        }

        handleKeyDown(e) {
            if (!this.isActive) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.stop();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                this.stepUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                this.stepDown();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                e.preventDefault();
                e.stopPropagation();
                this.undoLast();
            }
        }

        selectTarget(el) {
            if (!el || el === document.body || el === document.documentElement || isPureUiElement(el)) return;
            this.targetEl = el;
            this.currentInfo = this.generateSelector(el);
            this.updateHighlightRect();
            this.updateHUD();
        }

        stepUp() {
            if (!this.targetEl) return;
            const parent = this.targetEl.parentElement;
            if (!parent || parent === document.body || parent === document.documentElement || isPureUiElement(parent)) {
                showToast('已到达最外层区域');
                return;
            }
            this.depthStack.push(this.targetEl);
            this.selectTarget(parent);
        }

        stepDown() {
            if (this.depthStack.length === 0) {
                showToast('已回到初始选定元素');
                return;
            }
            const child = this.depthStack.pop();
            if (child && document.contains(child)) {
                this.selectTarget(child);
            }
        }

        updateHighlightRect() {
            if (!this.highlightBox || !this.targetEl || !document.contains(this.targetEl)) {
                if (this.highlightBox) this.highlightBox.style.display = 'none';
                return;
            }
            const rect = this.targetEl.getBoundingClientRect();
            if (rect.width <= 0 && rect.height <= 0) {
                this.highlightBox.style.display = 'none';
                return;
            }
            this.highlightBox.style.display = 'block';
            this.highlightBox.style.top = `${Math.max(0, rect.top)}px`;
            this.highlightBox.style.left = `${Math.max(0, rect.left)}px`;
            this.highlightBox.style.width = `${Math.max(2, rect.width)}px`;
            this.highlightBox.style.height = `${Math.max(2, rect.height)}px`;
        }

        updateHUD() {
            if (!this.hud) return;
            const ruleCountEl = this.hud.querySelector('#pure-zapper-rule-count');
            const selEl = this.hud.querySelector('#pure-zapper-sel-preview');
            const matchEl = this.hud.querySelector('#pure-zapper-match-badge');
            const undoBtn = this.hud.querySelector('#pure-zap-undo');

            const rules = ZapperStore.getForHost();
            if (ruleCountEl) {
                ruleCountEl.textContent = `已隐藏 ${rules.length} 项`;
            }
            if (undoBtn) {
                undoBtn.disabled = this.undoStack.length === 0;
            }
            if (this.currentInfo && this.currentInfo.selector) {
                if (selEl) selEl.textContent = this.currentInfo.selector;
                if (matchEl) {
                    matchEl.textContent = `匹配 ${this.currentInfo.matchCount} 个元素`;
                    matchEl.style.display = 'inline-block';
                }
            } else {
                if (selEl) selEl.textContent = '移动鼠标悬停目标，点击即按域名隐藏（↑↓ 调层级）';
                if (matchEl) matchEl.style.display = 'none';
            }
        }

        zapCurrent() {
            if (!this.targetEl || !this.currentInfo || !this.currentInfo.selector) {
                showToast('该元素暂无法生成安全选择器，请按 ↑ 尝试扩大选区');
                return;
            }
            const { selector, label } = this.currentInfo;
            const added = ZapperStore.addRule(selector, label);
            if (added) {
                this.undoStack.push({ selector, label });
                applyZapperCSS();
                UniversalExtractor.clearCache();
                if (config.enableFloatingTOC && tocInstance.container) {
                    tocInstance.refresh({ strict: !isKnownPlatform && config.universalDockMode === 'auto' });
                }
                showToast(`已隐藏：${label} (Ctrl/Cmd+Z 可撤销)`);
            } else {
                showToast('该选择器规则已存在');
            }
            this.targetEl = null;
            this.depthStack = [];
            this.currentInfo = null;
            this.updateHighlightRect();
            this.updateHUD();
        }

        undoLast() {
            if (this.undoStack.length === 0) {
                showToast('本次会话没有可撤销的操作');
                return;
            }
            const last = this.undoStack.pop();
            ZapperStore.removeRule(last.selector);
            const res = applyZapperCSS();
            UniversalExtractor.clearCache();
            this.updateHUD();
            showToast(res.liveUpdated ? `已恢复：${last.label}` : '规则已撤销，刷新页面后恢复显示');
        }
    }

    const zapperInstance = new ElementZapper();

    // ==========================================
    //  14. UI 组件：悬浮工具坞 (Floating Dock) & 设置面板
    // ==========================================
    class SettingsUI {
        constructor() {
            this.dock = null;
            this.modal = null;
            this.initialized = false;
        }

        init() {
            if (isAuthPage()) return;
            if (!this.initialized) {
                this.initialized = true;
                this.injectCSS();
                this.bindGlobalKeys();
                this.registerTampermonkeyMenu();
            }
            this.syncDockVisibility();
            if (!document.getElementById('pure-modal-mask')) {
                this.renderModal();
            }
        }

        shouldShowDock() {
            if (!config.showFloatingDock || isAuthPage()) return false;
            if (isKnownPlatform) return true;
            if (config.ignoredDockDomains.includes(host)) return false;
            if (config.universalDockMode === 'always') return true;
            if (config.universalDockMode === 'manual') return false;
            if (!config.enableUniversalFallback) return false;
            const detected = extractArticleData({ strict: true });
            return Boolean(detected && detected.isArticle && detected.contentEl);
        }

        syncDockVisibility() {
            const show = this.shouldShowDock();
            if (show) {
                if (!document.getElementById('pure-dock')) {
                    this.renderDock();
                }
                this.syncDockState();
            } else {
                document.querySelectorAll('#pure-dock').forEach(el => el.remove());
                this.dock = null;
            }
            return show;
        }

        syncDockState() {
            const zapBtn = document.getElementById('pure-dock-zapper');
            if (zapBtn) {
                const count = ZapperStore.getForHost().length;
                zapBtn.classList.toggle('pure-dock-active', zapperInstance.isActive);
                zapBtn.classList.toggle('pure-dock-has-rules', count > 0);
                zapBtn.title = count > 0 ? `元素橡皮擦 (Alt+Z) · 本站已屏蔽 ${count} 项` : '元素橡皮擦 (Alt+Z)';
            }
            tocInstance.syncDockState();
        }

        toggleCurrentHostDock() {
            if (isKnownPlatform) {
                showToast('内置适配平台请直接在设置中切换悬浮工具坞总开关');
                return;
            }
            const idx = config.ignoredDockDomains.indexOf(host);
            if (idx >= 0) {
                config.ignoredDockDomains.splice(idx, 1);
                saveConfig(config);
                this.syncDockVisibility();
                showToast(`已恢复在 ${host} 显示悬浮工具坞`);
            } else {
                config.ignoredDockDomains.push(host);
                saveConfig(config);
                this.syncDockVisibility();
                showToast(`已暂停在 ${host} 自动显示悬浮工具坞`);
            }
            this.refreshDynamicModalSections();
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
                #pure-zapper-hud, #pure-zapper-hud *,
                #pure-toast {
                    box-sizing: border-box !important;
                    letter-spacing: normal !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                }

                /* 元素橡皮擦高亮框与 HUD */
                html.pure-zapper-active, html.pure-zapper-active * {
                    cursor: crosshair !important;
                }
                #pure-zapper-hud, #pure-zapper-hud * {
                    cursor: default !important;
                }
                #pure-zapper-hud button {
                    cursor: pointer !important;
                }
                #pure-zapper-highlight {
                    position: fixed;
                    pointer-events: none;
                    z-index: 2147483644;
                    border: 2px solid ${THEME.primary};
                    background: rgba(204, 120, 92, 0.16);
                    border-radius: 4px;
                    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
                    transition: top 0.06s ease-out, left 0.06s ease-out, width 0.06s ease-out, height 0.06s ease-out;
                    display: none;
                }
                #pure-zapper-hud {
                    position: fixed;
                    top: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: min(640px, calc(100vw - 24px));
                    background: rgba(250, 249, 245, 0.96);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                    border: 1px solid ${THEME.hairline};
                    border-radius: 14px;
                    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16);
                    padding: 10px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    z-index: 2147483646;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }
                .pure-zapper-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .pure-zapper-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                }
                .pure-zapper-badge {
                    font-size: 13px;
                    font-weight: 600;
                    color: ${THEME.primary};
                }
                .pure-zapper-host {
                    font-size: 12px;
                    color: ${THEME.muted};
                    max-width: 170px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .pure-zapper-count {
                    font-size: 11.5px;
                    padding: 2px 8px;
                    border-radius: 99px;
                    background: ${THEME.surfaceCard};
                    color: ${THEME.body};
                    font-weight: 500;
                }
                .pure-zapper-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .pure-zapper-btn {
                    background: ${THEME.surfaceSoft} !important;
                    border: 1px solid ${THEME.hairline} !important;
                    color: ${THEME.ink} !important;
                    padding: 4px 10px !important;
                    border-radius: 7px !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                    line-height: 1.4 !important;
                    margin: 0 !important;
                    transition: all 0.15s ease;
                }
                .pure-zapper-btn:hover:not(:disabled) {
                    border-color: ${THEME.primary} !important;
                    color: ${THEME.primary} !important;
                }
                .pure-zapper-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed !important;
                }
                .pure-zapper-exit {
                    background: ${THEME.primary} !important;
                    border-color: ${THEME.primary} !important;
                    color: #ffffff !important;
                }
                .pure-zapper-exit:hover {
                    background: ${THEME.primaryActive} !important;
                    color: #ffffff !important;
                }
                .pure-zapper-preview {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 6px 10px;
                    border-radius: 8px;
                    background: ${THEME.surfaceSoft};
                    border: 1px solid ${THEME.hairlineSoft};
                }
                .pure-zapper-selector {
                    font-family: "JetBrains Mono", Consolas, Monaco, monospace !important;
                    font-size: 12px !important;
                    color: ${THEME.bodyStrong};
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    background: transparent !important;
                    padding: 0 !important;
                }
                .pure-zapper-matches {
                    font-size: 11.5px;
                    color: ${THEME.primaryActive};
                    background: rgba(204, 120, 92, 0.12);
                    padding: 2px 7px;
                    border-radius: 6px;
                    flex-shrink: 0;
                    display: none;
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
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }
                #pure-dock * {
                    -webkit-user-select: none !important;
                    user-select: none !important;
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
                #pure-dock .pure-dock-btn:hover,
                #pure-dock .pure-dock-btn.pure-dock-active {
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
                #pure-dock .pure-dock-btn.pure-dock-has-rules::after {
                    content: "";
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: ${THEME.primary};
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
                .pure-zen-toolbar {
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }
                .pure-zen-content p {
                    margin-bottom: 1.5em;
                }
                .pure-zen-content a {
                    color: ${THEME.primaryActive};
                    text-decoration: underline;
                    text-underline-offset: 3px;
                }
                .pure-zen-content blockquote {
                    margin: 18px 0;
                    padding: 10px 18px;
                    border-left: 4px solid ${THEME.primary};
                    background: rgba(204, 120, 92, 0.08);
                    border-radius: 0 8px 8px 0;
                }
                .pure-zen-content code:not(pre code) {
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.06);
                    font-size: 0.9em;
                    font-family: "JetBrains Mono", Consolas, Monaco, monospace;
                }
                .pure-zen-content hr {
                    border: none;
                    border-top: 1px solid rgba(0, 0, 0, 0.1);
                    margin: 28px 0;
                }
                .pure-zen-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 0.92em;
                }
                .pure-zen-content th, .pure-zen-content td {
                    border: 1px solid rgba(0, 0, 0, 0.12);
                    padding: 8px 12px;
                    text-align: left;
                }
                .pure-zen-content th {
                    background: rgba(0, 0, 0, 0.04);
                    font-weight: 600;
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

                /* 主题着色与宿主高对比度覆盖 */
                #pure-zen-overlay .pure-zen-title { color: inherit; }
                #pure-zen-overlay .pure-zen-content :is(.image-container, .image-view, .image-view-maintain) {
                    position: static !important;
                    width: auto !important;
                    height: auto !important;
                    max-height: none !important;
                    overflow: visible !important;
                }
                #pure-zen-overlay[data-theme="cream"] { background: #fbf9f4; color: #2d2b28; }
                #pure-zen-overlay[data-theme="cream"] .pure-zen-content :is(h1, h2, h3, h4, h5, h6, strong, b) { color: #1a1917 !important; }
                #pure-zen-overlay[data-theme="cream"] .pure-zen-content :is(p, li, td, th, figcaption, blockquote) { color: #2d2b28 !important; }
                #pure-zen-overlay[data-theme="green"] { background: #edf5ec; color: #243324; }
                #pure-zen-overlay[data-theme="green"] .pure-zen-content :is(h1, h2, h3, h4, h5, h6, strong, b) { color: #162416 !important; }
                #pure-zen-overlay[data-theme="green"] .pure-zen-content :is(p, li, td, th, figcaption, blockquote) { color: #243324 !important; }
                #pure-zen-overlay[data-theme="white"] { background: #ffffff; color: #1a1a1a; }
                #pure-zen-overlay[data-theme="white"] .pure-zen-content :is(h1, h2, h3, h4, h5, h6, strong, b) { color: #111111 !important; }
                #pure-zen-overlay[data-theme="white"] .pure-zen-content :is(p, li, td, th, figcaption, blockquote) { color: #1a1a1a !important; }
                #pure-zen-overlay[data-theme="dark"] { background: #161615; color: #dcdad5; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-toolbar { border-bottom-color: #262524; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-btn { border-color: #333330; color: #dcdad5; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-divider { background: #333330; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-title,
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content :is(h1, h2, h3, h4, h5, h6, strong, b) {
                    color: #f2f0eb !important;
                }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-title { border-bottom-color: #262524; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content :is(p, li, td, th, figcaption) {
                    color: #dcdad5 !important;
                }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content a { color: #e2957a !important; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content blockquote {
                    background: rgba(204, 120, 92, 0.14) !important;
                    border-left-color: #cc785c !important;
                    color: #c5c2ba !important;
                }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content :is(td, th) {
                    border-color: #333330 !important;
                }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content th {
                    background: #232320 !important;
                }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content pre { background: #222220; color: #e6e4df; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content code:not(pre code) { background: #2a2926; color: #f0dcd2; }
                #pure-zen-overlay[data-theme="dark"] .pure-zen-content hr { border-top-color: #333330; }

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
                .pure-btn-secondary {
                    background: ${THEME.surfaceSoft};
                    color: ${THEME.ink};
                    border: 1px solid ${THEME.hairline};
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12.5px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }
                .pure-btn-secondary:hover {
                    border-color: ${THEME.primary};
                    color: ${THEME.primary};
                }
                .pure-select {
                    background: ${THEME.surfaceSoft};
                    color: ${THEME.ink};
                    border: 1px solid ${THEME.hairline};
                    border-radius: 8px;
                    padding: 5px 10px;
                    font-size: 12.5px;
                    outline: none;
                    cursor: pointer;
                    max-width: 195px;
                }
                .pure-zapper-toolbar-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                }
                .pure-zapper-rule-list {
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid ${THEME.hairline};
                    border-radius: 10px;
                    background: ${THEME.surfaceSoft};
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .pure-zapper-rule-empty {
                    font-size: 12px;
                    color: ${THEME.muted};
                    padding: 10px 8px;
                    text-align: center;
                    line-height: 1.5;
                }
                .pure-zapper-rule-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 6px 8px;
                    background: ${THEME.canvas};
                    border: 1px solid ${THEME.hairlineSoft};
                    border-radius: 7px;
                }
                .pure-zapper-rule-info {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .pure-zapper-rule-label {
                    font-size: 12.5px;
                    font-weight: 500;
                    color: ${THEME.ink};
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .pure-zapper-rule-sel {
                    font-family: "JetBrains Mono", Consolas, Monaco, monospace !important;
                    font-size: 11px;
                    color: ${THEME.muted};
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .pure-zapper-rule-del {
                    background: transparent;
                    border: 1px solid ${THEME.hairline};
                    color: ${THEME.muted};
                    border-radius: 6px;
                    padding: 3px 8px;
                    font-size: 11.5px;
                    cursor: pointer;
                    flex-shrink: 0;
                }
                .pure-zapper-rule-del:hover {
                    border-color: ${THEME.primary};
                    color: ${THEME.primary};
                }

                @keyframes pureFadeIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }

                /* 打印优化 */
                @media print {
                    #pure-dock, #pure-toc-panel, #pure-modal-mask, #pure-zapper-hud, #pure-zapper-highlight,
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
                <!-- 元素橡皮擦 -->
                <button class="pure-dock-btn" id="pure-dock-zapper" title="元素橡皮擦 (Alt+Z)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 21h10"/><path d="M5.5 13.5 14.8 4.2a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10.5 18.5a2 2 0 0 1-1.4.6H5.9a2 2 0 0 1-1.4-.6l-.4-.4a2 2 0 0 1 0-2.8z"/><path d="m11 8 5 5"/></svg>
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
            this.dock.querySelector('#pure-dock-zapper').addEventListener('click', () => zapperInstance.toggle());
            this.dock.querySelector('#pure-dock-md').addEventListener('click', () => Exporter.exportMarkdown());
            this.dock.querySelector('#pure-dock-pdf').addEventListener('click', () => Exporter.printPDF());
            this.dock.querySelector('#pure-dock-settings').addEventListener('click', () => this.openModal());
            this.syncDockState();
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
                            <div class="pure-group-title">全网通用阅读模式 (Universal Fallback)</div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">未知域名启发式正文识别</div>
                                    <div class="pure-setting-desc">在个人博客、Substack、Medium、新闻站等自动提取正文供沉浸阅读与导出</div>
                                </div>
                                <label class="pure-switch"><input type="checkbox" data-key="enableUniversalFallback" ${config.enableUniversalFallback ? 'checked' : ''}><span class="pure-slider"></span></label>
                            </div>
                            <div class="pure-setting-row">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">未知域名悬浮坞显示策略</div>
                                    <div class="pure-setting-desc">避免在搜索页/网盘/工作台等非文章页面打扰</div>
                                </div>
                                <select class="pure-select" data-key="universalDockMode">
                                    <option value="auto" ${config.universalDockMode === 'auto' ? 'selected' : ''}>识别文章后自动显示 (推荐)</option>
                                    <option value="always" ${config.universalDockMode === 'always' ? 'selected' : ''}>所有网页始终显示</option>
                                    <option value="manual" ${config.universalDockMode === 'manual' ? 'selected' : ''}>仅快捷键 / 菜单唤起</option>
                                </select>
                            </div>
                            <div class="pure-setting-row" id="pure-host-dock-row" style="${isKnownPlatform ? 'display:none;' : ''}">
                                <div class="pure-setting-info">
                                    <div class="pure-setting-name">当前域名浮窗控制</div>
                                    <div class="pure-setting-desc" id="pure-host-dock-desc">${escapeHtml(host)}</div>
                                </div>
                                <button type="button" class="pure-btn-secondary" id="pure-host-dock-toggle"></button>
                            </div>
                        </div>

                        <div>
                            <div class="pure-group-title">可视化元素橡皮擦 (Element Zapper)</div>
                            <div class="pure-zapper-toolbar-row">
                                <button type="button" class="pure-btn-primary" id="pure-modal-start-zapper">🧹 启动橡皮擦 (Alt+Z)</button>
                                <button type="button" class="pure-btn-secondary" id="pure-modal-clear-zapper">清空本域名规则</button>
                            </div>
                            <div class="pure-zapper-rule-list" id="pure-zapper-rules-list"></div>
                            <div class="pure-setting-desc" id="pure-zapper-global-summary" style="margin-top:6px;"></div>
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

            this.modal.querySelector('#pure-host-dock-toggle').addEventListener('click', () => {
                this.toggleCurrentHostDock();
            });

            this.modal.querySelector('#pure-modal-start-zapper').addEventListener('click', () => {
                zapperInstance.start();
            });

            this.modal.querySelector('#pure-modal-clear-zapper').addEventListener('click', () => {
                const rules = ZapperStore.getForHost();
                if (rules.length === 0) {
                    showToast('当前域名暂无已保存的橡皮擦规则');
                    return;
                }
                ZapperStore.clearHost();
                const res = applyZapperCSS();
                UniversalExtractor.clearCache();
                this.refreshDynamicModalSections();
                this.syncDockState();
                showToast(res.liveUpdated ? '已清空当前域名全部屏蔽规则' : '已清空规则，刷新页面后恢复显示');
            });

            this.modal.querySelector('#pure-save-btn').addEventListener('click', () => {
                this.modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
                    const key = input.getAttribute('data-key');
                    if (key) config[key] = input.checked;
                });
                this.modal.querySelectorAll('select[data-key]').forEach(sel => {
                    const key = sel.getAttribute('data-key');
                    if (key) config[key] = sel.value;
                });
                saveConfig(config);
                this.closeModal();
                showToast('设置已保存！');
                setTimeout(() => window.location.reload(), 600);
            });

            this.refreshDynamicModalSections();
        }

        refreshDynamicModalSections() {
            if (!this.modal) return;

            const hostDockBtn = this.modal.querySelector('#pure-host-dock-toggle');
            const hostDockDesc = this.modal.querySelector('#pure-host-dock-desc');
            if (hostDockBtn && hostDockDesc) {
                const ignored = config.ignoredDockDomains.includes(host);
                hostDockDesc.textContent = ignored
                    ? `${host}（当前已隐藏悬浮工具坞）`
                    : `${host}（允许自动显示悬浮工具坞）`;
                hostDockBtn.textContent = ignored ? '恢复在本域名显示' : '在本域名隐藏浮窗';
            }

            const listEl = this.modal.querySelector('#pure-zapper-rules-list');
            const summaryEl = this.modal.querySelector('#pure-zapper-global-summary');
            const clearBtn = this.modal.querySelector('#pure-modal-clear-zapper');
            if (!listEl) return;

            const rules = ZapperStore.getForHost();
            if (clearBtn) clearBtn.disabled = rules.length === 0;

            if (rules.length === 0) {
                listEl.innerHTML = '<div class="pure-zapper-rule-empty">当前域名暂无屏蔽规则。点击上方“启动橡皮擦”或按 Alt+Z，即可点选页面中的广告、侧栏或弹窗并按域名永久隐藏。</div>';
            } else {
                listEl.innerHTML = rules.map((r, idx) => `
                    <div class="pure-zapper-rule-item">
                        <div class="pure-zapper-rule-info">
                            <div class="pure-zapper-rule-label" title="${escapeHtml(r.label || r.selector)}">${escapeHtml(r.label || r.selector)}</div>
                            <div class="pure-zapper-rule-sel" title="${escapeHtml(r.selector)}">${escapeHtml(r.selector)}</div>
                        </div>
                        <button type="button" class="pure-zapper-rule-del" data-idx="${idx}">恢复</button>
                    </div>
                `).join('');

                listEl.querySelectorAll('.pure-zapper-rule-del').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.getAttribute('data-idx'), 10);
                        const targetRule = rules[idx];
                        if (!targetRule) return;
                        ZapperStore.removeRule(targetRule.selector);
                        const res = applyZapperCSS();
                        UniversalExtractor.clearCache();
                        this.refreshDynamicModalSections();
                        this.syncDockState();
                        showToast(res.liveUpdated ? `已恢复元素：${targetRule.label || targetRule.selector}` : '规则已移除，刷新页面后恢复显示');
                    });
                });
            }

            if (summaryEl) {
                const domainCount = ZapperStore.getTotalHostCount();
                summaryEl.textContent = `当前域名：${host}（${rules.length} 条） · 全局累计已覆盖 ${domainCount} 个域名`;
            }
        }

        openModal() {
            if (zapperInstance.isActive) zapperInstance.stop();
            this.refreshDynamicModalSections();
            if (this.modal) this.modal.classList.add('pure-modal-show');
        }

        closeModal() {
            if (this.modal) this.modal.classList.remove('pure-modal-show');
        }

        bindGlobalKeys() {
            window.addEventListener('keydown', (e) => {
                if (isAuthPage()) return;
                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                const target = e.target;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
                    return;
                }
                // 优先用 e.code 判定按键:macOS 按住 Option 时 e.key 会变成 '®' 等特殊字符,导致快捷键失灵
                // Alt + R: 沉浸阅读
                if (e.altKey && (e.code === 'KeyR' || e.key === 'r' || e.key === 'R')) {
                    e.preventDefault();
                    zenInstance.toggle();
                }
                // Alt + T: 大纲 (沉浸阅读打开时目录被遮罩盖住,忽略触发)
                if (e.altKey && (e.code === 'KeyT' || e.key === 't' || e.key === 'T')) {
                    e.preventDefault();
                    if (!zenInstance.isActive) tocInstance.toggle();
                }
                // Alt + Z: 可视化元素橡皮擦
                if (e.altKey && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z')) {
                    e.preventDefault();
                    if (!zenInstance.isActive) zapperInstance.toggle();
                }
            });
        }

        registerTampermonkeyMenu() {
            if (typeof GM_registerMenuCommand !== 'undefined') {
                GM_registerMenuCommand('📖 沉浸阅读模式 (Alt+R)', () => zenInstance.toggle());
                GM_registerMenuCommand('📑 文章大纲目录 (Alt+T)', () => tocInstance.toggle());
                GM_registerMenuCommand('🧹 元素橡皮擦 (Alt+Z)', () => zapperInstance.toggle());
                GM_registerMenuCommand('📥 导出为 Markdown', () => Exporter.exportMarkdown());
                GM_registerMenuCommand('🖨️ 打印 / 存为 PDF', () => Exporter.printPDF());
                if (!isKnownPlatform) {
                    GM_registerMenuCommand('🌐 切换当前域名悬浮坞显示', () => this.toggleCurrentHostDock());
                }
                GM_registerMenuCommand('⚙️ 打开纯净阅读设置', () => this.openModal());
            }
        }
    }

    // ==========================================
    //  15. 入口初始化 & SPA 路由追踪
    // ==========================================
    const ui = new SettingsUI();
    let lastHref = window.location.href;
    let spaTimer = null;

    function refreshUniversalAndTOC(strictMode) {
        ui.syncDockVisibility();
        if (config.enableFloatingTOC) {
            if (isKnownPlatform || config.universalDockMode !== 'auto' || ui.dock) {
                tocInstance.refresh({ strict: strictMode });
            } else {
                tocInstance.clearPanel();
                tocInstance.syncDockState();
            }
        }
    }

    function handleRouteChange() {
        if (window.location.href === lastHref) return;
        lastHref = window.location.href;
        clearTimeout(spaTimer);
        spaTimer = setTimeout(() => {
            UniversalExtractor.clearCache();
            if (zapperInstance.isActive) zapperInstance.stop();
            if (zenInstance.isActive) zenInstance.close();
            if (isAuthPage()) {
                document.querySelectorAll('#pure-dock, #pure-toc-panel, #pure-modal-mask, #pure-zapper-hud, #pure-zapper-highlight').forEach(el => el.remove());
                return;
            }
            injectStartCSS();
            applyZapperCSS();
            setupPlatformFixes();
            setupCopyGuard();
            ui.init();
            refreshUniversalAndTOC(!isKnownPlatform && config.universalDockMode === 'auto');
            if (!isKnownPlatform && config.universalDockMode === 'auto' && !ui.dock) {
                setTimeout(() => refreshUniversalAndTOC(true), 1200);
            }
        }, 700);
    }

    function hookHistoryNavigation() {
        if (window.__pureHistoryHooked) return;
        window.__pureHistoryHooked = true;
        ['pushState', 'replaceState'].forEach(method => {
            const orig = history[method];
            if (typeof orig !== 'function') return;
            history[method] = function () {
                const ret = orig.apply(this, arguments);
                handleRouteChange();
                return ret;
            };
        });
        window.addEventListener('popstate', handleRouteChange);
    }

    function onDOMLoaded() {
        hookHistoryNavigation();
        if (isAuthPage()) return;
        ui.init();
        if (isKnownPlatform) {
            if (config.enableFloatingTOC) {
                setTimeout(() => tocInstance.init({ strict: false }), 1000);
            }
        } else {
            setTimeout(() => refreshUniversalAndTOC(config.universalDockMode === 'auto'), 350);
            if (config.universalDockMode === 'auto') {
                setTimeout(() => {
                    if (!ui.dock) refreshUniversalAndTOC(true);
                }, 1600);
                window.addEventListener('load', () => {
                    if (!ui.dock) refreshUniversalAndTOC(true);
                }, { once: true });
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMLoaded);
    } else {
        onDOMLoaded();
    }

})();
