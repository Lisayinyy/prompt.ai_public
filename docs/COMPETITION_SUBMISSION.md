# prompt.ai — 你 AI 工作的第二大脑

> 跨 22 个 AI 平台的中立记忆中枢:自动归档、智能优化、模板复用、跨平台搜索。
> 8 周完整迭代 · 5 大模块闭环 · 30+ SQL migration · GitHub 公开

---

## 📌 项目快览

| 维度 | 信息 |
|---|---|
| 产品名 | prompt.ai |
| 一句话定位 | 你 AI 工作的第二大脑 — 跨 22 个 AI 平台的中立记忆中枢 |
| 形态 | Chrome 扩展(已部署生产环境) |
| 技术栈 | React + TypeScript + Cloudflare Workers + Supabase + MiniMax-M2.7 + bge-m3 |
| 公开代码 | https://github.com/Lisayinyy/prompt.ai_public |
| 提交人 | Lisa(@Lisayinyy) |

---

## 🎯 TL;DR(评委 30 秒读完)

每个 AI 用户都同时在用 ChatGPT / Claude / Kimi / Gemini 等多个工具,但**没有任何工具能把跨平台的对话整合起来**。OpenAI 的 memory 出不了 ChatGPT,Anthropic 的 projects 出不了 Claude — 这是结构性敌对,他们永远不会做。

**prompt.ai 是寄生在所有 AI 平台上游的中立中间件**:Chrome 扩展自动监听用户在 22 个 AI 平台的 prompt,LLM 把它们抽成跨平台的 voice profile + 项目 brief + 可复用模板,通过 ⌘K 命令面板和语义搜索秒回任何历史。

**8 周完成 5 大模块闭环**(跨平台优化 / 项目空间 / 模板系统 / 跨平台搜索 / 8 层记忆中枢),全部在生产可用,代码 GitHub 公开。

---

# 维度 1 · 完整性与价值(50%)

## 1.1 解决什么问题

随着 prompt engineering 普及,**每个 AI 用户的工作流被 3 个真实痛点撕碎**:

| # | 用户原话 | 本质 |
|---|---|---|
| 1 | "上周问 ChatGPT 写的那个营销文案 prompt 哪去了?" | 历史检索失效 — 每个平台的 history 都是孤岛,翻 50 条找不到 |
| 2 | "做这个项目我已经写了 30 条 prompt,但散在 4 个平台,没法整体看" | 没有 folder/tag/项目维度,prompt 永远是流水账 |
| 3 | "上次那个'回复客户延期'的 prompt 写得超好,这次又得从零写" | 没有模板系统,每次重造轮子 |

这些痛点不是"我们觉得有",是用户日常交互中的**高频摩擦**。

## 1.2 AI 在系统中起到什么关键作用

LLM **不是花瓶,是 5 个核心环节的引擎**。每个环节都有专门的 prompt + 输出清洗 + retry 机制:

| # | LLM 用途 | 输入 | 输出 | 落地场景 |
|---|---|---|---|---|
| 1 | **Prompt 优化** | 用户原始 prompt + voice profile + facts | 优化版(角色 / 任务 / 输出格式)+ 评分 + diagnosis | ✨ 优化按钮(浮动 + sidebar)|
| 2 | **事实抽取** | 最近 N 条 prompts | 结构化 JSON facts(带 confidence)| L7:从离散 prompts 抽出"用户偏好" |
| 3 | **Voice profile 合成** | 全部 facts | 一段叙事性"声音指纹" | L8:跨平台融合的"你" |
| 4 | **项目 brief 生成** | 项目内 prompts | 一段项目摘要 | 项目详情页顶部紫色卡 |
| 5 | **自动归类判断** | 新 prompt + 历史项目 embeddings | 项目 ID + 相似度 | 优化后弹紫色 banner "看起来属于 X" |

**bge-m3 embedding(1024 维)** 同时支撑跨平台语义搜索 + 自动归类 + 模板智能建议。

## 1.3 流程是否完整闭环

**5 大模块全可用**(不是 placeholder),所有功能从用户输入到数据持久化完整闭环:

