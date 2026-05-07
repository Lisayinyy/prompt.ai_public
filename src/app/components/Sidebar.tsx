import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  RotateCcw,
  Zap,
  Target,
  MessageSquare,
  Settings,
  History,
  ArrowRight,
  Wand2,
  Globe,
  Lightbulb,
  Languages,
  BarChart3,
  LogIn,
  LogOut,
  User,
  Clock,
  Brain,
  Code,
  FileText,
  PenTool,
  Search,
  TrendingUp,
  Calendar,
  ChevronLeft,
  Folder,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MemoryPanel } from "./MemoryPanel";
import { OnboardingCard } from "./OnboardingCard";
import { ProjectsTab } from "./ProjectsTab";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type Lang = "en" | "zh";
type Tab = "optimize" | "history" | "projects" | "settings" | "insights";

// ─── i18n ───────────────────────────────────────────
const i18n: Record<Lang, Record<string, string>> = {
  en: {
    optimize: "Optimize",
    history: "History",
    projects: "Projects",
    settings: "Settings",
    insights: "Insights",
    targetAi: "TARGET AI",
    tone: "TONE",
    yourPrompt: "YOUR PROMPT",
    clear: "Clear",
    placeholder: "Type or paste your prompt here...",
    chars: "chars",
    tip: "Be specific for best results",
    optimizeBtn: "Optimize Prompt",
    optimizing: "Optimizing...",
    optimizedResult: "OPTIMIZED RESULT",
    copy: "Copy",
    copied: "Copied!",
    clarity: "Clarity",
    specificity: "Specificity",
    structure: "Structure",
    addContext: "Add context automatically",
    addContextDesc: "Include relevant context clues in prompts",
    includeExamples: "Include examples",
    includeExamplesDesc: "Add example outputs to guide AI responses",
    autoOptimize: "Auto-optimize on paste",
    autoOptimizeDesc: "Instantly optimize when text is pasted",
    language: "LANGUAGE",
    languageDesc: "Interface and output language",
    shortcuts: "SHORTCUTS",
    openSidebar: "Open sidebar",
    optimizePrompt: "Optimize prompt",
    copyResult: "Copy result",
    footerCount: "optimizations today",
    connected: "Connected",
    anyAi: "Any AI",
    Professional: "Professional",
    Casual: "Casual",
    Academic: "Academic",
    Creative: "Creative",
    Concise: "Concise",
    signIn: "Sign in",
    signOut: "Sign out",
    signInDesc: "Sign in to unlock usage insights and prompt analytics",
    totalPrompts: "Total Prompts",
    totalHours: "Hours Saved",
    avgScore: "Avg Score",
    streak: "Day Streak",
    usageOverTime: "USAGE OVER TIME",
    modelUsage: "MODEL USAGE",
    taskBreakdown: "TASK BREAKDOWN",
    topTopics: "TOP TOPICS",
    peakHours: "PEAK HOURS",
    monthlyReport: "Your monthly report",
    promptsThisMonth: "prompts this month",
    moreProductive: "more productive than last month",
    coding: "Coding",
    writing: "Writing",
    research: "Research",
    creative: "Creative",
    analysis: "Analysis",
    other: "Other",
    loginForInsights: "Sign in to view your insights",
    loginForInsightsDesc:
      "Track your AI usage patterns, discover your prompt habits, and get personalized optimization suggestions.",
    back: "Back",
    optimized: "Optimized",
    original: "Original",
    taskLaunchpad: "TASK LAUNCHPAD",
    popularFlows: "Popular flows",
    taskHint: "Start from a real task instead of a blank prompt.",
    resultDiff: "WHAT IMPROVED",
    originalRequest: "Original request",
    launchActions: "NEXT STEP",
    optimizeAndFill: "Fill now",
    optimizeForChatGPT: "For ChatGPT",
    optimizeForClaude: "For Claude",
    chooseScenario: "Choose a scenario",
    taskSummary: "TASK SUMMARY",
    selectedFlow: "Selected flow",
    whyThisModel: "WHY THIS MODEL",
    readyToUse: "READY TO USE",
    demoReady: "DEMO READY",
    compareView: "BEFORE / AFTER",
    strongestFlow: "Best demo path",
    optimizeFlow: "Optimize now",
    launchNow: "Fill now",
    scenarioTag: "Scenario",
    reuseNow: "Reuse",
    recentBest: "Recent prompts",
    historyAssetHint: "Turn good prompts into reusable assets.",
    recommendedFlow: "Recommended",
    demoScenarios: "Demo scenarios",
    bestForStage: "Best on stage",
    fastTrack: "Fast track",
    demoHint: "Use these when you need a fast, high-contrast demo.",
    quickPick: "Quick picks",
    showMore: "More",
    showLess: "Less",
    scenarioOptional: "Optional shortcuts",
  },
  zh: {
    optimize: "优化",
    history: "历史",
    projects: "项目",
    settings: "设置",
    insights: "洞察",
    targetAi: "目标 AI",
    tone: "语气",
    yourPrompt: "你的提示词",
    clear: "清除",
    placeholder: "输入或粘贴你的提示词...",
    chars: "字符",
    tip: "越具体，效果越好",
    optimizeBtn: "优化提示词",
    optimizing: "优化中...",
    optimizedResult: "优化结果",
    copy: "复制",
    copied: "已复制!",
    clarity: "清晰度",
    specificity: "具体性",
    structure: "结构性",
    addContext: "自动添加上下文",
    addContextDesc: "在提示词中加入相关上下文线索",
    includeExamples: "包含示例",
    includeExamplesDesc: "添加示例输出来引导 AI 回答",
    autoOptimize: "粘贴时自动优化",
    autoOptimizeDesc: "粘贴文本时自动进行优化",
    language: "语言",
    languageDesc: "界面与输出语言",
    shortcuts: "快捷键",
    openSidebar: "打开侧栏",
    optimizePrompt: "优化提示词",
    copyResult: "复制结果",
    footerCount: "今日已优化",
    connected: "已连接",
    anyAi: "所有 AI",
    Professional: "专业",
    Casual: "日常",
    Academic: "学术",
    Creative: "创意",
    Concise: "简洁",
    signIn: "登录",
    signOut: "退出登录",
    signInDesc: "登录后可查看使用洞察与提示词分析",
    totalPrompts: "总提示词数",
    totalHours: "节省时长",
    avgScore: "平均分",
    streak: "连续天数",
    usageOverTime: "使用趋势",
    modelUsage: "模型使用分布",
    taskBreakdown: "任务类型分布",
    topTopics: "热门话题",
    peakHours: "活跃时段",
    monthlyReport: "你的月度报告",
    promptsThisMonth: "条提示词（本月）",
    moreProductive: "比上月效率提升",
    coding: "编程",
    writing: "写作",
    research: "研究",
    creative: "创意",
    analysis: "分析",
    other: "其他",
    loginForInsights: "登录查看你的洞察",
    loginForInsightsDesc:
      "追踪你的 AI 使用模式，发现提示词习惯，获取个性化优化建议。",
    back: "返回",
    optimized: "优化后",
    original: "原始",
    taskLaunchpad: "任务入口",
    popularFlows: "高频场景",
    taskHint: "别从空白开始，直接从真实任务出发。",
    resultDiff: "本次增强",
    originalRequest: "原始需求",
    launchActions: "下一步",
    optimizeAndFill: "直接填入",
    optimizeForChatGPT: "适配 ChatGPT",
    optimizeForClaude: "适配 Claude",
    chooseScenario: "选择一个场景",
    taskSummary: "任务摘要",
    selectedFlow: "当前场景",
    whyThisModel: "为什么推荐",
    readyToUse: "可直接使用",
    demoReady: "演示推荐",
    compareView: "优化前后",
    strongestFlow: "最佳演示路径",
    optimizeFlow: "立即优化",
    launchNow: "直接填入",
    scenarioTag: "场景",
    reuseNow: "复用",
    recentBest: "最近沉淀",
    historyAssetHint: "把好 prompt 沉淀成可复用资产。",
    recommendedFlow: "推荐",
    demoScenarios: "演示场景",
    bestForStage: "上台最稳",
    fastTrack: "快捷路径",
    demoHint: "如果你要快速演示，优先用这两个场景。",
    quickPick: "快捷场景",
    showMore: "更多",
    showLess: "收起",
    scenarioOptional: "可选快捷入口",
  },
};

const TONES = ["Professional", "Casual", "Academic", "Creative", "Concise"];

// 按 Artificial Analysis Intelligence Index 排序
const AI_TARGETS = [
  { id: "any", name: "Any AI", icon: Globe },
  { id: "gemini", name: "Gemini", icon: Brain },           // AA #1: 57
  { id: "chatgpt", name: "ChatGPT", icon: MessageSquare }, // AA #2: 57
  { id: "claude", name: "Claude", icon: Sparkles },        // AA #3: 53
  { id: "zhipu", name: "GLM / 智谱", icon: Brain },        // AA #4: 50 (开源第一)
  { id: "minimax", name: "MiniMax", icon: Zap },           // AA ~50
  { id: "deepseek", name: "DeepSeek", icon: Search },      // AA ~48
  { id: "kimi", name: "Kimi", icon: Zap },                 // AA #6: 47
  { id: "grok", name: "Grok", icon: Zap },                 // AA ~46
  { id: "tongyi", name: "Qwen / 通义", icon: MessageSquare }, // AA #7: 45
  { id: "mistral", name: "Mistral", icon: Sparkles },      // AA ~44
  { id: "perplexity", name: "Perplexity", icon: Search },  // 搜索增强
  { id: "copilot", name: "Copilot", icon: Code },          // Microsoft
  { id: "doubao", name: "豆包", icon: MessageSquare },      // 字节跳动
  { id: "wenxin", name: "文心一言", icon: PenTool },         // 百度
  { id: "genspark", name: "Genspark", icon: Sparkles },     // Genspark AI
];

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "zh", label: "中文", flag: "中" },
];

// ─── Phase 4: 任务识别 + AI 推荐引擎（基于 AA 榜单）────────────────
type TaskType = "code" | "writing" | "reasoning" | "data" | "translation" | "agent" | "general";

type ScenarioVariable = {
  key: string;
  labelZh: string;
  labelEn: string;
  placeholder?: string;
  type?: "text" | "textarea";
};

type ScenarioPreset = {
  id: string;
  task: TaskType;
  icon: string;
  title: { zh: string; en: string };
  prompt: { zh: string; en: string };
  variables?: ScenarioVariable[];
  template?: { zh: string; en: string };
};

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "email",
    task: "writing",
    icon: "✉️",
    title: { zh: "写商务邮件", en: "Write an email" },
    prompt: { zh: "帮我写一封专业英文邮件，催客户尽快确认报价，并保持礼貌坚定。", en: "Write a professional email asking a client to confirm the quotation soon, polite but firm." },
    variables: [
      { key: "recipient", labelZh: "收件人", labelEn: "Recipient", placeholder: "Johnson" },
      { key: "purpose", labelZh: "目的", labelEn: "Purpose", placeholder: "催确认Q3报价" },
      { key: "tone", labelZh: "语气", labelEn: "Tone", placeholder: "礼貌坚定" },
    ],
    template: {
      zh: "帮我写一封专业英文邮件给{{recipient}}，目的是{{purpose}}。语气{{tone}}，150-200词，包含 subject line。",
      en: "Write a professional email to {{recipient}} about {{purpose}}. Tone: {{tone}}, 150-200 words, include subject line.",
    },
  },
  {
    id: "debug",
    task: "code",
    icon: "🛠️",
    title: { zh: "排查代码报错", en: "Debug code" },
    prompt: { zh: "帮我分析这个报错的原因，并给出可执行的修复步骤和修改后的代码。", en: "Analyze this error, explain the root cause, and give me actionable fix steps with revised code." },
    variables: [
      { key: "language", labelZh: "编程语言", labelEn: "Language", placeholder: "Python / React / Go" },
      { key: "error", labelZh: "错误信息", labelEn: "Error message", placeholder: "TypeError: Cannot read...", type: "textarea" },
      { key: "context", labelZh: "上下文", labelEn: "Context", placeholder: "在调用API时触发" },
    ],
    template: {
      zh: "我在用{{language}}开发，遇到这个报错：\n{{error}}\n上下文：{{context}}\n请分析原因并给出修复代码。",
      en: "I'm working with {{language}} and got this error:\n{{error}}\nContext: {{context}}\nAnalyze the root cause and provide a fix.",
    },
  },
  {
    id: "content",
    task: "writing",
    icon: "🪄",
    title: { zh: "生成内容文案", en: "Create content" },
    prompt: { zh: "帮我写一篇适合社交媒体发布的推广文案，要有吸引力、结构清晰、带 CTA。", en: "Create a social media post with a strong hook, clean structure, and a clear CTA." },
    variables: [
      { key: "platform", labelZh: "平台", labelEn: "Platform", placeholder: "小红书 / Twitter / LinkedIn" },
      { key: "topic", labelZh: "主题", labelEn: "Topic", placeholder: "新产品发布" },
      { key: "style", labelZh: "风格", labelEn: "Style", placeholder: "轻松有趣 / 专业严谨" },
    ],
    template: {
      zh: "帮我写一篇{{platform}}的推广文案，主题是{{topic}}，风格{{style}}，要有吸引力、结构清晰、带 CTA。",
      en: "Create a {{platform}} post about {{topic}}. Style: {{style}}. Include a strong hook, clean structure, and clear CTA.",
    },
  },
  {
    id: "analysis",
    task: "data",
    icon: "📊",
    title: { zh: "做数据分析", en: "Analyze data" },
    prompt: { zh: "请根据这份数据总结核心趋势、异常点、原因猜测，并给出下一步建议。", en: "Summarize key trends, outliers, likely causes, and next-step recommendations from this data." },
    variables: [
      { key: "dataType", labelZh: "数据类型", labelEn: "Data type", placeholder: "用户增长 / 销售额 / 留存" },
      { key: "goal", labelZh: "分析目标", labelEn: "Analysis goal", placeholder: "找出转化率下降原因" },
    ],
    template: {
      zh: "请分析这份{{dataType}}数据，目标是{{goal}}。总结核心趋势、异常点、原因猜测，并给出下一步建议。",
      en: "Analyze this {{dataType}} data. Goal: {{goal}}. Summarize key trends, outliers, likely causes, and next-step recommendations.",
    },
  },
  {
    id: "resume",
    task: "writing",
    icon: "🧳",
    title: { zh: "求职 / Cover Letter", en: "Job application" },
    prompt: { zh: "根据我的背景，帮我写一封针对目标岗位的英文求职邮件 / cover letter，突出匹配度和可量化成果。", en: "Based on my background, write an English application email / cover letter for a target role, highlighting fit and measurable impact." },
    variables: [
      { key: "position", labelZh: "目标职位", labelEn: "Target position", placeholder: "Product Manager @ Google" },
      { key: "strengths", labelZh: "核心优势", labelEn: "Key strengths", placeholder: "3年PM经验，主导过DAU百万产品" },
    ],
    template: {
      zh: "帮我写一封英文求职信，目标职位是{{position}}，我的核心优势是{{strengths}}。突出匹配度和可量化成果，200词左右。",
      en: "Write a cover letter for {{position}}. My key strengths: {{strengths}}. Highlight fit and measurable impact, ~200 words.",
    },
  },
  {
    id: "meeting",
    task: "writing",
    icon: "📝",
    title: { zh: "会议纪要 / 总结", en: "Meeting summary" },
    prompt: { zh: "把这段会议内容整理成结构化纪要，包含核心结论、待办事项、负责人和截止时间。", en: "Turn these meeting notes into a structured summary with decisions, action items, owners, and deadlines." },
    variables: [
      { key: "meetingTopic", labelZh: "会议主题", labelEn: "Meeting topic", placeholder: "Q3产品规划评审" },
      { key: "decisions", labelZh: "关键决策", labelEn: "Key decisions", placeholder: "确定优先级、分配负责人", type: "textarea" },
    ],
    template: {
      zh: "把关于「{{meetingTopic}}」的会议内容整理成结构化纪要。关键决策：{{decisions}}。包含核心结论、待办事项、负责人和截止时间。",
      en: "Organize the meeting on \"{{meetingTopic}}\" into a structured summary. Key decisions: {{decisions}}. Include conclusions, action items, owners, and deadlines.",
    },
  },
  {
    id: "translate",
    task: "translation",
    icon: "🌍",
    title: { zh: "翻译 + 改写", en: "Translate + rewrite" },
    prompt: { zh: "把这段中文翻译成自然专业的英文，并根据海外用户阅读习惯进行润色改写。", en: "Translate this text into natural professional English and rewrite it for an international audience." },
    variables: [
      { key: "langPair", labelZh: "语言方向", labelEn: "Language pair", placeholder: "中文 → 英文" },
      { key: "text", labelZh: "原文", labelEn: "Source text", placeholder: "粘贴需要翻译的内容...", type: "textarea" },
    ],
    template: {
      zh: "请把以下内容翻译（{{langPair}}），并根据目标语言用户阅读习惯润色改写：\n\n{{text}}",
      en: "Translate the following ({{langPair}}) and rewrite it naturally for the target audience:\n\n{{text}}",
    },
  },
  {
    id: "prd",
    task: "writing",
    icon: "📐",
    title: { zh: "写 PRD / 方案", en: "Write a PRD" },
    prompt: { zh: "帮我把这个产品想法整理成清晰的 PRD，包含目标用户、核心功能、用户流程、优先级和成功指标。", en: "Turn this product idea into a clean PRD with target users, core features, user flow, priorities, and success metrics." },
    variables: [
      { key: "productName", labelZh: "产品名称", labelEn: "Product name", placeholder: "prompt.ai" },
      { key: "coreFeature", labelZh: "核心功能", labelEn: "Core feature", placeholder: "一键优化prompt并填入AI平台" },
    ],
    template: {
      zh: "帮我写「{{productName}}」的 PRD，核心功能是{{coreFeature}}。包含目标用户、核心功能、用户流程、优先级和成功指标。",
      en: "Write a PRD for \"{{productName}}\". Core feature: {{coreFeature}}. Include target users, core features, user flow, priorities, and success metrics.",
    },
  },
];

type AIRecommendation = {
  id: string;
  name: string;
  reason: string;
  reasonZh: string;
  badge: string;
  badgeZh: string;
  url: string;
  color: string;
};

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  code: ["代码","code","函数","function","bug","debug","api","接口","程序","python","javascript","typescript","react","vue","sql","git","算法","algorithm","编程","开发","报错","error","implement","写一个类","写一个函数"],
  writing: ["写一篇","写一封","邮件","email","文章","报告","总结","摘要","介绍","简历","cover letter","essay","blog","博客","新闻稿","公告","通知","说明书","文案","copywriting"],
  reasoning: ["分析","为什么","推理","逻辑","证明","论证","科学","数学","物理","化学","why","because","reason","explain","hypothesis","哲学","辩论"],
  data: ["数据","表格","excel","统计","图表","分析报告","data","chart","dashboard","可视化","趋势","增长率","转化率","同比","环比","指标"],
  translation: ["翻译","translate","英文","中文","日文","korean","french","german","spanish","把这段","用英语","用中文","改成英文","改成中文"],
  agent: ["自动化","workflow","流程","多步骤","agent","任务拆解","执行计划","帮我安排","帮我规划","step by step","分步"],
  general: [],
};

const AI_RECOMMENDATIONS: Record<TaskType, AIRecommendation[]> = {
  code: [
    { id: "minimax", name: "MiniMax M2.7", reason: "Code Arena Elo global #9, 1/10 cost of Claude", reasonZh: "Code Arena Elo 全球第9，成本仅 Claude 的 1/10", badge: "Best Value", badgeZh: "性价比最高", url: "https://agent.minimax.io", color: "#18181b" },
    { id: "claude", name: "Claude Sonnet", reason: "AA #3, top instruction following", reasonZh: "AA 第3，代码指令遵循最强", badge: "Top Quality", badgeZh: "质量最高", url: "https://claude.ai", color: "#6366f1" },
  ],
  writing: [
    { id: "claude", name: "Claude Sonnet", reason: "AA #3, best long-form writing & tone", reasonZh: "AA 第3，长文写作和语气最自然", badge: "Best Writing", badgeZh: "写作最强", url: "https://claude.ai", color: "#6366f1" },
    { id: "minimax", name: "MiniMax M2.7", reason: "AA ~50, great Chinese writing, 1/10 cost", reasonZh: "AA ~50，中文写作优秀，成本低", badge: "Best Value", badgeZh: "性价比最高", url: "https://agent.minimax.io", color: "#18181b" },
  ],
  reasoning: [
    { id: "gemini", name: "Gemini 2.5 Pro", reason: "AA #1 (57), top reasoning & science", reasonZh: "AA 第1（57分），推理和科学最强", badge: "AA #1", badgeZh: "AA 第一", url: "https://gemini.google.com", color: "#1a73e8" },
    { id: "chatgpt", name: "ChatGPT o3", reason: "AA #2 (57), advanced reasoning", reasonZh: "AA 第2（57分），复杂推理极强", badge: "AA #2", badgeZh: "AA 第二", url: "https://chat.openai.com", color: "#10a37f" },
  ],
  data: [
    { id: "chatgpt", name: "ChatGPT o3", reason: "AA #2, best data analysis + Code Interpreter", reasonZh: "AA 第2，数据分析+代码执行最强", badge: "AA #2", badgeZh: "AA 第二", url: "https://chat.openai.com", color: "#10a37f" },
    { id: "minimax", name: "MiniMax M2.7", reason: "GDPval-AA ELO1495, office tasks #1", reasonZh: "GDPval-AA ELO1495，办公场景第一", badge: "Office #1", badgeZh: "办公第一", url: "https://agent.minimax.io", color: "#18181b" },
  ],
  translation: [
    { id: "deepseek", name: "DeepSeek", reason: "AA ~48, excellent multilingual, very cheap", reasonZh: "AA ~48，多语言优秀，价格极低", badge: "Best Value", badgeZh: "性价比最高", url: "https://chat.deepseek.com", color: "#4d6bfe" },
    { id: "minimax", name: "MiniMax M2.7", reason: "Strong Chinese-English, low cost", reasonZh: "中英互译出色，成本低", badge: "CN Best", badgeZh: "中文最佳", url: "https://agent.minimax.io", color: "#18181b" },
  ],
  agent: [
    { id: "minimax", name: "MiniMax M2.7", reason: "Toolathon multi-agent top tier, 97% instruction follow", reasonZh: "Toolathon 多智能体第一梯队，指令遵从率97%", badge: "Agent #1", badgeZh: "Agent 最强", url: "https://agent.minimax.io", color: "#18181b" },
    { id: "claude", name: "Claude Sonnet", reason: "AA #3, excellent multi-step task handling", reasonZh: "AA 第3，多步骤任务处理出色", badge: "Top Quality", badgeZh: "质量最高", url: "https://claude.ai", color: "#6366f1" },
  ],
  general: [
    { id: "minimax", name: "MiniMax M2.7", reason: "AA ~50, best price-performance ratio", reasonZh: "AA ~50，性价比最高的全能模型", badge: "Best Value", badgeZh: "性价比最高", url: "https://agent.minimax.io", color: "#18181b" },
    { id: "gemini", name: "Gemini 2.5 Pro", reason: "AA #1, top overall intelligence", reasonZh: "AA 第1，综合能力最强", badge: "AA #1", badgeZh: "AA 第一", url: "https://gemini.google.com", color: "#1a73e8" },
  ],
};

