#!/usr/bin/env node
/**
 * v18.1: Demo 演示数据填充脚本
 *
 * 用法:
 *   export SUPABASE_URL="https://vyuzkbdxsweaqftyqifh.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
 *   export DEMO_USER_ID="<你的 user_id>"
 *   node scripts/mock_demo_data.mjs
 *
 * 填充 (幂等,可重复跑会清旧的再插新的):
 *   - 30 条 prompts (跨 8 个 AI 平台,3 种 task_type,含 silent_capture)
 *   - 6 条 user_facts (PM 风格,匹配 v10 端到端测试出的结果)
 *   - 1 条 user_voice_profile (v11 合成的 222 字 voice)
 *
 * 用途:
 *   - 比赛 demo 前给账号灌"漂亮"的画像数据
 *   - dashboard 立即显示丰富的 22 平台热力图 + 多条 facts + 完整 voice
 *   - 评委一打开就看到产品价值 (而不是空状态)
 *
 * 安全:
 *   - 只插数据,绝不删别的 user 的数据
 *   - 重跑会先 DELETE WHERE user_id = DEMO_USER_ID,再插新数据
 *   - service_role key 必须从环境变量读,绝不写到代码
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.DEMO_USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID) {
  console.error("❌ Missing env vars. Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_ID");
  console.error("   USAGE:");
  console.error("     export SUPABASE_URL='...'");
  console.error("     export SUPABASE_SERVICE_ROLE_KEY='...'");
  console.error("     export DEMO_USER_ID='<your auth user uuid>'");
  console.error("     node scripts/mock_demo_data.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────

// 30 条 prompts: 跨 8 个平台,3 种 task,大部分是 silent_capture (展示 L8 价值)
const PROMPTS = [
  // ChatGPT (产品经理日常)
  { p: "chatgpt", t: "邮件",   o: "帮我写邮件给客户说项目延期",      x: "你是产品经理,请撰写正式简洁邮件 (200字内,不用emoji),向客户说明项目延期原因+新交付时间+补救方案。语气专业但不卑微。", src: "silent_capture", clarity: 75, spec: 80, struct: 78 },
  { p: "chatgpt", t: "分析",   o: "对比 chatgpt 和 claude",          x: "你是 AI 产品经理。请用 Markdown 表格对比 ChatGPT 和 Claude 在推理能力/上下文/价格/适用场景/生态 5 个维度的差异。每个维度给量化数据(若有)和场景化建议。总结段落不超过 200 字,全文 800 字内。", src: "silent_capture", clarity: 88, spec: 85, struct: 90 },
  { p: "chatgpt", t: "邮件",   o: "通知团队周会改时间",              x: "你是产品经理,给团队发周会改时间通知。简洁清晰中文邮件,200字内,直接给出:新时间+地点+需准备内容,不过度解释。", src: "silent_capture", clarity: 82, spec: 75, struct: 80 },
  { p: "chatgpt", t: "general", o: "把这段需求文档改得更结构化",     x: "你是资深产品经理,接下来我会粘贴需求文档原文。请用以下结构重写:背景目标→用户场景→功能清单(P0/P1/P2)→验收标准→风险评估。Markdown 格式,800字内。", src: "silent_capture", clarity: 85, spec: 88, struct: 92 },

  // Claude (复杂分析)
  { p: "claude",  t: "分析",   o: "分析 Q1 OKR 完成情况",            x: "你是企业战略分析师。我会粘贴 Q1 OKR 数据。请按 KR 完成度对每个 Objective 评分,识别瓶颈,给 Q2 调整建议。Markdown 输出,语气专业不夸张,800 字内。", src: "silent_capture", clarity: 90, spec: 92, struct: 88 },
  { p: "claude",  t: "general", o: "回复老板说同意他的 KR 调整",     x: "你是产品经理,简洁专业回复老板。语气认同但不卑微,补充自己的执行思路。100字内,直接说重点。", src: "silent_capture", clarity: 85, spec: 80, struct: 78 },
  { p: "claude",  t: "分析",   o: "拆解一下这个 metric 的下降原因",  x: "你是数据产品经理。我会给你一个核心指标的近30天数据。请用结构化分析框架(归因/相关/反事实)拆解下降原因,识别 top 3 可能因素,给验证建议。Markdown 表格输出,600字内。", src: "silent_capture", clarity: 92, spec: 90, struct: 90 },

  // Gemini (多模态/搜索)
  { p: "gemini",  t: "general", o: "帮我搜下最近的 LLM 评测数据",    x: "你是 AI 行业研究员。请搜索并汇总最近 30 天主流 LLM 评测数据(GPT-4/Claude/Gemini/Qwen 等)。输出表格:模型|MMLU|HumanEval|价格|上下文|发布时间。最后一段 100 字总结趋势。", src: "silent_capture", clarity: 88, spec: 88, struct: 90 },
  { p: "gemini",  t: "邮件",   o: "起草季度汇报邮件给 CEO",          x: "你是产品 VP,给 CEO 写季度汇报邮件。结构:开门见山结论(3点)→数据支撑(表格)→风险与请求资源→下季度承诺。专业 confident 但不夸张,400字内。", src: "silent_capture", clarity: 90, spec: 88, struct: 92 },

  // Kimi (中文长文)
  { p: "kimi",    t: "general", o: "帮我总结一下这本书的核心观点",   x: "你是阅读笔记专家。我会粘贴一本书的目录或核心章节。请用三层结构总结:1) 全书核心论点(50字) 2) 5 个关键章节论点 3) 对产品经理的启发(3点)。中文输出,1000字内,简洁直接。", src: "silent_capture", clarity: 85, spec: 85, struct: 88 },
  { p: "kimi",    t: "分析",   o: "对比一下国内几款 AI 助手",        x: "你是 AI 行业产品经理。简洁对比 Kimi/豆包/通义/文心 4 款国内 AI 助手:核心定位+技术亮点+目标用户+商业化路径。表格+总结段落,600字内,中文为主。", src: "silent_capture", clarity: 82, spec: 85, struct: 85 },

  // 豆包
  { p: "doubao",  t: "邮件",   o: "回复合作方说我们暂时不签",        x: "你是产品经理,礼貌专业回复合作方暂不签合同。结构:感谢+不合作的客观理由(技术/资源/优先级)+保持开放态度。中文,200字内,温和但坚定。", src: "silent_capture", clarity: 80, spec: 78, struct: 80 },
  { p: "doubao",  t: "general", o: "写个朋友圈推广文案",              x: "你是产品营销专家。写一条朋友圈文案推广 prompt.ai。要求:1句话钩子+1段价值描述+CTA。语气真诚不夸张,150字内。", src: "silent_capture", clarity: 75, spec: 75, struct: 78 },

  // DeepSeek (技术分析)
  { p: "deepseek", t: "分析",  o: "解释下 RAG 的核心原理",            x: "你是 AI 工程师。简洁清晰解释 RAG (Retrieval-Augmented Generation) 核心原理:1) 为什么需要 RAG 2) 工作流程图(text 描述) 3) 与 fine-tuning 的对比 4) 落地最佳实践 3 条。Markdown 输出,500字内。", src: "silent_capture", clarity: 90, spec: 92, struct: 90 },

  // Perplexity (搜索)
  { p: "perplexity", t: "general", o: "帮我查最新的 Apple Vision Pro 销量",  x: "请搜索最新的 Apple Vision Pro 销量数据(2024-2026),给出官方/分析师两类数据,标注信源,用表格对比预期vs实际。中文输出。", src: "silent_capture", clarity: 88, spec: 90, struct: 85 },

  // optimize 来源 (用户主动调 prompt.ai)
  { p: "chatgpt", t: "邮件",   o: "写邮件给候选人 reject",            x: "你是 HR 业务伙伴,给候选人写礼貌专业的拒信邮件。结构:感谢面试时间+客观说明(不深究细节)+鼓励未来再合作可能+祝好。语气温暖但专业,200字内,不用模板套话。", src: "optimize",       clarity: 88, spec: 85, struct: 88 },
  { p: "claude",  t: "分析",   o: "评估这个新功能要不要做",          x: "你是产品总监,基于以下评估框架决定新功能是否做:1) 用户价值(JTBD验证) 2) 战略契合度 3) 工程成本 4) 机会成本 5) 风险。每项 1-5 分+总分,给最终 GO/NO-GO 决策+理由 3 条。Markdown 表格,600字内。", src: "optimize", clarity: 92, spec: 90, struct: 92 },
  { p: "kimi",    t: "general", o: "整理我说话的录音变成会议纪要",   x: "你是会议纪要专家。我会粘贴语音转文字稿。请用结构化格式整理:会议主题+参会人+核心议题(3点)+决议+待办(责任人+deadline)。中文,500字内,直接简洁。", src: "optimize",        clarity: 88, spec: 88, struct: 90 },
  { p: "any",     t: "general", o: "帮我准备一个 30 分钟的产品分享",  x: "你是产品演讲专家。给我设计 30 分钟产品分享的大纲:1) 5分钟开场+议程 2) 15分钟核心内容(3个故事/数据/演示交错) 3) 5分钟下一步 4) 5分钟Q&A引导。每段标注时长+核心讯息+互动设计。", src: "optimize",            clarity: 85, spec: 85, struct: 88 },

  // 更多 silent_capture (展示频率)
  { p: "chatgpt", t: "邮件",   o: "给团队发新人入职 welcome 邮件",   x: "你是 HR Lead,给全公司发新人入职 welcome 邮件。结构:欢迎+新人简介(3亮点)+欢迎方式(午餐/咖啡)+团队回复鼓励。温暖友好但不浮夸,200字内。", src: "silent_capture", clarity: 80, spec: 78, struct: 82 },
  { p: "claude",  t: "general", o: "帮我审 review 同事的 PRD",       x: "你是资深产品经理。审 PRD 用以下框架:用户价值清晰度+目标量化+方案可行性+风险识别+验收标准。每项给评分+具体改进建议。结尾给 3 条最优先修改点。", src: "silent_capture", clarity: 90, spec: 88, struct: 90 },
  { p: "gemini",  t: "general", o: "帮我做今天周报",                 x: "你是高效产品经理。基于以下完成事项,生成本周周报:1) 本周关键进展(3-5条,带量化) 2) 风险与阻塞 3) 下周重点 4) 需要支持。Markdown 表格+段落,400字内。", src: "silent_capture",  clarity: 85, spec: 82, struct: 88 },
  { p: "kimi",    t: "邮件",   o: "回复客户说我们没法做这个定制",     x: "你是客户成功经理,礼貌但坚定回复客户拒绝定制需求。结构:理解需求+技术/资源限制+建议替代方案+保持长期合作意愿。200字内,温和坚定。", src: "silent_capture",   clarity: 82, spec: 80, struct: 82 },
  { p: "doubao",  t: "general", o: "帮我整理今天的待办事项",          x: "你是高效个人助理。基于我接下来粘贴的事项,按 Eisenhower 矩阵分类(紧急重要/重要不紧急/紧急不重要/低价值),每类给执行建议。中文,简洁直接。", src: "silent_capture",   clarity: 80, spec: 80, struct: 85 },

  // 更多平台覆盖
  { p: "tongyi",  t: "general", o: "用通义帮我润色一段产品文档",     x: "你是中文文档写作专家。请润色我接下来粘贴的产品文档,要求:逻辑清晰+用词专业精准+段落简洁+消除冗余表达。保留原意,中文输出。", src: "silent_capture",          clarity: 80, spec: 78, struct: 80 },
  { p: "qwen",    t: "分析",   o: "帮我做竞品分析",                  x: "你是行业分析师。我会给 3-5 个竞品。请用结构化框架对比:产品定位+核心功能+定价+用户画像+SWOT。Markdown 表格+总结段落 200 字,800字内。", src: "silent_capture",       clarity: 85, spec: 85, struct: 88 },
  { p: "zai",     t: "general", o: "起草一段产品愿景声明",            x: "你是品牌战略专家。基于公司产品形态,起草一段产品愿景声明:1句话核心+3句话支撑(why now/what unique/for whom)。专业有力,150字内。", src: "silent_capture",                  clarity: 82, spec: 80, struct: 85 },
  { p: "minimax-agent", t: "general", o: "帮我跑个 agent workflow", x: "你是 agent workflow 设计师。设计一个跨 N 步骤的工作流来完成 [任务]。每步骤:输入/工具/输出/失败处理。最后给 ASCII 流程图。", src: "silent_capture",        clarity: 78, spec: 82, struct: 85 },
  { p: "mistral", t: "general", o: "Translate this prompt to French", x: "You are a professional translator. Translate the following prompt to French while preserving its intent and tone. Output only the translation, no explanation.", src: "silent_capture",       clarity: 85, spec: 80, struct: 85 },
  { p: "grok",    t: "general", o: "What's the latest on AI policy",   x: "You are an AI policy analyst. Summarize the latest AI policy developments in EU/US/China in the past 30 days. Output: timeline + key actors + business impact. Markdown table, 500 words max.", src: "silent_capture", clarity: 88, spec: 85, struct: 88 },
];

// 6 条 user_facts (复用 v10 端到端测试出的结果,真实 PM 画像)
const FACTS = [
  { fact: "用户身份为产品经理,所有prompt都以此为角色定位",                confidence: 0.95, task_type: null      },
  { fact: "邮件类任务偏好正式简洁,不超过200字,不用emoji,语气专业但不卑微", confidence: 0.88, task_type: "邮件"   },
  { fact: "分析类任务偏好Markdown结构输出(表格+总结段落),不超过800字",     confidence: 0.85, task_type: "分析"   },
  { fact: "沟通风格偏好直接说重点,不过度解释,避免冗余",                   confidence: 0.82, task_type: null      },
  { fact: "常用 OKR、KR、Sprint 等企业管理术语",                            confidence: 0.80, task_type: null      },
  { fact: "整体语气风格:专业但不夸张、不卑微,适度自信",                   confidence: 0.75, task_type: null      },
];

// 1 条 voice_profile (复用 v11 端到端合成的 222 字)
const VOICE_PROFILE = "你正在为一位产品经理工作。Ta的沟通风格偏好直接说重点,不过度解释,避免冗余,整体语气专业但不夸张、不卑微,体现出一种适度的自信。在做邮件类任务时严格遵循「正式简洁、200字内、零emoji、专业但不卑微」的准则;在做分析类任务时偏好Markdown结构化输出,包含表格和总结段落,总字数控制在800字以内。Ta熟练使用OKR、KR、Sprint等企业管理术语,并自然融入中文表达。请把这套声音作为优化基线,除非当前input明确要求其他风格。";

// v25: 3 个 demo 项目
const PROJECTS = [
  {
    name: "创业公司官网",
    description: "落地页文案 + 视觉设计 + 转化漏斗优化",
    color: "#7c3aed",
    brief: "你正在做「创业公司官网」项目,核心在打磨产品落地页文案 + 视觉设计方案。在这个项目里你偏好简洁直接的措辞,Markdown 结构化的需求文档,常涉及的术语: 落地页 conversion / hero section / CTA / 转化漏斗 / A/B 测试。当前阶段在评审第二版视觉稿,下一步计划做用户测试。",
    prompt_indices: [0, 3, 4, 13, 16],
  },
  {
    name: "用户调研报告",
    description: "Q2 季度用户访谈 + 痛点提炼",
    color: "#3b82f6",
    brief: "你在做「用户调研报告」项目,基于 Q2 季度的用户访谈材料提炼痛点和机会。在这个项目里你偏好结构化分析(Eisenhower 矩阵 / JTBD 框架),Markdown 表格 + 总结段落,800 字内。常用术语: JTBD / pain point / job map / 用户旅程。下一步整理报告交给团队评审。",
    prompt_indices: [2, 5, 14, 17],
  },
  {
    name: "AI 产品分析",
    description: "竞品对比 + 市场趋势研究",
    color: "#10b981",
    brief: "你正在做「AI 产品分析」项目,系统性对比国内外主流 AI 助手的产品定位、技术亮点、商业化路径。在这个项目里你偏好 Markdown 表格 + 量化数据 + 总结段落 (800 字内)。常用术语: MMLU / HumanEval / 上下文长度 / 推理能力 / 生态整合。下一步整理成可对外发布的分析报告。",
    prompt_indices: [1, 9, 10, 26],
  },
];

// v30: 3 个 demo 模板
const TEMPLATES = [
  {
    name: "邮件 - 客户延期通知",
    template_text: "你是产品经理。请撰写一封正式简洁的邮件给客户 {{client_name}},告知 {{project_name}} 项目延期 {{delay_days}} 个工作日。要求:开头致歉、说明根本原因、给出新交付时间 {{new_deadline}}、附补救方案。语气专业但不卑微,200 字内,不用 emoji。",
    use_count: 12,
  },
  {
    name: "PRD 框架重写",
    template_text: "你是资深产品经理。请用以下结构重写需求文档 {{doc_topic}}:\n背景目标 → 用户场景 → 功能清单(P0/P1/P2)→ 验收标准 → 风险评估\nMarkdown 格式,{{word_count}} 字内,语气专业。",
    use_count: 8,
  },
  {
    name: "周报模板",
    template_text: "你是高效产品经理。基于以下完成事项,生成本周周报:\n1) 本周关键进展(3-5条,带量化数据)\n2) 风险与阻塞 ({{focus_area}})\n3) 下周重点\n4) 需要支持\nMarkdown 表格 + 段落,400 字内。",
    use_count: 5,
  },
];

// ─────────────────────────────────────────────────────────────
// EXECUTE
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎯 Target user: ${USER_ID}`);
  console.log(`📊 Will insert: ${PROMPTS.length} prompts + ${FACTS.length} facts + 1 voice profile\n`);

  // 1. 清旧数据 (安全: 只删 DEMO_USER_ID 自己的)
  console.log("🧹 Cleaning old demo data for this user...");
  const cleanupTables = [
    { name: "user_voice_profiles", filter: { user_id: USER_ID } },
    { name: "user_facts",          filter: { user_id: USER_ID } },
    { name: "prompt_feedback",     filter: { user_id: USER_ID } },
    { name: "prompt_templates",    filter: { user_id: USER_ID } },  // v30
    { name: "prompts",             filter: { user_id: USER_ID } },
    { name: "projects",            filter: { user_id: USER_ID } },  // v25
  ];
  for (const tbl of cleanupTables) {
    const { error } = await supabase.from(tbl.name).delete().match(tbl.filter);
    if (error) {
      console.warn(`   ⚠️  ${tbl.name}: ${error.message}`);
    } else {
      console.log(`   ✓ cleaned ${tbl.name}`);
    }
  }

  // 2. 插 prompts (打散 created_at 让看起来像真实使用)
  console.log("\n📝 Inserting prompts...");
  const now = Date.now();
  const promptRows = PROMPTS.map((p, i) => ({
    user_id: USER_ID,
    original_text: p.o,
    optimized_text: p.x,
    diagnosis: "已优化",
    platform: p.p,
    task_type: p.t,
    tone: "Professional",
    score_clarity: p.clarity,
    score_specificity: p.spec,
    score_structure: p.struct,
    source: p.src,
    // 散布在过去 21 天,最近的更密集
    created_at: new Date(now - (PROMPTS.length - i) * 60 * 60 * 1000 * (Math.random() * 6 + 4)).toISOString(),
  }));
  const { error: pErr } = await supabase.from("prompts").insert(promptRows);
  if (pErr) {
    console.error("   ❌", pErr);
    process.exit(1);
  }
  console.log(`   ✓ ${promptRows.length} prompts inserted`);

  // 3. 插 facts
  console.log("\n📌 Inserting facts...");
  const factRows = FACTS.map(f => ({
    user_id: USER_ID,
    fact: f.fact,
    confidence: f.confidence,
    task_type: f.task_type,
    source_prompt_ids: [],
    extracted_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 天前
  }));
  const { error: fErr } = await supabase.from("user_facts").insert(factRows);
  if (fErr) {
    console.error("   ❌", fErr);
    process.exit(1);
  }
  console.log(`   ✓ ${factRows.length} facts inserted`);

  // 4. 插 voice profile
  console.log("\n🎤 Inserting voice profile...");
  const { error: vErr } = await supabase
    .from("user_voice_profiles")
    .insert({
      user_id: USER_ID,
      voice_profile: VOICE_PROFILE,
      source_facts_count: FACTS.length,
      source_facts_hash: `mock-${FACTS.length}-${Date.now()}`,
      synthesized_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    });
  if (vErr) {
    console.error("   ❌", vErr);
    process.exit(1);
  }
  console.log("   ✓ voice profile inserted (222 chars, 6 source facts)");

  // 5. v25 插 demo projects + 6. assign prompts to projects + 7. set project briefs
  console.log("\n📁 Inserting demo projects + assigning prompts...");
  const projectRows = PROJECTS.map(p => ({
    user_id: USER_ID,
    name: p.name,
    description: p.description,
    color: p.color,
    brief: p.brief,
    brief_generated_at: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
  }));
  const { data: projData, error: prjErr } = await supabase
    .from("projects")
    .insert(projectRows)
    .select("id, name");
  if (prjErr) {
    console.error("   ❌", prjErr);
    process.exit(1);
  }
  console.log(`   ✓ ${projectRows.length} projects inserted`);

  // 拿刚插入 prompts 的 id (按 created_at 倒序对应 PROMPTS 数组顺序)
  const { data: insertedPrompts } = await supabase
    .from("prompts")
    .select("id, created_at")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: true });
  const promptIds = insertedPrompts?.map(p => p.id) || [];

  // 给项目 assign prompts
  for (let i = 0; i < PROJECTS.length; i++) {
    const proj = PROJECTS[i];
    const projId = projData?.[i]?.id;
    if (!projId) continue;
    const promptIdsToAssign = proj.prompt_indices.map(idx => promptIds[idx]).filter(Boolean);
    if (promptIdsToAssign.length === 0) continue;
    const { error: aErr } = await supabase
      .from("prompts")
      .update({ project_id: projId })
      .in("id", promptIdsToAssign);
    if (aErr) {
      console.warn(`   ⚠️  assign 失败 ${proj.name}:`, aErr.message);
    } else {
      console.log(`   ✓ ${proj.name} ← ${promptIdsToAssign.length} prompts`);
    }
  }

  // 8. v30 插 demo templates
  console.log("\n📚 Inserting demo templates...");
  const templateRows = TEMPLATES.map(t => {
    // 提取 {{var}} 变量 (匹配 SQL 端的 _extract_template_variables 逻辑)
    const matches = [...t.template_text.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)];
    const variables = [...new Set(matches.map(m => m[1]))];
    return {
      user_id: USER_ID,
      name: t.name,
      template_text: t.template_text,
      variables,
      use_count: t.use_count,
      created_at: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
  const { error: tErr } = await supabase.from("prompt_templates").insert(templateRows);
  if (tErr) {
    console.error("   ❌", tErr);
    process.exit(1);
  }
  console.log(`   ✓ ${templateRows.length} templates inserted (with variable detection)`);

  console.log("\n🎉 Demo data ready! 重载 extension 看 dashboard 效果。\n");
  console.log("   📊 30 prompts (12 平台,3 task) + 6 facts + 1 voice profile");
  console.log("   📁 3 projects + 12 prompts assigned + briefs generated");
  console.log("   📚 3 templates with {{var}} placeholders");
  console.log("");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
