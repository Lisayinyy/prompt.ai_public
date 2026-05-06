# 🏆 prompt.ai 比赛当天作战手册

> 单页打印,带在身边。比赛前 24h 反复读 3 遍。

---

## ⏰ 比赛前 24h 倒计时清单

### T-24h:环境就绪(60 min)
- [ ] `git clone https://github.com/Lisayinyy/prompt.ai_public.git fresh && cd fresh`
- [ ] `bash setup.sh`(install + build,看输出的 extension/ 路径)
- [ ] Chrome → chrome://extensions/ → 加载已解压 → 选 extension/
- [ ] 笔记本充满电 + 备用电源
- [ ] 确认 VPN/网络稳定(workers.dev 在大陆需要 VPN)

### T-12h:数据就绪(30 min)
- [ ] **重新登录 demo 账号**(防止 JWT 过期)
- [ ] 跑 `node scripts/mock_demo_data.mjs` 灌 27 prompts + 3 项目 + 3 模板 + voice profile
- [ ] 截图所有 tab 备用(优化结果 / 历史 / 项目 / 模板 / 🧠 dashboard)
- [ ] 上述截图全部塞 PPT 备用页

### T-2h:压测演习(30 min)
- [ ] 完整跑一遍 8 步 smoke test(下面)
- [ ] 录 90 秒备份视频(必须!OBS 4K 60fps,上传 YouTube/B 站)
- [ ] 关掉所有非必要 chrome 扩展
- [ ] 字体调到投屏可见

### T-0:开演前 5 min
- [ ] **手动登录确认**(绝不要现场登)
- [ ] 测一次 ✨ 优化 在 ChatGPT 上能跑
- [ ] 切到 🧠 dashboard 看数据正常
- [ ] 喝水

---

## 🧪 8 步 Smoke Test(每场 demo 前必跑一遍)

| # | 操作 | 期望 | 失败救场 |
|---|---|---|---|
| 1 | 在 ChatGPT 输入"帮我写邮件给客户说项目延期"→点 ✨ | 输入框变优化版 | "技术细节赛后聊",直接放 PPT 截图 |
| 2 | 切到 prompt.ai sidebar → 历史 tab | 看到刚优化的 prompt | 重 reload sidebar |
| 3 | 在 ChatGPT 输入"测试" → 直接发送(不点优化) | sidebar 历史出现 silent_capture 那条 | F12 console 看 `[prompt.ai capture]` 日志 |
| 4 | 历史 tab 展开任意条 | 应有 🤖 AI 响应紫色卡(若是 ChatGPT/Claude/Kimi/DeepSeek)| 若没,表示响应还在 streaming,等 5 秒 |
| 5 | 切 📁 项目 tab → 点示例项目 | 看到 brief + prompt 列表 | 点 🔄 重新生成简报 |
| 6 | 切 📚 模板 tab → 点示例模板的 ↗ 使用 | 弹模板填空 → 跳到 optimize tab | 直接复制 prompt 文本贴到对话框 |
| 7 | 任何 tab 按 ⌘K | 命令面板弹出 | 用鼠标点 tab 切换 |
| 8 | 切 🧠 我的 AI 记忆 | 顶部紫色 voice profile + 22 平台热力图 + 项目 Top 5 + 模板 Top 5 | 显示 PPT 截图 |

---

## 🎤 3 分钟 pitch 讲稿(背熟)

### 【0:00-0:20】开场 — 真痛点
> "举个手 — 在座有多少人每天用 ChatGPT、Claude、Kimi、Gemini 这些 AI?...几乎都举了。
>
> 那再问一个 — **你能找到上周问 ChatGPT 写的那个营销文案 prompt 吗?**...大部分人摇头。
>
> 这就是今天 AI 用户的真实场景:**4 个平台、几百条 prompt,全是流水账,没 folder、没搜索、没模板**。
>
> 我们做了 prompt.ai —— **你 AI 工作的第二大脑**。"

### 【0:20-2:00】Demo — 4 个核心场景

#### 场景 1: 优化 + 自动归档(25s)
- 打开 ChatGPT,输入客户延期邮件 prompt → 点 ✨ 优化
- **指评委注意紫色 banner**: "💡 看起来属于 [创业公司官网] (87% 匹配)"
- 点 ✓ 加入

> "它**自动认出来**这条属于哪个项目 — LLM 语义匹配,不是关键词。"

#### 场景 2: 项目 brief 一目了然(30s)
- 切 📁 项目 → 点"创业公司官网"
- **顶部 LLM 自动生成的项目 brief**

> "这个 brief 是 LLM 看完项目里所有 prompt 自动生成的。每周自动刷新,你打开就知道:**这个项目我用 AI 做了什么、效果如何**。"

#### 场景 3: 模板一键复用(35s)
- 切 📜 历史 → 找到客户延期邮件 → 点 [💾 存为模板]
- 切 📚 模板 → 看到刚存的,**自动识别 4 个 {{变量}}**
- 点 [↗ 使用模板] → 填空 → 一键填到 ChatGPT

> "下次同类需求 **5 秒搞定** — 你的 prompt 终于变成了**资产**。"