const TASK_LABELS: Record<TaskType, { zh: string; en: string; icon: string }> = {
  code:        { zh: "写代码",   en: "Coding",      icon: "💻" },
  writing:     { zh: "写作",     en: "Writing",     icon: "✍️" },
  reasoning:   { zh: "推理分析", en: "Reasoning",   icon: "🔬" },
  data:        { zh: "数据分析", en: "Data",        icon: "📊" },
  translation: { zh: "翻译",     en: "Translation", icon: "🌐" },
  agent:       { zh: "自动化",   en: "Agent Task",  icon: "🤖" },
  general:     { zh: "通用问答", en: "General",     icon: "💬" },
};

function detectTaskType(text: string): TaskType {
  const lower = text.toLowerCase();
  for (const [task, keywords] of Object.entries(TASK_KEYWORDS) as [TaskType, string[]][]) {
    if (task === "general") continue;
    if (keywords.some(kw => lower.includes(kw))) return task;
  }
  return "general";
}

const buildImprovementNotes = (text: string, lang: Lang) => {
  const notesZh: string[] = [];
  const notesEn: string[] = [];
  const hasBullets = /(^|\n)\s*[-*•]|\n\d+\./m.test(text);
  const hasConstraints = /(must|should|include|avoid|输出|要求|包含|格式|请|约束)/i.test(text);
  const hasRole = /(as a|act as|你是|作为)/i.test(text);
  const hasLength = text.length > 180;

  if (hasRole) {
    notesZh.push("补充了角色或视角，让模型更容易进入任务状态");
    notesEn.push("Added a role or perspective so the model can enter the task faster");
  }
  if (hasBullets) {
    notesZh.push("把目标拆成结构化步骤，输出更稳定");
    notesEn.push("Restructured the ask into clear steps for more reliable output");
  }
  if (hasConstraints) {
    notesZh.push("明确了约束条件和输出要求，减少跑偏");
    notesEn.push("Clarified constraints and output requirements to reduce drift");
  }
  if (hasLength) {
    notesZh.push("补充了上下文细节，提高可执行性");
    notesEn.push("Added context details to make the task more executable");
  }

  const fallbackZh = ["把模糊需求改成了更清晰、可执行的任务说明"];
  const fallbackEn = ["Turned a vague idea into a clearer, more executable task brief"];
  return lang === "zh"
    ? (notesZh.length ? notesZh.slice(0, 3) : fallbackZh)
    : (notesEn.length ? notesEn.slice(0, 3) : fallbackEn);
};

const buildScenarioPrompt = (preset: ScenarioPreset, lang: Lang) => preset.prompt[lang];

const getScenarioLabel = (task: TaskType | null, lang: Lang) => {
  if (!task) return lang === "zh" ? "通用" : "General";
  return TASK_LABELS[task][lang];
};

