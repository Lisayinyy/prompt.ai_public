#!/bin/bash
# test_mcp.sh — 测试 prompt.ai MCP 端点
# 用法: bash scripts/test_mcp.sh

URL="https://prompt-optimizer-api.prompt-optimizer.workers.dev/mcp"

echo "================================"
echo "Test 1: initialize"
echo "================================"
curl -sS -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
echo ""
echo ""

echo "================================"
echo "Test 2: tools/list"
echo "================================"
curl -sS -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
echo ""
echo ""

echo "================================"
echo "Test 3: tools/call optimize_prompt (调 MiniMax, 等几秒)"
echo "================================"
curl -sS -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"optimize_prompt","arguments":{"prompt":"帮我写邮件给客户说项目延期一周"}}}'
echo ""
echo ""
echo "✓ 全部跑完"