#### 场景 4: 跨平台搜索(20s)
- 搜"客户邮件"
- 跨 ChatGPT/Claude/Kimi 平台,**黄色高亮**显示匹配关键词

> "**ChatGPT 不知道你在 Claude 里写过什么。但 prompt.ai 都知道。**"

### 【2:00-2:30】Memory Dashboard 揭示

- 点 🧠 我的 AI 记忆
- **全屏震撼**:voice profile + 22 平台热力图 + 项目 Top 5 + 模板 Top 5

> "这是 ChatGPT 不知道、Claude 不知道、Kimi 不知道的 **'跨平台的你'**。
>
> 我们不是又一个 ChatGPT 套壳 — **我们是 AI 时代的 Notion + Anki**。"

### 【2:30-3:00】商业 + 战略
> "8 周做了完整 5 大模块:跨平台优化 / 项目空间 / 模板系统 / 跨平台搜索 / 记忆中枢。
>
> 商业模式:免费 100 条 → Pro ¥29 无限 → Team ¥199 共享。
>
> 我们不卖工具,**我们卖你的 AI 工作流第二大脑** — 一个 OpenAI、Anthropic 都拿不走的位置。
>
> 而且这只是浏览器层 — **下一步通过 MCP 协议接入 Claude Code、Cursor、Copilot CLI**,
> 同一份 voice profile 跨 web、跨 CLI、跨 IDE 都生效。这是 MCP 时代的结构性稀缺位置。"

---

## 🆘 现场救场 7 大原则

| 问题 | 救场动作 |
|------|---------|
| WiFi 挂 | 切手机热点;再不行直接放预录视频 |
| 优化按钮无反应 | F12 看 console;救场词:"网络抖动,我们看下视频" |
| Sidebar 空白 | F12 console 看 ReferenceError,reload extension |
| Memory dashboard 空 | "示例数据加载中,看下截图"(切 PPT) |
| 项目 brief 没生成 | "首次需 5 秒",直接展示 mock 数据截图 |
| Worker 502 | "技术细节赛后聊",跳过 |
| 任何不可恢复 bug | **绝不要在台上 debug**,立刻视频 fallback |

---

## ❓ 评委高频 10 问(精简答案)

1. **OpenAI/Anthropic 也在做 memory?**
   → ChatGPT memory 出不了 ChatGPT。我们跨 22 平台。结构性差异。

2. **隐私怎么保护?**
   → 数据在用户自己 Supabase + RLS;每条 fact 可单删;有 GDPR 一键导出+删账号。

3. **silent capture 不算偷窥?**
   → 用户主动开 toggle 显式授权;跟 1Password 自动填密码同性质。

4. **商业模型?**
   → embedding $0(Cloudflare AI 免费)+ MiniMax ¥1/月/人 + Supabase 几乎 0 = 90% 毛利。

5. **技术壁垒?**
   → 8 层记忆架构(99% 同类只到 L2-L3) + 22 平台 silent capture + 冷启动数据护城河。

6. **怎么获客?**
   → Chrome Web Store + 内容营销(Memory dashboard 截图分享是天然 viral)。

7. **Team 版?**
   → 共享 voice profile + 项目 + 模板;企业 SOP 一次配置全员生效。

8. **6 个月路线图?**
   → **Q1 上 MCP server**, prompt.ai 第二大脑通过协议层接入 Claude Code / Cursor / Copilot CLI — 同一份 voice profile + templates + memory, 跨 web / CLI / IDE 都生效 / Q2 Web dashboard / Q3 Team 共享 / Q4 Enterprise。

9. **自动归档准确率?**
   → LLM 60% 阈值 + banner 提示用户点 ✓,**绝不主动归档**。0 抱怨归错。

10. **跟 Notion AI / Mem 有什么不同?**
    → 它们是 standalone app,我们是**寄生在所有 AI 平台上游**的中立中间件。

11. **能在 Claude Code / Cursor / Copilot CLI 里用吗?(高频提问)**
    → **Q1 通过 MCP server 接入**。架构上 prompt.ai 不是 Chrome 扩展产品,
    是 **跨工具的 AI 第二大脑** —— UI 只是表层,核心 backend 通过 MCP 协议
    暴露给任何支持 MCP 的工具:Claude Code 用 hook 自动优化每条 prompt,
    Cursor 用 slash command 调模板, Copilot CLI 直接拿你的 voice profile。
    **同一个"你",跨 22 个网页 + 所有 CLI/IDE 工具,都生效**。
    OpenAI 做不到(他们 memory 出不了 ChatGPT),Anthropic 做不到(memory 出不了 Claude),
    **只有中立的 prompt.ai 能做** — 这是 MCP 时代的结构性稀缺位置。

---

## 🎯 心理建设(开演前 30 秒默念)

1. **你的 8 层 backend 是 99% 同类做不到的护城河** — 自信
2. **Dashboard 是为评委 5 秒打动设计的** — 让产品自己说话
3. **战略叙事:"AI 时代的第二大脑"是结构性稀缺位置** — 这不是营销,是事实

**慢一点。** 评委没看明白,就再演示一遍。**清晰 > 快**。

祝你赢 🏆
