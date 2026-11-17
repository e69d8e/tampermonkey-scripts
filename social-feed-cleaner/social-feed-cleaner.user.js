// ==UserScript==
// @name         时间线净化 - 小红书 / 微博
// @namespace    https://github.com/e69d8e/tampermonkey-scripts
// @version      0.1.1
// @description  净化小红书与微博时间线：隐藏侧栏、广告、直播、视频与登录提示，带来沉浸式浏览体验。
// @author       e69d8e
// @match        *://www.xiaohongshu.com/*
// @match        *://xiaohongshu.com/*
// @match        *://www.weibo.com/*
// @match        *://weibo.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const PLATFORM = (() => {
    const host = location.hostname;
    if (host.includes('xiaohongshu.com')) return 'xhs';
    if (host.includes('weibo.com')) return 'weibo';
    return null;
  })();

  if (!PLATFORM) return;

  const VERSION = '0.1.1';
  const STORAGE_KEY = 'socialFeedCleanerConfig';
  const IS_XHS = PLATFORM === 'xhs';
  const PLATFORM_LABEL = IS_XHS ? '小红书' : '微博';
  const BRAND = IS_XHS ? '#ff2442' : '#ff8200';
  const BRAND_LIGHT = IS_XHS ? '#ff6b81' : '#ffb24d';

  const DEFAULT_CONFIG = {
    cleanHeader: true,
    hideLeftNav: true,
    hideRightSidebar: true,
    hideHeroBanner: true,
    hideLoginPrompt: true,
    hideFloating: true,
    hideSponsored: true,
    hideRecommended: true,
    hideLiveCards: true,
    hideVideoCards: false,
    centerFeed: true,
    softTheme: true,
    zenMode: false,
    showFab: true,
  };

  const CONFIG_SCHEMA = [
    {
      id: 'clean',
      label: '净化',
      hint: '收起干扰，只留内容',
      items: [
        {
          key: 'hideSponsored',
          label: '隐藏广告推广',
          desc: '过滤带广告、赞助或推广标记的卡片',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideRecommended',
          label: '隐藏推荐内容',
          desc: '过滤标注为「推荐 / 为你推荐」的卡片',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideLiveCards',
          label: '隐藏直播卡片',
          desc: '不让直播入口打断时间线阅读',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideVideoCards',
          label: '隐藏短视频',
          desc: '隐藏视频笔记与短视频，只看图文内容',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideLoginPrompt',
          label: '隐藏登录提示',
          desc: '关闭登录弹窗与登录浮层',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideLeftNav',
          label: '隐藏左侧导航',
          desc: '收起侧栏，让时间线获得更多空间',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'hideRightSidebar',
          label: '隐藏右侧栏（热搜/推荐）',
          desc: '移除微博右侧热搜、关注推荐等模块',
          platforms: ['weibo'],
        },
        {
          key: 'hideHeroBanner',
          label: '隐藏顶部大图',
          desc: '收起微博顶部横幅，直达时间线',
          platforms: ['weibo'],
        },
        {
          key: 'hideFloating',
          label: '隐藏悬浮工具',
          desc: '隐藏小红书右下角的快捷按钮',
          platforms: ['xhs'],
        },
      ],
    },
    {
      id: 'look',
      label: '外观',
      hint: '调成舒服的阅读节奏',
      items: [
        {
          key: 'cleanHeader',
          label: '顶栏视觉净化',
          desc: '玻璃质感与留白，隐藏多余入口',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'centerFeed',
          label: '居中时间线',
          desc: '隐藏侧栏后保持舒适的内容宽度',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'softTheme',
          label: '柔和纸张主题',
          desc: '暖白背景与轻盈卡片，降低视觉噪音',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'zenMode',
          label: '专注模式',
          desc: '隐藏所有导航，只留下时间线',
          platforms: ['xhs', 'weibo'],
        },
        {
          key: 'showFab',
          label: '显示悬浮开关',
          desc: '在右下角保留「时间线净化」入口',
          platforms: ['xhs', 'weibo'],
        },
      ],
    },
  ];

  const GLOBAL_CSS = `
    :root {
      --sfb-xhs: #ff2442;
      --sfb-xhs-light: #ff6b81;
      --sfb-weibo: #ff8200;
      --sfb-weibo-light: #ffb24d;
      --sfb-bg: #f7f4f1;
      --sfb-surface: #fffdfb;
      --sfb-text: #2f2926;
      --sfb-muted: #8d817a;
      --sfb-line: rgba(58, 38, 30, 0.08);
      --sfb-shadow: rgba(52, 32, 24, 0.08);
    }

    html[data-sfb-platform="weibo"] {
      --sfb-bg: #f1f2f5;
      --sfb-surface: #ffffff;
      --sfb-text: #222222;
      --sfb-muted: #8a8a8a;
      --sfb-line: rgba(0, 0, 0, 0.07);
      --sfb-shadow: rgba(0, 0, 0, 0.06);
    }

    html.sfb-soft,
    html.sfb-soft body {
      background-color: var(--sfb-bg) !important;
      color: var(--sfb-text) !important;
    }

    html.sfb-soft #app,
    html.sfb-soft #global {
      background-color: transparent !important;
    }

    html.sfb-soft ::selection {
      background: rgba(255, 36, 66, 0.18);
    }

    html[data-sfb-platform="weibo"].sfb-soft ::selection {
      background: rgba(255, 130, 0, 0.18);
    }

    html.sfb-soft ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    html.sfb-soft ::-webkit-scrollbar-thumb {
      background: rgba(75, 58, 50, 0.22);
      border-radius: 8px;
    }
    html.sfb-soft ::-webkit-scrollbar-track {
      background: transparent;
    }

    /* 小红书：顶栏、侧栏与卡片 */
    html[data-sfb-platform="xhs"].sfb-soft header.mask-paper {
      background: rgba(255, 251, 247, 0.82) !important;
      -webkit-backdrop-filter: blur(18px) saturate(140%);
      backdrop-filter: blur(18px) saturate(140%);
      box-shadow: 0 1px 0 var(--sfb-line) !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft .header-container .input-box {
      background: rgba(255, 255, 255, 0.78) !important;
      border: 1px solid var(--sfb-line) !important;
      border-radius: 24px !important;
      box-shadow: 0 8px 24px rgba(64, 38, 28, 0.035) !important;
      overflow: hidden;
    }

    html[data-sfb-platform="xhs"].sfb-soft #search-input {
      background: transparent !important;
      color: var(--sfb-text) !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft .side-bar {
      background: linear-gradient(180deg, rgba(255, 251, 247, 0.68), transparent 82%) !important;
      border-radius: 20px;
    }

    html[data-sfb-platform="xhs"].sfb-soft section.note-item .cover {
      background: var(--sfb-surface);
      border-radius: 18px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 6px rgba(52, 32, 24, 0.035), 0 10px 24px rgba(52, 32, 24, 0.045) !important;
      transition: transform 0.22s ease, box-shadow 0.22s ease !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft section.note-item:hover .cover {
      transform: translateY(-3px);
      box-shadow: 0 4px 10px rgba(52, 32, 24, 0.06), 0 18px 36px rgba(52, 32, 24, 0.13) !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft section.note-item .cover img {
      border-radius: 18px !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft section.note-item .footer .title {
      color: var(--sfb-text) !important;
      font-weight: 600 !important;
    }

    html[data-sfb-platform="xhs"].sfb-soft section.note-item .footer .author-wrapper {
      color: var(--sfb-muted) !important;
    }

    /* 微博：卡片与内容区 */
    html[data-sfb-platform="weibo"].sfb-soft body {
      background: var(--sfb-bg) !important;
    }

    html[data-sfb-platform="weibo"].sfb-soft article[class*="woo-panel-main"] {
      background: var(--sfb-surface) !important;
      border-radius: 16px !important;
      box-shadow: 0 1px 2px rgba(35, 35, 35, 0.035), 0 8px 24px rgba(35, 35, 35, 0.035) !important;
    }

    html[data-sfb-platform="weibo"].sfb-soft #scroller {
      background: transparent !important;
    }

    /* 通用：净化开关 */
    html.sfb-hide-left[data-sfb-platform="xhs"] .side-bar {
      display: none !important;
    }

    html.sfb-hide-left[data-sfb-platform="xhs"] .main-content.with-side-bar {
      padding-left: 0 !important;
    }

    html.sfb-hide-left[data-sfb-platform="weibo"] ._side_1ubn9_37,
    html.sfb-hide-left[data-sfb-platform="weibo"] [class*="_side_1ubn9_"],
    html.sfb-hide-left[data-sfb-platform="weibo"] ._main_mmtyp_2,
    html.sfb-hide-left[data-sfb-platform="weibo"] [class*="_main_mmtyp_"] {
      display: none !important;
    }

    html.sfb-hide-right[data-sfb-platform="weibo"] #__sidebar,
    html.sfb-hide-right[data-sfb-platform="weibo"] .rightSide,
    html.sfb-hide-right[data-sfb-platform="weibo"] ._side_1l406_17,
    html.sfb-hide-right[data-sfb-platform="weibo"] [class*="_side_1l406_"] {
      display: none !important;
    }

    html.sfb-hide-hero[data-sfb-platform="weibo"] ._top_1ubn9_14,
    html.sfb-hide-hero[data-sfb-platform="weibo"] [class*="_top_1ubn9_"] {
      display: none !important;
    }

    html.sfb-hide-floating[data-sfb-platform="xhs"] .floating-btn-sets {
      display: none !important;
    }

    html.sfb-hide-login[data-sfb-platform="xhs"],
    html.sfb-hide-login[data-sfb-platform="xhs"] body {
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }

    html.sfb-hide-login #login-modal,
    html.sfb-hide-login .login-container,
    html.sfb-hide-login .login-modal,
    html.sfb-hide-login [class*="login-container"],
    html.sfb-hide-login [class*="login-modal"],
    html.sfb-hide-login [class*="LoginModal"],
    html.sfb-hide-login [class*="loginMask"],
    html.sfb-hide-login [class*="login-mask"],
    html.sfb-hide-login #loginLayer,
    html.sfb-hide-login .modal-mask {
      display: none !important;
    }

    html.sfb-clean-header[data-sfb-platform="xhs"] header.mask-paper .right,
    html.sfb-clean-header[data-sfb-platform="xhs"] .header-container .right {
      visibility: hidden !important;
      pointer-events: none !important;
    }

    html.sfb-clean-header[data-sfb-platform="weibo"] ._visable_r36s9_8,
    html.sfb-clean-header[data-sfb-platform="weibo"] [class*="_visable_r36s9_"] {
      background: rgba(255, 255, 255, 0.82) !important;
      -webkit-backdrop-filter: blur(16px) saturate(140%);
      backdrop-filter: blur(16px) saturate(140%);
      border-radius: 14px 14px 0 0 !important;
      box-shadow: 0 1px 0 var(--sfb-line) !important;
    }

    /* 小红书：保持原有瀑布流宽度，只改变容器位置 */
    html[data-sfb-platform="xhs"] #mfContainer {
      width: 100% !important;
      max-width: 1028px !important;
      box-sizing: border-box !important;
    }

    html.sfb-center[data-sfb-platform="xhs"] .main-content.with-side-bar {
      padding-left: 0 !important;
    }

    html.sfb-center[data-sfb-platform="xhs"] #mfContainer {
      margin-left: auto !important;
      margin-right: auto !important;
    }

    /* 微博：隐藏侧栏后，让 642px 时间线稳定居中 */
    html.sfb-center[data-sfb-platform="weibo"] ._content_1ubn9_18,
    html.sfb-center[data-sfb-platform="weibo"] [class*="_content_1ubn9_"] {
      width: 100% !important;
      max-width: 100vw !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 24px !important;
      justify-content: center !important;
    }

    html.sfb-center[data-sfb-platform="weibo"] main {
      justify-content: center !important;
    }

    html.sfb-center[data-sfb-platform="weibo"] ._full_1l406_7,
    html.sfb-center[data-sfb-platform="weibo"] [class*="_full_1l406_"] {
      margin-left: auto !important;
      margin-right: auto !important;
    }

    /* 专注模式 */
    html.sfb-zen[data-sfb-platform="xhs"] header.mask-paper,
    html.sfb-zen[data-sfb-platform="xhs"] .header-container {
      display: none !important;
    }

    html.sfb-zen[data-sfb-platform="xhs"] #mfContainer {
      width: 100% !important;
      max-width: 1028px !important;
      margin: 0 auto !important;
      padding-top: 20px !important;
    }

    html.sfb-zen[data-sfb-platform="xhs"] .main-content.with-side-bar {
      padding-left: 0 !important;
    }

    html.sfb-zen[data-sfb-platform="xhs"] .floating-btn-sets,
    html.sfb-zen[data-sfb-platform="weibo"] ._top_1ubn9_14,
    html.sfb-zen[data-sfb-platform="weibo"] [class*="_top_1ubn9_"],
    html.sfb-zen[data-sfb-platform="weibo"] ._side_1ubn9_37,
    html.sfb-zen[data-sfb-platform="weibo"] [class*="_side_1ubn9_"],
    html.sfb-zen[data-sfb-platform="weibo"] #__sidebar,
    html.sfb-zen[data-sfb-platform="weibo"] ._side_1l406_17,
    html.sfb-zen[data-sfb-platform="weibo"] [class*="_side_1l406_"] {
      display: none !important;
    }

    html.sfb-zen[data-sfb-platform="weibo"] ._content_1ubn9_18,
    html.sfb-zen[data-sfb-platform="weibo"] [class*="_content_1ubn9_"] {
      width: 100% !important;
      max-width: 100vw !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 20px 24px 0 !important;
      justify-content: center !important;
    }

    html.sfb-zen[data-sfb-platform="weibo"] main {
      justify-content: center !important;
    }

    /* 运行时过滤标记 */
    [data-sfb-sponsored],
    [data-sfb-recommended],
    [data-sfb-live],
    [data-sfb-video],
    [data-sfb-login-overlay] {
      display: none !important;
    }

    html.sfb-hide-live[data-sfb-platform="xhs"] section.note-item:has(.live-badge) {
      display: none !important;
    }

    html.sfb-hide-video[data-sfb-platform="xhs"] section.note-item:has(video) {
      display: none !important;
    }
  `;

  let config = {};
  let styleElement = null;
  let uiHost = null;
  let shadowRoot = null;
  let panelOpen = false;
  let toastTimer = null;
  let filterTimer = null;

  function getConfig() {
    let stored = null;
    try {
      stored = typeof GM_getValue === 'function'
        ? GM_getValue(STORAGE_KEY, null)
        : localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      stored = null;
    }

    if (!stored) return { ...DEFAULT_CONFIG };

    try {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CONFIG };
      const merged = { ...DEFAULT_CONFIG };
      Object.keys(DEFAULT_CONFIG).forEach((key) => {
        if (typeof parsed[key] === 'boolean') merged[key] = parsed[key];
      });
      return merged;
    } catch (error) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    const value = JSON.stringify(config);
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, value);
      } else {
        localStorage.setItem(STORAGE_KEY, value);
      }
    } catch (error) {
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch (nestedError) {
        /* ignore unavailable storage */
      }
    }
  }

  function buildGlobalCSS() {
    return GLOBAL_CSS;
  }

  function ensureStyleElement() {
    if (styleElement && styleElement.isConnected) return styleElement;

    const existing = document.getElementById('sfb-global-style');
    if (existing) {
      styleElement = existing;
      return styleElement;
    }

    const parent = document.head || document.documentElement;
    if (!parent) return null;

    if (typeof GM_addStyle === 'function') {
      try {
        const added = GM_addStyle(buildGlobalCSS());
        if (added && added.nodeType === 1) {
          added.id = 'sfb-global-style';
          styleElement = added;
          return styleElement;
        }
      } catch (error) {
        /* fall through to a native style element */
      }
    }

    const style = document.createElement('style');
    style.id = 'sfb-global-style';
    style.textContent = buildGlobalCSS();
    parent.appendChild(style);
    styleElement = style;
    return styleElement;
  }

  function applyStyles() {
    try {
      ensureStyleElement();
    } catch (error) {
      /* keep the page usable even if style injection is blocked */
    }
  }

  function syncRootState() {
    const root = document.documentElement;
    root.setAttribute('data-sfb-platform', PLATFORM);

    const classMap = {
      'sfb-clean-header': config.cleanHeader,
      'sfb-hide-left': config.hideLeftNav,
      'sfb-hide-right': config.hideRightSidebar,
      'sfb-hide-hero': config.hideHeroBanner,
      'sfb-hide-login': config.hideLoginPrompt,
      'sfb-hide-floating': config.hideFloating,
      'sfb-hide-recommended': config.hideRecommended,
      'sfb-hide-live': config.hideLiveCards,
      'sfb-hide-video': config.hideVideoCards,
      'sfb-center': config.centerFeed,
      'sfb-soft': config.softTheme,
      'sfb-zen': config.zenMode,
    };

    Object.keys(classMap).forEach((className) => {
      root.classList.toggle(className, Boolean(classMap[className]));
    });
  }

  function isPromotedCard(card) {
    if (card.matches('[data-ad], [data-ad-id], [data-sponsored="true"]')) return true;

    const candidates = card.querySelectorAll('span, div, a, i, em');
    for (const node of candidates) {
      if (node.children && node.children.length > 0) continue;
      const text = (node.textContent || '').replace(/\s+/g, '').trim();
      if (!text || text.length > 8) continue;
      if (/^(广告|赞助|推广|品牌合作|商业推广|赞助内容)$/.test(text)) return true;
    }
    return false;
  }

  function isRecommendedCard(card) {
    if (card.matches('[data-recommend], [data-recommended="true"], [class*="recommend-card"]')) return true;

    const candidates = card.querySelectorAll('span, div, a, i, em, p');
    for (const node of candidates) {
      if (node.children && node.children.length > 0) continue;
      const text = (node.textContent || '').replace(/\s+/g, '').trim();
      if (!text || text.length > 12) continue;
      if (/^(推荐|推荐内容|为你推荐|相关推荐|猜你喜欢)$/.test(text)) return true;
    }
    return false;
  }

  function isLiveCard(card) {
    if (IS_XHS) return Boolean(card.querySelector('.live-badge'));

    if (card.hasAttribute('data-live')) return true;
    if (
      card.querySelector(
        '[data-live="true"], [data-live="1"], [class*="live-badge"], [class*="liveTag"], [class*="live-tag"], [class*="liveCard"], [class*="live-card"], [class*="liveStatus"], [class*="live-status"]'
      )
    ) {
      return true;
    }

    if (card.querySelector('a[href*="live.weibo.com"]')) return true;

    // 只认文章头部的小尺寸直播徽标，避免把视频播放器控制条里的“直播”文案误判成直播卡。
    const header = card.querySelector('header') || card;
    const candidates = header.querySelectorAll('span, i, em, a, div');
    for (const node of candidates) {
      if (node.children && node.children.length > 0) continue;
      const text = (node.textContent || '').replace(/\s+/g, '').trim();
      if (!text || text.length > 8) continue;
      if (!/^(直播|直播中|直播回放|正在直播|观看直播)$/.test(text)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.width <= 80 && rect.height > 0 && rect.height <= 28) return true;
    }
    return false;
  }

  function setFlag(element, attribute, enabled) {
    if (enabled) {
      if (!element.hasAttribute(attribute)) element.setAttribute(attribute, '');
    } else if (element.hasAttribute(attribute)) {
      element.removeAttribute(attribute);
    }
  }

  function applyRuntimeFilters() {
    if (!document.documentElement) return;

    if (IS_XHS) {
      document.querySelectorAll('section.note-item').forEach((card) => {
        setFlag(card, 'data-sfb-sponsored', config.hideSponsored && isPromotedCard(card));
        setFlag(card, 'data-sfb-recommended', config.hideRecommended && isRecommendedCard(card));
        setFlag(card, 'data-sfb-live', config.hideLiveCards && Boolean(card.querySelector('.live-badge')));
        setFlag(card, 'data-sfb-video', config.hideVideoCards && Boolean(card.querySelector('video')));
      });
    } else {
      document.querySelectorAll('article').forEach((card) => {
        setFlag(card, 'data-sfb-sponsored', config.hideSponsored && isPromotedCard(card));
        setFlag(card, 'data-sfb-recommended', config.hideRecommended && isRecommendedCard(card));
        setFlag(card, 'data-sfb-live', config.hideLiveCards && isLiveCard(card));
        setFlag(card, 'data-sfb-video', config.hideVideoCards && Boolean(card.querySelector('video')));
      });
    }

    if (config.hideLoginPrompt) {
      const loginCandidates = document.querySelectorAll(
        '[class*="login-container"], [class*="login-modal"], [class*="LoginModal"], #loginLayer'
      );
      let sawLoginOverlay = false;
      loginCandidates.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width > 280 || rect.height > 280) {
          node.setAttribute('data-sfb-login-overlay', '');
          sawLoginOverlay = true;
        }
      });

      // 小红书在登录弹窗打开时会锁住页面滚动；隐藏弹窗后要主动解锁。
      if (sawLoginOverlay || document.querySelector('.login-modal, [class*="login-modal"]')) {
        document.documentElement.classList.remove('reds-lock-scroll');
        document.body?.classList.remove('reds-lock-scroll');
        if (getComputedStyle(document.documentElement).overflow === 'hidden') {
          document.documentElement.style.overflow = 'auto';
        }
        if (document.body && getComputedStyle(document.body).overflow === 'hidden') {
          document.body.style.overflow = 'auto';
        }
      }
    }
  }

  function scheduleRuntimeFilters() {
    if (filterTimer) return;
    filterTimer = window.setTimeout(() => {
      filterTimer = null;
      applyRuntimeFilters();
    }, 180);
  }

  function nudgeLayout() {
    window.setTimeout(() => {
      try {
        window.dispatchEvent(new Event('resize'));
      } catch (error) {
        /* ignore */
      }
    }, 60);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderToggleRow(item) {
    const checked = Boolean(config[item.key]);
    return `
      <label class="sfb-row" data-platform="${item.platforms.join(',')}">
        <span class="sfb-row-copy">
          <span class="sfb-row-label">${escapeHtml(item.label)}</span>
          <span class="sfb-row-desc">${escapeHtml(item.desc)}</span>
        </span>
        <span class="sfb-switch">
          <input type="checkbox" data-key="${item.key}" ${checked ? 'checked' : ''}>
          <span class="sfb-switch-track" aria-hidden="true"></span>
        </span>
      </label>
    `;
  }

  function renderPanelContent() {
    const tabs = CONFIG_SCHEMA.map((section, index) => {
      const active = index === 0 ? ' is-active' : '';
      return `<button type="button" class="sfb-tab${active}" data-tab="${section.id}">${section.label}</button>`;
    }).join('');

    const panes = CONFIG_SCHEMA.map((section, index) => {
      const hidden = index === 0 ? '' : ' hidden';
      const rows = section.items
        .filter((item) => item.platforms.includes(PLATFORM))
        .map(renderToggleRow)
        .join('');
      return `
        <section class="sfb-pane" data-pane="${section.id}"${hidden}>
          <div class="sfb-pane-hint">${escapeHtml(section.hint)}</div>
          <div class="sfb-rows">${rows}</div>
        </section>
      `;
    }).join('');

    return { tabs, panes };
  }

  function createUI() {
    if (uiHost || !document.body) return;

    const brandStyle = `--sfb-brand:${BRAND};--sfb-brand-light:${BRAND_LIGHT};`;

    uiHost = document.createElement('div');
    uiHost.id = 'sfb-ui-host';
    uiHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(uiHost);
    shadowRoot = uiHost.attachShadow({ mode: 'open' });

    const content = renderPanelContent();

    shadowRoot.innerHTML = `
      <style>
        :host {
          ${brandStyle}
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
          color: #2a2320;
          font-size: 14px;
          line-height: 1.45;
        }

        * { box-sizing: border-box; }

        .sfb-fab {
          position: fixed;
          right: 22px;
          bottom: 22px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 46px;
          padding: 0 17px 0 13px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--sfb-brand), var(--sfb-brand-light));
          color: #fff;
          font: inherit;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.02em;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 10px 28px color-mix(in srgb, var(--sfb-brand) 30%, transparent), 0 3px 8px rgba(28, 18, 14, 0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .sfb-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px color-mix(in srgb, var(--sfb-brand) 36%, transparent), 0 4px 10px rgba(28, 18, 14, 0.2);
        }

        .sfb-fab.is-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px);
        }

        .sfb-fab-mark {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.19);
          font-size: 17px;
          line-height: 1;
        }

        .sfb-panel {
          position: fixed;
          right: 22px;
          bottom: 82px;
          width: 358px;
          max-height: min(640px, calc(100vh - 108px));
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 22px;
          background: rgba(255, 252, 249, 0.96);
          box-shadow: 0 28px 90px rgba(45, 25, 18, 0.24), 0 8px 24px rgba(45, 25, 18, 0.09);
          -webkit-backdrop-filter: blur(30px) saturate(145%);
          backdrop-filter: blur(30px) saturate(145%);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(10px) scale(0.985);
          transform-origin: bottom right;
          transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
          overflow: hidden;
        }

        .sfb-panel.is-open {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0) scale(1);
        }

        .sfb-panel-head {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 20px 14px;
          background:
            radial-gradient(280px 120px at 12% 0%, color-mix(in srgb, var(--sfb-brand) 10%, transparent), transparent 72%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.68), transparent);
        }

        .sfb-brand-block {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .sfb-logo {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: linear-gradient(135deg, var(--sfb-brand), var(--sfb-brand-light));
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          box-shadow: 0 8px 18px color-mix(in srgb, var(--sfb-brand) 24%, transparent);
        }

        .sfb-title {
          margin: 0;
          font-size: 17px;
          font-weight: 750;
          letter-spacing: -0.02em;
          color: #241d1a;
        }

        .sfb-version {
          margin-left: 6px;
          font-size: 10px;
          font-weight: 600;
          color: var(--sfb-brand);
          vertical-align: 2px;
          opacity: 0.82;
        }

        .sfb-subtitle {
          margin: 3px 0 0;
          font-size: 11px;
          color: #8c7d75;
        }

        .sfb-close {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          margin: -2px -4px 0 0;
          border: 0;
          border-radius: 10px;
          background: rgba(57, 42, 36, 0.06);
          color: #75665f;
          font: inherit;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .sfb-close:hover {
          background: rgba(57, 42, 36, 0.11);
          color: #382c27;
        }

        .sfb-tabs {
          display: flex;
          gap: 4px;
          margin: 0 14px 8px;
          padding: 4px;
          border-radius: 13px;
          background: rgba(61, 43, 36, 0.055);
        }

        .sfb-tab {
          flex: 1;
          height: 34px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #87766e;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }

        .sfb-tab.is-active {
          background: rgba(255, 255, 255, 0.9);
          color: #2d2420;
          box-shadow: 0 2px 8px rgba(52, 33, 25, 0.08);
        }

        .sfb-panel-body {
          padding: 0 14px 6px;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .sfb-pane {
          padding: 2px 6px 0;
        }

        .sfb-pane-hint {
          padding: 4px 4px 8px;
          color: #a0928a;
          font-size: 11px;
        }

        .sfb-rows {
          display: flex;
          flex-direction: column;
        }

        .sfb-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 58px;
          padding: 8px 4px;
          border-bottom: 1px solid rgba(62, 43, 36, 0.06);
          cursor: pointer;
        }

        .sfb-row:last-child { border-bottom: 0; }

        .sfb-row-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }

        .sfb-row-label {
          font-size: 13px;
          font-weight: 650;
          color: #342a25;
        }

        .sfb-row-desc {
          overflow: hidden;
          color: #97877e;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sfb-switch {
          position: relative;
          flex: 0 0 auto;
          width: 42px;
          height: 24px;
        }

        .sfb-switch input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: pointer;
          z-index: 2;
        }

        .sfb-switch-track {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(76, 60, 52, 0.16);
          transition: background 0.18s ease, box-shadow 0.18s ease;
        }

        .sfb-switch-track::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 5px rgba(38, 25, 19, 0.18);
          transition: transform 0.18s ease;
        }

        .sfb-switch input:checked + .sfb-switch-track {
          background: linear-gradient(135deg, var(--sfb-brand), var(--sfb-brand-light));
          box-shadow: 0 4px 12px color-mix(in srgb, var(--sfb-brand) 28%, transparent);
        }

        .sfb-switch input:checked + .sfb-switch-track::after {
          transform: translateX(18px);
        }

        .sfb-switch input:focus-visible + .sfb-switch-track {
          outline: 2px solid color-mix(in srgb, var(--sfb-brand) 55%, white);
          outline-offset: 2px;
        }

        .sfb-panel-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 20px 16px;
          border-top: 1px solid rgba(62, 43, 36, 0.06);
          background: rgba(255, 255, 255, 0.38);
        }

        .sfb-reset {
          height: 32px;
          padding: 0 12px;
          border: 1px solid rgba(68, 48, 39, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.58);
          color: #715f56;
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .sfb-reset:hover {
          border-color: rgba(68, 48, 39, 0.2);
          background: rgba(255, 255, 255, 0.9);
        }

        .sfb-shortcut {
          color: #a0928a;
          font-size: 10px;
          white-space: nowrap;
        }

        .sfb-toast {
          position: fixed;
          left: 50%;
          bottom: 26px;
          max-width: min(320px, calc(100vw - 40px));
          padding: 9px 15px;
          border-radius: 999px;
          background: rgba(34, 27, 24, 0.9);
          color: #fff;
          font-size: 12px;
          line-height: 1.4;
          text-align: center;
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, 8px);
          transition: opacity 0.18s ease, transform 0.18s ease;
          box-shadow: 0 10px 30px rgba(20, 12, 10, 0.24);
        }

        .sfb-toast.is-visible {
          opacity: 1;
          transform: translate(-50%, 0);
        }

        @media (max-width: 480px) {
          .sfb-fab {
            right: 14px;
            bottom: 14px;
          }
          .sfb-fab-label { display: none; }
          .sfb-panel {
            right: 12px;
            bottom: 70px;
            width: calc(100vw - 24px);
            max-height: calc(100vh - 90px);
          }
        }
      </style>

      <button type="button" class="sfb-fab" id="sfb-fab" aria-label="打开时间线净化设置">
        <span class="sfb-fab-mark" aria-hidden="true">✦</span>
        <span class="sfb-fab-label">时间线净化</span>
      </button>

      <section class="sfb-panel" id="sfb-panel" aria-label="时间线净化设置">
        <header class="sfb-panel-head">
          <div class="sfb-brand-block">
            <span class="sfb-logo" aria-hidden="true">净</span>
            <div>
              <h2 class="sfb-title">时间线净化<span class="sfb-version">v${VERSION}</span></h2>
              <p class="sfb-subtitle">${escapeHtml(PLATFORM_LABEL)} · 只看你想看的</p>
            </div>
          </div>
          <button type="button" class="sfb-close" id="sfb-close" aria-label="关闭设置面板">×</button>
        </header>

        <div class="sfb-tabs" role="tablist">${content.tabs}</div>
        <div class="sfb-panel-body" id="sfb-panel-body">${content.panes}</div>

        <footer class="sfb-panel-foot">
          <button type="button" class="sfb-reset" id="sfb-reset">恢复默认</button>
          <span class="sfb-shortcut">Alt+Shift+S 呼出设置</span>
        </footer>
      </section>

      <div class="sfb-toast" id="sfb-toast" role="status" aria-live="polite"></div>
    `;

    bindUIEvents();
    syncUIState();
    applyRuntimeFilters();
  }

  function syncUIState() {
    if (!shadowRoot) return;

    shadowRoot.querySelectorAll('input[data-key]').forEach((input) => {
      input.checked = Boolean(config[input.dataset.key]);
    });

    const fab = shadowRoot.getElementById('sfb-fab');
    if (fab) fab.classList.toggle('is-hidden', !config.showFab);
  }

  function showToast(message) {
    if (!shadowRoot) return;
    const toast = shadowRoot.getElementById('sfb-toast');
    if (!toast) return;

    if (toastTimer) window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toastTimer = null;
    }, 1900);
  }

  function togglePanel(force) {
    if (!shadowRoot) return;
    const panel = shadowRoot.getElementById('sfb-panel');
    const fab = shadowRoot.getElementById('sfb-fab');
    if (!panel) return;

    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    panel.classList.toggle('is-open', panelOpen);
    if (fab) fab.classList.toggle('is-hidden', !config.showFab && !panelOpen);
  }

  function selectTab(tabId) {
    if (!shadowRoot) return;
    shadowRoot.querySelectorAll('.sfb-tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.tab === tabId);
    });
    shadowRoot.querySelectorAll('.sfb-pane').forEach((pane) => {
      pane.hidden = pane.dataset.pane !== tabId;
    });
  }

  function applyAll() {
    syncRootState();
    applyStyles();
    applyRuntimeFilters();
    syncUIState();
    nudgeLayout();
  }

  function resetConfig() {
    config = { ...DEFAULT_CONFIG };
    saveConfig();
    applyAll();
    showToast('已恢复默认设置');
  }

  function bindUIEvents() {
    if (!shadowRoot) return;

    shadowRoot.getElementById('sfb-fab').addEventListener('click', () => togglePanel());
    shadowRoot.getElementById('sfb-close').addEventListener('click', () => togglePanel(false));
    shadowRoot.getElementById('sfb-reset').addEventListener('click', resetConfig);

    shadowRoot.querySelector('.sfb-tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('.sfb-tab');
      if (tab) selectTab(tab.dataset.tab);
    });

    shadowRoot.querySelector('.sfb-panel-body').addEventListener('change', (event) => {
      const input = event.target.closest('input[data-key]');
      if (!input) return;

      const key = input.dataset.key;
      if (!(key in DEFAULT_CONFIG)) return;

      config[key] = input.checked;
      saveConfig();
      applyAll();

      if (key === 'showFab' && !input.checked && !panelOpen) {
        showToast('悬浮开关已隐藏，可用 Alt+Shift+S 呼出设置');
      }
    });
  }

  function setupMenuCommands() {
    if (typeof GM_registerMenuCommand !== 'function') return;

    GM_registerMenuCommand('打开时间线净化设置', () => {
      if (!shadowRoot) createUI();
      togglePanel(true);
    });

    GM_registerMenuCommand('切换专注模式', () => {
      config.zenMode = !config.zenMode;
      saveConfig();
      applyAll();
      showToast(config.zenMode ? '已开启专注模式' : '已关闭专注模式');
    });

    GM_registerMenuCommand('恢复默认设置', resetConfig);
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();

      if (event.altKey && event.shiftKey && key === 's') {
        event.preventDefault();
        if (!shadowRoot) createUI();
        togglePanel();
        return;
      }

      if (event.altKey && event.shiftKey && key === 'z') {
        event.preventDefault();
        config.zenMode = !config.zenMode;
        saveConfig();
        applyAll();
        showToast(config.zenMode ? '已开启专注模式' : '已关闭专注模式');
        return;
      }

      if (event.key === 'Escape' && panelOpen) {
        togglePanel(false);
      }
    }, true);
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            node.matches?.('section, article, video') ||
            node.querySelector?.('section.note-item, article, video')
          ) {
            shouldRefresh = true;
            break;
          }
        }
        if (shouldRefresh) break;
      }

      if (shouldRefresh) scheduleRuntimeFilters();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function boot() {
    config = getConfig();
    syncRootState();
    applyStyles();

    const onReady = () => {
      applyStyles();
      createUI();
      applyRuntimeFilters();
      setupObserver();
      setupKeyboardShortcuts();
      setupMenuCommands();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
      onReady();
    }
  }

  boot();
})();