### 模块 1 · 跨平台 ✨ 优化
- 在 22 个 AI 平台(ChatGPT / Claude / Kimi / Gemini / DeepSeek / Doubao / Tongyi / Qwen / Perplexity / Grok / Copilot / 智谱 / 通义千问 / Mistral / 海螺 / 文心 / Genspark / ZAI 等)的输入框注入浮动 ✨ 优化按钮
- 点击 → Worker `/optimize` → MiniMax-M2.7 → 返回优化版 → 自动填回输入框
- 优化后 banner 提示自动归类建议 + 一键加入项目

### 模块 2 · 22 平台 silent capture(用户无感)
- content script 监听 22 个平台输入框的"清空动作"(用户按 Enter 发送时输入框被清空 — 这是平台无关的统一信号)
- 5 秒哈希去重 / placeholder 文案过滤 / 长度边界校验
- 自动写入 Supabase prompts 表(用户 JWT auth + RLS 隔离)
- ChatGPT / Claude / Kimi / DeepSeek 4 个平台还会**抓取 AI 响应**(MutationObserver 轮询 1.5s,稳定 3s 后落库)

### 模块 3 · 项目空间(folder)
- 一键创建项目(名称 + 描述 + 主题色)
- prompts 可手动加入或 LLM 自动归类(60% 阈值,banner 提示用户确认)
- 项目详情页有 LLM 自动生成的项目 brief(后台并发预生成,卡片显示 🪄 / ✨ 状态)
- prompts 时间线 / 跨平台展示

### 模块 4 · 模板系统
- 任何历史 prompt 可一键存为模板,自动识别 `{{变量}}` 占位符
- 使用模板时弹填空表单,填好直接发到当前 AI 网页
- 模板可编辑(rename / 改 text)/ 删除
- 模板智能建议:扫历史高频 prompt,推荐"这条适合存为模板"

### 模块 5 · Memory Dashboard(L1→L8 记忆中枢)
- 顶部紫色渐变 voice profile(LLM 合成的"你的 AI 声音指纹")
- 22 平台彩色热力图(60 天使用分布)
- 偏好画像(facts 按 task_type 分组,带置信度)
- 项目活跃度排行 + 模板使用 Top 5
- 9:16 竖版社媒分享卡(html-to-image 导出 PNG)
- 周报洞察邮件订阅(Cloudflare Cron Triggers,每周一 09:00 BJT 自动发)
- 完整 GDPR:一键导出 JSON + 永久删除账号

### 模块 6 · 跨平台搜索 + ⌘K 命令面板
- Ctrl+K / ⌘K 任何 tab 弹搜索面板,跨 prompts/templates/projects/actions
- 历史搜索:语义(bge-m3)+ 关键词混合,匹配关键短语**黄色高亮**
- 多 filter:平台 / 任务类型 / 时间范围 / 仅收藏
- 三档历史视图:📜 列表 / 💬 会话(同平台 30 min 自动聚类)/ 📚 模板

## 1.4 demo 是否稳定可演示

**赛前 24 小时全面体检通过**:

| 检查 | 结果 |
|---|---|
| Build | ✅ Vite 2731 modules, exit 0, 1.9s |
| 4 个 JS 文件 syntax check | ✅ 全过 |
| Chrome extension/ 6 个关键文件齐 | ✅ manifest + content + background + html + js + css |
| manifest 关键权限(identity / sidePanel / activeTab / storage) | ✅ |
| Worker 部署版本 | ✅ Production version `5e467d6b` |
| 历史踩坑(void lang / API_URL / build script / motion 闭合)| ✅ 全部 grep 验证已修 |

**8 步 smoke test playbook**(`docs/DEMO_DAY.md`)+ 备份 90 秒视频 + 1 页 print-ready PDF 架构图(`docs/architecture.html`)三重保障。

## 1.5 实际价值 / 效率提升

| 场景 | Before(用户原状)| After(用 prompt.ai)| 节省 |
|---|---|---|---|
| 写一个客户延期邮件 prompt | 3-5 分钟手写 | 5 秒(✨ 优化 OR 模板填空)| **30-60 倍** |
| 找回上周的某条 prompt | 0 找回率(平台 history 失效) | ⌘K + 语义高亮匹配秒回 | **从不可能到可能** |
| 切换到一个新 AI 平台开始项目 | 重新交代背景 + 偏好 + 风格 | 复制 voice profile / 项目 brief 一次到位 | **10 分钟 → 10 秒** |
| 查询自己的 AI 使用习惯 | 不知道 | Memory Dashboard + 周报洞察邮件 | **从黑盒到可视** |

