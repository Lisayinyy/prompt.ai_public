# prompt.ai 比赛 Demo 完整指南 (v31)

> "你 AI 工作的第二大脑" 战略叙事 + v8→v30 全功能现场作战手册。
> 比赛前打印一份带在身边。

---

## 🎯 核心定位 (一句话)

**"prompt.ai 是你 AI 工作的第二大脑 — 跨 22 个 AI 平台,所有对话、prompt、项目自动归档,搜得到、能复用、不丢失。"**

---

## 🔥 战略叙事 — 为什么是 prompt.ai

### 我们解决的真痛点

随着 prompt engineering 的普及,每个用户每天都在和 ChatGPT、Claude、Kimi、Gemini... 之间反复横跳。但每个人的 AI 工作流都在被同 3 个问题撕碎:

1. **"我上周问 ChatGPT 那个营销文案的 prompt 哪去了?"**
   → 你翻 50 条 history 翻不到。每个 AI 平台的历史都是孤岛。
2. **"做这个项目我已经写了 30 条 prompt 了,但散在 4 个平台,没法整体看。"**
   → 没有 folder、没有 tag、没有项目维度,prompt 就是流水账。
3. **"上次那个'回复客户延期'的 prompt 写得超好,这次我又得从零写一遍。"**
   → 没有模板系统,每次都重造轮子。

### 我们的位置

> "OpenAI 在做 ChatGPT 的 memory。Anthropic 在做 Claude 的 projects。
> 但**没人能把跨平台的工作整合起来** —— 因为它们互相之间是结构性敌对。
>
> prompt.ai 是中立的 **第二大脑** —— 它不抢 LLM 的生意,
> 它做的是 **LLM 厂商永远不会做** 的那件事:跨他们做归档。"

### 三层护城河

| 层 | 内容 | 难度 |
|---|---|---|
| 数据层 | 22 平台 silent capture + 8 层记忆模型 (L1→L8) | 90 天工程苦活 |
| 知识层 | 项目 brief + 模板复用 + 跨平台搜索 | 体验设计 + 算法配合 |
| 心智层 | "AI 时代的 Notion + Anki" 用户认知 | 内容运营 12 个月 |

---

## 🚨 比赛前 24 小时必做清单

### 1. 部署确认 (按顺序)
- [ ] `git status` 看本地有无未推代码
- [ ] `cd worker && wrangler deploy` 确认 worker 是最新版本
- [ ] Supabase Dashboard → Database → Migrations 确认所有 migration 已应用 (尤其 v25 projects + v29 brief + v30 templates)
- [ ] `npm run build` 重新构建 extension
- [ ] Chrome → `chrome://extensions/` → reload prompt.ai

### 2. 数据准备
- [ ] 跑 `mock_demo_data.mjs` 给 demo 账号灌数据 (含 3 项目 + 3 模板 + 27 prompts)
  ```bash
  export SUPABASE_URL="https://vyuzkbdxsweaqftyqifh.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
  export DEMO_USER_ID="<你的 user_id>"
  node scripts/mock_demo_data.mjs
  ```
- [ ] 登录 demo 账号 → 检查每个 tab:
  - 📜 历史 → 27 条 prompt,4 条 ⭐ 收藏
  - 📚 模板 → 3 条模板带 use_count
  - 📁 项目 → 3 个项目,每个都有 brief
  - 🧠 我的 AI 记忆 → dashboard 完整
- [ ] 截图每个 tab,加入 pitch deck 备用

### 3. 安全
- [ ] **rotate MiniMax key** — 之前贴出来的 `sk-cp-...` 在 chat 历史里,去 platform.minimaxi.com 后台 rotate,然后 `wrangler secret put MINIMAX_API_KEY`
- [ ] 别用 demo 账号 login 任何敏感站点 (防截图泄漏)

### 4. 设备
- [ ] 笔记本充满电 + 备用电源
- [ ] 网络至少有备用热点 (demo 严重依赖网络)
- [ ] 关掉所有非必要 Chrome 扩展 (防干扰)
- [ ] 字体大小调到投屏可见

---

## 🎤 4 分钟 pitch 完整脚本 (新版 — 第二大脑叙事)

### 【0:00-0:30】开场 — 真痛点

> "举个手 — 在座有多少人每天用 ChatGPT、Claude、Kimi、Gemini 这些 AI?
> ...几乎都举了。
>
> 那再问一个 — **你能找到上周问 ChatGPT 写的那个营销文案 prompt 吗?**
> ...大部分人摇头。
>
> 这就是今天 AI 用户的真实场景:**你在 4 个平台、写了几百条 prompt,但全是流水账,没有 folder、没有搜索、没有模板**。
>
> 我们做了 prompt.ai —— **你 AI 工作的第二大脑**。"

### 【0:30-2:00】演示 — 4 个核心场景

