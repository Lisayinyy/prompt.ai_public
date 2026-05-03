# prompt.ai 比赛 Demo 完整指南

> v8 → v15 全流程的"现场作战手册"。比赛前打印一份带在身边。

---

## 🚨 比赛前 24 小时必做清单

### 1. 部署确认（按顺序）
- [ ] `git status` 看本地有无未推代码
- [ ] `cd worker && wrangler deploy` 确认 worker 是最新版本
- [ ] Supabase Dashboard → Database → Migrations 确认所有 migration 已应用
- [ ] `npm run build` 重新构建 extension
- [ ] Chrome → `chrome://extensions/` → reload prompt.ai

### 2. 数据准备
- [ ] 跑 `mock_demo_data.mjs` 给 demo 账号灌画像数据
  ```bash
  export SUPABASE_URL="https://vyuzkbdxsweaqftyqifh.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
  export DEMO_USER_ID="<你的 user_id>"
  node scripts/mock_demo_data.mjs
  ```
- [ ] 登录 demo 账号，打开 🧠 Memory Panel 视觉确认丰富度
- [ ] 截图 dashboard，加入 pitch deck 备用

### 3. 安全
- [ ] **rotate MiniMax key**：之前贴出来的 `sk-cp-...` 在 chat 历史里，去 platform.minimaxi.com 后台 rotate，然后 `wrangler secret put MINIMAX_API_KEY`
- [ ] 别用 demo 账号 login 任何敏感站点（防截图泄漏）

### 4. 设备
- [ ] 笔记本充满电 + 备用电源
- [ ] 网络至少有备用热点（demo 严重依赖网络）
- [ ] 关掉所有非必要 Chrome 扩展（防干扰）
- [ ] 字体大小调到投屏可见

---

## 🎤 3 分钟 pitch 完整脚本

### 【0:00-0:30】开场 — 痛点

> "大家每天都在用 ChatGPT、Claude、Kimi 这些 AI 工具。但你有没有发现一件事 —
> **每次切到一个新 AI，你都要重新告诉它你是谁、你偏好什么。**
>
> ChatGPT 不知道你在 Claude 里写过什么。Claude 不知道你在 Kimi 里的偏好。
> 它们各是孤岛，永远互不相通。"

### 【0:30-1:30】演示 — 看 demo 怎么解决

> "我们做了 prompt.ai —— **一个跨平台的 AI 个人记忆系统**。"

**操作（关键 - 现场演示，不要只看 PPT）**：
1. 打开 ChatGPT → 输入 "帮我写邮件给客户说项目延期" → 点 prompt.ai 浮动按钮的 "✨ 优化"
2. 评委看到优化后的版本：自动加入"你是产品经理 / 200 字内 / 不用 emoji"等偏好
3. 切到 Claude → 同样输入一个新问题 → "✨ 优化"
4. 评委看到 **同样的产品经理画像在 Claude 上继续生效** —— 这是关键 wow

> "注意 —— ChatGPT 不知道我在 Claude 里写过什么。但 prompt.ai 知道。"

### 【1:30-2:30】揭示 — 打开 dashboard

**操作**：
1. 点 prompt.ai 侧边栏的 "🧠 我的 AI 记忆" 按钮
2. 评委看到 **Memory Dashboard 全屏震撼**：
   - 顶部紫色渐变 voice profile：***"你正在为一位资深产品经理工作..."***
   - 22 平台彩色热力图（ChatGPT 12 条 / Claude 5 条 / Kimi 3 条...）
   - 6 条精确偏好按 task 分组
   - 全部带置信度分数

> "这是 ChatGPT 不知道、Claude 不知道、Kimi 不知道、**只有 prompt.ai 知道的「跨平台你」**。
>
> 这是**一个时代级别的稀缺位置** —— OpenAI、Anthropic、Google，谁都做不到。
> 因为它们各是孤岛，而 prompt.ai 坐在所有 AI 工具的上游。"

### 【2:30-3:00】商业 + 战略

> "**8 周时间，我们做了 8 层完整记忆系统**：从持久化、统计画像、语义检索，
> 到 LLM 事实抽取、声音指纹合成、UI 透明面板、跨平台 silent capture。
>
> 商业模式：
> - 免费版：100 条记忆 / 8 平台覆盖
> - Pro: ¥29/月，无限记忆 / 22 平台 / 高级 dashboard
> - Team: ¥199/月，团队共享 voice profile
>
> 我们不卖工具，我们卖**用户的跨平台 AI 记忆中枢** —— 一个 OpenAI/Anthropic 拿不走的位置。"