---

# 维度 2 · 创新性(25%)

## 2.1 AI 相关创新点

### 创新 1:跨平台 silent capture(平台无关信号设计)
- 业内同类产品都"绑定单平台"或要求用户手动复制
- prompt.ai 发现一个**所有 22 个 AI 平台都遵守的统一信号**:用户按 Enter 发送时输入框被清空
- content script 监听这一动作,5 秒哈希去重 + 占位符过滤 + recentlyFilledByExt 防误判
- 一套代码覆盖 22 平台,新平台只需加 1 个 hostname → platform code 映射

### 创新 2:8 层记忆模型 L1→L8(分层架构,业内 99% 同类只到 L2-L3)

| 层 | 名称 | 核心功能 |
|---|---|---|
| L1 | Persistence | 所有 prompt 入库,跨平台统一存储 |
| L2 | Examples + Scores | 高质量 prompt 作为 few-shot |
| L3 | Negative Samples | 用户 👎 反馈,避免重蹈 |
| L4 | Time Decay | 老 prompt 权重指数衰减 |
| L5 | Profile Cache | 统计画像(task / tone)|
| L6 | Semantic Retrieval | pgvector 1024 维相似度召回 |
| L7 | Fact Extraction | LLM 抽结构化偏好 facts |
| L8 | Voice Profile | 跨平台融合的"你的声音指纹" |

每一层都有具体落地代码 + SQL migration + RPC,**不是 PPT 概念**。

### 创新 3:LLM 自动项目归类(60% 阈值 + banner 提示,绝不主动归档)
- 优化完成时,LLM 用 embedding 判断这条 prompt 跟已有项目的语义距离
- ≥ 60% 相似度才弹紫色 banner 提示,**用户点 ✓ 才归档**
- 试用过的 8 个用户,**0 抱怨归错**(决定权永远在用户)

### 创新 4:9:16 社媒友好分享卡(viral hook)
- Memory Dashboard 一键生成 720×1280 的竖版 PNG
- 含 voice profile 引用 + Top 4 平台 + 品牌底栏
- 适合小红书 / IG Story / 朋友圈,**让用户成为传播者**

### 创新 5:AI 响应捕获(不只抓 prompt,还抓 AI 答案)
- ChatGPT / Claude / Kimi / DeepSeek 4 平台的 assistant message DOM 监听
- MutationObserver 轮询 1.5s,文本稳定 3s 后判定流式完成,落库
- 历史展开里看得见 🤖 AI 响应紫色卡 — **完整对话重建**,不只孤立 prompt

## 2.2 方案差异化亮点

### 跟 OpenAI / Anthropic 第一方 memory 的本质区别
- ChatGPT memory 出不了 ChatGPT
- Anthropic projects 出不了 Claude
- **跨家是结构性敌对**,他们永远不会跨家做

### 跟 Notion AI / Mem / Rewind 的区别
- 这些都是 **standalone app**(用户得专门打开)
- prompt.ai 是 **寄生在所有 AI 平台上游**的中间件,用户在原来的 AI 工具里就能用
- "中立中间件"是结构性稀缺位置

### 战略 positioning(可写进 Q&A)
> "OpenAI / Anthropic / Google 各自做不到跨家的 memory。
> Notion / Mem 是 standalone 不在 AI 平台里。
> 只有中立的 prompt.ai,把'你'通过 Chrome 扩展和未来的 MCP 协议带到任何 AI 工具里。"

## 2.3 是否可复用 / 可推广

| 维度 | 设计上的可推广性 |
|---|---|
| 架构 | 22 平台架构可扩到 50+,只需加 hostname 映射 + DOM selector(graceful degrade)|
| 模型 | bge-m3 embedding 跨语言通用,中英混合 prompt 表现一致 |
| 协议 | 所有 RPC 用 SECURITY DEFINER + auth.uid() 隔离,可直接服务百万用户(Cloudflare Workers 边缘 0 冷启动)|
| 形态 | 当前是 Chrome 扩展,Q1 通过 MCP 协议接入 Claude Code / Cursor / Copilot CLI — **跨 web / CLI / IDE 同一份 voice profile + templates + memory** |

---

# 维度 3 · 技术实现性(25%)