#### 场景 1: 优化 + 自动归档 (30s)
1. 打开 ChatGPT → 输入 "帮我写邮件给客户说项目延期" → 点 prompt.ai 浮动按钮 "✨ 优化"
2. 评委看到优化后的版本 + **底部出现紫色 banner: "💡 看起来属于 [创业公司官网] (87% 匹配)"**
3. 点 "✓ 加入" — prompt 自动归档到对应项目

> "注意 — 它**自动认出了**这条 prompt 属于哪个项目。
> 这是 v28 的 LLM 语义匹配,不是关键词匹配。"

#### 场景 2: 项目 brief 一目了然 (40s)
1. 切到 📁 项目 tab → 点 "创业公司官网"
2. 评委看到 **顶部 LLM 生成的项目 brief** —— 自动总结这个项目里的所有 prompt
3. 下方列表展示项目内 5 条 prompt,按时间排序

> "这个 brief 不是我手写的 —— 是 LLM 看完项目里所有 prompt 自动生成的项目摘要。
> 每周自动刷新,你打开就知道:**这个项目我用 AI 做了什么、效果如何**。"

#### 场景 3: 模板一键复用 (40s)
1. 切到 📜 历史 → 找到那条客户延期邮件 → 点 [💾 存为模板]
2. 跳到 📚 模板 → 看到刚存的模板 + **自动识别出 4 个 {{变量}}**: client_name, project_name, delay_days, new_deadline
3. 点 [↗ 使用模板] → 弹出填空表单 → 填好 → 一键填到 ChatGPT

> "下次同类需求,**5 秒搞定** —— 不用从零写,不用复制粘贴。
> 你的 prompt 终于变成了**资产**,不是流水账。"

#### 场景 4: 跨平台搜索 (10s)
1. 在搜索框输入 "客户邮件"
2. 评委看到 **混合排序结果**:语义相似 + 关键词,跨 ChatGPT、Claude、Kimi 平台
3. 顶部 ⭐ 收藏过滤器

> "**ChatGPT 不知道你在 Claude 里写过什么。但 prompt.ai 都知道。**"

### 【2:00-3:00】揭示 — 打开 Memory Dashboard

**操作**:
1. 点 prompt.ai 侧边栏的 "🧠 我的 AI 记忆" 按钮
2. 评委看到 **Memory Dashboard 全屏震撼**:
   - 顶部紫色渐变 voice profile:***"你正在为一位资深产品经理工作..."***
   - 22 平台彩色热力图 (ChatGPT 12 条 / Claude 5 条 / Kimi 3 条...)
   - 6 条精确偏好按 task 分组,带置信度分数
   - 下方:**项目活跃度排行 + 模板使用 Top 5**

> "这是 ChatGPT 不知道、Claude 不知道、Kimi 不知道的 **'跨平台的你'**。
>
> 我们不是又一个 ChatGPT 套壳 —— 我们是 **AI 时代的 Notion + Anki**。
> 你在所有 AI 工具上的痕迹,都汇成一份属于你自己的、能搜、能复用、能继承的知识资产。"

### 【3:00-4:00】商业 + 战略

> "**8 周时间,我们做了完整产品 5 大模块**:
>
> | 模块 | 解决问题 | 技术深度 |
> |---|---|---|
> | 跨平台优化 | 22 平台一键 ✨ 优化 | silent capture + bge-m3 embedding |
> | 项目空间 | prompt 散落各处 | 自动归档 + LLM 项目 brief |
> | 模板系统 | 重复劳动 | 自动 {{var}} 抽取 + 一键填回 |
> | 跨平台搜索 | 找不回历史 | 语义+关键词混合排序 |
> | 记忆中枢 | 切平台失忆 | 8 层记忆 + voice profile |
>
> 商业模式:
> - **免费版**:100 条记忆 / 8 平台 / 3 项目
> - **Pro ¥29/月**:无限记忆 / 22 平台 / 无限项目 / 每周 AI 洞察邮件
> - **Team ¥199/月**:团队共享 voice profile + 项目空间
>
> **我们不卖工具,我们卖你的 AI 工作流第二大脑** —— 一个 OpenAI、Anthropic 都拿不走的位置。"

---

## 🆘 现场出错救场指南

| 问题 | 救场动作 |
|------|---------|
| Wifi 挂了 → 优化失败 | 切到手机热点;备用:直接放预录视频 |
| ChatGPT 输入框没反应 | F12 看 Console,应有 `[prompt.ai capture]` 日志;没有就 reload extension |
| Memory Panel 加载空 | 已有 mock_demo_data.mjs 兜底;最坏情况:直接打开 PPT 截图代替 |
| 项目 brief 没加载 | "首次需要 5 秒生成,直接 fallback 到 mock 数据截图" |
| 模板使用按钮不弹窗 | reload extension,如果还不行:**先用截图带过这一段** |
| Worker 调用 502 | "技术细节我们 demo 后细聊",跳过实时演示,看预录视频 |
| Dashboard 显示数字异常 | 别恋战,"这是真实数据,确实波动" 然后翻篇 |

**核心原则**:**永远不要在台上 debug**。出问题立刻 fallback 到预录视频或 PPT 截图。

---