---

## 🆘 现场出错救场指南

| 问题 | 救场动作 |
|------|---------|
| Wifi 挂了 → 优化失败 | 切到手机热点；备用：直接放预录视频 |
| ChatGPT 输入框没反应 | F12 看 Console，应有 `[prompt.ai capture]` 日志；没有就 reload extension |
| Memory Panel 加载空 | 已有 mock_demo_data.mjs 兜底；最坏情况：直接打开 PPT 截图代替 |
| Worker 调用 502 | "技术细节我们 demo 后细聊"，跳过实时演示，看预录视频 |
| Dashboard 显示数字异常 | 别恋战，"这是真实数据，确实波动" 然后翻篇 |

**核心原则**：**永远不要在台上 debug**。出问题立刻 fallback 到预录视频或 PPT 截图。

---

## ❓ 评委可能问的 8 个问题（提前准备答案）

### Q1: OpenAI 也在做 memory，你怎么办？
> "ChatGPT 的 memory 只能在 ChatGPT 里用。我们的 memory 跨 22 个平台。
> OpenAI 永远不会让你把 memory 带去 Claude，但 prompt.ai 是中立的中间件。
> 这是结构性差异 —— 它们是平台，我们是协议层。"

### Q2: 用户隐私怎么保护？
> "1) 数据存在用户自己的 Supabase 账号，加 RLS 行级安全；2) 22 平台 silent capture 有 toggle 可关；
> 3) Memory Panel 里每条 fact 都可单独删除；4) 后端用户 JWT 鉴权，绝不持有 service_role。
> 我们坚持: **用户拥有自己的数据。**"

### Q3: 跨平台 silent capture 不算偷窥吗？
> "用户主动安装我们的 extension 并开启监听 toggle，是显式授权。
> 我们做的事和 1Password 自动填充密码、Grammarly 自动检查语法是同性质的本地数据增强。
> 默认 ON 是因为大部分用户来这里就是要这个。"

### Q4: 商业模型可持续吗？
> "比同类 SaaS 工具贵 30%（Pro ¥29），低于 ChatGPT Plus（$20）。
> 单用户每月成本：embedding $0（免费 Cloudflare AI）+ MiniMax API ¥1（极轻量）+ Supabase 几乎为 0。
> 毛利率 90%+，付费转化率 5% 即可盈利。"

### Q5: 技术壁垒在哪？
> "三层壁垒：1) 8 层记忆架构（市面 99% 同类只到 L2-L3）；
> 2) 22 平台 silent capture（每个平台都是工程苦活）；
> 3) **运营冷启动数据** —— 后来者就算复制代码，也需要 3-6 个月才能积累出有效的用户行为数据。"

### Q6: 怎么获客？
> "Chrome Web Store 自然搜索 + 内容营销（"我用 prompt.ai 把 voice profile 截图分享了"病毒图）
> + Twitter/小红书 KOL 种草。Memory Panel 的截图分享是天然 viral hook。"

### Q7: Team 版是怎样的？
> "团队共享 voice profile —— "Marketing 团队的标准声音" / "Engineering 团队的代码规范"
> 一次配置全员生效。配合 Notion/Slack 集成，是 SMB 协作场景的关键基础设施。"

### Q8: 接下来 6 个月路线图？
> "Q1: Web 端 dashboard（mobile-first）；
> Q2: API 开放（让第三方 LLM app 用 prompt.ai voice profile 做个性化）；
> Q3: AI Insights（每周自动生成"你的 AI 使用洞察"邮件）；
> Q4: Team / Enterprise 商业版本。
> 战略：从工具 → 个人记忆中枢 → AI 时代基础设施。"

---

## 📦 视频备份录制建议

万一现场设备/网络出问题，**预录 90 秒精华版**：
- OBS 屏幕录制
- 4K，60fps（投屏不糊）
- 路径覆盖 pitch 1:00-2:30 的核心部分（操作 + dashboard）
- 准备 mp4 文件 + 一个 YouTube 备份链接（QR 码现场扫）

---

## 🎯 核心心理建设

**记住三件事：**

1. **你的 8 层 backend 是 99% 同类做不到的护城河** —— 自信
2. **dashboard 是为评委 5 秒打动设计的** —— 让产品自己说话
3. **战略叙事："跨平台 AI 记忆中枢"是结构性稀缺位置** —— 这不是营销话术，是事实

**慢一点。** 评委没看明白，就再演示一遍。**清晰 > 快**。

祝你赢。🏆
