# prompt.ai — 项目手册

> AI Prompt Optimizer Chrome 插件 | 出海赚美金 | 对标 Simplify.jobs 的 AI 版

---

## 产品定位

**不是 Prompt 改写器，是先理解、再优化、再验证、再编排的智能 Agent 系统。**

目标用户：每天使用 AI 工具的知识工作者（学生、创作者、程序员、产品经理）
核心价值：让普通人写出专家级 Prompt，提升 AI 使用效率

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + TypeScript + Tailwind CSS |
| 插件 | Chrome Extension Manifest V3，Side Panel 模式 |
| 后端 | Cloudflare Worker |
| 数据库 | Supabase（PostgreSQL） |
| AI 引擎 | MiniMax M2.7（通过 Cloudflare Worker 调用） |
| 认证 | Google OAuth + Email/Password via Supabase |

### 关键地址
- **GitHub**: https://github.com/Lisayinyy/prompt.ai
- **Cloudflare Worker**: https://prompt-optimizer-api.prompt-optimizer.workers.dev
- **Supabase**: vyuzkbdxsweaqftyqifh.supabase.co
- **插件本地路径**: /Users/minimax/.openclaw/workspace-lisa-work/prompt.ai

---

## 架构设计思想

参考了以下 GitHub 成熟项目的核心思想：

| 参考项目 | 借鉴的核心 |
|---------|-----------|
| Prompt-Engineering-Guide | 方法论（CO-STAR / RISEN / CoT）|
| DSPy | 可编程优化、多轮迭代思想 |
| Guidance | 结构化约束生成 |
| promptfoo | 评测与 A/B 测试能力 |
| Guardrails | 输入输出防护与结构校验 |
| LangChain/LangGraph | Agent 编排和可视化工作流 |

---

## 产品路线图

### ✅ Phase 1 — 智能优化引擎（已完成 v7.5）

**目标**：让单次优化质量明显好于竞品

- **理解层**：自动检测任务类型，根据目标 AI 差异化优化策略
  - ChatGPT/Gemini → Markdown 结构化、代码块
  - Claude → XML 标签结构（`<context>`, `<task>`）
  - Kimi/DeepSeek/MiniMax → 中文优先、简洁直接
- **验证层**：AI 实时打分（清晰度/具体性/结构性，0-100）+ 改进建议 tips
- **防护层**：Guardrails 拦截 prompt 注入攻击（13+ 种模式）
- **框架**：CO-STAR + RISEN + Chain-of-Thought，按任务类型自动选择

### ✅ Phase 2 — 上下文感知多轮优化（已完成 v7.7）

**目标**：对话记忆，不再每次都从头开始

- **对话历史**：用 `useRef` 存储最近 6 条消息，传给后端
- **自动话题检测**：新输入与上一轮关键词重叠 < 25% → 自动开新话题
- **手动控制**：「🔄 新话题」按钮，用户可随时重置
- **快捷二次优化**：💼 更专业 / ✂️ 更简洁 / 🎯 更具体 / ✨ 更创意
- **轮次显示**：继续调整（第 N 轮），让用户感知到对话深度

### 🔜 Phase 3 — Pro 版变现（计划中）

**目标**：Agent 编排，打造核心商业壁垒

- **可视化 Prompt 工作流**：LangGraph 风格，用户可以拖拽组合多步 Prompt
- **A/B 测试**：对比不同优化策略的效果，用数据说话
- **团队协作**：共享 Prompt 库，团队统一标准
- **Stripe 订阅**：月付 $4.9，Pro 版解锁工作流和团队功能

---

## 登录系统

支持三种方式：
1. **Google 一键登录**（OAuth，强制显示账号选择页）
2. **邮箱 + 密码**（任意邮箱，Supabase Auth）
3. **游客模式**（不登录，只用优化功能，无历史记录）

### 邀请码系统（内测期）
- Supabase `invite_codes` 表管理 20 个内测码
- 格式：`PAI-XXXX-XXXX`
- 注册时验证，用过自动标记已使用
- 内测策略：小红书发帖，评论区抽 20 人私信邀请码

---

## 已支持的 AI 网站（自动填充）

ChatGPT / Claude / Gemini / Kimi / DeepSeek / Genspark / MiniMax / 智谱 GLM / 豆包 / 文心一言 / Grok / Copilot / 通义千问 / Mistral / Perplexity（共 15+）

---

## 关键经验（踩过的坑）

- Chrome Extension Side Panel 的 index.html 路径注意根目录 vs dist/
- Vite 构建的 JS 是 IIFE，script 标签需要 `defer`，否则 React 挂载失败
- 去掉 `type="module"` 和 `crossorigin` 属性避免 CSP 问题
- `chrome.scripting.executeScript` 需要目标网站的 `host_permissions`
- Genspark 用 React 渲染，需要 `nativeInputValueSetter` + 多事件触发
- AI 网站域名经常变：kimi.moonshot.cn→kimi.com, chatglm.cn→chat.z.ai
- Google OAuth 登录需要加 `prompt: "select_account"` 否则默认用缓存账号
- Supabase 邮件确认默认模板太丑，需要自定义 HTML 模板

---

## 常用命令

```bash
# 本地开发
cd /Users/minimax/.openclaw/workspace-lisa-work/prompt.ai
npm run build          # 构建
npm run dev            # 开发模式

# 部署 Cloudflare Worker（每次改 worker.js 后必须执行）
cd worker
npx wrangler deploy

# Git
git add -A && git commit -m "vX.X: 改动描述" && git push
```

---

## 版本历史

| 版本 | 内容 |
|------|------|
| v6.4 | 支持 Genspark |
| v6.5 | 升级优化引擎（CO-STAR + RISEN + CoT）|
| v6.6 | 修复 Google 登录账号切换 |
| v6.7 | 新登录弹窗（邮箱+密码+Google+游客）+ 邮件验证成功页 |
| v6.8 | 头像自动生成（DiceBear） |
| v6.9 | 更换插件图标 |
| v7.0-7.3 | 图标迭代，最终用原版魔杖描边 logo |
| v7.4 | 邀请码系统（内测 20 人）|
| v7.5 | Phase 1：三层智能优化架构 |
| v7.6 | 快捷二次优化按钮（更专业/简洁/具体/创意）|
| v7.7 | Phase 2：上下文感知多轮优化 + 自动话题检测 |

---

*最后更新：2026-03-24*
