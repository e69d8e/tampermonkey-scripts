# Tampermonkey 脚本合集

一组自用的 Tampermonkey 油猴脚本，解决日常使用中的具体问题。每个脚本独立运行，无外部依赖，安装即用。

---

## 脚本列表

| 脚本 | 说明 |
|------|------|
| [学习通AI自动答题](./automatic-AI-answer-system-for-xxt/README.md) | 自动读取学习通题目，调用 AI 生成答案并填入页面。支持单选、多选、判断、填空、简答等全部题型 |
| [斗鱼直播美化](./douyu-beautification/README.md) | 移除斗鱼直播间广告、礼物栏、活动弹窗等冗余元素，还原为纯粹的观看界面 |

> 点击脚本名称进入各自的使用教程，包含详细的安装步骤和功能说明。

---

## 安装前置条件

所有脚本均需要浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。推荐使用 Edge、Chrome 或 Firefox。

安装方式：点击各脚本目录下的 `.user.js` 文件，Tampermonkey 会自动弹出安装确认。也可在 Tampermonkey 管理面板的「实用工具」中手动导入。

---

## 项目结构

```
yh/
├── automatic-AI-answer-system-for-xxt/
│   ├── 学习通AI答题.user.js        # 脚本主体
│   ├── DESIGN.md                    # UI 设计系统参考
│   └── README.md                    # 使用教程
├── douyu-beautification/
│   ├── douyu-beautification.user.js # 脚本主体
│   └── README.md                    # 使用教程
└── CLAUDE.md                        # 开发指引
```

每个脚本为单文件 IIFE 架构 — 无构建系统、无包管理器、无测试、无 CI/CD。`.user.js` 文件直接安装到 Tampermonkey 即可运行。
