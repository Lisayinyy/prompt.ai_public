#!/usr/bin/env bash
# prompt.ai — fresh clone 一键 setup
# Usage: bash setup.sh

set -e

echo "🚀 prompt.ai 一键 setup"
echo "─────────────────────────────"

# 1. 检查 node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 没装。去 https://nodejs.org 装一个 (≥ 18)"
  exit 1
fi
echo "✓ Node $(node -v)"

# 2. 装依赖
echo ""
echo "📦 安装依赖 (npm install)..."
npm install --silent

# 3. Build
echo ""
echo "🔨 Build extension..."
npm run build

# 4. 报告 Chrome 加载路径
EXTENSION_PATH="$(pwd)/extension"
echo ""
echo "─────────────────────────────"
echo "✅ Setup 完成"
echo ""
echo "📍 Chrome 加载路径:"
echo "   $EXTENSION_PATH"
echo ""
echo "📋 下一步:"
echo "   1. 打开 chrome://extensions/"
echo "   2. 右上角开 [开发者模式]"
echo "   3. 点 [加载已解压的扩展程序] → 选上面那个 extension/ 目录"
echo "   4. 看到 prompt.ai 卡片 = ✓"
echo ""
echo "📚 接下来读: QUICKSTART.md (5 分钟跑通) 或 docs/DEMO_DAY.md (比赛作战手册)"