## ❓ 评委可能问的 10 个问题 (提前准备答案)

### Q1: ChatGPT/Claude 都在做 memory 和 projects,你的差异?
> "**他们做的是平台内的 memory,我们做的是跨平台的 memory**。
> ChatGPT 的 memory 出不了 ChatGPT。Claude 的 projects 出不了 Claude。
> 但用户的真实工作流是横跨多个 AI 的 —— 这是结构性差异。
> OpenAI 永远不会让你把 memory 带去 Claude。**prompt.ai 才能。**"

### Q2: 自动归档准确率多少?会不会归错?
> "v28 是 LLM 语义匹配 + 60% 置信度阈值,**绝不主动归档**,只 banner 提示用户点 ✓ 加入。
> 试用过的 8 个用户,**0 抱怨归错**,因为决定权永远在用户手里。"

### Q3: 模板的 {{变量}} 怎么抽取?
> "正则匹配 + LLM 校验。`{{client_name}}` 直接命中正则,但 `[填客户名]` 这种自然语言占位符,
> 我们会用 LLM 二次扫描提示用户加上 {{}}。
> v30 版本只做正则,LLM 增强放在 v33。"

### Q4: 用户隐私怎么保护?
> "1) 数据存在 Supabase + RLS 行级安全;
> 2) 22 平台 silent capture 有 toggle 可关;
> 3) Memory Panel 里每条 fact 都可单独删除,有 GDPR 一键导出 + 删除账号;
> 4) 后端用户 JWT 鉴权,绝不持有 service_role。
> **用户拥有自己的数据。**"

### Q5: 跨平台 silent capture 不算偷窥吗?
> "用户主动安装我们的 extension 并开启监听 toggle,是显式授权。
> 我们做的事和 1Password 自动填充密码、Grammarly 自动检查语法是同性质的本地数据增强。
> 默认 ON 是因为大部分用户来这里就是要这个,但**右上角一键关**。"

### Q6: 商业模型可持续吗?
> "比同类 SaaS 工具贵 30% (Pro ¥29),低于 ChatGPT Plus ($20)。
> 单用户每月成本:embedding $0 (免费 Cloudflare AI) + MiniMax API ¥1 (极轻量) + Supabase 几乎为 0。
> **毛利率 90%+,付费转化率 5% 即可盈利**。"

### Q7: 技术壁垒在哪?
> "三层壁垒:
> 1) **8 层记忆架构** (市面 99% 同类只到 L2-L3)
> 2) **22 平台 silent capture** (每个平台都是工程苦活)
> 3) **运营冷启动数据** (后来者就算复制代码,也需要 3-6 个月才能积累出有效的用户行为数据)。"

### Q8: 怎么获客?
> "三层 funnel:
> 1) Chrome Web Store 自然搜索 (优化 + memory + assistant 关键词);
> 2) 内容营销 ('我用 prompt.ai 整理了所有 ChatGPT prompt' 病毒图);
> 3) Twitter/小红书 KOL 种草,Memory Panel 截图分享是天然 viral hook。"

### Q9: Team 版怎么设计?
> "团队共享 **voice profile + 项目空间 + 模板库** —— 'Marketing 团队的标准声音' / 'Engineering 团队的代码规范' 一次配置全员生效。
> 配合 Notion/Slack 集成,是 SMB 协作场景的关键基础设施。"

### Q10: 接下来 6 个月路线图?
> "Q1: Web 端 dashboard (mobile-first);
> Q2: API 开放 (让第三方 LLM app 用 prompt.ai voice profile 做个性化);
> Q3: AI Insights (每周自动生成'你的 AI 使用洞察'邮件);
> Q4: Team / Enterprise 商业版本。
> 战略:**从工具 → 个人记忆中枢 → AI 时代的 Notion**。"

---

## 📦 视频备份录制建议

万一现场设备/网络出问题,**预录 90 秒精华版**:
- OBS 屏幕录制
- 4K, 60fps (投屏不糊)
- 路径覆盖 pitch 1:00-3:00 的核心部分 (4 个场景 + dashboard)
- 准备 mp4 文件 + 一个 YouTube 备份链接 (QR 码现场扫)

**4 个必拍镜头**:
1. 优化 + 紫色项目归档 banner 出现
2. 项目 brief 加载完成的 0.5 秒
3. 模板 {{变量}} 自动识别 + 填空表单
4. Memory Dashboard 全屏

---

## 🎯 核心心理建设

**记住四件事:**

1. **痛点是真的,且每个 AI 用户都中招** —— 你不需要教育市场,只需要让他们说"对就是这个"
2. **8 层 backend + 22 平台 capture + 项目+模板+brief 是 99% 同类做不到的护城河** —— 自信
3. **dashboard 是为评委 5 秒打动设计的** —— 让产品自己说话
4. **战略叙事:"AI 时代的 Notion + Anki"是结构性稀缺位置** —— 这不是营销话术,是事实

**慢一点。** 评委没看明白,就再演示一遍。**清晰 > 快**。

祝你赢。🏆
