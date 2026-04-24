# Prompt Optimizer — 后端部署指南

## 一键部署步骤

### 1. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```
会打开浏览器让你授权，免费账号即可。

### 3. 设置 API Key（安全存储，不写在代码里）
```bash
cd worker
wrangler secret put MINIMAX_API_KEY
```
粘贴你的 MiniMax API Key，回车。

### 4. 部署
```bash
wrangler deploy
```
部署成功后会输出一个 URL，类似：
`https://prompt-optimizer-api.你的账号.workers.dev`

### 5. 更新前端配置
把 `config.js` 中的 `API_URL` 改成上面的 URL。

## 本地测试
```bash
cd worker
wrangler dev
```
然后把 `config.js` 中的 URL 改成 `http://127.0.0.1:8787`

## 免费额度
Cloudflare Workers 免费版：每天 10 万次请求，完全够用。
