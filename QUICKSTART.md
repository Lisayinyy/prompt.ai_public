# prompt.ai — Quickstart (5 分钟跑通)

## 🚀 最短路径

```bash
git clone https://github.com/Lisayinyy/prompt.ai_public.git
cd prompt.ai_public
bash setup.sh                # 一键 install + build,完成后会告诉你 Chrome 加载哪个目录
```

打开 `chrome://extensions/` → 右上角开 **开发者模式** → 点 **加载已解压的扩展程序** → 选上面 setup.sh 提示的 `extension/` 目录。

完事 — sidebar 应该能开了。

---

## 📁 项目结构(重要!)

```
prompt.ai/
├── extension/              ← Chrome 实际加载这个 ⚠️
│   ├── manifest.json       (权限配置)
│   ├── content.js          (注入 22 平台,silent capture)
│   ├── background.js       (service worker)
│   ├── index.html          (sidebar HTML)
│   └── assets/index.js     (vite 编译的 React 主 bundle, npm run build 自动覆盖)
├── src/                    ← React 源码 (vite 编译目标)
│   └── app/components/
│       ├── Sidebar.tsx     (5237 行,核心)
│       ├── MemoryPanel.tsx (1160 行,记忆 dashboard)
│       └── ProjectsTab.tsx (712 行,项目工作台)
├── content.js              ← 源码,build 时自动 cp 到 extension/
├── manifest.json           ← 同上
├── background.js           ← 同上
├── icons/                  ← 同上
├── worker/                 ← Cloudflare Worker (单独 deploy)
│   ├── worker.js           (2128 行)
│   └── wrangler.toml
└── supabase/migrations/    ← SQL schema (按时间序应用)
```

**重要规则**: 改根目录的 `content.js` / `manifest.json` 后必须 `npm run build` 才能同步到 `extension/`。

---

## 🔧 完整开发环境(可选)

下面这些只在你想自己跑 worker / 改 schema 时才需要。**只想看 demo,跳过这一节就行**。

### a. 部署 Worker(已经在云上,你 fork 了再做)

```bash
cd worker
wrangler login                                        # 第一次
wrangler secret put MINIMAX_API_KEY                   # MiniMax LLM
wrangler secret put SUPABASE_SERVICE_ROLE_KEY         # cron 用
wrangler secret put RESEND_API_KEY                    # 邮件用
wrangler secret put TEST_EMAIL_KEY                    # /test-email 端点保护
wrangler deploy
```

### b. 应用 Supabase migrations

```bash
supabase login
supabase link --project-ref <你的 project_ref>
supabase db push
```

### c. 灌 demo 数据(让新账号 dashboard 满)

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
export DEMO_USER_ID="<你的 user_id>"   # sidebar 设置面板能看到
node scripts/mock_demo_data.mjs
```

灌完会有:**27 条 prompts + 6 条 facts + 3 个项目 + 3 个模板 + 1 个 voice profile**。

---

## 🧪 快速验证(5 步)

按顺序点一遍,任何一步炸说明有问题:

| # | 操作 | 应该看到 |
|---|---|---|
| 1 | 打开 ChatGPT.com,输入框聚焦 | 出现 `✨ 优化` 浮动按钮 |
| 2 | 输入 "hello",点 ✨ 优化 | 优化版替换原文 |
| 3 | 打开 prompt.ai sidebar (浏览器右上角扩展图标) | 5 tab + 登录按钮 |
| 4 | 点登录 → Google → 选账号 | sidebar 显示头像/邮箱 |
| 5 | 切到 🧠 我的 AI 记忆 | 看到 voice profile + 平台热力图 |

跑通这 5 步 = 比赛核心 demo 没问题。

---

## 📚 更多文档

- `docs/DEMO_DAY.md` — 比赛当天作战手册(3 分钟讲稿 + 8 步 smoke test + 救场 fallback)
- `docs/DEMO_GUIDE.md` — 完整 pitch 脚本 + 评委 Q&A
- `worker/README.md` — Worker 部署细节

---

## ❓ 常见问题

**Q: sidebar 一片空白?**
A: F12 → Console 看红字 ReferenceError。最近一次类似 bug 是 `void lang;` 写错位置(已修)。

**Q: 优化按钮没反应?**
A: F12 → Network 看 `/` POST 是否 200。失败可能是 worker URL 错或者 MiniMax key 没配。

**Q: silent capture 没记录?**
A: 必须登录 + 22 平台之一 + 输入 ≥10 字 + 点发送。F12 console 应有 `[prompt.ai capture]` 日志。

**Q: 改了源代码 chrome 不更新?**
A: `npm run build` → `chrome://extensions/` → 点 🔄 reload prompt.ai → 关 sidebar 重开。
