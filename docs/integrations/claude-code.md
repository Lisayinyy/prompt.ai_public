# prompt.ai MCP — 在 Claude Code / Cursor / Copilot CLI 里用 prompt.ai

> v34: prompt.ai 的 worker 现在同时是个 **MCP HTTP server**。一行命令接入,所有支持 MCP 的 AI 工具都能用 prompt.ai 优化引擎。

---

## 🚀 30 秒接入 Claude Code

```bash
claude mcp add prompt-ai https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp
```

完事。重启 Claude Code,你就能调 `optimize_prompt` 工具了。

---

## 用法

### 在 Claude Code 里手动调

跟 Claude 说:
> "用 prompt-ai 的 optimize_prompt 工具优化这条:'帮我写客户延期邮件'"

Claude Code 会自动调 MCP tool,**1-2 秒后返回**专业优化版(自动加角色 / 任务 / 输出要求结构)。

### 或者用 hook 自动优化每条 prompt(power user)

`~/.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "command": "curl -s -X POST https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"optimize_prompt\",\"arguments\":{\"prompt\":\"$CLAUDE_USER_PROMPT\"}}}' | jq -r .result.content[0].text"
      }
    ]
  }
}
```

每条你输入的 prompt **自动经 prompt.ai 优化后**再发给 Claude。

---

## 工具清单(目前)

| Tool | 描述 | 参数 |
|---|---|---|
| `optimize_prompt` | 把模糊指令优化成专业 prompt(自动加角色/任务/输出格式) | `prompt` (required), `target_ai`, `tone` |

未来会加:
- `search_history` — 跨 22 平台搜历史 prompt(需 JWT)
- `list_templates` — 列出你的模板库
- `use_template` — 用模板填空
- `get_voice_profile` — 拿你的 AI 声音指纹

---

## 测试

```bash
# 1. initialize handshake
curl -s -X POST https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# 应返: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{...}}}

# 2. list tools
curl -s -X POST https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
# 应返: {"result":{"tools":[{"name":"optimize_prompt",...}]}}

# 3. 真实优化调用
curl -s -X POST https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"optimize_prompt","arguments":{"prompt":"帮我写邮件给客户说项目延期"}}}'
# 应返优化后 prompt 文本
```

---

## 战略意义

prompt.ai 不是 Chrome 扩展产品,**是 AI 第二大脑**。

- **UI 是表层**:浏览器 sidebar 只是其中一种 surface
- **核心是 backend**:LLM 优化引擎 + voice profile + memory + templates
- **MCP 是协议**:把 backend 暴露给任何 AI 工具,跨 web / CLI / IDE 都生效

OpenAI 的 memory 出不了 ChatGPT。Anthropic 的 projects 出不了 Claude。
**只有中立的 prompt.ai,通过 MCP 把"你"带到任何 AI 工具里。**

这是 MCP 时代的结构性稀缺位置。