// ─── Component ──────────────────────────────────────
export default function Sidebar() {
  const [lang, setLang] = useState<Lang>("zh");
  const [activeTab, setActiveTab] = useState<Tab>("optimize");
  const [inputText, setInputText] = useState("");
  const [selectedTone, setSelectedTone] = useState("Professional");
  const [selectedTarget, setSelectedTarget] = useState("any");
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [optimizedText, setOptimizedText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addContext, setAddContext] = useState(true);
  const [addExamples, setAddExamples] = useState(false);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // 获取头像 URL：优先 OAuth 头像，其次 Gravatar，最后默认
  const getAvatarUrl = (u: typeof user): string | null => {
    if (!u) return null;
    if (u.user_metadata?.avatar_url) return u.user_metadata.avatar_url;
    if (u.email) {
      // Gravatar: 用 DiceBear 做 fallback（无需 MD5，直接生成唯一头像）
      const seed = encodeURIComponent(u.email);
      return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=18181b&textColor=ffffff&fontSize=38`;
    }
    return null;
  };

  // 登录弹窗状态
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // 检查登录状态 + v13: JWT 同步到 chrome.storage 让 content.js 能调 Supabase
  useEffect(() => {
    const syncToStorage = (session: any) => {
      if (typeof chrome === "undefined" || !chrome?.storage?.local) return;
      if (session?.access_token && session?.user?.id) {
        chrome.storage.local.set({
          promptai_jwt: session.access_token,
          promptai_user_id: session.user.id,
        });
      } else {
        chrome.storage.local.remove(["promptai_jwt", "promptai_user_id"]);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setUser(session?.user ?? null);
      syncToStorage(session);
      // v23: 登录用户首次进入 → 弹 onboarding (localStorage 标记 dismiss 后不再弹)
      if (session?.user && typeof window !== "undefined") {
        const done = window.localStorage.getItem("promptai_onboarded");
        if (!done) setOnboardingOpen(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setUser(session?.user ?? null);
      syncToStorage(session);
      // v23: 新登录用户也触发 onboarding (注册后第一次)
      if (session?.user && typeof window !== "undefined") {
        const done = window.localStorage.getItem("promptai_onboarded");
        if (!done) setOnboardingOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 读取今日优化计数
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.get(["optimizeCount", "optimizeDate"]).then((data: Record<string, unknown>) => {
        if (data.optimizeDate === today && typeof data.optimizeCount === "number") {
          setOptimizeCount(data.optimizeCount);
        }
      });
    }
  }, []);

  const handleGoogleSignIn = async () => {
    // v23.1: 改用 chrome.identity.launchWebAuthFlow 是 chrome 扩展正统 OAuth 方案
    // 优势:
    //   1. redirectTo 用 chrome.identity.getRedirectURL() 返回的 chromiumapp.org URL
    //   2. Chrome 自动拦截 redirect,不用浏览器加载第三方页面
    //   3. 完全不依赖网络稳定性 / Supabase 根 URL 行为
    //   4. 不需要 chrome.scripting polling
    if (typeof chrome === "undefined" || !chrome?.identity) {
      // 非扩展环境 (如本地开发) fallback 到原 web flow
      const { data } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { queryParams: { prompt: "select_account" } },
      });
      if (data?.url) window.open(data.url, "_blank");
      return;
    }

    const redirectURL = chrome.identity.getRedirectURL();  // https://EXT_ID.chromiumapp.org/
    console.log("[prompt.ai oauth] expected redirectURL =", redirectURL);
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: redirectURL,
        queryParams: { prompt: "select_account" },
      },
    });
    if (!data?.url) {
      console.error("[prompt.ai oauth] supabase 没返 url, 检查 supabase auth 配置");
      return;
    }
    console.log("[prompt.ai oauth] 跳转到:", data.url);

    try {
      const responseUrl = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: data.url, interactive: true },
          (callbackUrl) => {
            if (chrome.runtime.lastError || !callbackUrl) {
              reject(new Error(chrome.runtime.lastError?.message || "OAuth cancelled"));
              return;
            }
            resolve(callbackUrl);
          }
        );
      });

      console.log("[prompt.ai oauth] 收到 callbackUrl =", responseUrl);
      // callbackUrl 形如 https://EXT_ID.chromiumapp.org/#access_token=...&refresh_token=...
      const hash = responseUrl.split("#")[1] || "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error("[prompt.ai oauth] setSession 失败:", error.message);
        } else {
          console.log("[prompt.ai oauth] ✓ 登录成功");
          setShowAuthModal(false);
        }
      } else {
        console.warn("[prompt.ai oauth] callbackUrl 里没有 access_token / refresh_token");
        console.warn("[prompt.ai oauth] 这说明 Supabase 退回了 site_url 而不是用我们指定的 redirectTo");
        console.warn("[prompt.ai oauth] 去 Supabase dashboard 加 https://*.chromiumapp.org/** 到 Redirect URLs");
        console.warn("[prompt.ai oauth] 完整 callbackUrl:", responseUrl);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[prompt.ai oauth] launchWebAuthFlow 异常:", (e as Error)?.message);
    }
  };

  const handleEmailAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        // 验证邀请码
        const code = authInviteCode.trim().toUpperCase();
        if (!code) {
          setAuthError(lang === "zh" ? "请输入邀请码" : "Please enter an invite code");
          return;
        }
        const { data: codeData, error: codeError } = await supabase
          .from("invite_codes")
          .select("id, used")
          .eq("code", code)
          .single();

        if (codeError || !codeData) {
          setAuthError(lang === "zh" ? "邀请码无效，请检查是否输入正确" : "Invalid invite code");
          return;
        }
        if (codeData.used) {
          setAuthError(lang === "zh" ? "该邀请码已被使用" : "This invite code has already been used");
          return;
        }

        // 注册
        const { data: signUpData, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) {
          setAuthError(error.message);
          return;
        }

        // 标记邀请码已使用
        await supabase
          .from("invite_codes")
          .update({ used: true, used_by: authEmail, used_at: new Date().toISOString() })
          .eq("id", codeData.id);

        setAuthError(lang === "zh" ? "🎉 注册成功！请查收验证邮件" : "🎉 Signed up! Please check your email.");
        void signUpData;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) { setAuthError(lang === "zh" ? "邮箱或密码错误" : "Invalid email or password"); }
        else { setShowAuthModal(false); }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestMode = () => {
    setIsGuest(true);
    setShowAuthModal(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setIsGuest(false);
    setUser(null);
  };
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // ── 真实历史记录 ──
  type PromptRecord = {
    id: string;
    original_text: string;
    optimized_text: string | null;
    diagnosis: string | null;
    platform: string | null;
    tone: string | null;
    task_type?: string | null;
    source?: string | null;
    is_starred?: boolean | null;     // v26
    project_id?: string | null;      // v26
    score_clarity?: number | null;
    score_specificity?: number | null;
    score_structure?: number | null;
    similarity?: number | null;
    ai_response_text?: string | null;          // v32-G: 抓到的 AI 响应文本
    ai_response_captured_at?: string | null;
    created_at: string;
  };
  const [realHistory, setRealHistory] = useState<PromptRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  // v24: 高级搜索 + filter 状态
  const [searchPlatforms, setSearchPlatforms] = useState<string[]>([]);
  const [searchTaskTypes, setSearchTaskTypes] = useState<string[]>([]);
  const [searchDays, setSearchDays] = useState<number>(90);
  const [searchOnlyStarred, setSearchOnlyStarred] = useState<boolean>(false); // v26
  const [facets, setFacets] = useState<{ platforms: { value: string; count: number }[]; task_types: { value: string; count: number }[] }>({ platforms: [], task_types: [] });
  // v26: 用户项目缓存 + 当前 optimize 的星标/项目状态
  const [userProjects, setUserProjects] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  const [optimizedIsStarred, setOptimizedIsStarred] = useState<boolean>(false);
  const [showProjectMenu, setShowProjectMenu] = useState<boolean>(false);
  const [assignToast, setAssignToast] = useState<string>("");
  // v28: 自动归类建议
  const [projectSuggestion, setProjectSuggestion] = useState<{ id: string; name: string; color: string | null; sim: number } | null>(null);
  // v30: prompt 模板库
  type PromptTemplate = {
    id: string;
    name: string;
    template_text: string;
    variables: string[];
    use_count: number;
    created_at: string;
    updated_at: string;
  };
  const [historyView, setHistoryView] = useState<"history" | "sessions" | "templates">("history");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showSaveTemplateFor, setShowSaveTemplateFor] = useState<string | null>(null); // prompt_id
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setTemplatesLoading(true);
    try {
      const { data } = await supabase.rpc("list_user_templates", { p_user_id: user.id });
      setTemplates((data as PromptTemplate[]) || []);
    } catch {} finally {
      setTemplatesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoggedIn && activeTab === "history" && historyView === "templates") {
      loadTemplates();
    }
  }, [isLoggedIn, activeTab, historyView, loadTemplates]);

  const handleSaveAsTemplate = async (promptId: string) => {
    if (!user || !newTemplateName.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await supabase.rpc("save_prompt_as_template", {
        p_prompt_id: promptId,
        p_name: newTemplateName.trim(),
        p_use_optimized: true,
      });
      setShowSaveTemplateFor(null);
      setNewTemplateName("");
      // 不切换视图,但加载下次进 templates 时就能看到
    } catch {} finally {
      setSavingTemplate(false);
    }
  };

  const handleUseTemplate = async (tpl: PromptTemplate) => {
    setInputText(tpl.template_text);
    setActiveTab("optimize");
    try {
      await supabase.rpc("increment_template_use", { p_template_id: tpl.id });
    } catch {}
  };

  const handleDeleteTemplate = async (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id)); // optimistic
    try {
      await supabase.rpc("delete_template", { p_template_id: id });
    } catch {
      loadTemplates(); // 失败回滚
    }
  };

  // v33-β: 模板编辑 — modal 状态 + 保存
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplText, setEditTplText] = useState("");
  const [editTplSaving, setEditTplSaving] = useState(false);
  const [editTplToast, setEditTplToast] = useState("");
  // v33-γ: ⌘K 全局命令面板
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [cmdkActiveIndex, setCmdkActiveIndex] = useState(0);
  const handleOpenEditTemplate = (tpl: PromptTemplate) => {
    setEditingTemplate(tpl);
    setEditTplName(tpl.name);
    setEditTplText(tpl.template_text);
    setEditTplToast("");
  };
  const handleCloseEditTemplate = () => {
    setEditingTemplate(null);
    setEditTplName("");
    setEditTplText("");
    setEditTplToast("");
    setEditTplSaving(false);
  };
  const handleSaveEditTemplate = async () => {
    if (!editingTemplate || editTplSaving) return;
    const trimmedName = editTplName.trim();
    const trimmedText = editTplText.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      setEditTplToast("✗ 名字 1-100 字");
      return;
    }
    if (trimmedText.length < 5 || trimmedText.length > 8000) {
      setEditTplToast("✗ 内容 5-8000 字");
      return;
    }
    setEditTplSaving(true);
    setEditTplToast("");
    try {
      const { error } = await supabase.rpc("update_template", {
        p_template_id: editingTemplate.id,
        p_name: trimmedName,
        p_template_text: trimmedText,
      });
      if (error) throw error;
      await loadTemplates();
      setEditTplToast("✓ 已保存");
      setTimeout(() => handleCloseEditTemplate(), 800);
    } catch (err) {
      setEditTplToast("✗ " + ((err as Error)?.message || "保存失败"));
    } finally {
      setEditTplSaving(false);
    }
  };

  // v32-B: 一键加载示例数据 — 给新用户秒上手 (插入到当前账号,标 source: "demo")
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoSeededToast, setDemoSeededToast] = useState("");
  const handleSeedDemo = async () => {
    if (!user || seedingDemo) return;
    setSeedingDemo(true);
    setDemoSeededToast("");
    try {
      // 1) 插入 1 个 demo 项目
      const { data: project } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: "示例项目 · 创业公司官网",
          description: "这是 prompt.ai 给你的示例项目,展示如何把零散 prompt 归类管理",
          color: "#7c3aed",
        })
        .select("id")
        .single();
      const projectId = project?.id || null;

      // 2) 插入 5 条 demo prompt
      const now = Date.now();
      const demoPrompts = [
        { o: "帮我写一封邮件给客户说项目要延期一周", p: "ChatGPT", task: "邮件", starred: true, withProject: true, ago: 0 },
        { o: "怎么提高用户留存率", p: "ChatGPT", task: "策略", starred: false, withProject: true, ago: 1 },
        { o: "写个产品 Hero 区文案,要简洁有冲击力", p: "Claude", task: "营销", starred: true, withProject: true, ago: 2 },
        { o: "总结一下昨天的用户访谈,重点是 pain point", p: "Kimi", task: "调研", starred: false, withProject: false, ago: 3 },
        { o: "对比 Notion / Obsidian / Roam 三个笔记工具的差异", p: "DeepSeek", task: "调研", starred: false, withProject: false, ago: 5 },
      ];
      const promptRows = demoPrompts.map((d) => ({
        user_id: user.id,
        original_text: d.o,
        optimized_text: `# 角色\n你是一位资深产品经理。\n\n# 任务\n${d.o}\n\n# 输出要求\n- 200 字以内\n- 结构清晰,条理分明\n- 用平实语言,避免空话`,
        diagnosis: "已优化",
        platform: d.p,
        task_type: d.task,
        source: "demo",
        is_starred: d.starred,
        project_id: d.withProject ? projectId : null,
        score_clarity: 85 + Math.floor(Math.random() * 10),
        score_specificity: 80 + Math.floor(Math.random() * 12),
        score_structure: 88 + Math.floor(Math.random() * 8),
        created_at: new Date(now - d.ago * 86400000).toISOString(),
      }));
      await supabase.from("prompts").insert(promptRows);

      // 3) 插入 1 个 demo 模板
      await supabase.rpc("save_template_direct", {
        p_name: "示例模板 · 客户延期通知邮件",
        p_template_text:
          "亲爱的 {{client_name}},\n\n关于 {{project_name}} 项目,因 {{reason}} 原因,预计延期 {{delay_days}} 天,新交付时间为 {{new_deadline}}。\n\n我们已制定补救方案,详情如下:\n1. ...\n2. ...\n\n感谢理解,有任何问题请随时联系。\n\n顺祝商祺",
      });

      // 4) 刷新所有相关数据
      await Promise.all([fetchHistory(), loadUserProjects(), loadTemplates(), loadFacets()]);
      setDemoSeededToast("✓ 已加载 5 条 prompt + 1 项目 + 1 模板,开始体验吧");
      setTimeout(() => setDemoSeededToast(""), 4000);
    } catch (err) {
      console.error("[seed demo]", err);
      setDemoSeededToast("✗ 加载失败,稍后再试");
      setTimeout(() => setDemoSeededToast(""), 3000);
    } finally {
      setSeedingDemo(false);
    }
  };

  // v26: 加载用户项目列表 (供 optimize "加入项目" dropdown 用)
  const loadUserProjects = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc("list_user_projects", { p_user_id: user.id });
      if (Array.isArray(data)) {
        setUserProjects(data.map((p: any) => ({ id: p.id, name: p.name, color: p.color })));
      }
    } catch {}
  }, [user]);

  // v26: 切到 optimize tab / 登录时加载项目列表
  useEffect(() => {
    if (isLoggedIn) loadUserProjects();
  }, [isLoggedIn, loadUserProjects]);

  // v33-γ: 全局 ⌘K / Ctrl+K 监听 — 任何 tab 都能呼出命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen(prev => !prev);
        setCmdkQuery("");
        setCmdkActiveIndex(0);
      }
      if (e.key === "Escape" && cmdkOpen) {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdkOpen]);

  // v33-γ: cmdk 搜索结果 — 跨 templates / projects / recent prompts
  type CmdkItem =
    | { kind: "template"; id: string; name: string; vars: number; useCount: number; raw: PromptTemplate }
    | { kind: "project"; id: string; name: string; color: string | null }
    | { kind: "prompt"; id: string; preview: string; platform: string | null }
    | { kind: "action"; label: string; sub: string; onPick: () => void };
  const cmdkResults = useMemo<CmdkItem[]>(() => {
    const q = cmdkQuery.trim().toLowerCase();
    const out: CmdkItem[] = [];
    // 操作类 (无 query 时也显示常用快捷)
    if (!q) {
      out.push({ kind: "action", label: "🧠 打开 AI 记忆 dashboard", sub: "voice + 平台 + 偏好", onPick: () => { setMemoryPanelOpen(true); setCmdkOpen(false); } });
      out.push({ kind: "action", label: "📁 切到项目 tab", sub: "管理你的 prompt folders", onPick: () => { setActiveTab("projects"); setCmdkOpen(false); } });
      out.push({ kind: "action", label: "📚 切到模板 tab", sub: "复用高频 prompt", onPick: () => { setActiveTab("history"); setHistoryView("templates"); setCmdkOpen(false); } });
      out.push({ kind: "action", label: "💬 切到会话视图", sub: "按对话浏览历史", onPick: () => { setActiveTab("history"); setHistoryView("sessions"); setCmdkOpen(false); } });
    }
    // Templates
    for (const t of templates) {
      if (!q || t.name.toLowerCase().includes(q) || (t.template_text || "").toLowerCase().includes(q)) {
        out.push({ kind: "template", id: t.id, name: t.name, vars: t.variables.length, useCount: t.use_count, raw: t });
      }
      if (out.length >= 30) break;
    }
    // Projects
    for (const p of userProjects) {
      if (!q || p.name.toLowerCase().includes(q)) {
        out.push({ kind: "project", id: p.id, name: p.name, color: p.color });
      }
      if (out.length >= 30) break;
    }
    // Recent prompts
    if (q) {
      for (const r of realHistory.slice(0, 50)) {
        const text = (r.original_text || "").toLowerCase();
        if (text.includes(q)) {
          out.push({ kind: "prompt", id: r.id, preview: r.original_text.slice(0, 80), platform: r.platform });
        }
        if (out.length >= 50) break;
      }
    }
    return out.slice(0, 50);
  }, [cmdkQuery, templates, userProjects, realHistory]);

  // 重置 active index 当结果变化
  useEffect(() => { setCmdkActiveIndex(0); }, [cmdkQuery]);

  // v26: 切换 optimize 结果的星标
  const toggleOptimizedStar = async () => {
    if (!lastPromptIdRef.current) return;
    try {
      const { data } = await supabase.rpc("toggle_prompt_star", { p_prompt_id: lastPromptIdRef.current });
      setOptimizedIsStarred(!!data);
    } catch {}
  };

  // v26: 把 optimize 结果归到某项目 (project_id null = 移出)
  const assignOptimizedToProject = async (projectId: string | null, projectName?: string) => {
    if (!lastPromptIdRef.current) {
      setAssignToast("⚠ 还没保存到云端,稍等 1 秒再试");
      setTimeout(() => setAssignToast(""), 2500);
      return;
    }
    try {
      await supabase.rpc("assign_prompt_to_project", {
        p_prompt_id: lastPromptIdRef.current,
        p_project_id: projectId,
      });
      setShowProjectMenu(false);
      setAssignToast(projectId ? `✓ 已加入「${projectName || "项目"}」` : "✓ 已移出项目");
      setTimeout(() => setAssignToast(""), 3000);
      // 刷新项目列表 (项目计数变了)
      loadUserProjects();
    } catch (e) {
      setAssignToast(`✗ ${(e as Error)?.message || "失败"}`);
      setTimeout(() => setAssignToast(""), 3000);
    }
  };

  // v24: 调用新 search RPC (替代旧的 supabase.from('prompts').select)
  const runSearch = async () => {
    if (!user) return;
    setHistoryLoading(true);

    // 拿语义 embedding (有搜索词时)
    let queryEmbedding: number[] | null = null;
    const q = historySearch.trim();
    if (q.length >= 2) {
      try {
        const embedRes = await fetch(`${API_URL}/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: q.slice(0, 4000) }),
        });
        const embedData = await embedRes.json().catch(() => ({}));
        if (Array.isArray(embedData?.embedding) && embedData.embedding.length === 1024) {
          queryEmbedding = embedData.embedding;
        }
      } catch {
        // embedding 失败不致命,降级为关键词搜索
      }
    }

    const { data, error } = await supabase.rpc("search_user_prompts", {
      p_user_id: user.id,
      p_query: q || null,
      p_query_embedding: queryEmbedding,
      p_platforms: searchPlatforms.length > 0 ? searchPlatforms : null,
      p_task_types: searchTaskTypes.length > 0 ? searchTaskTypes : null,
      p_days: searchDays,
      p_limit: 50,
      p_only_starred: searchOnlyStarred,
      p_project_id: null,
    });
    if (!error && data) setRealHistory(data as PromptRecord[]);
    setHistoryLoading(false);
  };

  // v24: 加载 facets (用户用过的所有平台/任务,给 filter chips 用)
  const loadFacets = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc("get_user_prompt_facets", { p_user_id: user.id });
      if (data) setFacets(data as any);
    } catch {}
  };

  // 兼容旧名字 (其他地方可能 referenced)
  const fetchHistory = runSearch;

  // v24: 切到 history tab 时加载 facets
  useEffect(() => {
    if (isLoggedIn && activeTab === "history") {
      loadFacets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activeTab]);

  // v24: 搜索/filter 变化 debounce 重新查 (300ms)
  useEffect(() => {
    if (!isLoggedIn || activeTab !== "history") return;
    const timer = setTimeout(() => {
      runSearch();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, activeTab, historySearch, searchPlatforms, searchTaskTypes, searchDays, searchOnlyStarred]);

  const deleteHistory = async (id: string) => {
    await supabase.from("prompts").delete().eq("id", id);
    setRealHistory((prev) => prev.filter((r) => r.id !== id));
  };

  // v32-D: 把 query 的关键短语在结果中高亮 — 解决"为什么匹配"的可解释性
  // 策略: query 切 2-6 字 ngram, 在 text 中找 longest non-overlapping matches, 包 <mark>
  const highlightQueryInText = useCallback((text: string, query: string): React.ReactNode => {
    const q = (query || "").trim();
    if (!q || !text) return text;
    // 1) 收集 query 的 ngram 候选 (2-8 字),按长度降序去重
    const candidates = new Set<string>();
    const cleanQ = q.replace(/[\s,。.,!?!?、:;""'']+/g, " ").trim();
    const words = cleanQ.split(/\s+/).filter(w => w.length >= 2);
    words.forEach(w => candidates.add(w));
    // 中文: 也加 ngram
    for (const w of words) {
      if (w.length >= 3) {
        for (let n = Math.min(w.length, 6); n >= 2; n--) {
          for (let i = 0; i + n <= w.length; i++) {
            candidates.add(w.slice(i, i + n));
          }
        }
      }
    }
    const sorted = Array.from(candidates).sort((a, b) => b.length - a.length);
    if (sorted.length === 0) return text;
    // 2) 找 non-overlapping matches
    const ranges: Array<[number, number]> = [];
    const lower = text.toLowerCase();
    for (const tok of sorted) {
      const lt = tok.toLowerCase();
      let from = 0;
      while (from < lower.length) {
        const idx = lower.indexOf(lt, from);
        if (idx === -1) break;
        const end = idx + lt.length;
        // overlap check
        const overlap = ranges.some(([s, e]) => Math.max(s, idx) < Math.min(e, end));
        if (!overlap) ranges.push([idx, end]);
        from = end;
      }
    }
    if (ranges.length === 0) return text;
    ranges.sort((a, b) => a[0] - b[0]);
    // 3) 拼成 JSX
    const out: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(([s, e], i) => {
      if (s > cursor) out.push(text.slice(cursor, s));
      out.push(
        <mark key={`hl-${i}`} className="bg-[#fff4cc] text-[#7a5b00] rounded-sm px-0.5" style={{ fontWeight: 600 }}>
          {text.slice(s, e)}
        </mark>
      );
      cursor = e;
    });
    if (cursor < text.length) out.push(text.slice(cursor));
    return <>{out}</>;
  }, []);

  // 截断 + 智能围绕第一个匹配 (snippet) — 让评委一眼看到匹配点
  const buildSearchSnippet = useCallback((text: string, query: string, maxLen = 80): { snippet: string; truncated: boolean } => {
    if (!query || !text || text.length <= maxLen) return { snippet: text, truncated: text.length > maxLen };
    const q = (query || "").trim().toLowerCase();
    const lower = text.toLowerCase();
    const tokens = q.split(/\s+/).filter(w => w.length >= 2);
    let firstMatch = -1;
    for (const t of tokens) {
      const idx = lower.indexOf(t);
      if (idx >= 0 && (firstMatch === -1 || idx < firstMatch)) firstMatch = idx;
    }
    if (firstMatch < 0) return { snippet: text.slice(0, maxLen) + "…", truncated: true };
    const start = Math.max(0, firstMatch - 20);
    const end = Math.min(text.length, start + maxLen);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    return { snippet: prefix + text.slice(start, end) + suffix, truncated: true };
  }, []);

  const formatRelativeTime = (isoStr: string) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (lang === "zh") {
      if (mins < 1) return "刚刚";
      if (mins < 60) return `${mins} 分钟前`;
      if (hours < 24) return `${hours} 小时前`;
      if (days === 1) return "昨天";
      return `${days} 天前`;
    } else {
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return "yesterday";
      return `${days}d ago`;
    }
  };

  // v24: server-side 已经按 query/filters 搜过了,client 不再 filter
  const filteredHistory = realHistory;

  // 按日期分组
  const groupedHistory = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 86400000;
    const groups: { label: string; items: typeof filteredHistory }[] = [];
    const today = filteredHistory.filter(r => new Date(r.created_at).getTime() >= todayStart);
    const thisWeek = filteredHistory.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= weekStart && t < todayStart;
    });
    const earlier = filteredHistory.filter(r => new Date(r.created_at).getTime() < weekStart);
    if (today.length) groups.push({ label: lang === "zh" ? "今天" : "Today", items: today });
    if (thisWeek.length) groups.push({ label: lang === "zh" ? "本周" : "This Week", items: thisWeek });
    if (earlier.length) groups.push({ label: lang === "zh" ? "更早" : "Earlier", items: earlier });
    return groups;
  }, [filteredHistory, lang]);

  // v31: 会话视图 — 同平台、30 分钟内的连续 prompt 视为一个会话
  const sessionGroups = useMemo(() => {
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min gap = new session
    const sorted = [...filteredHistory].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    type Session = {
      id: string;
      platform: string;
      startTime: string;
      endTime: string;
      items: typeof filteredHistory;
    };
    const sessions: Session[] = [];
    for (const item of sorted) {
      const platform = item.platform || "unknown";
      const itemTime = new Date(item.created_at).getTime();
      // 找最近的同平台 session,看 gap 是否 < 30min
      const last = sessions[sessions.length - 1];
      if (
        last &&
        last.platform === platform &&
        Math.abs(new Date(last.endTime).getTime() - itemTime) <= SESSION_GAP_MS
      ) {
        last.items.push(item);
        last.endTime = item.created_at; // sorted desc, so this is the earliest in session
      } else {
        sessions.push({
          id: `${platform}-${item.created_at}`,
          platform,
          startTime: item.created_at,
          endTime: item.created_at,
          items: [item],
        });
      }
    }
    return sessions;
  }, [filteredHistory]);

  // v32-F: 模板智能建议 — 客户端 frequency clustering
  // 策略: 对所有 prompts 取 normalized 签名 (去标点+小写+前40字), count >= 2 即为高频候选
  type TemplateSuggestion = {
    signature: string;
    sample: typeof realHistory[number];
    count: number;
    relatedIds: string[];
    autoVars: string[];
  };
  const templateSuggestions = useMemo<TemplateSuggestion[]>(() => {
    if (realHistory.length < 3) return [];
    // 已有模板的签名,跳过
    const existingSigs = new Set(
      templates.map(t => (t.template_text || "").toLowerCase().replace(/[\s\W]+/g, "").slice(0, 40))
    );
    const buckets: Record<string, { sample: typeof realHistory[number]; ids: string[]; count: number }> = {};
    for (const r of realHistory) {
      const text = r.original_text || "";
      const sig = text.toLowerCase().replace(/[\s\W]+/g, "").slice(0, 40);
      if (!sig || sig.length < 8) continue;
      if (existingSigs.has(sig)) continue;
      if (!buckets[sig]) buckets[sig] = { sample: r, ids: [r.id], count: 1 };
      else { buckets[sig].count += 1; buckets[sig].ids.push(r.id); }
    }
    // 自动抽变量启发: 数字、日期 (XXXX-XX-XX 等)、英文大写词组
    const extractAutoVars = (text: string): string[] => {
      const vars = new Set<string>();
      if (/\b\d{4}-\d{2}-\d{2}\b/.test(text)) vars.add("date");
      if (/\b\d{2,}\b/.test(text)) vars.add("number");
      if (/[\[【「][^\]】」]+[\]】」]/.test(text)) vars.add("placeholder");
      if (/客户|client/i.test(text)) vars.add("client_name");
      if (/项目|project/i.test(text)) vars.add("project_name");
      if (/产品|product/i.test(text)) vars.add("product_name");
      return Array.from(vars).slice(0, 4);
    };
    const list: TemplateSuggestion[] = Object.entries(buckets)
      .filter(([, v]) => v.count >= 2)
      .map(([signature, v]) => ({
        signature,
        sample: v.sample,
        count: v.count,
        relatedIds: v.ids,
        autoVars: extractAutoVars(v.sample.original_text || ""),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return list;
  }, [realHistory, templates]);

  const handleSaveTemplateFromSuggestion = useCallback(async (s: TemplateSuggestion) => {
    if (!user) return;
    const defaultName = (s.sample.original_text || "").slice(0, 40);
    const name = typeof window !== "undefined"
      ? window.prompt("给这个模板起个名字 (重复出现 " + s.count + " 次)", defaultName)
      : defaultName;
    if (!name || !name.trim()) return;
    try {
      // 用 sample 的 optimized_text 作为模板,如果没有 fallback original_text
      // 自动把检测到的"变量"占位符在 text 中包成 {{var}} (尽力而为,简单替换)
      let templateText = s.sample.optimized_text || s.sample.original_text || "";
      for (const v of s.autoVars) {
        if (v === "date") templateText = templateText.replace(/\b\d{4}-\d{2}-\d{2}\b/g, `{{${v}}}`);
        else if (v === "number") templateText = templateText.replace(/\b\d{2,}\b/g, `{{${v}}}`);
        else if (v === "placeholder") templateText = templateText.replace(/[\[【「]([^\]】」]+)[\]】」]/g, `{{${v}}}`);
      }
      await supabase.rpc("save_template_direct", {
        p_name: name.trim().slice(0, 100),
        p_template_text: templateText,
      });
      await loadTemplates();
      setHistoryView("templates");
    } catch (err) {
      console.error("[suggest template]", err);
    }
  }, [user, loadTemplates]);
  type RealStats = {
    totalPrompts: number;
    streak: number;
  };
  const [realStats, setRealStats] = useState<RealStats>({ totalPrompts: 0, streak: 0 });
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const fetchStats = async () => {
    if (!user) return;
    // 总数
    const { count } = await supabase
      .from("prompts")
      .select("*", { count: "exact", head: true });
    // 连续天数：读最近30天的记录，算连续有记录的天数
    const { data: recent } = await supabase
      .from("prompts")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    let streak = 0;
    if (recent && recent.length > 0) {
      const days = new Set(recent.map(r => new Date(r.created_at).toDateString()));
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        if (days.has(d.toDateString())) streak++;
        else break;
      }
    }
    setRealStats({ totalPrompts: count ?? 0, streak });
  };

  useEffect(() => {
    if (isLoggedIn) fetchStats();
  }, [isLoggedIn, realHistory]);

  const t = (key: string) => i18n[lang][key] ?? key;

  const targetObj = AI_TARGETS.find((t) => t.id === selectedTarget)!;

  const [diagnosis, setDiagnosis] = useState("");
  const [scores, setScores] = useState<{ clarity: number; specificity: number; structure: number } | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [optimizeError, setOptimizeError] = useState("");
  const [optimizeCount, setOptimizeCount] = useState(0);

  // 对话历史（多轮上下文）
  type ConvMessage = { role: "user" | "assistant"; content: string };
  const conversationRef = useRef<ConvMessage[]>([]);
  const lastInputRef = useRef<string>("");
  const [isNewTopic, setIsNewTopic] = useState(false); // 是否刚切换了新话题
  const [showContext, setShowContext] = useState(false); // 上下文预览面板
  const [memoryHint, setMemoryHint] = useState<string>(""); // v7.8: "已记住 N 条该任务历史"
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false); // v12: L7 透明面板
  const [onboardingOpen, setOnboardingOpen] = useState(false); // v23: 首次体验引导

  // 语义相似度检测（简单关键词重叠，不调 API）
  const isSameTopic = (a: string, b: string): boolean => {
    if (!a || !b) return false;
    const tokenize = (s: string) => s.toLowerCase().split(/[\s，。！？,.\s]+/).filter(w => w.length > 1);
    const setA = new Set(tokenize(a));
    const setB = new Set(tokenize(b));
    const intersection = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 && intersection / union >= 0.25; // 25% 关键词重叠视为同一话题
  };

  // 手动开新话题
  const handleNewTopic = () => {
    conversationRef.current = [];
    lastInputRef.current = "";
    setIsNewTopic(true);
    setShowContext(false);
    setOptimizedText("");
    setOptimizeError("");
    setDiagnosis("");
    setScores(null);
    setTips([]);
    setShowFeedbackOptions(false);
    setFeedbackConfirmed(false);
    setFeedback(null);
    setTimeout(() => setIsNewTopic(false), 1500);
  };

  const API_URL = "https://api.prompt-ai.work";

  // ─── 通过 Cloudflare Worker 调用 AI 服务（key 在 Worker secret，不在前端）───
  function buildSystemPrompt(targetAI = "any", tone = "Professional", round = 1) {
    let targetStrategy = "";
    if (["chatgpt", "gemini"].includes(targetAI)) {
      targetStrategy = `\n## TARGET AI STRATEGY: ${targetAI.toUpperCase()}\nThis prompt will be used with ${targetAI === "chatgpt" ? "ChatGPT (OpenAI)" : "Gemini (Google)"}.\n- Use Markdown structure: headers (##), bullet lists, code blocks when appropriate\n- Clear role + step-by-step instructions work best\n- Include explicit output format specification with examples`;
    } else if (targetAI === "claude") {
      targetStrategy = `\n## TARGET AI STRATEGY: CLAUDE\nThis prompt will be used with Claude (Anthropic).\n- Claude excels at long-form content and nuanced tasks\n- Use XML tag structure when helpful: <context>, <task>, <constraints>, <format>\n- Claude follows instructions precisely — be explicit about what you want\n- Multi-step tasks benefit from clear sequential structure`;
    } else if (["kimi", "zhipu", "deepseek", "minimax"].includes(targetAI)) {
      targetStrategy = `\n## TARGET AI STRATEGY: CHINESE LLM (${targetAI})\nThis prompt will be used with a Chinese-first LLM.\n- Prioritize Chinese output unless user explicitly wants English\n- Be concise and direct — avoid over-engineered Western prompt structures\n- Use simple numbered lists, avoid heavy XML or Markdown\n- Chinese-specific context (文化、行业背景) improves results dramatically`;
    } else {
      targetStrategy = `\n## TARGET AI STRATEGY: UNIVERSAL\nOptimize for broad compatibility across all major AI systems.\n- Use clear, unambiguous language\n- Moderate use of Markdown structure\n- Explicit role + task + output format`;
    }
    const toneGuide: Record<string, string> = { Professional: "formal, precise, business-appropriate", Casual: "friendly, conversational, approachable", Academic: "scholarly, evidence-based, structured", Creative: "imaginative, expressive, open-ended", Concise: "ultra-brief, direct, no filler words" };
    const toneDesc = toneGuide[tone] || "balanced and clear";
    return `You are an elite Prompt Engineer with mastery of the world's best prompting frameworks. Your job: transform any rough user input into a high-quality, immediately usable prompt.\n${targetStrategy}\n\n## TONE REQUIREMENT\nApply this tone to the optimized prompt: ${tone} — ${toneDesc}\n\n## YOUR OPTIMIZATION ENGINE\nApply these frameworks intelligently based on what the prompt needs:\n**CO-STAR** (for creative/writing/communication tasks): Context, Objective, Style, Tone, Audience, Response format\n**RISEN** (for analytical/technical/structured tasks): Role, Instructions, Steps, End goal, Narrowing\n**Chain-of-Thought** (for reasoning/problem-solving): Add "Think step by step", break complex asks into stages\n\n## OPTIMIZATION RULES\n**DETECT language first**: If input is Chinese → output Chinese. If English → output English.\n**DETECT complexity**: Simple → minimal touch; Medium → apply CO-STAR/RISEN; Complex → full framework + sub-tasks\n**ALWAYS add**: 1. Expert role assignment 2. Specific output format 3. Relevant constraints 4. Quality anchor\n**NEVER**: Add unnecessary complexity to simple questions; Change the user's core intent; Use generic phrases like "helpful assistant"\n\n## SCORING CRITERIA\nEvaluate the ORIGINAL prompt on 3 dimensions (0-100 each):\n- **clarity**: How clearly does the prompt state its intent?\n- **specificity**: How much relevant detail/context does it include?\n- **structure**: How well-organized and formatted is it?\n\n## OUTPUT FORMAT\nReturn ONLY valid JSON:\n{"diagnosis":"one sentence max 40 chars in same language as input","optimized":"the complete optimized prompt","scores":{"clarity":<0-100>,"specificity":<0-100>,"structure":<0-100>},"tips":["tip 1","tip 2","tip 3"]}${round >= 2 ? `\n\n## INCREMENTAL OPTIMIZATION MODE (Round ${round})\nYou are continuing to refine a prompt the user has been working on across multiple rounds.\n\nCRITICAL RULES:\n1. DO NOT regenerate the role assignment or expert persona from scratch — the user already has those from previous rounds.\n2. BUILD UPON the previous optimization result. Treat the last assistant message as the current working version.\n3. FOCUS on specific adjustments requested by the user — do not rewrite everything.\n4. PRESERVE established context: role setup, domain expertise, output format, and constraints that were already working.\n5. Be surgical: only modify the parts that need improvement. Keep everything else intact.\n6. If the user provides feedback about a specific issue, address ONLY that issue while preserving the rest.` : ""}`;
  }

  function cleanModelOutput(raw: string) {
    let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // 去掉 markdown 代码块 ```json ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) text = codeBlockMatch[1].trim();
    // 尝试提取最外层 JSON 对象 { ... }
    if (!text.startsWith("{")) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) text = jsonMatch[0].trim();
    }
    return text;
  }

  function normalizeResult(result: any) {
    const isZh = lang === "zh";
    const fallbackTips = isZh ? ["补充任务目标", "加入约束条件", "明确输出格式"] : ["Add the task goal", "Add constraints", "Specify the output format"];
    return {
      diagnosis: typeof result?.diagnosis === "string" && result.diagnosis.trim() ? result.diagnosis.trim().slice(0, 40) : (isZh ? "已优化" : "Optimized"),
      optimized: typeof result?.optimized === "string" && result.optimized.trim() ? result.optimized.trim() : "",
      scores: { clarity: typeof result?.scores?.clarity === "number" ? result.scores.clarity : 0, specificity: typeof result?.scores?.specificity === "number" ? result.scores.specificity : 0, structure: typeof result?.scores?.structure === "number" ? result.scores.structure : 0 },
      tips: Array.isArray(result?.tips) && result.tips.length > 0 ? result.tips.filter(Boolean).slice(0, 3) : fallbackTips,
    };
  }

  // ─── v7.8: 用户级 × 任务级 风格记忆缓存（60s TTL）───────────
  const memoryCacheRef = useRef<Map<string, { profile: any; dislikes: any[]; facts: any[]; voiceProfile: string | null; ts: number }>>(new Map());
  const MEMORY_TTL_MS = 60_000;

  // v11: 拉取用户记忆 + 语义 few-shot + LLM 抽取事实 + 声音指纹
  // - profile / dislikes / facts / voiceProfile: task-level，60s 缓存（不依赖 input）
  // - examples: input-level，每次现拉（语义检索 → fallback v8 score-based）
  // - queryEmbedding: 当前 input 的 1024 维向量，optimize 完成后写回新 prompt 行
  async function loadUserMemory(
    taskType: string,
    currentInput?: string,
  ): Promise<{ profile: any; examples: any[]; dislikes: any[]; facts: any[]; voiceProfile: string | null; queryEmbedding: number[] | null }> {
    if (!user) return { profile: null, examples: [], dislikes: [], facts: [], voiceProfile: null, queryEmbedding: null };

    // ─ 第 1 路：profile + dislikes + facts + voice（task-level，可缓存）
    const cacheKey = `${user.id}::${taskType}`;
    const cached = memoryCacheRef.current.get(cacheKey);
    let profile: any = null;
    let dislikes: any[] = [];
    let facts: any[] = [];
    let voiceProfile: string | null = null;

    if (cached && Date.now() - cached.ts < MEMORY_TTL_MS) {
      profile = cached.profile;
      dislikes = cached.dislikes;
      facts = cached.facts;
      voiceProfile = cached.voiceProfile;
    } else {
      try {
        const [profileRes, dislikesRes, factsRes, voiceRes] = await Promise.all([
          supabase.rpc("get_user_task_profile", { p_user_id: user.id, p_task_type: taskType }),
          supabase.rpc("get_user_recent_dislikes", { p_user_id: user.id, p_task_type: taskType, p_limit: 3 }),
          supabase.rpc("get_user_facts", { p_user_id: user.id, p_task_type: taskType, p_limit: 8 }),
          supabase.rpc("get_user_voice_profile", { p_user_id: user.id }),
        ]);
        profile = (profileRes.data as any) || null;
        dislikes = Array.isArray(dislikesRes.data) ? dislikesRes.data : [];
        facts = Array.isArray(factsRes.data) ? factsRes.data : [];
        const v = (voiceRes.data as any)?.voice_profile;
        voiceProfile = typeof v === "string" && v.trim() ? v : null;
        memoryCacheRef.current.set(cacheKey, { profile, dislikes, facts, voiceProfile, ts: Date.now() });
      } catch {
        // RPC 失败不致命
      }
    }

    // ─ 第 2 路：examples（v9 语义检索 → fallback v8 score-based）
    let examples: any[] = [];
    let queryEmbedding: number[] | null = null;

    if (currentInput && currentInput.trim()) {
      try {
        const embedRes = await fetch(`${API_URL}/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: currentInput.slice(0, 4000) }),
        });
        const embedData = await embedRes.json().catch(() => ({}));
        if (Array.isArray(embedData?.embedding) && embedData.embedding.length === 1024) {
          queryEmbedding = embedData.embedding;
          const semanticRes = await supabase.rpc("get_top_user_prompts_semantic", {
            p_user_id: user.id,
            p_task_type: taskType,
            p_query_embedding: queryEmbedding,
            p_limit: 2,
          });
          examples = Array.isArray(semanticRes.data) ? semanticRes.data : [];
        }
      } catch {}
    }

    if (examples.length === 0) {
      try {
        const fallbackRes = await supabase.rpc("get_top_user_prompts", {
          p_user_id: user.id,
          p_task_type: taskType,
          p_limit: 2,
        });
        examples = Array.isArray(fallbackRes.data) ? fallbackRes.data : [];
      } catch {}
    }

    return { profile, examples, dislikes, facts, voiceProfile, queryEmbedding };
  }

  // v10+v11: fire-and-forget LLM 事实抽取 + 声音指纹合成
  // 流程: extract-facts → add_user_facts → synthesize-voice → set_user_voice_profile → clear cache
  // v12: 加 { force: true } 参数,允许 UI 跳过 prompts_since_last >= 10 阈值手动触发
  async function maybeExtractFacts(opts: { force?: boolean } = {}) {
    if (!user) return;
    try {
      const { data: state } = await supabase.rpc("get_extraction_state", { p_user_id: user.id });
      const promptsSinceLast = Number(state?.prompts_since_last || 0);
      if (!opts.force && promptsSinceLast < 10) return;

      const { data: recent } = await supabase
        .from("prompts")
        .select("id, original_text, optimized_text, task_type")
        .eq("user_id", user.id)
        .not("optimized_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!Array.isArray(recent) || recent.length === 0) return;

      const factsRes = await fetch(`${API_URL}/extract-facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts: recent.map((p: any) => ({
            original_text: p.original_text,
            optimized_text: p.optimized_text,
            task_type: p.task_type || "general",
          })),
        }),
      });
      const factsData = await factsRes.json().catch(() => ({}));
      if (!Array.isArray(factsData?.facts) || factsData.facts.length === 0) return;

      // 写入新事实
      await supabase.rpc("add_user_facts", {
        p_facts: factsData.facts,
        p_source_prompt_ids: recent.map((p: any) => p.id),
      });

      // v11: 链式合成 voice profile (基于全部最新 facts,不只是这次新增的)
      try {
        const { data: allFacts } = await supabase.rpc("get_user_facts", { p_user_id: user.id, p_limit: 15 });
        if (Array.isArray(allFacts) && allFacts.length > 0) {
          const voiceRes = await fetch(`${API_URL}/synthesize-voice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facts: allFacts }),
          });
          const voiceData = await voiceRes.json().catch(() => ({}));
          if (typeof voiceData?.voice_profile === "string" && voiceData.voice_profile.length >= 30) {
            // 简易 hash: count + 前 50 个 fact 字符串拼接长度
            const hash = `${allFacts.length}::${allFacts.map((f: any) => String(f.fact || "").slice(0, 30)).join("|").length}`;
            await supabase.rpc("set_user_voice_profile", {
              p_voice_profile: voiceData.voice_profile,
              p_source_facts_count: allFacts.length,
              p_source_facts_hash: hash,
            });
          }
        }
      } catch (e) {
        // voice 合成失败不致命,facts 已经写入,下次 extraction 再尝试
        // eslint-disable-next-line no-console
        console.warn("Voice synthesis failed (non-fatal):", (e as Error)?.message);
      }

      // 清缓存,下次 loadUserMemory 拿新 facts + 新 voice
      memoryCacheRef.current.clear();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Fact extraction failed (non-fatal):", (e as Error)?.message);
    }
  }

  async function callMiniMaxDirect(prompt: string, targetAI: string, tone: string, messages: any[] = [], isRefinement = false, round = 1, userProfile: any = null, topExamples: any[] = [], taskType: string = "general", userDislikes: any[] = [], userFacts: any[] = [], userVoiceProfile: string | null = null) {
    void round;
    const validHistory = messages.slice(-6).filter((m: any) => m.role && m.content);

    // v34: 加 30s timeout — 防 worker 不响应 / DNS 污染时 fetch 无限挂起
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let res: Response;
    try {
      res = await fetch(`${API_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, targetAI, tone, lang, messages: validHistory, isRefinement, userProfile, topExamples, taskType, userDislikes, userFacts, userVoiceProfile }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        throw new Error(lang === "zh" ? "AI 服务响应超时(30 秒),请检查网络或稍后重试" : "AI service timed out (30s), check network and retry");
      }
      throw new Error(lang === "zh" ? "网络请求失败,请检查 VPN/网络连接" : "Network request failed, check VPN/connection");
    }
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (data?.error === "prompt_injection") {
      throw new Error(data.message || (lang === "zh" ? "检测到异常输入，请重新描述你的需求" : "Detected suspicious input, please rephrase"));
    }

    if (!res.ok) {
      throw new Error(data?.error || (lang === "zh" ? "AI 服务暂时不可用，请稍后重试" : "AI service is temporarily unavailable"));
    }

    if (!data.optimized) {
      throw new Error(lang === "zh" ? "AI 返回了空结果，请重试" : "AI returned an empty result");
    }

    return normalizeResult(data);
  }

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    return lang === "zh" ? "优化失败，请稍后重试" : "Optimization failed, please try again";
  };

  const parseApiResponse = async (res: Response) => {
    let data: any = null;

    try {
      data = await res.json();
    } catch {
      throw new Error(lang === "zh" ? "服务响应异常，请稍后重试" : "Service returned an invalid response, please try again");
    }

    if (data?.error === "prompt_injection") {
      return { data, handled: true };
    }

    if (!res.ok) {
      throw new Error(
        data?.error ||
        (lang === "zh" ? "AI 服务暂时不可用，请稍后重试" : "AI service is temporarily unavailable, please try again")
      );
    }

    return { data, handled: false };
  };

  // 快捷指令：基于已有结果做二次优化
  const REFINE_ACTIONS = [
    { key: "professional", labelZh: "更专业", labelEn: "More formal", emoji: "💼" },
    { key: "concise",      labelZh: "更简洁", labelEn: "More concise", emoji: "✂️" },
    { key: "specific",     labelZh: "更具体", labelEn: "More specific", emoji: "🎯" },
    { key: "creative",     labelZh: "更创意", labelEn: "More creative", emoji: "✨" },
  ];

  // 踩赞反馈选项
  const FEEDBACK_REASONS = [
    { key: "too_long",     labelZh: "太长了",   labelEn: "Too long",     emoji: "📏" },
    { key: "not_specific", labelZh: "不够具体", labelEn: "Not specific", emoji: "🔍" },
    { key: "wrong_tone",   labelZh: "语气不对", labelEn: "Wrong tone",   emoji: "🎭" },
    { key: "off_intent",   labelZh: "偏离意图", labelEn: "Off intent",   emoji: "🎯" },
    { key: "format_issue", labelZh: "格式问题", labelEn: "Format issue", emoji: "📋" },
  ];

  const handleRefine = async (action: string) => {
    if (!optimizedText || isRefining) return;
    setIsRefining(true);

    const actionPrompts: Record<string, string> = {
      professional: lang === "zh" ? "请将以下 prompt 改写得更加专业、正式，使用行业术语" : "Make this prompt more professional and formal",
      concise:      lang === "zh" ? "请将以下 prompt 精简，去掉冗余，保留核心意图" : "Make this prompt more concise, remove redundancy",
      specific:     lang === "zh" ? "请将以下 prompt 改写得更具体，加入更多细节和约束条件" : "Make this prompt more specific with more details and constraints",
      creative:     lang === "zh" ? "请将以下 prompt 改写得更有创意，更有启发性" : "Make this prompt more creative and inspiring",
    };

    const refineInstruction = actionPrompts[action];

    try {
      const refineRound = Math.floor(conversationRef.current.length / 2) + 1;
      const data = await callMiniMaxDirect(refineInstruction, selectedTarget, selectedTone, conversationRef.current.slice(-6), true, refineRound);
      if (data.optimized) {
        // 把这次 refine 也追加到历史
        conversationRef.current.push({ role: "user", content: refineInstruction });
        conversationRef.current.push({ role: "assistant", content: data.optimized });

        setOptimizedText(data.optimized);
        if (data.scores) setScores(data.scores);
        if (Array.isArray(data.tips)) setTips(data.tips.slice(0, 3));
        if (data.diagnosis) setDiagnosis(data.diagnosis.slice(0, 40));
      }
    } catch {
      // 静默失败
    } finally {
      setIsRefining(false);
    }
  };

  const handleOptimize = async () => {
    if (!inputText.trim()) return;
    setIsOptimizing(true);
    setOptimizedText("");
    setOptimizeError("");
    setDiagnosis("");
    setScores(null);
    setTips([]);
    setOptimizedIsStarred(false); // v26: 新优化清星标
    setShowProjectMenu(false);
    setAssignToast("");
    setProjectSuggestion(null); // v28: 清旧建议

    const currentInput = inputText.trim();

    // 自动话题检测：新输入和上一轮差异大 → 清空历史开新话题
    if (lastInputRef.current && !isSameTopic(currentInput, lastInputRef.current)) {
      conversationRef.current = [];
    }
    lastInputRef.current = currentInput;

    // 构建消息历史（最多保留最近 6 条，避免 token 过多）
    const historyMessages = conversationRef.current.slice(-6);
    const currentRound = Math.floor(conversationRef.current.length / 2) + 1;

    try {
      // v11: 拉取用户风格记忆 + 语义 few-shot + 反向样本 + LLM 抽取事实 + 声音指纹
      const taskTypeForMemory = (detectedTask as string) || "general";
      const { profile: userProfile, examples: topExamples, dislikes: userDislikes, facts: userFacts, voiceProfile: userVoiceProfile, queryEmbedding } = await loadUserMemory(taskTypeForMemory, currentInput);
      const sampleN = Number(userProfile?.sample_count || 0);
      if (sampleN >= 3) {
        setMemoryHint(lang === "zh"
          ? `已记住你 ${sampleN} 条「${taskTypeForMemory}」任务的历史风格`
          : `Remembered ${sampleN} past "${taskTypeForMemory}" prompts`);
      } else {
        setMemoryHint("");
      }

      const data = await callMiniMaxDirect(currentInput, selectedTarget, selectedTone, historyMessages, false, currentRound, userProfile, topExamples, taskTypeForMemory, userDislikes, userFacts, userVoiceProfile);

      // v11 观测性: 把 worker 返回的 _debug.memory_applied 打到 console,方便用户/开发者看到个性化是否生效
      if (data?._debug?.memory_applied) {
        // eslint-disable-next-line no-console
        console.log("[prompt.ai memory]", data._debug.memory_applied);
      }

      if (data.diagnosis && data.diagnosis !== "已优化") {
        setDiagnosis(data.diagnosis.slice(0, 40));
      }

      const optimized = data.optimized || "未返回结果";
      setOptimizedText(optimized);

      // 把这轮对话追加到历史
      conversationRef.current.push({ role: "user", content: currentInput });
      conversationRef.current.push({ role: "assistant", content: optimized });

      // 接收 scores
      if (data.scores && typeof data.scores.clarity === "number") {
        setScores(data.scores);
      }

      // 接收 tips
      if (Array.isArray(data.tips) && data.tips.length > 0) {
        setTips(data.tips.slice(0, 3));
      }

      // 存入数据库（已登录时）
      if (user && data.optimized) {
        setFeedback(null); // 重置反馈状态
        setShowFeedbackOptions(false);
        setFeedbackConfirmed(false);
        const scoreData = data.scores && typeof data.scores.clarity === "number" ? {
          score_clarity: data.scores.clarity,
          score_specificity: data.scores.specificity,
          score_structure: data.scores.structure,
        } : {};
        supabase.from("prompts").insert({
          user_id: user.id,
          original_text: currentInput,
          optimized_text: data.optimized,
          diagnosis: data.diagnosis || null,
          platform: selectedTarget !== "any" ? selectedTarget : null,
          tone: selectedTone,
          task_type: detectedTask || "general",
          ...scoreData,
        }).select("id").single().then(({ data: row }) => {
          if (row?.id) {
            lastPromptIdRef.current = row.id;
            // v9: 把刚算出的 query embedding 写回这条新 prompt，让未来的语义检索能找到它
            if (queryEmbedding) {
              supabase.rpc("set_prompt_embedding", {
                p_prompt_id: row.id,
                p_embedding: queryEmbedding,
              }).then(() => {}).catch(() => {});
            }
            // v10: fire-and-forget — 累计够 10 条新 prompt 就触发 LLM 事实抽取
            // 不阻塞 UI,失败静默。新事实会在下次 loadUserMemory 时被拿到
            maybeExtractFacts();
            // v28: 自动项目归类建议 (基于 embedding 相似度,从已有项目找最匹配的)
            if (queryEmbedding) {
              supabase.rpc("suggest_projects_for_prompt", {
                p_user_id: user.id,
                p_query_embedding: queryEmbedding,
                p_limit: 1,
                p_min_similarity: 0.55,
              }).then(({ data: sug }) => {
                const top = Array.isArray(sug) && sug[0];
                if (top && top.project_id) {
                  setProjectSuggestion({
                    id: top.project_id,
                    name: top.project_name,
                    color: top.project_color,
                    sim: Number(top.max_similarity) || 0,
                  });
                }
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }
      // 优化成功计数
      setOptimizeCount(c => {
        const newCount = c + 1;
        const today = new Date().toISOString().slice(0, 10);
        if (typeof chrome !== "undefined" && chrome?.storage?.local) {
          chrome.storage.local.set({ optimizeCount: newCount, optimizeDate: today });
        }
        return newCount;
      });
    } catch (error) {
      setOptimizeError(getErrorMessage(error));
    } finally {
      setIsOptimizing(false);
    }
  };

  const [fillStatus, setFillStatus] = useState("");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const lastPromptIdRef = useRef<string | null>(null);
  const [showFeedbackOptions, setShowFeedbackOptions] = useState(false);
  const [feedbackConfirmed, setFeedbackConfirmed] = useState(false);

  const handleFeedback = async (value: "up" | "down") => {
    setFeedback(value);
    if (value === "up") {
      // 写入 Supabase + 闪烁确认
      if (user && lastPromptIdRef.current) {
        supabase.from("prompt_feedback").insert({
          user_id: user.id,
          prompt_id: lastPromptIdRef.current,
          rating: 1,
          created_at: new Date().toISOString(),
        }).then(() => {}).catch(() => {});
      }
      setFeedbackConfirmed(true);
      setShowFeedbackOptions(false);
      setTimeout(() => setFeedbackConfirmed(false), 1500);
    } else {
      // 展开反馈选项
      setShowFeedbackOptions(true);
      setFeedbackConfirmed(false);
    }
  };

  const handleFeedbackReason = async (reasonKey: string) => {
    const reason = FEEDBACK_REASONS.find(r => r.key === reasonKey);
    if (!reason) return;

    setShowFeedbackOptions(false);

    // 写入 Supabase
    if (user && lastPromptIdRef.current) {
      supabase.from("prompt_feedback").insert({
        user_id: user.id,
        prompt_id: lastPromptIdRef.current,
        rating: -1,
        created_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});
    }

    // 注入反馈到对话历史 + 自动重新优化
    const feedbackLabel = lang === "zh" ? reason.labelZh : reason.labelEn;
    const feedbackMessage = lang === "zh"
      ? `上一次的优化结果问题是：${feedbackLabel}，请针对这个问题调整优化`
      : `The previous optimization had this issue: ${feedbackLabel}. Please adjust accordingly.`;

    conversationRef.current.push({ role: "user", content: feedbackMessage });

    setIsRefining(true);
    try {
      const fbRound = Math.floor(conversationRef.current.length / 2) + 1;
      const data = await callMiniMaxDirect(feedbackMessage, selectedTarget, selectedTone, conversationRef.current.slice(-6), true, fbRound);
      if (data.optimized) {
        conversationRef.current.push({ role: "assistant", content: data.optimized });
        setOptimizedText(data.optimized);
        if (data.scores) setScores(data.scores);
        if (Array.isArray(data.tips)) setTips(data.tips.slice(0, 3));
        if (data.diagnosis) setDiagnosis(data.diagnosis.slice(0, 40));
        setFeedback(null);
      }
    } catch {
      // silent fail
    } finally {
      setIsRefining(false);
    }
  };

  // Phase 4: 任务检测
  const [detectedTask, setDetectedTask] = useState<TaskType | null>(null);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string | null>("email");
  const [showAllScenarios, setShowAllScenarios] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  const improvementNotes = useMemo(() => optimizedText ? buildImprovementNotes(optimizedText, lang) : [], [optimizedText, lang]);
  const selectedScenarioObj = selectedScenario
    ? SCENARIO_PRESETS.find((item) => item.id === selectedScenario) ?? null
    : null;

  const primaryRecommendation = detectedTask ? AI_RECOMMENDATIONS[detectedTask]?.[0] ?? null : null;

  const recentReusableHistory = useMemo(() => realHistory.slice(0, 4), [realHistory]);

  const featuredScenarios = SCENARIO_PRESETS.filter((item) => item.id === "email" || item.id === "debug");

  const compactScenarios = SCENARIO_PRESETS.filter((item) => !featuredScenarios.some((featured) => featured.id === item.id));


  const renderTemplate = (template: string, vars: Record<string, string>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key]?.trim() || `[${key}]`);
  };

  const handleScenarioSelect = (preset: ScenarioPreset) => {
    setSelectedScenario(preset.id);
    setTemplateVars({});
    setDetectedTask(preset.task);
    setShowRecommendation(true);
    setActiveTab("optimize");
    // If the preset has variables+template, don't fill the textarea yet — let user fill the form
    if (!preset.variables || !preset.template) {
      setInputText(buildScenarioPrompt(preset, lang));
    }
  };

  const handleFeaturedScenario = (scenarioId: string) => {
    const preset = SCENARIO_PRESETS.find((item) => item.id === scenarioId);
    if (!preset) return;
    handleScenarioSelect(preset);
  };

  // ─── 共用的填入逻辑（content script → scripting API → clipboard 兜底）───
  const fillTextToChat = async (text: string): Promise<"filled" | "copied" | "error"> => {
    try {
      if (typeof chrome !== "undefined" && chrome?.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // 方法1：通过 content script 消息通信
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: "FILL_INPUT", text });
            if (response?.ok) return "filled";
          } catch {}
          // 方法2：直接注入脚本
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (text: string) => {
                const sels = ["#prompt-textarea", "div.ProseMirror[contenteditable='true']", "div[contenteditable='true'][spellcheck]", "div[contenteditable='true']", "textarea"];
                let input: HTMLElement | null = null;
                for (const s of sels) { const el = document.querySelector<HTMLElement>(s); if (el && el.offsetHeight > 0) { input = el; break; } }
                if (!input) return;
                input.focus();
                if (input instanceof HTMLTextAreaElement) {
                  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
                  if (setter) setter.call(input, text); else input.value = text;
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                } else {
                  input.textContent = "";
                  const sel = window.getSelection(); const range = document.createRange();
                  range.selectNodeContents(input); sel?.removeAllRanges(); sel?.addRange(range);
                  document.execCommand("insertText", false, text);
                  if (!input.textContent) input.textContent = text;
                  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
                }
              },
              args: [text],
            });
            return "filled";
          } catch {}
        }
      }
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      try { await navigator.clipboard.writeText(text); return "copied"; } catch { return "error"; }
    }
  };

  // 一键填入：模板 + 变量 → 直接填入 AI 平台（跳过优化）
  const handleQuickFill = async () => {
    if (!selectedScenarioObj?.template) return;
    const assembled = renderTemplate(selectedScenarioObj.template[lang], templateVars);
    const result = await fillTextToChat(assembled);
    setFillStatus(result);
    setTimeout(() => setFillStatus(""), 2000);
  };

  // 优化后填入：模板 + 变量 → 组装成 inputText → 走优化流程
  const handleTemplateOptimize = () => {
    if (!selectedScenarioObj?.template) return;
    const assembled = renderTemplate(selectedScenarioObj.template[lang], templateVars);
    setInputText(assembled);
  };

  const handleOptimizeAndFill = async () => {
    await handleOptimize();
    setTimeout(() => {
      handleFillToChat();
    }, 900);
  };


  useEffect(() => {
    const fallbackScenario = selectedScenario ?? "email";
    const preset = SCENARIO_PRESETS.find((item) => item.id === fallbackScenario);
    if (!preset) return;
    // If preset has template+variables, don't auto-fill textarea — let user use the form
    if (preset.variables && preset.template) {
      setSelectedScenario(fallbackScenario);
      setDetectedTask(preset.task);
      return;
    }
    if (!inputText.trim()) {
      setSelectedScenario(fallbackScenario);
      setInputText(buildScenarioPrompt(preset, lang));
      setDetectedTask(preset.task);
    } else if (selectedScenario) {
      setInputText(buildScenarioPrompt(preset, lang));
    }
  }, [lang, selectedScenario]);

  useEffect(() => {
    if (inputText.trim().length > 15) {
      const task = detectTaskType(inputText);
      setDetectedTask(task);
      setShowRecommendation(true);
    } else {
      setDetectedTask(null);
    }
  }, [inputText]);

  const handleFillToChat = async () => {
    if (!optimizedText) return;
    const result = await fillTextToChat(optimizedText);
    setFillStatus(result);
    setTimeout(() => setFillStatus(""), 2000);
  };

  const handleCopy = async (text?: string) => {
    try {
      await navigator.clipboard.writeText(text || optimizedText);
    } catch {
      // Fallback for older browsers / non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text || optimizedText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInputText("");
    setOptimizedText("");
    setOptimizeError("");
    setDiagnosis("");
    setScores(null);
    setTips([]);
    setSelectedScenario("email");
    setTemplateVars({});
    setFillStatus("");
    setFeedback(null);
    // 清除时也重置对话历史（开启新话题）
    conversationRef.current = [];
    lastInputRef.current = "";
  };

  const Toggle = ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors duration-200 relative flex-shrink-0 ${
        value ? "bg-[#18181b]" : "bg-[#d8d8e0]"
      }`}
    >
      <motion.div
        className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm"
        animate={{ left: value ? 18 : 3 }}
        transition={{ duration: 0.15 }}
      />
    </button>
  );

  // ─── Memoized Insights data ────────────────────────
  const insightsUsageTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return days.map(d => {
      const label = lang === "zh"
        ? ["周日","周一","周二","周三","周四","周五","周六"][d.getDay()]
        : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
      const count = realHistory.filter(r => {
        const rd = new Date(r.created_at);
        return rd.getFullYear() === d.getFullYear() &&
          rd.getMonth() === d.getMonth() &&
          rd.getDate() === d.getDate();
      }).length;
      return { name: label, count };
    });
  }, [realHistory, lang]);

  const insightsModelData = useMemo(() => {
    const colors = ["#18181b","#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#e2e2e8"];
    const countMap: Record<string, number> = {};
    realHistory.forEach(r => {
      const p = r.platform && r.platform !== "any" ? r.platform : (lang === "zh" ? "其他" : "Other");
      countMap[p] = (countMap[p] || 0) + 1;
    });
    const total = realHistory.length;
    if (total === 0) return [];
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Math.round((count / total) * 100),
        color: colors[i] || colors[5],
      }));
  }, [realHistory, lang]);

  const insightsTaskBreakdown = useMemo(() => {
    const taskCount: Record<string, number> = {};
    realHistory.forEach(r => {
      const t = (r as any).task_type || "general";
      taskCount[t] = (taskCount[t] || 0) + 1;
    });
    const total = realHistory.length;
    if (total === 0) return [];
    const taskColors: Record<string, string> = {
      code: "#18181b", writing: "#6366f1", reasoning: "#8b5cf6",
      data: "#0ea5e9", translation: "#10b981", agent: "#f59e0b", general: "#d1d5db",
    };
    return Object.entries(taskCount)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / total) * 100),
        label: lang === "zh" ? TASK_LABELS[type as TaskType]?.zh || type : TASK_LABELS[type as TaskType]?.en || type,
        icon: TASK_LABELS[type as TaskType]?.icon || "💬",
        color: taskColors[type] || "#d1d5db",
      }));
  }, [realHistory, lang]);

  const insightsPeakHours = useMemo(() => {
    const hourMap: Record<number, number> = {};
    realHistory.forEach(r => {
      const h = new Date(r.created_at).getHours();
      const slot = Math.floor(h / 2) * 2;
      hourMap[slot] = (hourMap[slot] || 0) + 1;
    });
    const peakData = Array.from({ length: 8 }, (_, i) => {
      const h = i * 3;
      const label = lang === "zh" ? `${h}时` : `${h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`}`;
      return { hour: label, count: hourMap[h] || hourMap[h+1] || hourMap[h+2] || 0 };
    });
    return peakData.some(d => d.count > 0) ? peakData : null;
  }, [realHistory, lang]);

  const insightsQualityTrend = useMemo(() => {
    const scoredHistory = realHistory.filter(r =>
      r.score_clarity != null && r.score_specificity != null && r.score_structure != null
    );
    if (scoredHistory.length < 2) return null;
    const recent = [...scoredHistory].reverse().slice(-10);
    const trendData = recent.map((r, i) => ({
      idx: i + 1,
      avg: Math.round(((r.score_clarity! + r.score_specificity! + r.score_structure!) / 3)),
    }));
    const firstAvg = trendData[0]?.avg ?? 0;
    const lastAvg = trendData[trendData.length - 1]?.avg ?? 0;
    return { trendData, lastAvg, improving: lastAvg >= firstAvg };
  }, [realHistory]);

  const insightsAIInsight = useMemo(() => {
    if (realHistory.length < 3) return null;
    const taskCount: Record<string, number> = {};
    realHistory.forEach(r => { const t = r.task_type || "general"; taskCount[t] = (taskCount[t] || 0) + 1; });
    const topTask = Object.entries(taskCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";
    const topTaskLabel = lang === "zh" ? TASK_LABELS[topTask as TaskType]?.zh || topTask : TASK_LABELS[topTask as TaskType]?.en || topTask;
    const hourMap: Record<number, number> = {};
    realHistory.forEach(r => { const h = new Date(r.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1; });
    const peakH = Number(Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 14);
    const peakStr = lang === "zh" ? `${peakH}:00–${peakH+1}:00` : `${peakH < 12 ? peakH+"am" : peakH === 12 ? "12pm" : (peakH-12)+"pm"}`;
    const scoredRecords = realHistory.filter(r => r.score_clarity != null);
    const avgQuality = scoredRecords.length > 0
      ? Math.round(scoredRecords.reduce((sum, r) => sum + ((r.score_clarity! + r.score_specificity! + r.score_structure!) / 3), 0) / scoredRecords.length)
      : null;
    const text = lang === "zh"
      ? `你最常优化的是 ${topTaskLabel} 类任务，高峰期在 ${peakStr}${avgQuality !== null ? `，Prompt 平均质量分达到 ${avgQuality}` : ""}。${realStats.streak >= 3 ? ` 连续 ${realStats.streak} 天使用中，保持得不错 🔥` : ""}`
      : `You mostly optimize ${topTaskLabel} prompts, peak usage at ${peakStr}${avgQuality !== null ? `, avg quality score ${avgQuality}` : ""}. ${realStats.streak >= 3 ? `${realStats.streak}-day streak — keep it up 🔥` : ""}`;
    return text;
  }, [realHistory, lang, realStats.streak]);

  // ─── Tabs config ──────────────────────────────────
  const tabs = [
    { key: "optimize" as Tab, icon: Sparkles },
    { key: "history" as Tab, icon: History },
    { key: "projects" as Tab, icon: Folder },
    { key: "insights" as Tab, icon: BarChart3 },
    { key: "settings" as Tab, icon: Settings },
  ];

  return (
    <div className="w-[380px] h-screen bg-white flex flex-col border-r border-[#e8e8ec]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#18181b] flex items-center justify-center">
              <Wand2 size={14} className="text-white" />
            </div>
            <span
              className="text-[15px] tracking-[-0.3px] text-[#18181b]"
              style={{ fontWeight: 600 }}
            >
              prompt<span className="text-violet-500">.</span>ai
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              getAvatarUrl(user) ? (
                <img src={getAvatarUrl(user)!} className="w-6 h-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#18181b] flex items-center justify-center">
                  <User size={11} className="text-white" />
                </div>
              )
            )}
            <span className="text-[11px] text-[#8b8b9e] bg-[#f4f4f6] px-2 py-0.5 rounded-full tracking-[-0.2px]">
              v1.7
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-[#f4f4f6] rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-md text-[12px] tracking-[-0.2px] transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-white text-[#18181b] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#8b8b9e] hover:text-[#5a5a72]"
              }`}
              style={{ fontWeight: activeTab === tab.key ? 500 : 400 }}
            >
              <tab.icon size={12} />
              {t(tab.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ─── OPTIMIZE TAB ─── */}
          {activeTab === "optimize" && (
            <motion.div
              key="optimize"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="px-5 pb-5 flex flex-col gap-4 pt-3"
            >
              {/* Target AI */}
              <div className="relative">
                <label
                  className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-1.5 block"
                  style={{ fontWeight: 500 }}
                >
                  {t("targetAi")}
                </label>
                <button
                  onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                  className="w-full flex items-center justify-between px-3 py-[7px] rounded-lg border border-[#e8e8ec] bg-[#fafafa] text-[13px] text-[#18181b] hover:border-[#d0d0d8] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <targetObj.icon size={13} className="text-[#8b8b9e]" />
                    {targetObj.id === "any" ? t("anyAi") : targetObj.name}
                  </span>
                  <ChevronDown size={13} className="text-[#8b8b9e]" />
                </button>
                {showTargetDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8e8ec] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-10 overflow-hidden"
                  >
                    {AI_TARGETS.map((target) => (
                      <button
                        key={target.id}
                        onClick={() => {
                          setSelectedTarget(target.id);
                          setShowTargetDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#f4f4f6] transition-colors ${
                          selectedTarget === target.id
                            ? "text-[#18181b] bg-[#f4f4f6]"
                            : "text-[#5a5a72]"
                        }`}
                      >
                        <target.icon size={13} />
                        {target.id === "any" ? t("anyAi") : target.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Tone */}
              <div>
                <label
                  className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-1.5 block"
                  style={{ fontWeight: 500 }}
                >
                  {t("tone")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      className={`px-3 py-[5px] rounded-md text-[12.5px] tracking-[-0.1px] transition-all duration-150 border ${
                        selectedTone === tone
                          ? "bg-[#18181b] text-white border-[#18181b]"
                          : "bg-white text-[#5a5a72] border-[#e8e8ec] hover:border-[#c8c8d4] hover:text-[#18181b]"
                      }`}
                    >
                      {t(tone)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input first + compact shortcuts */}
              <div className="rounded-2xl border border-[#eceaf2] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f6fb_100%)] p-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase" style={{ fontWeight: 500 }}>
                        {t("yourPrompt")}
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {inputText && (
                        <button
                          onClick={handleReset}
                          className="text-[11px] text-[#8b8b9e] hover:text-[#5a5a72] flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw size={10} />
                          {t("clear")}
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t("placeholder")}
                    className="w-full h-[128px] px-3 py-3 rounded-xl border bg-white text-[13px] text-[#18181b] placeholder:text-[#c0c0cc] resize-none focus:outline-none focus:ring-2 transition-all border-[#e8e2f0] focus:border-[#18181b] focus:ring-[#18181b]/5"
                  />
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[11px] text-[#c0c0cc]">
                      {inputText.length} {t("chars")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Lightbulb size={11} className="text-[#c0c0cc]" />
                      <span className="text-[11px] text-[#c0c0cc]">
                        {t("tip")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-[#ebe7f1] bg-white p-3">
                  <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px] mb-2" style={{ fontWeight: 600 }}>
                    {t("quickPick")}
                  </div>

                  {/* Compact horizontal scenario pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {SCENARIO_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleFeaturedScenario(preset.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] transition-all ${selectedScenario === preset.id ? "bg-[#18181b] text-white shadow-sm" : "bg-[#f5f3f8] text-[#4a4a5a] hover:bg-[#eae6f0]"}`}
                        style={{ fontWeight: 500 }}
                      >
                        <span className="text-[13px]">{preset.icon}</span>
                        {preset.title[lang]}
                      </button>
                    ))}
                  </div>

                  {/* Template Variable Form — inline compact */}
                  {selectedScenarioObj?.variables && selectedScenarioObj?.template && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#ebe7f1]">
                      <div className="space-y-1.5">
                        {selectedScenarioObj.variables.map((v) => (
                          <div key={v.key} className={v.type === "textarea" ? "" : "flex items-center gap-2"}>
                            <label className={`text-[11px] text-[#8b8b9e] shrink-0 ${v.type === "textarea" ? "mb-0.5 block" : ""}`} style={{ fontWeight: 500, minWidth: v.type === "textarea" ? undefined : "48px" }}>
                              {lang === "zh" ? v.labelZh : v.labelEn}
                            </label>
                            {v.type === "textarea" ? (
                              <textarea
                                value={templateVars[v.key] || ""}
                                onChange={(e) => setTemplateVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                placeholder={v.placeholder}
                                className="w-full h-[48px] px-2 py-1.5 rounded-lg border border-[#e8e2f0] bg-[#faf9fc] text-[12px] text-[#18181b] placeholder:text-[#c0c0cc] resize-none focus:outline-none focus:border-[#18181b] focus:ring-1 focus:ring-[#18181b]/10 transition-all"
                              />
                            ) : (
                              <input
                                type="text"
                                value={templateVars[v.key] || ""}
                                onChange={(e) => setTemplateVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                placeholder={v.placeholder}
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[#e8e2f0] bg-[#faf9fc] text-[12px] text-[#18181b] placeholder:text-[#c0c0cc] focus:outline-none focus:border-[#18181b] focus:ring-1 focus:ring-[#18181b]/10 transition-all"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={handleQuickFill}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#18181b] text-white text-[11.5px] hover:bg-[#2d2d33] transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          <Zap size={12} />
                          {lang === "zh" ? "一键填入" : "Quick Fill"}
                        </button>
                        <button
                          onClick={handleTemplateOptimize}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-[#18181b] text-[#18181b] text-[11.5px] hover:bg-[#f5f5f7] transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          <Sparkles size={12} />
                          {lang === "zh" ? "优化后填入" : "Optimize & Fill"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(selectedScenarioObj || primaryRecommendation) && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-[#ebe7f2] bg-white p-3">
                    <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px] mb-1" style={{ fontWeight: 600 }}>
                      {t("taskSummary")}
                    </div>
                    {selectedScenarioObj ? (
                      <>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px]">{selectedScenarioObj.icon}</span>
                          <span className="text-[12.5px] text-[#18181b]" style={{ fontWeight: 600 }}>
                            {selectedScenarioObj.title[lang]}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-[#8b8b9e] leading-[1.5]">
                          {selectedScenarioObj.prompt[lang]}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11.5px] text-[#8b8b9e] leading-[1.5]">{lang === "zh" ? "输入内容后，这里会生成任务摘要。" : "A task summary will appear here once you start typing."}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#ebe7f2] bg-white p-3">
                    <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px] mb-1" style={{ fontWeight: 600 }}>
                      {t("whyThisModel")}
                    </div>
                    {primaryRecommendation ? (
                      <>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center" style={{ background: primaryRecommendation.color, fontWeight: 700 }}>1</span>
                          <span className="text-[12.5px] text-[#18181b]" style={{ fontWeight: 600 }}>
                            {primaryRecommendation.name}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-[#8b8b9e] leading-[1.5]">
                          {lang === "zh" ? primaryRecommendation.reasonZh : primaryRecommendation.reason}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11.5px] text-[#8b8b9e] leading-[1.5]">{lang === "zh" ? "检测到任务类型后，这里会解释为什么推荐对应模型。" : "Once a task type is detected, this panel explains the top model choice."}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 4: AI 推荐卡片 */}
              <AnimatePresence>
                {detectedTask && showRecommendation && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-[#e8e8ec] bg-[#fafafa] p-3">
                      {/* 任务类型标题 */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px]">{TASK_LABELS[detectedTask].icon}</span>
                          <span className="text-[12px] text-[#18181b]" style={{ fontWeight: 600 }}>
                            {lang === "zh"
                              ? `检测到：${TASK_LABELS[detectedTask].zh}任务`
                              : `Detected: ${TASK_LABELS[detectedTask].en} Task`}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowRecommendation(false)}
                          className="text-[11px] text-[#c0c0cc] hover:text-[#8b8b9e] transition-colors px-1"
                        >
                          ✕
                        </button>
                      </div>

                      {/* 推荐卡片列表 */}
                      <div className="flex flex-col gap-2">
                        {AI_RECOMMENDATIONS[detectedTask].map((rec, i) => (
                          <div
                            key={rec.id}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                              i === 0
                                ? "border-[#18181b]/20 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                                : "border-[#e8e8ec] bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* 排名 */}
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0"
                                style={{ background: rec.color, fontWeight: 700 }}
                              >
                                {i + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[12.5px] text-[#18181b]" style={{ fontWeight: 500 }}>
                                    {rec.name}
                                  </span>
                                  <span
                                    className="text-[9.5px] px-1.5 py-0.5 rounded-full text-white"
                                    style={{ background: rec.color, fontWeight: 500 }}
                                  >
                                    {lang === "zh" ? rec.badgeZh : rec.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#8b8b9e] mt-0.5" style={{ lineHeight: "1.4" }}>
                                  {lang === "zh" ? rec.reasonZh : rec.reason}
                                </p>
                              </div>
                            </div>
                            <a
                              href={rec.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-[#18181b] bg-[#f4f4f6] hover:bg-[#18181b] hover:text-white px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0 ml-2"
                              style={{ fontWeight: 500 }}
                            >
                              {lang === "zh" ? "去用" : "Open"}
                              <ArrowRight size={10} />
                            </a>
                          </div>
                        ))}
                      </div>

                      {/* AA 来源标注 */}
                      <p className="text-[10.5px] text-[#c0c0cc] mt-2 text-center">
                        {lang === "zh" ? "基于 Artificial Analysis 榜单" : "Based on Artificial Analysis rankings"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Optimize Button */}
              <button
                onClick={handleOptimize}
                disabled={!inputText.trim() || isOptimizing}
                className={`w-full flex items-center justify-center gap-2 py-[10px] rounded-lg text-[13.5px] tracking-[-0.2px] transition-all duration-200 ${
                  isOptimizing
                    ? "bg-[#18181b] text-white/80 cursor-wait animate-pulse"
                    : inputText.trim()
                    ? "bg-[#18181b] text-white hover:bg-[#2a2a30] active:scale-[0.98] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                    : "bg-[#e8e8ec] text-[#b0b0be] cursor-not-allowed"
                }`}
                style={{ fontWeight: 500 }}
              >
                {isOptimizing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Sparkles size={14} />
                    </motion.div>
                    {t("optimizing")}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {t("optimizeFlow")}
                    <ArrowRight size={13} />
                  </>
                )}
              </button>

              {/* Error Card */}
              <AnimatePresence>
                {optimizeError && !isOptimizing && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[14px] shrink-0">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#9b1c1c] mb-1" style={{ fontWeight: 600 }}>
                          {lang === "zh" ? "优化失败" : "Optimization failed"}
                        </div>
                        <p className="text-[11.5px] text-[#b91c1c] leading-[1.4] break-all">{optimizeError}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleOptimize}
                      className="mt-2 w-full text-[11.5px] text-[#9b1c1c] bg-white hover:bg-[#fff5f5] border border-[#fecaca] rounded-lg py-1.5 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      {lang === "zh" ? "🔄 重新尝试" : "🔄 Try again"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Output */}
              <AnimatePresence>
                {optimizedText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* v7.8: 风格记忆提示 + v12: AI 记忆面板入口 */}
                    {(memoryHint || user) && (
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {memoryHint && (
                          <div className="inline-flex items-center px-2 py-1 bg-[#f5f0ff] border border-[#e0d3f9] rounded-full">
                            <span className="text-[11px] text-[#5d3eb8]" style={{ fontWeight: 600 }}>✨ {memoryHint}</span>
                          </div>
                        )}
                        {user && (
                          <button
                            onClick={() => setMemoryPanelOpen(true)}
                            className="inline-flex items-center px-2 py-1 bg-white border border-[#e0d3f9] hover:bg-[#f5f0ff] rounded-full transition-colors cursor-pointer"
                            title="查看 prompt.ai 学到的你的 AI 偏好画像"
                            type="button"
                          >
                            <span className="text-[11px] text-[#5d3eb8]" style={{ fontWeight: 500 }}>🧠 我的 AI 记忆</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* v12: Memory Panel modal (Dialog Portal — 渲染位置不影响布局) */}
                    <MemoryPanel
                      open={memoryPanelOpen}
                      onClose={() => setMemoryPanelOpen(false)}
                      user={user}
                      onForceExtract={() => maybeExtractFacts({ force: true })}
                      lang={lang}
                    />

                    {/* v23: Onboarding 首次体验引导 (Dialog Portal,首次登录后自动弹一次) */}
                    <OnboardingCard
                      open={onboardingOpen}
                      onClose={() => setOnboardingOpen(false)}
                    />

                    {/* Diagnosis card */}
                    {diagnosis && (
                      <div className="flex items-start gap-2 px-3 py-2.5 bg-[#fffbf0] border border-[#f0e4c8] rounded-lg mb-3">
                        <Lightbulb size={13} className="text-[#c09b3f] flex-shrink-0 mt-0.5" />
                        <span className="text-[12.5px] text-[#8a6d3b]">{diagnosis}</span>
                      </div>
                    )}

                    <div className="rounded-2xl border border-[#ebe7f2] bg-[linear-gradient(180deg,#fdfcff_0%,#faf8fd_100%)] p-3 mb-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px]" style={{ fontWeight: 600 }}>
                          {t("compareView")}
                        </div>
                        <div className="text-[10.5px] text-[#6f6682] bg-white border border-[#ece7f2] rounded-full px-2 py-0.5">
                          {t("resultDiff")}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-[#ece7f2] bg-white p-3">
                          <div className="text-[10.5px] text-[#a197b1] uppercase tracking-[0.3px] mb-1" style={{ fontWeight: 600 }}>
                            {t("originalRequest")}
                          </div>
                          <div className="text-[12.5px] text-[#51495f] leading-[1.55] line-clamp-6">
                            {inputText}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[#ded6ea] bg-white p-3 shadow-[0_10px_24px_rgba(124,92,255,0.06)]">
                          <div className="text-[10.5px] text-[#7c5cff] uppercase tracking-[0.3px] mb-1" style={{ fontWeight: 700 }}>
                            {lang === "zh" ? "优化后的任务规格" : "Improved task spec"}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {improvementNotes.map((item) => (
                              <div key={item} className="flex items-start gap-2 text-[12px] text-[#4c4460] leading-[1.45]">
                                <span className="mt-0.5 text-[#7c5cff]">•</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase flex items-center gap-1.5"
                        style={{ fontWeight: 500 }}
                      >
                        <Target size={11} />
                        {t("optimizedResult")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleFillToChat}
                          className={`flex items-center gap-1 text-[11px] text-white px-2.5 py-1 rounded-md transition-colors ${
                            fillStatus === "filled" ? "bg-emerald-500" :
                            fillStatus === "copied" ? "bg-blue-500" :
                            fillStatus === "error" ? "bg-red-500" :
                            "bg-[#18181b] hover:bg-[#2a2a30]"
                          }`}
                        >
                          {fillStatus === "filled" ? (
                            <><Check size={10} />{lang === "zh" ? "已填入" : "Filled"}</>
                          ) : fillStatus === "copied" ? (
                            <><Check size={10} />{lang === "zh" ? "已复制" : "Copied"}</>
                          ) : (
                            <><ArrowRight size={10} />{t("optimizeAndFill")}</>
                          )}
                        </button>
                        <button
                          onClick={() => handleCopy()}
                          className="flex items-center gap-1 text-[11px] text-[#8b8b9e] hover:text-[#18181b] transition-colors bg-[#f4f4f6] hover:bg-[#ebebf0] px-2 py-1 rounded-md"
                        >
                          {copied ? (
                            <>
                              <Check size={11} className="text-emerald-500" />
                              <span className="text-emerald-500">
                                {t("copied")}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              {t("copy")}
                            </>
                          )}
                        </button>

                      </div>
                    </div>
                      <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px] mb-1.5" style={{ fontWeight: 600 }}>
                        {t("readyToUse")}
                      </div>
                      <div className="relative">
                        <div className="absolute top-0 left-0 w-[3px] h-full bg-[#18181b] rounded-full" />
                        <div
                          className="pl-4 pr-3 py-3 bg-[#fafafa] rounded-lg border border-[#e8e8ec] text-[13px] text-[#2a2a30] whitespace-pre-wrap max-h-[200px] overflow-y-auto"
                          style={{ lineHeight: "1.65" }}
                        >
                          {optimizedText}
                        </div>
                      </div>
                      {/* v28: 自动项目归类建议 banner */}
                      {user && projectSuggestion && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#faf7ff] to-white border border-[#e0d3f9]"
                        >
                          <span className="text-base">💡</span>
                          <div className="flex-1 text-[11.5px] text-[#5d3eb8] leading-snug">
                            看起来属于
                            <span
                              className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: (projectSuggestion.color || "#7c3aed") + "20", color: projectSuggestion.color || "#7c3aed" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: projectSuggestion.color || "#7c3aed" }} />
                              {projectSuggestion.name}
                            </span>
                            ({Math.round(projectSuggestion.sim * 100)}% 匹配)
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              assignOptimizedToProject(projectSuggestion.id, projectSuggestion.name);
                              setProjectSuggestion(null);
                            }}
                            className="px-2 py-0.5 rounded-md text-[10.5px] bg-[#5d3eb8] text-white hover:bg-[#7c3aed] transition-colors"
                          >
                            ✓ 加入
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectSuggestion(null)}
                            className="px-1 text-[#a78bfa] hover:text-[#5d3eb8] text-[12px]"
                            title="忽略"
                          >
                            ✕
                          </button>
                        </motion.div>
                      )}

                      {/* v31 polish: 行动条 — 左侧管理 (☆ + 📁), 右侧主操作 (↗ 发送) */}
                      {user && (
                        <div className="mt-2 flex items-center gap-2 px-1">
                          {/* 左侧管理动作 */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={toggleOptimizedStar}
                              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] border transition-all active:scale-[0.97] ${
                                optimizedIsStarred
                                  ? "bg-[#fff7e0] text-[#a06a08] border-[#fbbf24] shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
                                  : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#fbbf24] hover:text-[#a06a08] hover:bg-[#fffbef]"
                              }`}
                              title={optimizedIsStarred ? "已收藏 — 再次点击取消" : "收藏供未来检索"}
                            >
                              <span className="text-[12px] leading-none">{optimizedIsStarred ? "⭐" : "☆"}</span>
                              <span className="leading-none">{optimizedIsStarred ? "已收藏" : "收藏"}</span>
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowProjectMenu(v => !v)}
                                className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] border transition-all active:scale-[0.97] ${
                                  showProjectMenu
                                    ? "bg-[#faf7ff] text-[#5d3eb8] border-[#c7b3f5]"
                                    : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#c7b3f5] hover:text-[#5d3eb8] hover:bg-[#faf7ff]"
                                }`}
                                title="把这条 prompt 归类到一个项目"
                              >
                                <span className="leading-none">📁</span>
                                <span className="leading-none">加入项目</span>
                                <span className="text-[9px] leading-none opacity-60">▾</span>
                              </button>
                              {showProjectMenu && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setShowProjectMenu(false)} />
                                  <div className="absolute z-20 top-full mt-1.5 left-0 bg-white border border-[#e7e1ef] rounded-lg shadow-[0_8px_24px_rgba(24,24,27,0.08)] min-w-[220px] max-h-[260px] overflow-y-auto py-1">
                                    {userProjects.length === 0 ? (
                                      <div className="p-3 text-[11.5px] text-zinc-500 leading-relaxed">
                                        还没有项目<br />
                                        <button
                                          type="button"
                                          onClick={() => { setActiveTab("projects"); setShowProjectMenu(false); }}
                                          className="text-[#7c3aed] hover:underline mt-1"
                                        >
                                          去 📁 项目 tab 创建第一个 →
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {userProjects.map(p => (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => assignOptimizedToProject(p.id, p.name)}
                                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12px] text-zinc-700 hover:bg-[#faf7ff] transition-colors"
                                          >
                                            <span
                                              className="w-2 h-2 rounded-full flex-shrink-0"
                                              style={{ background: p.color || "#7c3aed" }}
                                            />
                                            <span className="truncate">{p.name}</span>
                                          </button>
                                        ))}
                                        <div className="border-t border-zinc-100 mt-1 px-3 py-1.5">
                                          <button
                                            type="button"
                                            onClick={() => { setActiveTab("projects"); setShowProjectMenu(false); }}
                                            className="text-[11px] text-[#7c3aed] hover:underline"
                                          >
                                            + 新建项目
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 中间分隔 + toast */}
                          <div className="flex-1 flex items-center justify-center min-w-0">
                            <AnimatePresence>
                              {assignToast && (
                                <motion.span
                                  key={assignToast}
                                  initial={{ opacity: 0, y: -2 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className={`text-[10.5px] truncate ${assignToast.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}
                                >
                                  {assignToast}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* 右侧主操作 — 发送到当前 AI */}
                          <button
                            type="button"
                            onClick={async () => {
                              const result = await fillTextToChat(optimizedText);
                              setAssignToast(
                                result === "filled" ? "✓ 已发到当前 AI tab" :
                                result === "copied" ? "✓ 已复制 (当前页面没识别到输入框)" :
                                "✗ 发送失败"
                              );
                              setTimeout(() => setAssignToast(""), 2500);
                            }}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] bg-[#18181b] text-white hover:bg-[#2a2a30] active:scale-[0.97] transition-all shadow-[0_1px_2px_rgba(24,24,27,0.18)]"
                            style={{ fontWeight: 500 }}
                            title="把这条优化版直接发到当前打开的 AI 网页输入框"
                          >
                            <span className="leading-none">↗</span>
                            <span className="leading-none">发送到 AI</span>
                          </button>
                        </div>
                      )}
                    <div className="flex items-center gap-3 mt-3">
                      {[
                        {
                          label: t("clarity"),
                          value: scores ? `${scores.clarity}` : "—",
                          color: "text-emerald-500",
                        },
                        {
                          label: t("specificity"),
                          value: scores ? `${scores.specificity}` : "—",
                          color: "text-blue-500",
                        },
                        {
                          label: t("structure"),
                          value: scores ? `${scores.structure}` : "—",
                          color: "text-violet-500",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="flex-1 bg-[#fafafa] border border-[#e8e8ec] rounded-lg px-3 py-2 text-center"
                        >
                          <div
                            className={`text-[13px] ${stat.color}`}
                            style={{ fontWeight: 600 }}
                          >
                            {stat.value}
                          </div>
                          <div className="text-[10.5px] text-[#8b8b9e]">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                      {/* 👍/👎 反馈按钮，放评分行右侧 */}
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleFeedback("up")}
                          title={lang === "zh" ? "有帮助" : "Helpful"}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[14px] transition-all ${
                            feedback === "up"
                              ? "bg-emerald-100"
                              : "hover:bg-[#f0f0f4] opacity-40 hover:opacity-100"
                          }`}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleFeedback("down")}
                          title={lang === "zh" ? "不够好" : "Not helpful"}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[14px] transition-all ${
                            feedback === "down"
                              ? "bg-red-100"
                              : "hover:bg-[#f0f0f4] opacity-40 hover:opacity-100"
                          }`}
                        >
                          👎
                        </button>
                      </div>
                    </div>

                    {/* 👍 确认提示 */}
                    <AnimatePresence>
                      {feedbackConfirmed && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-[11px] text-emerald-500 text-right mt-1 pr-1"
                        >
                          {lang === "zh" ? "✅ 已记录，感谢反馈" : "✅ Noted, thanks!"}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 👎 反馈选项面板 */}
                    <AnimatePresence>
                      {showFeedbackOptions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                            <div className="text-[10.5px] text-[#9b1c1c] mb-1.5" style={{ fontWeight: 500 }}>
                              {lang === "zh" ? "哪里不满意？选择后自动改进" : "What went wrong? Auto-refine after selection"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {FEEDBACK_REASONS.map(reason => (
                                <button
                                  key={reason.key}
                                  onClick={() => handleFeedbackReason(reason.key)}
                                  disabled={isRefining}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-all active:scale-[0.97]"
                                  style={{
                                    borderColor: "#ddd9e3",
                                    background: "#fcfbfd",
                                    color: "#3d3d47",
                                    fontWeight: 500,
                                    cursor: isRefining ? "not-allowed" : "pointer",
                                  }}
                                >
                                  <span>{reason.emoji}</span>
                                  <span>{lang === "zh" ? reason.labelZh : reason.labelEn}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {tips.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-[#f4f4f6] rounded-lg">
                            <span className="text-[11px] text-[#8b8b9e] flex-shrink-0 mt-0.5">💡</span>
                            <span className="text-[12px] text-[#5a5a72]" style={{ lineHeight: "1.5" }}>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-[#ece7f2] bg-[#fbfafc] p-3">
                      <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px] mb-2" style={{ fontWeight: 600 }}>
                        {t("launchActions")}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleFillToChat} className="rounded-lg bg-[#18181b] text-white text-[11.5px] py-2 px-2 hover:bg-[#2a2a30] transition-colors">
                          {t("optimizeAndFill")}
                        </button>
                        <button onClick={() => handleCopy()} className="rounded-lg border border-[#e2dde9] bg-white text-[#18181b] text-[11.5px] py-2 px-2 hover:border-[#18181b] transition-colors">
                          {t("copy")}
                        </button>
                      </div>
                    </div>

                    {/* 快捷二次优化指令 + 上下文预览 */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        {/* 上下文指示器 */}
                        {conversationRef.current.length > 0 ? (
                          <button
                            onClick={() => setShowContext(!showContext)}
                            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full transition-all"
                            style={{
                              background: showContext ? "#18181b" : "#f0eef4",
                              color: showContext ? "#fff" : "#5a5a72",
                              fontWeight: 500,
                            }}
                          >
                            <span className="text-[12px]">🧠</span>
                            {lang === "zh"
                              ? `第 ${Math.floor(conversationRef.current.length / 2)} 轮 · ${conversationRef.current.length} 条上下文`
                              : `Round ${Math.floor(conversationRef.current.length / 2)} · ${conversationRef.current.length} msgs`}
                            <ChevronDown size={10} className={`transition-transform ${showContext ? "rotate-180" : ""}`} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#c0c0cc] px-2 py-1">
                            🧠 {lang === "zh" ? "新对话" : "New conversation"}
                          </span>
                        )}
                        {/* 新话题按钮 */}
                        <button
                          onClick={handleNewTopic}
                          className="flex items-center gap-1 text-[11px] transition-colors"
                          style={{ color: isNewTopic ? "#2d7a4f" : "#9898a7", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          {isNewTopic ? "✅ 已开启新话题" : (lang === "zh" ? "🔄 新话题" : "🔄 New topic")}
                        </button>
                      </div>

                      {/* 上下文预览面板 */}
                      <AnimatePresence>
                        {showContext && conversationRef.current.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mb-2.5 rounded-lg border border-[#e8e4f0] bg-[#faf9fc] p-2.5 max-h-[180px] overflow-y-auto">
                              {Array.from({ length: Math.ceil(conversationRef.current.length / 2) }).map((_, roundIdx) => {
                                const userMsg = conversationRef.current[roundIdx * 2];
                                const aiMsg = conversationRef.current[roundIdx * 2 + 1];
                                return (
                                  <div key={roundIdx}>
                                    {roundIdx > 0 && <div className="border-t border-[#ebe7f1] my-1.5" />}
                                    {userMsg && (
                                      <div className="flex items-start gap-1.5 py-1">
                                        <span className="text-[11px] shrink-0 mt-0.5">👤</span>
                                        <p className="text-[11px] text-[#4a4a5a] leading-[1.4] line-clamp-2">{userMsg.content.slice(0, 80)}{userMsg.content.length > 80 ? "..." : ""}</p>
                                      </div>
                                    )}
                                    {aiMsg && (
                                      <div className="flex items-start gap-1.5 py-1 bg-white rounded px-1.5 -mx-0.5">
                                        <span className="text-[11px] shrink-0 mt-0.5">🤖</span>
                                        <p className="text-[11px] text-[#6b6b7a] leading-[1.4] line-clamp-2">{aiMsg.content.slice(0, 80)}{aiMsg.content.length > 80 ? "..." : ""}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <button
                                onClick={handleNewTopic}
                                className="mt-2 w-full text-[10.5px] text-[#9b1c1c] bg-[#fef2f2] hover:bg-[#fecaca]/30 border border-[#fecaca] rounded-md py-1 transition-colors"
                              >
                                🗑️ {lang === "zh" ? "清除上下文，开新话题" : "Clear context, start fresh"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-wrap gap-1.5">
                        {REFINE_ACTIONS.map(action => (
                          <button
                            key={action.key}
                            onClick={() => handleRefine(action.key)}
                            disabled={isRefining}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[12px] transition-all active:scale-[0.97]"
                            style={{
                              borderColor: "#ddd9e3",
                              background: isRefining ? "#f2f1f5" : "#fcfbfd",
                              color: isRefining ? "#ababba" : "#3d3d47",
                              fontWeight: 500,
                              cursor: isRefining ? "not-allowed" : "pointer",
                            }}
                          >
                            <span>{action.emoji}</span>
                            <span>{lang === "zh" ? action.labelZh : action.labelEn}</span>
                          </button>
                        ))}
                        {isRefining && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" style={{ color: "#8e8e9d" }}>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                              <Sparkles size={11} />
                            </motion.div>
                            {lang === "zh" ? "优化中..." : "Refining..."}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ─── HISTORY TAB ─── */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="px-5 pb-5 pt-3"
            >
              {/* 未登录 */}
              {!isLoggedIn ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f4f4f6] to-[#e8e8ec] flex items-center justify-center mb-5">
                    <History size={28} className="text-[#8b8b9e]" />
                  </div>
                  <h3 className="text-[15px] text-[#18181b] text-center mb-2">
                    {lang === "zh" ? "登录查看历史记录" : "Sign in to view history"}
                  </h3>
                  <p className="text-[12.5px] text-[#8b8b9e] text-center mb-6 px-4" style={{ lineHeight: "1.6" }}>
                    {lang === "zh"
                      ? "登录后可以查看所有优化过的 prompt 记录，随时复用"
                      : "Sign in to access all your optimized prompts anytime"}
                  </p>
                  <button
                    onClick={() => { setShowAuthModal(true); setAuthMode("signin"); setAuthError(""); }}
                    className="flex items-center gap-2 bg-[#18181b] text-white px-6 py-2.5 rounded-lg text-[13px] hover:bg-[#2a2a30] active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                    style={{ fontWeight: 500 }}
                  >
                    <LogIn size={14} />
                    {t("signIn")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#ebe7f2] bg-[linear-gradient(180deg,#fcfbff_0%,#f8f6fb_100%)] p-3 mb-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div>
                        <div className="text-[10.5px] text-[#8b8b9e] uppercase tracking-[0.3px]" style={{ fontWeight: 600 }}>
                          {t("recentBest")}
                        </div>
                        <div className="text-[13px] text-[#18181b]" style={{ fontWeight: 600 }}>
                          {lang === "zh" ? "你的 Prompt 资产库" : "Your prompt asset library"}
                        </div>
                      </div>
                      <div className="px-2 py-1 rounded-full bg-white text-[10.5px] text-[#6f6682] border border-[#ece7f4]">
                        {historyView === "templates" ? `${templates.length} 模板` : `${realHistory.length}`}
                      </div>
                    </div>
                    <p className="text-[11.5px] text-[#8b8b9e]">{t("historyAssetHint")}</p>
                  </div>

                  {/* v30/v31: View mode toggle 历史 / 会话 / 模板 */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {[
                      { value: "history", label: "📜 列表", count: null as null | number },
                      { value: "sessions", label: "💬 会话", count: sessionGroups.length },
                      { value: "templates", label: "📚 模板", count: templates.length },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setHistoryView(opt.value as "history" | "sessions" | "templates")}
                        className={`flex-1 px-2 py-1.5 text-[12px] rounded-md border transition-colors ${
                          historyView === opt.value
                            ? "bg-[#18181b] text-white border-[#18181b]"
                            : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#c0c0cc]"
                        }`}
                      >
                        {opt.label}
                        {opt.count !== null && opt.count > 0 && (
                          <span className={`ml-1 ${historyView === opt.value ? "opacity-70" : "text-[#c0c0cc]"}`}>
                            ({opt.count})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* v30: Templates view */}
                  {historyView === "templates" ? (
                    <div>
                      {/* v32-F: 智能模板建议 banner */}
                      {!templatesLoading && templateSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-3 rounded-lg border border-[#e0d3f9] bg-gradient-to-br from-[#faf7ff] to-white p-3"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[14px]">💡</span>
                            <span className="text-[12px] font-semibold text-[#5d3eb8]">
                              发现 {templateSuggestions.length} 条高频 prompt 适合存为模板
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {templateSuggestions.map((s) => (
                              <div
                                key={s.signature}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-[#ece7f4] hover:border-[#c7b3f5] transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11.5px] text-[#3a3a45] truncate">
                                    {s.sample.original_text.slice(0, 60)}{s.sample.original_text.length > 60 ? "…" : ""}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-[#8b8b9e]">
                                      重复 {s.count} 次
                                    </span>
                                    {s.autoVars.length > 0 && (
                                      <>
                                        <span className="text-[10px] text-[#c0c0cc]">·</span>
                                        <span className="text-[10px] text-[#5d3eb8]">
                                          自动识别: {s.autoVars.map(v => `{{${v}}}`).join(" ")}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleSaveTemplateFromSuggestion(s)}
                                  className="flex-shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10.5px] bg-[#5d3eb8] text-white hover:bg-[#7c3aed] active:scale-[0.97] transition-all"
                                  style={{ fontWeight: 500 }}
                                >
                                  💾 存为模板
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      {templatesLoading ? (
                        <div className="py-8 text-center text-[12px] text-zinc-400">加载模板中...</div>
                      ) : templates.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center">
                          <div className="text-3xl mb-2">📚</div>
                          <p className="text-[12.5px] text-zinc-700 mb-1 font-medium">还没有模板</p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
                            在「📜 历史」里展开任意 prompt → 点 [💾 存为模板]<br/>
                            把好用的 prompt 存成模板,下次一键复用
                          </p>
                          <p className="text-[10.5px] text-zinc-400">
                            💡 模板支持 {"{{变量}}"} 占位符,使用时一键替换
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {templates.map(tpl => (
                            <motion.div
                              key={tpl.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors p-3"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <h4 className="text-[13px] font-semibold text-zinc-900 flex items-center gap-1.5">
                                  📄 {tpl.name}
                                </h4>
                                <span className="text-[10.5px] text-zinc-400">
                                  用了 {tpl.use_count} 次
                                </span>
                              </div>
                              <p className="text-[11.5px] text-zinc-600 line-clamp-2 mb-2 leading-relaxed">
                                {tpl.template_text.slice(0, 120)}{tpl.template_text.length > 120 ? "…" : ""}
                              </p>
                              {tpl.variables.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {tpl.variables.map(v => (
                                    <span key={v} className="text-[10px] bg-[#faf7ff] text-[#5d3eb8] px-1.5 py-0.5 rounded border border-[#e0d3f9]">
                                      {`{{${v}}}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleUseTemplate(tpl)}
                                  className="flex-1 text-[11px] h-7"
                                >
                                  ↗ 使用模板
                                </Button>
                                <button
                                  onClick={() => handleOpenEditTemplate(tpl)}
                                  className="text-[11px] text-zinc-500 hover:text-[#5d3eb8] px-2 py-1"
                                  title="编辑模板"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  className="text-[11px] text-zinc-400 hover:text-red-500 px-2 py-1"
                                  title="删除模板"
                                >
                                  🗑️
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : historyView === "sessions" ? (
                    /* v31: Sessions view — 同平台 + 30min 内的 prompts 视为一个会话 */
                    <div>
                      {sessionGroups.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center">
                          <div className="text-3xl mb-2">💬</div>
                          <p className="text-[12.5px] text-zinc-700 mb-1 font-medium">还没有会话</p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            优化几条 prompt 后,系统会按平台 + 时间窗口<br/>
                            自动把"同一段对话"的 prompt 聚成一个会话卡片
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {sessionGroups.map((s) => {
                            const sessionKey = `session:${s.id}`;
                            const isExpanded = expandedHistory === sessionKey;
                            const startDate = new Date(s.startTime);
                            const endDate = new Date(s.endTime);
                            const sameMinute = Math.abs(startDate.getTime() - endDate.getTime()) < 60000;
                            const platformLabel = s.platform === "unknown" ? "未识别" : s.platform;
                            const hasStarred = s.items.some(x => x.is_starred);
                            return (
                              <motion.div
                                key={s.id}
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border border-[#e8e8ec] bg-white hover:border-[#d0d0d8] transition-colors overflow-hidden"
                              >
                                {/* Session header */}
                                <button
                                  onClick={() => setExpandedHistory(isExpanded ? null : sessionKey)}
                                  className="text-left w-full p-3.5 group"
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10.5px] font-semibold text-[#5d3eb8] bg-[#faf7ff] border border-[#e0d3f9] px-2 py-0.5 rounded-full capitalize">
                                        💬 {platformLabel}
                                      </span>
                                      <span className="text-[11px] text-[#8b8b9e]">
                                        {formatRelativeTime(s.startTime)}
                                        {!sameMinute && (
                                          <>
                                            {" · 持续 "}
                                            {Math.max(1, Math.round((startDate.getTime() - endDate.getTime()) / 60000))}
                                            {" 分钟"}
                                          </>
                                        )}
                                      </span>
                                      <span className="text-[10.5px] text-[#6f6682] bg-[#f4f4f6] px-1.5 py-0.5 rounded">
                                        {s.items.length} 条 prompt
                                      </span>
                                      {hasStarred && (
                                        <span className="text-[10.5px] text-[#a06a08] bg-[#fff7e0] border border-[#fbbf24] px-1.5 py-0.5 rounded">
                                          ⭐ 含收藏
                                        </span>
                                      )}
                                    </div>
                                    <motion.div
                                      animate={{ rotate: isExpanded ? 90 : 0 }}
                                      transition={{ duration: 0.15 }}
                                    >
                                      <ArrowRight size={12} className="text-[#c0c0cc] group-hover:text-[#18181b] transition-colors" />
                                    </motion.div>
                                  </div>
                                  {/* 第一条 prompt 作为标题摘要 */}
                                  <p className="text-[13px] text-[#18181b]" style={{ fontWeight: 500 }}>
                                    {s.items[s.items.length - 1].original_text.length > 60
                                      ? s.items[s.items.length - 1].original_text.slice(0, 60) + "…"
                                      : s.items[s.items.length - 1].original_text}
                                  </p>
                                  {!isExpanded && s.items.length > 1 && (
                                    <p className="text-[12px] text-[#8b8b9e] truncate mt-1">
                                      … 还有 {s.items.length - 1} 条 prompt
                                    </p>
                                  )}
                                </button>
                                {/* Expanded — 整个会话的 prompts 时间倒序 */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-3.5 pb-3.5 border-t border-[#f0f0f4] pt-3 space-y-2">
                                        {s.items.map((it, idx) => (
                                          <div
                                            key={it.id}
                                            className="rounded-lg bg-[#fafafa] border border-[#e8e8ec] p-2.5"
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] text-[#8b8b9e]">
                                                #{s.items.length - idx} · {formatRelativeTime(it.created_at)}
                                              </span>
                                              {it.is_starred && (
                                                <span className="text-[10px] text-[#a06a08]">⭐</span>
                                              )}
                                            </div>
                                            <p className="text-[12px] text-[#18181b] mb-1" style={{ fontWeight: 500 }}>
                                              {it.original_text.length > 100
                                                ? it.original_text.slice(0, 100) + "…"
                                                : it.original_text}
                                            </p>
                                            {it.optimized_text && (
                                              <p className="text-[11.5px] text-[#6f6682] truncate">
                                                → {it.optimized_text.split("\n")[0]}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (it.optimized_text) handleCopy(it.optimized_text);
                                                }}
                                                className="text-[10px] text-[#6f6682] hover:text-[#18181b] bg-white border border-[#e7e1ef] px-2 py-0.5 rounded transition-colors"
                                              >
                                                📋 复制优化版
                                              </button>
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  if (it.optimized_text) await fillTextToChat(it.optimized_text);
                                                }}
                                                className="text-[10px] text-white bg-[#18181b] hover:bg-[#2a2a30] px-2 py-0.5 rounded transition-colors"
                                              >
                                                ↗ 发到 AI
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>

                  {/* 搜索框 */}
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c0c0cc]" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder={lang === "zh" ? "搜索 (语义匹配 + 关键词)..." : "Search (semantic + keyword)..."}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#e8e8ec] bg-[#fafafa] text-[13px] text-[#18181b] placeholder:text-[#c0c0cc] focus:outline-none focus:border-[#b0b0c0] transition-colors"
                    />
                  </div>

                  {/* v24: 时间范围 + 平台 filter chips */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {[
                      { value: 1, label: "今天" },
                      { value: 7, label: "7天" },
                      { value: 30, label: "30天" },
                      { value: 90, label: "全部" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSearchDays(opt.value)}
                        className={`px-2 py-0.5 text-[10.5px] rounded-full border transition-colors ${
                          searchDays === opt.value
                            ? "bg-[#18181b] text-white border-[#18181b]"
                            : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#c0c0cc]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {/* v26: 仅收藏 toggle */}
                    <button
                      onClick={() => setSearchOnlyStarred(v => !v)}
                      className={`px-2 py-0.5 text-[10.5px] rounded-full border transition-colors ${
                        searchOnlyStarred
                          ? "bg-[#fbbf24] text-white border-[#fbbf24]"
                          : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#fbbf24]"
                      }`}
                    >
                      ⭐ 仅收藏
                    </button>
                  </div>
                  {facets.platforms.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      <span className="text-[10.5px] text-[#8b8b9e] mr-0.5">平台:</span>
                      {facets.platforms.slice(0, 8).map((p) => {
                        const isActive = searchPlatforms.includes(p.value);
                        return (
                          <button
                            key={p.value}
                            onClick={() => setSearchPlatforms(prev =>
                              isActive ? prev.filter(x => x !== p.value) : [...prev, p.value]
                            )}
                            className={`px-2 py-0.5 text-[10.5px] rounded-full border transition-colors ${
                              isActive
                                ? "bg-[#5d3eb8] text-white border-[#5d3eb8]"
                                : "bg-white text-[#6f6682] border-[#e7e1ef] hover:border-[#c0c0cc]"
                            }`}
                          >
                            {p.value} <span className={isActive ? "opacity-70" : "text-[#c0c0cc]"}>({p.count})</span>
                          </button>
                        );
                      })}
                      {(searchPlatforms.length > 0 || searchDays !== 90) && (
                        <button
                          onClick={() => { setSearchPlatforms([]); setSearchTaskTypes([]); setSearchDays(90); }}
                          className="text-[10.5px] text-[#c0c0cc] hover:text-[#71717a] ml-1 underline"
                        >
                          清除
                        </button>
                      )}
                    </div>
                  )}

                  {recentReusableHistory.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {recentReusableHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => { setInputText(item.original_text); setActiveTab("optimize"); }}
                          className="max-w-full text-left px-2.5 py-1.5 rounded-full border border-[#e7e1ef] bg-white text-[11.5px] text-[#5a5168] hover:border-[#18181b] hover:text-[#18181b] transition-colors truncate"
                        >
                          {(item.original_text || "").slice(0, 28)}{(item.original_text || "").length > 28 ? "…" : ""}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 加载中 */}
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles size={18} className="text-[#c0c0cc]" />
                      </motion.div>
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    /* 空状态 — v32-B: 加示例数据按钮 */
                    <div className="flex flex-col items-center justify-center py-10 px-4">
                      <Clock size={28} className="text-[#e8e8ec] mb-3" />
                      <p className="text-[13px] text-[#8b8b9e]">
                        {historySearch
                          ? (lang === "zh" ? "没有找到匹配记录" : "No matching records")
                          : (lang === "zh" ? "还没有优化记录" : "No history yet")}
                      </p>
                      {!historySearch && (
                        <>
                          <p className="text-[12px] text-[#c0c0cc] mt-1 mb-4">
                            {lang === "zh" ? "去优化你的第一个 prompt 吧" : "Optimize your first prompt!"}
                          </p>
                          <div className="w-full max-w-[280px] rounded-xl border border-[#e0d3f9] bg-gradient-to-br from-[#faf7ff] to-white p-3.5 text-center">
                            <div className="text-[20px] mb-1">✨</div>
                            <p className="text-[12.5px] text-[#5d3eb8] font-medium mb-1">
                              第一次用?先体验示例数据
                            </p>
                            <p className="text-[11px] text-[#8b7eb3] leading-relaxed mb-3">
                              我们会给你账号插入 5 条 demo prompt + 1 个项目 + 1 个模板,<br/>
                              一键看完整功能 (随时可清除)
                            </p>
                            <button
                              onClick={handleSeedDemo}
                              disabled={seedingDemo}
                              className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-[#5d3eb8] text-white text-[12px] hover:bg-[#7c3aed] active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-wait"
                              style={{ fontWeight: 500 }}
                            >
                              {seedingDemo ? (
                                <>
                                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                    <Sparkles size={12} />
                                  </motion.span>
                                  正在写入...
                                </>
                              ) : (
                                <>🎬 加载示例数据</>
                              )}
                            </button>
                            {demoSeededToast && (
                              <p className={`mt-2 text-[10.5px] ${demoSeededToast.startsWith("✓") ? "text-emerald-600" : "text-amber-600"}`}>
                                {demoSeededToast}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* 历史列表（按日期分组）*/
                    <div className="flex flex-col gap-4">
                      {groupedHistory.map((group) => (
                        <div key={group.label}>
                          {/* 分组标题 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] text-[#8b8b9e] uppercase tracking-[0.4px]" style={{ fontWeight: 600 }}>
                              {group.label}
                            </span>
                            <div className="flex-1 h-px bg-[#f0f0f4]" />
                            <span className="text-[11px] text-[#c0c0cc]">{group.items.length}</span>
                          </div>
                          <div className="flex flex-col gap-2.5">
                      {group.items.map((item, i) => {
                        const uid = `${group.label}-${i}`;
                        const listKey = `list:${groupedHistory.indexOf(group)}-${i}`;
                        const isExpanded = expandedHistory === listKey;
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            className="rounded-xl border border-[#e8e8ec] bg-white hover:border-[#d0d0d8] transition-colors overflow-hidden"
                          >
                            {/* Header */}
                            <button
                              onClick={() => setExpandedHistory(isExpanded ? null : listKey)}
                              className="text-left w-full p-3.5 group"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11.5px] text-[#8b8b9e]">
                                    {formatRelativeTime(item.created_at)}
                                  </span>
                                  {item.platform && item.platform !== "any" && (
                                    <span className="text-[10px] text-[#8b8b9e] bg-[#f4f4f6] px-1.5 py-0.5 rounded capitalize">
                                      {item.platform}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#6d47d9] bg-[#f3edff] px-1.5 py-0.5 rounded">
                                    {t("scenarioTag")}: {getScenarioLabel((item as any).task_type || "general", lang)}
                                  </span>
                                </div>
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <ArrowRight size={12} className="text-[#c0c0cc] group-hover:text-[#18181b] transition-colors" />
                                </motion.div>
                              </div>
                              <p className="text-[13px] text-[#18181b]" style={{ fontWeight: 500 }}>
                                {(() => {
                                  const { snippet } = buildSearchSnippet(item.original_text, historySearch, 60);
                                  return historySearch ? highlightQueryInText(snippet, historySearch) : snippet;
                                })()}
                              </p>
                              {!isExpanded && item.optimized_text && (
                                <p className="text-[12px] text-[#8b8b9e] truncate mt-1">
                                  → {historySearch
                                    ? highlightQueryInText(item.optimized_text.split("\n")[0].slice(0, 80), historySearch)
                                    : item.optimized_text.split("\n")[0]}
                                </p>
                              )}
                              {/* v32-D: 搜索时展示相似度 + 匹配解释 */}
                              {historySearch && typeof item.similarity === "number" && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[10px] text-[#5d3eb8] bg-[#faf7ff] border border-[#e0d3f9] px-1.5 py-0.5 rounded">
                                    🔍 {Math.round((item.similarity || 0) * 100)}% 匹配
                                  </span>
                                  <span className="text-[10px] text-[#8b8b9e]">
                                    黄色高亮 = 命中关键短语
                                  </span>
                                </div>
                              )}
                            </button>

                            {/* Expanded */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3.5 pb-3.5">
                                    <div className="border-t border-[#f0f0f4] pt-3">
                                      {/* Diagnosis */}
                                      {item.diagnosis && item.diagnosis !== "已优化" && (
                                        <div className="flex items-start gap-2 px-3 py-2 bg-[#fffbf0] border border-[#f0e4c8] rounded-lg mb-3">
                                          <Lightbulb size={12} className="text-[#c09b3f] flex-shrink-0 mt-0.5" />
                                          <span className="text-[12px] text-[#8a6d3b]">{item.diagnosis}</span>
                                        </div>
                                      )}

                                      {/* Original */}
                                      <div className="mb-3">
                                        <span className="text-[11px] text-[#8b8b9e] uppercase tracking-[0.3px] block mb-1.5" style={{ fontWeight: 500 }}>
                                          {t("original")}
                                        </span>
                                        <p className="text-[12.5px] text-[#8b8b9e] whitespace-pre-wrap" style={{ lineHeight: "1.6" }}>
                                          {item.original_text}
                                        </p>
                                      </div>

                                      {/* Optimized */}
                                      {item.optimized_text && (
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] text-[#8b8b9e] uppercase tracking-[0.3px]" style={{ fontWeight: 500 }}>
                                              {t("optimized")}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleCopy(item.optimized_text!); }}
                                                className="flex items-center gap-1 text-[10.5px] text-[#8b8b9e] hover:text-[#18181b] bg-[#f4f4f6] hover:bg-[#ebebf0] px-2 py-0.5 rounded transition-colors"
                                              >
                                                <Copy size={10} />
                                                {t("copy")}
                                              </button>
                                              {/* v27: 一键发到当前 AI tab */}
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  if (!item.optimized_text) return;
                                                  await fillTextToChat(item.optimized_text);
                                                }}
                                                className="flex items-center gap-1 text-[10.5px] text-white bg-[#18181b] hover:bg-[#2a2a30] px-2 py-0.5 rounded transition-colors"
                                                title="发到当前 AI 网页"
                                              >
                                                ↗ 发送
                                              </button>
                                              {/* v30: 存为模板 */}
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  if (typeof window === "undefined") return;
                                                  const name = window.prompt(
                                                    "给这个模板起个名字 (它会被存到 📚 模板库,以后可以一键复用)",
                                                    item.original_text.slice(0, 50),
                                                  );
                                                  if (!name || !name.trim()) return;
                                                  try {
                                                    await supabase.rpc("save_prompt_as_template", {
                                                      p_prompt_id: item.id,
                                                      p_name: name.trim().slice(0, 100),
                                                      p_use_optimized: true,
                                                    });
                                                    // 切到 templates 视图让用户看到刚存的
                                                    setHistoryView("templates");
                                                    loadTemplates();
                                                  } catch {}
                                                }}
                                                className="flex items-center gap-1 text-[10.5px] text-[#5d3eb8] bg-[#faf7ff] hover:bg-[#f0eaff] border border-[#e0d3f9] px-2 py-0.5 rounded transition-colors"
                                                title="把这条 prompt 存为模板,后续一键复用"
                                              >
                                                💾 模板
                                              </button>
                                            </div>
                                          </div>
                                          <div className="relative">
                                            <div className="absolute top-0 left-0 w-[2.5px] h-full bg-[#18181b] rounded-full" />
                                            <div className="pl-3 text-[12.5px] text-[#2a2a30] whitespace-pre-wrap max-h-[150px] overflow-y-auto" style={{ lineHeight: "1.7" }}>
                                              {item.optimized_text}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* v32-G: AI 响应 (silent_capture, ChatGPT/Claude) */}
                                      {item.ai_response_text && (
                                        <div className="mt-3">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] text-[#5d3eb8] uppercase tracking-[0.3px] flex items-center gap-1" style={{ fontWeight: 500 }}>
                                              🤖 AI 响应
                                              {item.platform && (
                                                <span className="text-[10px] text-[#8b7eb3] normal-case tracking-normal">· {item.platform}</span>
                                              )}
                                            </span>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleCopy(item.ai_response_text || ""); }}
                                              className="flex items-center gap-1 text-[10.5px] text-[#8b8b9e] hover:text-[#18181b] bg-[#f4f4f6] hover:bg-[#ebebf0] px-2 py-0.5 rounded transition-colors"
                                            >
                                              <Copy size={10} />
                                              复制响应
                                            </button>
                                          </div>
                                          <div className="relative">
                                            <div className="absolute top-0 left-0 w-[2.5px] h-full bg-[#7c3aed] rounded-full" />
                                            <div className="pl-3 text-[12.5px] text-[#3a3a45] whitespace-pre-wrap max-h-[180px] overflow-y-auto bg-[#faf7ff] rounded-r p-2" style={{ lineHeight: "1.7" }}>
                                              {item.ai_response_text}
                                            </div>
                                          </div>
                                          {item.ai_response_captured_at && (
                                            <p className="text-[10px] text-[#a78bfa] mt-1">
                                              捕获于 {formatRelativeTime(item.ai_response_captured_at)}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Actions */}
                                      <div className="flex gap-2 mt-3">
                                        <button
                                          onClick={() => { setInputText(item.original_text); setActiveTab("optimize"); }}
                                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#e8e8ec] text-[12px] text-[#5a5a72] hover:text-[#18181b] hover:border-[#c8c8d4] transition-colors"
                                        >
                                          <RotateCcw size={11} />
                                          {t("reuseNow")}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }}
                                          className="px-3 py-2 rounded-lg border border-[#e8e8ec] text-[12px] text-[#c0c0cc] hover:text-red-400 hover:border-red-200 transition-colors"
                                        >
                                          {lang === "zh" ? "删除" : "Delete"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── INSIGHTS TAB ─── */}
          {activeTab === "insights" && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="px-5 pb-5 pt-3"
            >
              {!isLoggedIn ? (
                /* ── Login CTA ── */
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f4f4f6] to-[#e8e8ec] flex items-center justify-center mb-5">
                    <BarChart3 size={28} className="text-[#8b8b9e]" />
                  </div>
                  <h3 className="text-[15px] text-[#18181b] text-center mb-2">
                    {t("loginForInsights")}
                  </h3>
                  <p className="text-[12.5px] text-[#8b8b9e] text-center mb-6 px-4" style={{ lineHeight: "1.6" }}>
                    {t("loginForInsightsDesc")}
                  </p>
                  <button
                    onClick={() => { setShowAuthModal(true); setAuthMode("signin"); setAuthError(""); }}
                    className="flex items-center gap-2 bg-[#18181b] text-white px-6 py-2.5 rounded-lg text-[13px] hover:bg-[#2a2a30] active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                    style={{ fontWeight: 500 }}
                  >
                    <LogIn size={14} />
                    {t("signIn")}
                  </button>
                </div>
              ) : realStats.totalPrompts === 0 ? (
                /* ── 空状态：还没有数据 ── */
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f4f4f6] to-[#e8e8ec] flex items-center justify-center mb-5">
                    <BarChart3 size={28} className="text-[#c0c0cc]" />
                  </div>
                  <h3 className="text-[15px] text-[#18181b] text-center mb-2" style={{ fontWeight: 500 }}>
                    {lang === "zh" ? "还没有使用数据" : "No data yet"}
                  </h3>
                  <p className="text-[12.5px] text-[#8b8b9e] text-center mb-6 px-4" style={{ lineHeight: "1.6" }}>
                    {lang === "zh"
                      ? "去优化几个 prompt，这里会自动生成你的使用洞察"
                      : "Optimize some prompts and your insights will appear here"}
                  </p>
                  <button
                    onClick={() => setActiveTab("optimize")}
                    className="flex items-center gap-2 bg-[#18181b] text-white px-5 py-2.5 rounded-lg text-[13px] hover:bg-[#2a2a30] transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    <Sparkles size={13} />
                    {lang === "zh" ? "去优化 Prompt" : "Start Optimizing"}
                  </button>
                </div>
              ) : (
                /* ── Analytics Dashboard（有数据才显示）── */
                <div className="flex flex-col gap-5">
                  {/* Summary card */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#18181b] to-[#2d2d35] p-4 text-white">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-violet-300" />
                          <span className="text-[11px] text-violet-300 tracking-[0.3px] uppercase" style={{ fontWeight: 500 }}>
                            {t("monthlyReport")}
                          </span>
                        </div>
                        {/* 最擅长任务角标 */}
                        {(() => {
                          const taskCount: Record<string, number> = {};
                          realHistory.forEach(r => { const tt = r.task_type || "general"; taskCount[tt] = (taskCount[tt] || 0) + 1; });
                          const topTask = Object.entries(taskCount).sort((a, b) => b[1] - a[1])[0]?.[0];
                          if (!topTask || topTask === "general") return null;
                          const label = TASK_LABELS[topTask as TaskType];
                          if (!label) return null;
                          return (
                            <span className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5 text-[10px] text-white/70">
                              <span>{label.icon}</span>
                              <span>{lang === "zh" ? label.zh : label.en}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-[32px] tracking-[-1px]" style={{ fontWeight: 700 }}>
                          {realStats.totalPrompts}
                        </span>
                        <span className="text-[12px] text-white/60">
                          {t("promptsThisMonth")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Zap size={12} className="text-emerald-400" />
                          <span className="text-[12px] text-emerald-400">
                            {lang === "zh"
                              ? `连续 ${realStats.streak} 天使用`
                              : `${realStats.streak} day streak`}
                          </span>
                        </div>
                        {/* 平均质量分 */}
                        {(() => {
                          const scoredRecords = realHistory.filter(r => r.score_clarity != null);
                          if (scoredRecords.length === 0) return null;
                          const avg = Math.round(scoredRecords.reduce((sum, r) => sum + ((r.score_clarity! + r.score_specificity! + r.score_structure!) / 3), 0) / scoredRecords.length);
                          return (
                            <div className="flex items-center gap-1">
                              <TrendingUp size={12} className="text-violet-300" />
                              <span className="text-[12px] text-violet-300">
                                {lang === "zh" ? `平均质量 ${avg}分` : `Avg quality ${avg}`}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: t("totalPrompts"), value: realStats.totalPrompts.toLocaleString(), icon: MessageSquare },
                      { label: t("totalHours"), value: (() => {
                          const mins = realStats.totalPrompts * 5;
                          if (mins < 60) return `${mins}min`;
                          const h = (mins / 60).toFixed(1).replace(/\.0$/, "");
                          return `${h}h`;
                        })(), icon: Clock },
                      { label: t("streak"), value: `${realStats.streak}d`, icon: Zap },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex flex-col items-center py-2.5 px-1 bg-[#fafafa] border border-[#e8e8ec] rounded-lg"
                      >
                        <stat.icon
                          size={13}
                          className="text-[#8b8b9e] mb-1.5"
                        />
                        <span
                          className="text-[14px] text-[#18181b]"
                          style={{ fontWeight: 600 }}
                        >
                          {stat.value}
                        </span>
                        <span className="text-[9.5px] text-[#8b8b9e] mt-0.5 text-center" style={{ lineHeight: "1.2" }}>
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Usage Over Time — 真实数据 */}
                  <div>
                    <label
                      className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-3 block"
                      style={{ fontWeight: 500 }}
                    >
                      {t("usageOverTime")}
                    </label>
                    <div className="bg-[#fafafa] border border-[#e8e8ec] rounded-xl p-3">
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart
                          data={insightsUsageTrend}
                        >
                          <defs>
                            <linearGradient
                              id="colorCount"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#18181b"
                                stopOpacity={0.15}
                              />
                              <stop
                                offset="95%"
                                stopColor="#18181b"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f4"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#8b8b9e" }}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              background: "#18181b",
                              border: "none",
                              borderRadius: 8,
                              fontSize: 11,
                              color: "#fff",
                              padding: "6px 10px",
                            }}
                            itemStyle={{ color: "#fff" }}
                            labelStyle={{ color: "#8b8b9e", fontSize: 10 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#18181b"
                            strokeWidth={2}
                            fill="url(#colorCount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Model Usage — 真实数据 */}
                  {insightsModelData.length > 0 && (
                      <div>
                        <label className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-3 block" style={{ fontWeight: 500 }}>
                          {t("modelUsage")}
                        </label>
                        <div className="bg-[#fafafa] border border-[#e8e8ec] rounded-xl p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-[100px] h-[100px] flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={insightsModelData} innerRadius={28} outerRadius={46} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                    {insightsModelData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                              {insightsModelData.map((m) => (
                                <div key={m.name} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                                    <span className="text-[12px] text-[#2a2a30]">{m.name}</span>
                                  </div>
                                  <span className="text-[12px] text-[#18181b]" style={{ fontWeight: 500 }}>{m.value}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                  )}

                  {/* Task Breakdown — 真实数据 */}
                  {insightsTaskBreakdown.length > 0 && (
                      <div>
                        <label className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-3 block" style={{ fontWeight: 500 }}>
                          {lang === "zh" ? "任务类型分布" : "Task Breakdown"}
                        </label>
                        <div className="flex flex-col gap-2">
                          {insightsTaskBreakdown.map(task => (
                            <div key={task.type} className="flex items-center gap-3 bg-[#fafafa] border border-[#e8e8ec] rounded-lg px-3 py-2.5">
                              <span className="text-[14px] flex-shrink-0">{task.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[12.5px] text-[#2a2a30]">{task.label}</span>
                                  <span className="text-[12px] text-[#18181b]" style={{ fontWeight: 500 }}>{task.pct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#e8e8ec] rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: task.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${task.pct}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                              <span className="text-[11px] text-[#8b8b9e] flex-shrink-0">{task.count}{lang === "zh" ? "次" : "x"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                  )}

                  {/* Peak Hours — 真实数据 */}
                  {/* Peak Hours — 真实数据 */}
                  {insightsPeakHours && (
                      <div>
                        <label className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-3 block" style={{ fontWeight: 500 }}>
                          {t("peakHours")}
                        </label>
                        <div className="bg-[#fafafa] border border-[#e8e8ec] rounded-xl p-3">
                          <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={insightsPeakHours}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" vertical={false} />
                              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#8b8b9e" }} />
                              <YAxis hide />
                              <Tooltip contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 11, color: "#fff", padding: "6px 10px" }} />
                              <Bar dataKey="count" fill="#18181b" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                  )}

                  {/* ── AI 质量趋势图 ── */}
                  {insightsQualityTrend && (
                      <div>
                        <label className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-3 block" style={{ fontWeight: 500 }}>
                          {lang === "zh" ? "Prompt 质量趋势" : "Quality Trend"}
                        </label>
                        <div className="bg-[#fafafa] border border-[#e8e8ec] rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-[#8b8b9e]">
                              {lang === "zh" ? `平均分 ${insightsQualityTrend.lastAvg}` : `Avg score ${insightsQualityTrend.lastAvg}`}
                            </span>
                            <span className={`text-[11px] flex items-center gap-0.5 ${insightsQualityTrend.improving ? "text-emerald-500" : "text-orange-400"}`}>
                              {insightsQualityTrend.improving ? "↗" : "→"} {insightsQualityTrend.improving
                                ? (lang === "zh" ? "持续提升" : "Improving")
                                : (lang === "zh" ? "保持稳定" : "Steady")}
                            </span>
                          </div>
                          <ResponsiveContainer width="100%" height={80}>
                            <AreaChart data={insightsQualityTrend.trendData}>
                              <defs>
                                <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="idx" hide />
                              <YAxis domain={[0, 100]} hide />
                              <Tooltip
                                contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 11, color: "#fff", padding: "4px 8px" }}
                                formatter={(v: number) => [`${v}分`, lang === "zh" ? "平均质量" : "Avg Quality"]}
                                labelFormatter={() => ""}
                              />
                              <Area type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} fill="url(#qualityGrad)" dot={{ fill: "#6366f1", r: 3, strokeWidth: 0 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                  )}

                  {/* ── AI 个性化洞察 ── */}
                  {insightsAIInsight && (
                      <div className="bg-gradient-to-br from-[#ede9fe] to-[#f0f0fe] border border-[#ddd6fe] rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Lightbulb size={15} className="text-[#6366f1]" />
                          </div>
                          <div>
                            <p className="text-[11.5px] text-[#6366f1] mb-1" style={{ fontWeight: 600 }}>
                              {lang === "zh" ? "你的 AI 使用洞察" : "Your AI Insight"}
                            </p>
                            <p className="text-[12.5px] text-[#3f3f6a]" style={{ lineHeight: "1.6" }}>
                              {insightsAIInsight}
                            </p>
                          </div>
                        </div>
                      </div>
                  )}

                  {/* ── 发送周报按钮（调用 Worker HTML 邮件）── */}
                  {(() => {
                    const handleSendReport = async () => {
                      if (!user?.email || reportSending) return;
                      setReportSending(true);
                      try {
                        // 计算统计数据
                        const topPlatform = (() => {
                          const countMap: Record<string, number> = {};
                          realHistory.forEach(r => {
                            const p = r.platform && r.platform !== "any" ? r.platform : (lang === "zh" ? "其他" : "Other");
                            countMap[p] = (countMap[p] || 0) + 1;
                          });
                          return Object.entries(countMap).sort((a,b) => b[1]-a[1])[0]?.[0] || "-";
                        })();
                        const taskCount: Record<string, number> = {};
                        realHistory.forEach(r => { const tt = r.task_type || "general"; taskCount[tt] = (taskCount[tt] || 0) + 1; });
                        const topTask = Object.entries(taskCount).sort((a,b) => b[1]-a[1])[0]?.[0] || "general";
                        const topTaskLabel = lang === "zh" ? TASK_LABELS[topTask as TaskType]?.zh || topTask : TASK_LABELS[topTask as TaskType]?.en || topTask;
                        const hourMap: Record<number, number> = {};
                        realHistory.forEach(r => { const h = new Date(r.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1; });
                        const peakH = Number(Object.entries(hourMap).sort((a,b) => Number(b[1])-Number(a[1]))[0]?.[0] ?? 14);
                        const peakStr = lang === "zh" ? `${peakH}:00 – ${peakH+1}:00` : `${peakH < 12 ? peakH+"am" : peakH === 12 ? "12pm" : (peakH-12)+"pm"}`;
                        const scoredRecords = realHistory.filter(r => r.score_clarity != null);
                        const avgQuality = scoredRecords.length > 0
                          ? Math.round(scoredRecords.reduce((sum, r) => sum + ((r.score_clarity! + r.score_specificity! + r.score_structure!) / 3), 0) / scoredRecords.length)
                          : null;
                        const mins = realStats.totalPrompts * 5;
                        const timeSavedStr = mins < 60 ? (lang === "zh" ? `${mins} 分钟` : `${mins} min`) : (lang === "zh" ? `${(mins/60).toFixed(1).replace(/\.0$/,"")} 小时` : `${(mins/60).toFixed(1).replace(/\.0$/,"")}h`);
                        const recentPrompts = realHistory.slice(0, 5).map(r => r.original_text.slice(0, 60) + (r.original_text.length > 60 ? "..." : ""));

                        await fetch(`${API_URL}/send-report`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: user.email,
                            name: user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
                            lang,
                            stats: {
                              totalPrompts: realStats.totalPrompts,
                              streak: realStats.streak,
                              timeSaved: timeSavedStr,
                              topPlatform,
                              topTask: topTaskLabel,
                              peakHour: peakStr,
                              avgQuality,
                            },
                            recentPrompts,
                          }),
                        });
                        setReportSent(true);
                        setTimeout(() => setReportSent(false), 4000);
                      } catch {
                        // fallback: mailto
                        window.open(`mailto:${user.email}?subject=${encodeURIComponent(lang === "zh" ? "📊 prompt.ai 周报" : "📊 prompt.ai Weekly Report")}`);
                      } finally {
                        setReportSending(false);
                      }
                    };

                    return (
                      <button
                        onClick={handleSendReport}
                        disabled={reportSending || reportSent}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[13px] transition-all ${
                          reportSent
                            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                            : reportSending
                              ? "border-[#e8e8ec] text-[#c0c0cc] cursor-not-allowed"
                              : "border-[#e8e8ec] text-[#5a5a72] hover:text-[#18181b] hover:border-[#18181b] hover:bg-[#fafafa]"
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        {reportSent ? <Check size={13} /> : <MessageSquare size={13} />}
                        {reportSent
                          ? (lang === "zh" ? "周报已发送 ✓" : "Report Sent ✓")
                          : reportSending
                            ? (lang === "zh" ? "发送中..." : "Sending...")
                            : (lang === "zh" ? "发送周报到邮箱" : "Send Weekly Report")}
                      </button>
                    );
                  })()}

                  {/* Sign out link */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-[#c0c0cc] hover:text-[#8b8b9e] transition-colors"
                  >
                    <LogOut size={12} />
                    {t("signOut")}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── PROJECTS TAB (v25) ─── */}
          {activeTab === "projects" && (
            <motion.div
              key="projects"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <ProjectsTab user={user} lang={lang as "zh" | "en"} onSendToTab={fillTextToChat} />
            </motion.div>
          )}

          {/* ─── SETTINGS TAB ─── */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="px-5 pb-5 pt-3"
            >
              {/* Language Selector */}
              <div className="mb-5">
                <label
                  className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-2 block"
                  style={{ fontWeight: 500 }}
                >
                  <span className="flex items-center gap-1.5">
                    <Languages size={12} />
                    {t("language")}
                  </span>
                </label>
                <p className="text-[11.5px] text-[#8b8b9e] mb-3">
                  {t("languageDesc")}
                </p>
                <div className="flex gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-lg border text-[13px] transition-all duration-150 ${
                        lang === l.code
                          ? "bg-[#18181b] text-white border-[#18181b] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                          : "bg-white text-[#5a5a72] border-[#e8e8ec] hover:border-[#c8c8d4] hover:text-[#18181b]"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                          lang === l.code
                            ? "bg-white/20 text-white"
                            : "bg-[#f4f4f6] text-[#8b8b9e]"
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {l.flag}
                      </span>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full h-px bg-[#f0f0f4] mb-1" />

              {/* Toggle Settings */}
              <div className="flex flex-col gap-1">
                {[
                  {
                    label: t("addContext"),
                    desc: t("addContextDesc"),
                    value: addContext,
                    onChange: setAddContext,
                  },
                  {
                    label: t("includeExamples"),
                    desc: t("includeExamplesDesc"),
                    value: addExamples,
                    onChange: setAddExamples,
                  },
                  {
                    label: t("autoOptimize"),
                    desc: t("autoOptimizeDesc"),
                    value: autoOptimize,
                    onChange: setAutoOptimize,
                  },
                ].map((setting) => (
                  <div
                    key={setting.label}
                    className="flex items-center justify-between py-3 border-b border-[#f0f0f4] last:border-0"
                  >
                    <div className="pr-3">
                      <p
                        className="text-[13px] text-[#18181b]"
                        style={{ fontWeight: 500 }}
                      >
                        {setting.label}
                      </p>
                      <p className="text-[11.5px] text-[#8b8b9e] mt-0.5">
                        {setting.desc}
                      </p>
                    </div>
                    <Toggle value={setting.value} onChange={setting.onChange} />
                  </div>
                ))}
              </div>

              {/* Account section */}
              <div className="mt-5 pt-4 border-t border-[#f0f0f4]">
                {isLoggedIn ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {getAvatarUrl(user) ? (
                        <img src={getAvatarUrl(user)!} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#18181b] flex items-center justify-center">
                          <User size={14} className="text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-[13px] text-[#18181b]" style={{ fontWeight: 500 }}>
                          {user?.user_metadata?.full_name || user?.email || "User"}
                        </p>
                        <p className="text-[11px] text-[#8b8b9e]">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="text-[11.5px] text-[#8b8b9e] hover:text-[#5a5a72] flex items-center gap-1 transition-colors"
                    >
                      <LogOut size={11} />
                      {t("signOut")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowAuthModal(true); setAuthMode("signin"); setAuthError(""); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#e8e8ec] rounded-lg text-[13px] text-[#5a5a72] hover:text-[#18181b] hover:border-[#c8c8d4] transition-colors"
                  >
                    <LogIn size={13} />
                    {t("signIn")}
                  </button>
                )}
              </div>

              {/* Keyboard shortcuts */}
              <div className="mt-5">
                <label
                  className="text-[11.5px] text-[#8b8b9e] tracking-[0.3px] uppercase mb-2.5 block"
                  style={{ fontWeight: 500 }}
                >
                  {t("shortcuts")}
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { keys: ["⌘", "⇧", "O"], label: t("openSidebar") },
                    { keys: ["⌘", "↵"], label: t("optimizePrompt") },
                    { keys: ["⌘", "⇧", "C"], label: t("copyResult") },
                  ].map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[12.5px] text-[#5a5a72]">
                        {shortcut.label}
                      </span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, ki) => (
                          <span
                            key={ki}
                            className="min-w-[22px] h-[22px] flex items-center justify-center bg-[#f4f4f6] border border-[#e8e8ec] rounded text-[11px] text-[#5a5a72] px-1"
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#f0f0f4] flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#c0c0cc]">
            {lang === "zh" ? `${t("footerCount")} ${optimizeCount} 次` : `${optimizeCount} ${t("footerCount")}`}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-[#8b8b9e]">
              {t("connected")}
            </span>
          </div>
        </div>
      </div>

      {/* v33-γ: ⌘K 全局命令面板 */}
      {cmdkOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] px-4"
          style={{ background: "oklch(0% 0 0 / 0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setCmdkOpen(false)}
        >
          <div
            className="relative w-full max-w-[520px] bg-white rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.25)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 输入栏 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
              <span className="text-zinc-400 text-[14px]">⌘K</span>
              <input
                type="text"
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCmdkActiveIndex(i => Math.min(i + 1, cmdkResults.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCmdkActiveIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const item = cmdkResults[cmdkActiveIndex];
                    if (!item) return;
                    if (item.kind === "action") item.onPick();
                    else if (item.kind === "template") {
                      handleUseTemplate(item.raw);
                      setCmdkOpen(false);
                    } else if (item.kind === "project") {
                      setActiveTab("projects");
                      setCmdkOpen(false);
                    } else if (item.kind === "prompt") {
                      const r = realHistory.find(x => x.id === item.id);
                      if (r) {
                        setInputText(r.original_text);
                        setActiveTab("optimize");
                      }
                      setCmdkOpen(false);
                    }
                  }
                }}
                autoFocus
                placeholder="搜索模板 / 项目 / 历史 prompt 或选择操作..."
                className="flex-1 bg-transparent border-none focus:outline-none text-[14px] text-zinc-900 placeholder:text-zinc-400"
              />
              <kbd className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">esc</kbd>
            </div>
            {/* 结果列表 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {cmdkResults.length === 0 ? (
                <div className="py-10 text-center text-[12.5px] text-zinc-400">
                  没有匹配的项目 / 模板 / 历史 prompt
                </div>
              ) : (
                <div className="py-1">
                  {cmdkResults.map((item, idx) => {
                    const isActive = idx === cmdkActiveIndex;
                    const baseCls = `flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors ${
                      isActive ? "bg-[#faf7ff]" : "hover:bg-zinc-50"
                    }`;
                    if (item.kind === "action") {
                      return (
                        <div
                          key={`a-${idx}`}
                          className={baseCls}
                          onMouseEnter={() => setCmdkActiveIndex(idx)}
                          onClick={() => item.onPick()}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-zinc-900 font-medium">{item.label}</div>
                            <div className="text-[10.5px] text-zinc-400">{item.sub}</div>
                          </div>
                          <span className="text-[10px] text-zinc-300">操作</span>
                        </div>
                      );
                    }
                    if (item.kind === "template") {
                      return (
                        <div
                          key={`t-${item.id}`}
                          className={baseCls}
                          onMouseEnter={() => setCmdkActiveIndex(idx)}
                          onClick={() => { handleUseTemplate(item.raw); setCmdkOpen(false); }}
                        >
                          <span className="text-[14px]">📚</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-zinc-900 truncate">{item.name}</div>
                            <div className="text-[10.5px] text-zinc-400">
                              {item.vars > 0 ? `${item.vars} 变量 · ` : ""}用了 {item.useCount} 次
                            </div>
                          </div>
                          <span className="text-[10px] text-[#5d3eb8]">模板</span>
                        </div>
                      );
                    }
                    if (item.kind === "project") {
                      return (
                        <div
                          key={`p-${item.id}`}
                          className={baseCls}
                          onMouseEnter={() => setCmdkActiveIndex(idx)}
                          onClick={() => { setActiveTab("projects"); setCmdkOpen(false); }}
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: item.color || "#7c3aed" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-zinc-900 truncate">{item.name}</div>
                          </div>
                          <span className="text-[10px] text-[#5d3eb8]">项目</span>
                        </div>
                      );
                    }
                    if (item.kind === "prompt") {
                      return (
                        <div
                          key={`pr-${item.id}`}
                          className={baseCls}
                          onMouseEnter={() => setCmdkActiveIndex(idx)}
                          onClick={() => {
                            const r = realHistory.find(x => x.id === item.id);
                            if (r) { setInputText(r.original_text); setActiveTab("optimize"); }
                            setCmdkOpen(false);
                          }}
                        >
                          <span className="text-[14px]">📜</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] text-zinc-900 truncate">{item.preview}</div>
                            {item.platform && (
                              <div className="text-[10.5px] text-zinc-400 capitalize">{item.platform}</div>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400">历史</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
            {/* 底部 hint */}
            <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-3 text-[10px] text-zinc-400 bg-zinc-50/50">
              <span><kbd className="bg-white border border-zinc-200 px-1 rounded">↑↓</kbd> 选择</span>
              <span><kbd className="bg-white border border-zinc-200 px-1 rounded">↵</kbd> 打开</span>
              <span className="ml-auto">{cmdkResults.length} 个结果</span>
            </div>
          </div>
        </div>
      )}

      {/* v33-β: 模板编辑 Modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "oklch(0% 0 0 / 0.5)", backdropFilter: "blur(4px)" }}
          onClick={handleCloseEditTemplate}
        >
          <div
            className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[88vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-[16px]">✏️</span>
              <h3 className="text-[15px] font-semibold text-zinc-900">编辑模板</h3>
              <button
                onClick={handleCloseEditTemplate}
                className="ml-auto text-zinc-400 hover:text-zinc-700 text-[18px] leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-700 block mb-1">模板名称</label>
                <input
                  type="text"
                  value={editTplName}
                  onChange={(e) => setEditTplName(e.target.value)}
                  maxLength={100}
                  placeholder="例: 客户延期通知邮件"
                  className="w-full px-3 py-2 rounded-md border border-zinc-200 focus:outline-none focus:border-[#5d3eb8] text-[13px]"
                />
                <p className="text-[10.5px] text-zinc-400 mt-1">{editTplName.length}/100</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-700 block mb-1">
                  模板内容 <span className="text-zinc-400">(支持 {"{{变量}}"} 占位符,保存后自动重抽)</span>
                </label>
                <textarea
                  value={editTplText}
                  onChange={(e) => setEditTplText(e.target.value)}
                  maxLength={8000}
                  rows={9}
                  placeholder="模板正文,用 {{var}} 标占位符"
                  className="w-full px-3 py-2 rounded-md border border-zinc-200 focus:outline-none focus:border-[#5d3eb8] text-[12.5px] font-mono leading-relaxed resize-y"
                />
                <p className="text-[10.5px] text-zinc-400 mt-1">{editTplText.length}/8000</p>
              </div>
              {/* 实时识别变量 preview */}
              {(() => {
                const detectedVars = Array.from(
                  new Set(
                    Array.from(editTplText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)).map(m => m[1])
                  )
                );
                return detectedVars.length > 0 ? (
                  <div className="rounded-md bg-[#faf7ff] border border-[#e0d3f9] px-3 py-2">
                    <p className="text-[10.5px] text-[#5d3eb8] font-medium mb-1">检测到 {detectedVars.length} 个变量:</p>
                    <div className="flex flex-wrap gap-1">
                      {detectedVars.map(v => (
                        <span key={v} className="text-[10.5px] bg-white text-[#5d3eb8] px-1.5 py-0.5 rounded border border-[#e0d3f9]">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {editTplToast && (
                <p className={`text-[11px] ${editTplToast.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                  {editTplToast}
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2 bg-zinc-50/50">
              <button
                onClick={handleCloseEditTemplate}
                disabled={editTplSaving}
                className="flex-1 h-9 rounded-md border border-zinc-200 text-[12px] text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditTemplate}
                disabled={editTplSaving}
                className="flex-1 h-9 rounded-md bg-[#5d3eb8] text-white text-[12px] hover:bg-[#7c3aed] active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-wait"
                style={{ fontWeight: 500 }}
              >
                {editTplSaving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth Modal ── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "oklch(0% 0 0 / 0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-[400px] flex flex-col"
            style={{
              background: "#fcfbfd",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px oklch(0% 0 0 / 0.12), 0 -1px 0 oklch(85% 0.01 250)",
              padding: "28px 24px 32px",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部拖拽条 */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full" style={{ background: "oklch(82% 0.01 250)" }} />

            {/* 关闭按钮 */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "oklch(93% 0.008 250)", color: "oklch(50% 0.01 250)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>

            {/* 头部：品牌 + 文案 */}
            <div className="mb-6 mt-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "oklch(18% 0.01 250)" }}>
                  <Sparkles size={15} className="text-white" />
                </div>
                <span className="text-[13px]" style={{ color: "oklch(45% 0.01 250)", fontWeight: 500, letterSpacing: "0.01em" }}>prompt.ai</span>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "oklch(15% 0.01 250)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                {lang === "zh" ? (authMode === "signup" ? "创建账号" : "欢迎回来") : (authMode === "signup" ? "Create account" : "Welcome back")}
              </h2>
              <p style={{ fontSize: "13px", color: "oklch(52% 0.01 250)", marginTop: "4px" }}>
                {lang === "zh"
                  ? (authMode === "signup" ? "注册后解锁历史记录与使用洞察" : "登录后查看你的提示词历史与洞察")
                  : (authMode === "signup" ? "Unlock history & insights" : "Sign in to view your history & insights")}
              </p>
            </div>

            {/* Google 登录 */}
            <button
              onClick={() => { setShowAuthModal(false); handleGoogleSignIn(); }}
              className="w-full flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              style={{
                padding: "11px 16px",
                borderRadius: "12px",
                border: "1px solid #ddd9e3",
                background: "#fcfbfd",
                fontSize: "13.5px",
                fontWeight: 500,
                color: "oklch(18% 0.01 250)",
                boxShadow: "0 1px 3px oklch(0% 0 0 / 0.06)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(96% 0.008 250)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fcfbfd"; }}
            >
              <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.5 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.2-11.4-7.8L6 33.5C9.3 39.7 16.1 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C41.3 35.1 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
              {lang === "zh" ? "用 Google 账号继续" : "Continue with Google"}
            </button>

            {/* 分隔线 */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: "oklch(90% 0.008 250)" }} />
              <span style={{ fontSize: "11px", color: "#9898a7", letterSpacing: "0.04em" }}>
                {lang === "zh" ? "或用邮箱" : "OR WITH EMAIL"}
              </span>
              <div className="flex-1 h-px" style={{ background: "oklch(90% 0.008 250)" }} />
            </div>

            {/* 邮箱 + 密码 */}
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder={lang === "zh" ? "邮箱地址" : "Email address"}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ddd9e3",
                    background: "oklch(98% 0.005 250)",
                    fontSize: "13.5px",
                    color: "oklch(15% 0.01 250)",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "oklch(50% 0.02 250)"; e.currentTarget.style.boxShadow = "0 0 0 3px oklch(85% 0.02 250)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#ddd9e3"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder={lang === "zh" ? "密码（至少 6 位）" : "Password (min 6 chars)"}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ddd9e3",
                    background: "oklch(98% 0.005 250)",
                    fontSize: "13.5px",
                    color: "oklch(15% 0.01 250)",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "oklch(50% 0.02 250)"; e.currentTarget.style.boxShadow = "0 0 0 3px oklch(85% 0.02 250)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#ddd9e3"; e.currentTarget.style.boxShadow = "none"; }}
                  onKeyDown={e => { if (e.key === "Enter") handleEmailAuth(); }}
                />
              </div>
              {/* 邀请码（仅注册时显示） */}
              {authMode === "signup" && (
                <div className="relative">
                  <input
                    type="text"
                    value={authInviteCode}
                    onChange={e => setAuthInviteCode(e.target.value.toUpperCase())}
                    placeholder={lang === "zh" ? "邀请码（如 PAI-XXXX-XXXX）" : "Invite code (e.g. PAI-XXXX-XXXX)"}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1px solid oklch(82% 0.02 60)",
                      background: "oklch(98% 0.008 60)",
                      fontSize: "13.5px",
                      color: "oklch(15% 0.01 250)",
                      outline: "none",
                      boxSizing: "border-box",
                      letterSpacing: "0.05em",
                      fontWeight: 500,
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "oklch(55% 0.08 60)"; e.currentTarget.style.boxShadow = "0 0 0 3px oklch(88% 0.05 60)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "oklch(82% 0.02 60)"; e.currentTarget.style.boxShadow = "none"; }}
                    onKeyDown={e => { if (e.key === "Enter") handleEmailAuth(); }}
                  />
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" }}>🎫</span>
                </div>
              )}
            </div>

            {/* 错误/成功提示 */}
            {authError && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-[12px] text-center"
                style={{
                  background: authError.includes("成功") || authError.includes("check")
                    ? "oklch(95% 0.05 145)" : "oklch(95% 0.05 20)",
                  color: authError.includes("成功") || authError.includes("check")
                    ? "oklch(35% 0.12 145)" : "oklch(40% 0.15 20)",
                }}
              >
                {authError}
              </div>
            )}

            {/* 主按钮 */}
            <button
              onClick={handleEmailAuth}
              disabled={authLoading || !authEmail || !authPassword}
              className="w-full mt-3 transition-all active:scale-[0.98]"
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                background: authLoading || !authEmail || !authPassword
                  ? "oklch(75% 0.01 250)" : "oklch(18% 0.01 250)",
                color: "white",
                fontSize: "13.5px",
                fontWeight: 600,
                letterSpacing: "0.01em",
                cursor: authLoading || !authEmail || !authPassword ? "not-allowed" : "pointer",
                border: "none",
              }}
            >
              {authLoading
                ? (lang === "zh" ? "处理中..." : "Processing...")
                : authMode === "signin"
                  ? (lang === "zh" ? "登录" : "Sign in")
                  : (lang === "zh" ? "创建账号" : "Create account")}
            </button>

            {/* 切换登录/注册 */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <span style={{ fontSize: "12.5px", color: "oklch(55% 0.01 250)" }}>
                {authMode === "signin"
                  ? (lang === "zh" ? "还没有账号？" : "Don't have an account?")
                  : (lang === "zh" ? "已有账号？" : "Already have an account?")}
              </span>
              <button
                onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}
                style={{ fontSize: "12.5px", fontWeight: 600, color: "oklch(35% 0.02 250)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {authMode === "signin"
                  ? (lang === "zh" ? "注册" : "Sign up")
                  : (lang === "zh" ? "登录" : "Sign in")}
              </button>
            </div>

            {/* 游客模式 */}
            <button
              onClick={handleGuestMode}
              className="w-full mt-3 transition-colors"
              style={{
                padding: "9px",
                borderRadius: "10px",
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "#8e8e9d",
                cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "oklch(30% 0.01 250)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#8e8e9d"; }}
            >
              {lang === "zh" ? "以游客身份继续，暂不登录 →" : "Continue as guest, skip for now →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