## 3.1 AI 技术使用深度

### 主 LLM:MiniMax-M2.7
- 5 个独立用途共用同一 LLM(优化 / 抽事实 / voice / brief / 归类)
- 每个用途都有专门的 system prompt + temperature(0.3-0.7)+ max_tokens
- LLM 输出清洗:
  - `<think>` 标签内容剥离
  - JSON code block 解析(`\`\`\`json ... \`\`\``)
  - JSON 解析失败 fallback 到原文
- Retry + 指数退避(MiniMax 偶发 429 / 502 时自动重试 2 次)

### Embedding:Cloudflare AI bge-m3
- 1024 维向量,跨语言(中文 / 英文 / 混合 prompt 都准)
- pgvector IVFFLAT 100 lists 索引(召回 / 精度平衡)
- HNSW 备选

### 自定义算法
- **5 秒哈希去重**:`((h<<5)-h)+charCodeAt` 极简 hash + Set TTL
- **会话视图聚类**:同平台 + 30min 时间窗
- **模板智能建议**:客户端 frequency clustering(签名 = 前 40 字 normalized)

## 3.2 技术架构

```
┌─────────────────────────────────────────────────────┐
│  USER · 22 AI Platforms                              │
│  ChatGPT · Claude · Kimi · Gemini · DeepSeek ...    │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (React + TS + Vite)                │
│  ├ Sidebar (5 tabs)                                  │
│  ├ Content Script (22-platform silent capture)       │
│  └ Background Service Worker                         │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Cloudflare Workers · Edge Compute (0 cold start)    │
│  /optimize · /embed · /extract-facts ·               │
│  /synthesize-voice · /synthesize-project-brief ·     │
│  /generate-insights · /unsubscribe                   │
│  + Cron Trigger (Mon 09:00 BJT)                      │
└─────────────────────────────────────────────────────┘
        ↓             ↓                ↓
   ┌─────────┐  ┌──────────┐    ┌──────────┐
   │ MiniMax │  │  bge-m3  │    │  Resend  │
   │ M2.7    │  │ embedding│    │  email   │
   └─────────┘  └──────────┘    └──────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Supabase · Postgres + pgvector + RLS                │
│  prompts / user_facts / user_voice_profiles /        │
│  projects / prompt_templates / weekly_recipients     │
│                                                      │
│  Tables 全 RLS · auth.uid() per-user 隔离            │
│  IVFFLAT 1024-dim vector index                       │
│  30+ migrations(v8 → v33)                           │
└─────────────────────────────────────────────────────┘
```

**为什么选这套架构**:
- **Cloudflare Workers Edge**:0 冷启动,worldwide CDN,适合"用户随时一键优化"的低延迟需求
- **Supabase Postgres + pgvector**:RLS 让前端可以直接调,worker 不必持有 service_role,显著降低安全风险
- **MiniMax-M2.7**:中英文 prompt 优化质量优秀,价格友好(每用户每月 ≈ ¥1)
- **bge-m3 by Cloudflare AI**:免费(每天 10k 请求额度),不用自己买 OpenAI embedding

## 3.3 工程规范

| 维度 | 实践 |
|---|---|
| **数据库** | 30+ SQL migration,按时间序应用,supabase CLI 管理 |
| **安全** | 所有 RPC `SECURITY DEFINER` + `auth.uid()` 校验;前端绝不持有 service_role;OAuth 用 chrome.identity.launchWebAuthFlow 隔离 popup;GDPR 一键导出 + 删除账号 |
| **稳定性** | Worker MiniMax 调用 retry 2 次 + 指数退避;`Promise.allSettled` 让 dashboard 抗网络抖动;silent capture 5 秒哈希去重防 React 重渲染重复触发 |
| **可扩展** | Cloudflare Workers 边缘自动扩 worldwide;Supabase Postgres connection pooling;Cron Triggers 自动跑周报 |
| **可观测** | content.js 全链路 console.log(`[prompt.ai capture] ✓ saved to chatgpt`)便于用户 F12 自查;OAuth 加 4 行诊断 log 便于排查 |
| **i18n** | 完整中英双语(zh/en),用户在 Settings 一键切换,所有 5 大模块完整覆盖 |
| **build** | Vite + IIFE 输出,自动同步 manifest / content.js / icons 到 extension/;`bash setup.sh` 一键 fresh setup |
| **文档** | QUICKSTART(5 分钟跑通)+ DEMO_DAY(比赛作战手册,含 8 步 smoke test + 3 分钟 pitch 讲稿)+ architecture.html(1 页技术架构图)|
| **协作** | Git history 清晰,43 commits 全英文 commit message,每个 commit 都对应 1 个明确的功能点或修复 |

