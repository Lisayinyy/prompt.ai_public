# prompt.ai

**AI Task Launcher for the prompt era**

> Turn rough intent into a structured AI task, match it with the right model, then launch it directly into AI chat.

## What it does

prompt.ai is a Chrome extension that helps users go from vague ideas to execution-ready AI tasks.

Instead of starting from a blank box every time, users can:
- start from common task flows
- optimize rough requests into structured prompts
- get a model recommendation based on task type
- launch the result into ChatGPT, Claude, Kimi, DeepSeek, Gemini, and more
- save prompt history and review usage insights

## Core product pillars

- **Task Launchpad** — Start from real workflows like email writing, debugging, PRD drafting, translation, meeting summaries, and content creation
- **Prompt Optimization** — Transform rough input into clearer, more executable task specs
- **Model Recommender** — Detect task type and suggest the best-fit model using Artificial Analysis-informed recommendations
- **One-click Launch** — Fill the optimized result into supported AI chat interfaces
- **History & Insights** — Save, search, reuse, and analyze prompt usage over time

## Why this direction matters

Prompt-only tools will get commoditized.
prompt.ai is moving beyond prompt polishing toward an **AI task launcher**:
- understand the task
- structure the request
- recommend the model
- launch into execution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| UI | Tailwind CSS + custom component system |
| Build | Vite |
| Backend | Cloudflare Worker |
| AI Engine | MiniMax M2.7 |
| Database | Supabase (PostgreSQL) |
| Auth | Google OAuth via Supabase |
| Extension | Chrome Extension MV3 (Side Panel) |

## Project Structure

```text
prompt.ai/
├── src/                    # Frontend source (React + TypeScript)
├── worker/                 # Backend (Cloudflare Worker)
├── supabase/               # Database schema
├── extension/              # Built extension assets
├── website/                # Marketing / landing assets
└── dist/                   # Load this as unpacked extension after build
```

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Build for Chrome
```bash
npm run build
# Load dist/ as unpacked extension in Chrome
```

### Deploy Backend
```bash
cd worker
wrangler secret put MINIMAX_API_KEY
wrangler deploy
```

## Current focus

This repo is currently being upgraded from a generic prompt optimizer into a more complete **task-first AI workflow launcher** for demos, competition, and future monetization.

## License

MIT