## 3.4 稳定性 / 可扩展性具体细节

### 防御性编码
- silent capture 4 道防误判:文本长度 ≥10 / `recentlyFilledByExt` flag / 5s 哈希去重 / 占位符正则过滤
- 项目 brief 后台预生成限并发(max 2),不打满 worker AI binding 配额
- ChatGPT/Claude/Kimi/DeepSeek 的 assistant DOM selector 各 4-5 个 fallback,DOM 改了至少一个能命中
- DNS 污染场景下 graceful 降级(Sidebar 用 wrangler tail 也能监控 worker 端日志)

### 测试 / 部署
- `bash setup.sh` 一键 install + build + 报 Chrome 加载路径
- `node --check` syntax check 所有 JS 入口
- `wrangler deploy` 一键部署 Cloudflare Worker
- `supabase db push` 一键应用所有 migration

### 监控 / 运维
- Cloudflare Workers 自带 metrics + tail
- Supabase 自带 query log + RLS audit
- Resend 自带 email delivery dashboard

---

# 量化指标速查(评委 5 秒读完)

| 指标 | 数字 |
|---|---|
| 支持的 AI 平台 | **22** |
| 记忆模型层数 | **8 层(L1→L8)** |
| LLM 用途 | **5 个独立场景** |
| Embedding 维度 | **1024**(bge-m3) |
| SQL Migration 数 | **30+** |
| 完整迭代周期 | **8 周** |
| Git Commits | **43**(全英文 commit message) |
| 完整产出版本 | **v8 → v33**(每周 1 个里程碑) |
| 支持双语 | **中文 + English** |
| Bundle 大小 | **1.27 MB**(gzip 349 KB) |
| Worker 部署版本 | **5e467d6b**(production) |
| 测试 SOP | **8 步 smoke test** + 90 秒备份视频 |

---

# 演示资源 / 链接

| 资源 | 链接 |
|---|---|
| GitHub Repo | https://github.com/Lisayinyy/prompt.ai_public |
| 一页技术架构 PDF | repo 内 `docs/architecture.html`(浏览器打开 → 打印 → Save as PDF)|
| 5 分钟跑通指南 | repo 内 `QUICKSTART.md` |
| 比赛作战手册 | repo 内 `docs/DEMO_DAY.md` |
| 完整 demo 流程 | 现场演示(8 步 smoke test 全程) |
| 备份 90 秒视频 | (录制中,赛前发评委)|

---

# 三个核心叙事(评委一定会问)

### Q1:"你跟 ChatGPT memory / Anthropic projects 的差异是什么?"

> "ChatGPT 的 memory 出不了 ChatGPT。Anthropic 的 projects 出不了 Claude。**跨家是结构性敌对**,他们永远不会跨家做。我们坐在所有 AI 工具的上游,做的就是它们做不到的那件事 —— 这是 MCP 时代的结构性稀缺位置。"

### Q2:"silent capture 不是偷窥吗?"

> "1) 用户主动安装我们的扩展并开启 toggle 是显式授权;2) 跟 1Password 自动填充密码、Grammarly 自动检查语法是同性质的本地数据增强;3) 用户在 Settings 里随时一键关闭;4) 数据存在用户自己的 Supabase 账号 + RLS 隔离,我们的后端用 user JWT 认证,绝不持有 service_role。"

### Q3:"6 个月路线图?"

> "Q1 通过 MCP 协议接入 Claude Code / Cursor / Copilot CLI,**同一份 voice profile + templates + memory 跨 web / CLI / IDE 都生效**;Q2 Web dashboard(mobile-first);Q3 Team 共享 voice profile + 项目空间;Q4 Enterprise SSO + 私有部署。**战略:从 Chrome 扩展产品 → 跨工具的 AI 第二大脑协议层基础设施**。"

---

> 「我们不卖工具,我们卖你的 AI 工作流第二大脑 — 一个 OpenAI、Anthropic 都拿不走的位置。」
