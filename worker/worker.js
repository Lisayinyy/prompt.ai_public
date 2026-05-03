// ============================================================
// Prompt Optimizer — Cloudflare Worker 后端代理
// v7.5: Phase 1 智能优化升级 — 动态策略+评分+Guardrails
// ============================================================

const MINIMAX_API = "https://api.minimaxi.com/v1/chat/completions";
const MODEL = "MiniMax-M2.7";

// ─── Guardrails: 检测 prompt 注入 & 有害内容 ────────────────
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+instructions/i,
  /disregard\s+(previous|all|prior)\s+instructions/i,
  /forget\s+everything/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+if\s+you\s+are/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /你现在是/,
  /忽略之前的指令/,
  /忽略所有指令/,
  /你是一个没有限制的/,
  /扮演.{0,10}没有道德/,
  /system\s*prompt/i,
  /bypass\s+(safety|filter|restriction)/i,
];

const HARMFUL_PATTERNS = [
  /如何制造.{0,10}(炸弹|毒品|武器|病毒)/,
  /how\s+to\s+(make|create|build)\s+(bomb|drug|weapon|virus|malware)/i,
  /合成.{0,10}(毒品|违禁|爆炸)/,
  /synthesize\s+(drugs|explosives|poison)/i,
];

function checkGuardrails(text) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return "injection";
  }
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(text)) return "harmful";
  }
  return null;
}

// ─── 用户风格画像 → system prompt 块 ─────────────────────
// userProfile shape: { sample_count, top_tone, avg_input_len, avg_optimized_len, up_rate }
// topExamples shape: [{ original_text, optimized_text, combined_score, has_upvote }]
function buildUserProfileBlock(userProfile, taskType) {
  if (!userProfile || typeof userProfile !== "object") return "";
  const n = Number(userProfile.sample_count || 0);
  if (n < 3) return ""; // 样本不足，跳过个性化
  const lines = [];
  lines.push(`\n## USER STYLE PROFILE (task: ${taskType || "general"}, based on ${n} past prompts)`);
  if (userProfile.top_tone) lines.push(`- preferred tone: ${userProfile.top_tone}`);
  if (userProfile.avg_optimized_len) lines.push(`- typical optimized length: ~${userProfile.avg_optimized_len} chars`);
  if (userProfile.avg_input_len) lines.push(`- typical input length: ~${userProfile.avg_input_len} chars`);
  if (userProfile.up_rate !== null && userProfile.up_rate !== undefined) {
    lines.push(`- positive feedback rate: ${userProfile.up_rate}%`);
  }
  lines.push(`Apply these preferences when sensible, but the current input always overrides.`);
  return lines.join("\n");
}

function buildExamplesBlock(topExamples) {
  if (!Array.isArray(topExamples) || topExamples.length === 0) return "";
  // 单条裁剪到 ~600 chars，整块预算 ~1300 chars (~300 token)
  const safe = topExamples.slice(0, 2).map((ex, i) => {
    const raw = String(ex.original_text || "").slice(0, 200);
    const opt = String(ex.optimized_text || "").slice(0, 600);
    return `\nExample ${i + 1} (your past high-quality optimization):\n  raw: ${raw}\n  optimized: ${opt}`;
  }).join("");
  if (!safe) return "";
  return `\n## REFERENCE EXAMPLES${safe}\nMatch the structure and style of these past examples when sensible.`;
}

// v8.1: 反向样本 — 用户曾明确点踩的优化，告诉 LLM 不要复制这种风格
// userDislikes shape: [{ original_text, optimized_text, disliked_at }]
function buildUserDislikesBlock(userDislikes) {
  if (!Array.isArray(userDislikes) || userDislikes.length === 0) return "";
  // 单条裁剪到 ~400 chars，整块预算 ~1000 chars
  const safe = userDislikes.slice(0, 3).map((ex, i) => {
    const raw = String(ex.original_text || "").slice(0, 150);
    const opt = String(ex.optimized_text || "").slice(0, 400);
    return `\nRejected ${i + 1}:\n  input: ${raw}\n  user-disliked output: ${opt}`;
  }).join("");
  if (!safe) return "";
  return `\n## STYLES TO AVOID (the user explicitly disliked these in the past)${safe}\nDo NOT replicate the structure, tone, or phrasing of these rejected outputs. The user clicked thumbs-down on them — they are anti-examples.`;
}

// v10: LLM 抽取出来的用户偏好事实 — 信息密度最高，放在 system prompt 末尾
// userFacts shape: [{ fact, confidence, task_type }]
function buildUserFactsBlock(userFacts) {
  if (!Array.isArray(userFacts) || userFacts.length === 0) return "";
  // 单条 ≤ 80 chars，整块预算 ~1000 chars (~10 facts)
  const lines = userFacts.slice(0, 10).map((f, i) => {
    const text = String(f?.fact || "").trim().slice(0, 300);
    if (!text) return null;
    const conf = typeof f?.confidence === "number" ? ` (conf=${f.confidence.toFixed(2)})` : "";
    return `${i + 1}. ${text}${conf}`;
  }).filter(Boolean).join("\n");
  if (!lines) return "";
  return `\n## USER PROFILE FACTS (extracted from past usage patterns — these are STABLE preferences)\n${lines}\nThese facts describe who the user IS and what they consistently prefer. Apply them to the optimized output unless the current input clearly overrides them.`;
}

// v11: LLM 合成的"声音指纹" — 比 facts 列表更连贯、更高优先级
// userVoiceProfile shape: string (150-300 chars 中文叙事)
function buildVoiceProfileBlock(userVoiceProfile) {
  const text = String(userVoiceProfile || "").trim();
  if (!text || text.length < 30) return "";
  // 截断防爆 (max 2000 chars,匹配 SQL CHECK)
  const safe = text.slice(0, 2000);
  return `\n## YOUR VOICE PROFILE (the unified voice you should write IN — derived from this user's stable patterns)\n${safe}`;
}

// ─── 动态系统提示词（根据 targetAI 差异化）─────────────────
function buildSystemPrompt(targetAI = "any", tone = "Professional", userProfile = null, topExamples = null, taskType = "general", userDislikes = null, userFacts = null, userVoiceProfile = null) {
  // 目标 AI 策略
  let targetStrategy = "";

  if (["chatgpt", "gemini"].includes(targetAI)) {
    targetStrategy = `
## TARGET AI STRATEGY: ${targetAI.toUpperCase()}
This prompt will be used with ${targetAI === "chatgpt" ? "ChatGPT (OpenAI)" : "Gemini (Google)"}.
- Use Markdown structure: headers (##), bullet lists, code blocks when appropriate
- Clear role + step-by-step instructions work best
- Include explicit output format specification with examples`;
  } else if (targetAI === "claude") {
    targetStrategy = `
## TARGET AI STRATEGY: CLAUDE
This prompt will be used with Claude (Anthropic).
- Claude excels at long-form content and nuanced tasks
- Use XML tag structure when helpful: <context>, <task>, <constraints>, <format>
- Claude follows instructions precisely — be explicit about what you want
- Multi-step tasks benefit from clear sequential structure`;
  } else if (["kimi", "zhipu", "deepseek", "minimax"].includes(targetAI)) {
    targetStrategy = `
## TARGET AI STRATEGY: CHINESE LLM (${targetAI})
This prompt will be used with a Chinese-first LLM.
- Prioritize Chinese output unless user explicitly wants English
- Be concise and direct — avoid over-engineered Western prompt structures
- Use simple numbered lists, avoid heavy XML or Markdown
- Chinese-specific context (文化、行业背景) improves results dramatically`;
  } else {
    targetStrategy = `
## TARGET AI STRATEGY: UNIVERSAL
Optimize for broad compatibility across all major AI systems.
- Use clear, unambiguous language
- Moderate use of Markdown structure
- Explicit role + task + output format`;
  }

  // 语气指导
  const toneGuide = {
    Professional: "formal, precise, business-appropriate",
    Casual: "friendly, conversational, approachable",
    Academic: "scholarly, evidence-based, structured",
    Creative: "imaginative, expressive, open-ended",
    Concise: "ultra-brief, direct, no filler words",
  };
  const toneDesc = toneGuide[tone] || "balanced and clear";

  // 个性化记忆：声音指纹（v11，最顶部）+ 风格画像 + 历史高分示例 + 反向样本（v8.1）+ LLM 抽取事实（v10）
  const voiceProfileBlock = buildVoiceProfileBlock(userVoiceProfile);
  const userProfileBlock = buildUserProfileBlock(userProfile, taskType);
  const examplesBlock = buildExamplesBlock(topExamples);
  const dislikesBlock = buildUserDislikesBlock(userDislikes);
  const factsBlock = buildUserFactsBlock(userFacts);

  return `You are an elite Prompt Engineer with mastery of the world's best prompting frameworks. Your job: transform any rough user input into a high-quality, immediately usable prompt.
${targetStrategy}
${voiceProfileBlock}

## TONE REQUIREMENT
Apply this tone to the optimized prompt: ${tone} — ${toneDesc}
${userProfileBlock}${examplesBlock}${dislikesBlock}${factsBlock}

## YOUR OPTIMIZATION ENGINE

Apply these frameworks intelligently based on what the prompt needs:

**CO-STAR** (for creative/writing/communication tasks):
- Context: background the AI needs
- Objective: exact task
- Style: tone/voice/format
- Tone: emotional register
- Audience: who the output is for
- Response: output format

**RISEN** (for analytical/technical/structured tasks):
- Role: expert identity for the AI
- Instructions: clear step-by-step
- Steps: logical sequence
- End goal: what success looks like
- Narrowing: constraints/exclusions

**Chain-of-Thought** (for reasoning/problem-solving tasks):
- Add "Think step by step" or "Let's reason through this"
- Break complex asks into explicit stages

## OPTIMIZATION RULES

**DETECT language first**: If input is Chinese → output Chinese. If English → output English. Mixed → match dominant language.

**DETECT complexity**:
- Simple (translate/lookup/summarize) → minimal touch: just add precision, don't over-engineer
- Medium (write/analyze/code) → apply CO-STAR or RISEN fully
- Complex (design/architect/multi-step) → full framework + sub-tasks + quality criteria

**ALWAYS add**:
1. Expert role assignment ("You are a senior [X] with [Y] years of experience...")
2. Specific output format (length, structure, bullets vs prose)
3. Relevant constraints ("Do not include...", "Focus only on...")
4. Quality anchor ("Ensure the output is actionable/professional/beginner-friendly")

**NEVER**:
- Add unnecessary complexity to simple questions
- Change the user's core intent
- Use generic phrases like "helpful assistant"

## SCORING CRITERIA
You must evaluate the ORIGINAL prompt and score it on these 3 dimensions (0-100 each):
- **clarity** (清晰度): How clearly does the prompt state its intent? 0=completely vague, 100=crystal clear
- **specificity** (具体性): How much relevant detail/context does it include? 0=no details, 100=fully specified
- **structure** (结构性): How well-organized and formatted is it? 0=random text, 100=perfect structure

## FEW-SHOT EXAMPLES

Example 1:
Input: "帮我写邮件给客户说项目延期了"
Output:
{
  "diagnosis": "缺少角色、语气和具体细节，意图过于模糊",
  "optimized": "你是一位专业的项目经理，擅长处理客户关系。请帮我写一封正式但友好的邮件，向客户说明项目延期的情况。\\n\\n邮件要求：\\n- 语气：专业、诚恳、负责任\\n- 结构：开头道歉 → 说明延期原因（可留空让我填写）→ 新的交付时间 → 补偿方案 → 结尾承诺\\n- 长度：200-300字\\n- 避免：推卸责任的措辞",
  "scores": { "clarity": 45, "specificity": 20, "structure": 30 },
  "tips": ["说明延期原因和新的交付时间", "指定邮件语气（正式/友好）", "告知收件人是客户还是上级"]
}

Example 2:
Input: "write code to sort a list"
Output:
{
  "diagnosis": "Missing language, list type, and sort criteria — too vague to be useful",
  "optimized": "You are a senior software engineer. Write a clean, well-commented function to sort a list.\\n\\nRequirements:\\n- Language: [specify: Python/JavaScript/etc.]\\n- Input: a list of [numbers/strings/objects]\\n- Sort order: ascending (default) with option for descending\\n- Include: type hints, docstring, and a usage example\\n- Handle edge cases: empty list, single element, duplicate values\\n- Output format: just the function + example, no extra explanation",
  "scores": { "clarity": 40, "specificity": 15, "structure": 25 },
  "tips": ["Specify the programming language", "Describe what's in the list (numbers, strings, objects)", "State whether ascending or descending order is needed"]
}

## OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no explanation outside JSON:
{
  "diagnosis": "one sentence max 40 chars in same language as input, describing the main problem",
  "optimized": "the complete optimized prompt ready to use",
  "scores": {
    "clarity": <0-100>,
    "specificity": <0-100>,
    "structure": <0-100>
  },
  "tips": ["improvement tip 1", "improvement tip 2", "improvement tip 3"]
}`;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MINIMAX_TIMEOUT_MS = 25000;
const MINIMAX_MAX_RETRIES = 2;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = MINIMAX_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callMiniMaxWithRetry(env, payload) {
  let lastErrorText = "";
  let lastStatus = 0;
  let lastThrown = null;

  for (let attempt = 0; attempt <= MINIMAX_MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        MINIMAX_API,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
          },
          body: JSON.stringify(payload),
        },
        MINIMAX_TIMEOUT_MS,
      );

      if (response.ok) {
        return { response, attempt, lastErrorText: "", lastStatus: response.status };
      }

      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(`MiniMax API error (attempt ${attempt + 1}):`, response.status, lastErrorText);

      if (attempt < MINIMAX_MAX_RETRIES && isRetryableStatus(response.status)) {
        await delay(600 * (attempt + 1));
        continue;
      }

      return { response, attempt, lastErrorText, lastStatus: response.status };
    } catch (error) {
      lastThrown = error;
      console.error(`MiniMax request failed (attempt ${attempt + 1}):`, error);

      if (attempt < MINIMAX_MAX_RETRIES) {
        await delay(600 * (attempt + 1));
        continue;
      }
    }
  }

  throw new Error(lastThrown?.message || `MiniMax request failed, lastStatus=${lastStatus}, details=${lastErrorText.slice(0, 200)}`);
}

function normalizeResult(result, lang = "zh") {
  const isZh = lang === "zh";
  const fallbackTips = isZh
    ? ["补充任务目标", "加入约束条件", "明确输出格式"]
    : ["Add the task goal", "Add constraints", "Specify the output format"];

  return {
    diagnosis: typeof result?.diagnosis === "string" && result.diagnosis.trim()
      ? result.diagnosis.trim().slice(0, 40)
      : (isZh ? "已优化" : "Optimized"),
    optimized: typeof result?.optimized === "string" && result.optimized.trim()
      ? result.optimized.trim()
      : "",
    scores: {
      clarity: typeof result?.scores?.clarity === "number" ? result.scores.clarity : 0,
      specificity: typeof result?.scores?.specificity === "number" ? result.scores.specificity : 0,
      structure: typeof result?.scores?.structure === "number" ? result.scores.structure : 0,
    },
    tips: Array.isArray(result?.tips) && result.tips.length > 0
      ? result.tips.filter(Boolean).slice(0, 3)
      : fallbackTips,
  };
}

// 清理模型输出：去掉 <think> 标签和 markdown 代码块
function cleanModelOutput(raw) {
  let text = raw;

  // 1. 去掉 <think>...</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. 去掉 markdown 代码块 ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  return text;
}

// ─── Resend 发送确认邮件 ────────────────────────────────────
async function sendWaitlistEmail(email, lang, resendApiKey) {
  const isZh = lang === "zh";
  const subject = isZh
    ? "🎉 你已成功加入 prompt.ai 候补名单！"
    : "🎉 You're on the prompt.ai waitlist!";

  const html = isZh ? `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'DM Sans', -apple-system, sans-serif; background: #fafafa; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 40px;">
    <div style="font-family: Georgia, serif; font-size: 1.4rem; color: #18181b; margin-bottom: 24px;">
      <a href="https://prompt-ai.work" style="color: #18181b; text-decoration: none;">prompt<span style="color: #7c3aed;">.</span>ai</a>
    </div>
    <h1 style="font-family: Georgia, serif; font-size: 1.6rem; color: #18181b; margin: 0 0 16px; line-height: 1.3;">
      你已成功加入候补名单 🎉
    </h1>
    <p style="color: #52525b; line-height: 1.7; margin: 0 0 24px;">
      感谢你的关注！我们目前处于内测阶段，名额限 <strong>20 人</strong>。<br/>
      名额开放时，我们会第一时间发邮件通知你。
    </p>
    <div style="background: #ede9fe; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
      <p style="color: #7c3aed; font-weight: 600; margin: 0 0 8px;"><a href="https://prompt-ai.work" style="color: #7c3aed; text-decoration: none;">prompt.ai</a> 能帮你做什么？</p>
      <ul style="color: #52525b; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>✦ 一键把粗糙想法优化成专业级提示词</li>
        <li>→ 自动填充到 ChatGPT / Claude / Kimi 等 15+ 平台</li>
        <li>↗ 智能推荐最适合你任务的 AI 模型</li>
      </ul>
    </div>
    <p style="color: #a1a1aa; font-size: 0.85rem; margin: 0;">
      有任何问题请回复此邮件或联系 <a href="mailto:lisayyyin@qq.com" style="color: #7c3aed;">lisayyyin@qq.com</a>
    </p>
  </div>
</body>
</html>` : `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'DM Sans', -apple-system, sans-serif; background: #fafafa; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 40px;">
    <div style="font-family: Georgia, serif; font-size: 1.4rem; color: #18181b; margin-bottom: 24px;">
      <a href="https://prompt-ai.work" style="color: #18181b; text-decoration: none;">prompt<span style="color: #7c3aed;">.</span>ai</a>
    </div>
    <h1 style="font-family: Georgia, serif; font-size: 1.6rem; color: #18181b; margin: 0 0 16px; line-height: 1.3;">
      You're on the waitlist! 🎉
    </h1>
    <p style="color: #52525b; line-height: 1.7; margin: 0 0 24px;">
      Thanks for your interest in prompt.ai! We're currently in private beta,
      limited to <strong>20 early users</strong>.<br/>
      We'll email you as soon as your spot is ready.
    </p>
    <div style="background: #ede9fe; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
      <p style="color: #7c3aed; font-weight: 600; margin: 0 0 8px;"><a href="https://prompt-ai.work" style="color: #7c3aed; text-decoration: none;">prompt.ai</a> — What it does for you:</p>
      <ul style="color: #52525b; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>✦ Turn rough ideas into professional prompts in one click</li>
        <li>→ Auto-fill into ChatGPT, Claude, Kimi & 15+ AI platforms</li>
        <li>↗ Smart AI model recommendations based on your task</li>
      </ul>
    </div>
    <p style="color: #a1a1aa; font-size: 0.85rem; margin: 0;">
      Questions? Reply to this email or reach us at <a href="mailto:lisayyyin@qq.com" style="color: #7c3aed;">lisayyyin@qq.com</a>
    </p>
  </div>
</body>
</html>`;

  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "prompt.ai <hi@prompt-ai.work>",
      to: [email],
      subject,
      html,
    }),
  });
}

// ─── Supabase 写入 waitlist ─────────────────────────────────
async function insertWaitlist(email, source, lang, supabaseUrl, supabaseKey) {
  return fetch(`${supabaseUrl}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ email, source, lang, created_at: new Date().toISOString() }),
  });
}

// ─── v20: AI Weekly Insights helpers ─────────────────────────
// 从 request 拿 JWT,验证身份,聚合 7 天数据,调 LLM 生成洞察,渲染 HTML
async function generateInsightsFromRequest(env, request) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { error: "Supabase not configured", status: 500 };
  }

  // 1. 拿 JWT (从 Authorization header)
  const authHeader = request.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: "Missing Authorization Bearer JWT", status: 401 };

  // 2. 通过 Supabase auth 验证 JWT 拿 user info
  const userInfoRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": env.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${jwt}`,
    },
  });
  if (!userInfoRes.ok) return { error: "Invalid JWT", status: 401 };
  const userInfo = await userInfoRes.json();
  const userId = userInfo.id;
  const email = userInfo.email;
  if (!userId) return { error: "User not found", status: 401 };

  return await generateInsightsForUser(env, userId, email, jwt);
}

async function generateInsightsForUser(env, userId, email, authToken) {
  const SUPABASE_URL = env.SUPABASE_URL;
  const ANON_KEY = env.SUPABASE_ANON_KEY;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  const headers = {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${authToken}`,
  };

  // 拉 7 天 prompts
  const promptsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/prompts?user_id=eq.${userId}&created_at=gte.${sevenDaysAgo}&select=platform,task_type,source,created_at,original_text&order=created_at.desc&limit=200`,
    { headers }
  );
  const prompts = promptsRes.ok ? await promptsRes.json() : [];

  // 拉本周新 facts
  const factsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_facts?user_id=eq.${userId}&extracted_at=gte.${sevenDaysAgo}&select=fact,confidence,task_type&order=confidence.desc&limit=10`,
    { headers }
  );
  const newFacts = factsRes.ok ? await factsRes.json() : [];

  // 拉 voice profile
  const voiceRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_voice_profiles?user_id=eq.${userId}&select=voice_profile,synthesized_at&limit=1`,
    { headers }
  );
  const voiceData = voiceRes.ok ? await voiceRes.json() : [];
  const voice = voiceData[0] || null;
  const voiceUpdatedThisWeek = voice && new Date(voice.synthesized_at) >= new Date(sevenDaysAgo);

  // 聚合
  const total = prompts.length;
  const byPlatform = {};
  const byTask = {};
  const bySource = { silent_capture: 0, optimize: 0, manual: 0 };
  for (const p of prompts) {
    const plat = p.platform || "unknown";
    byPlatform[plat] = (byPlatform[plat] || 0) + 1;
    const task = p.task_type || "general";
    byTask[task] = (byTask[task] || 0) + 1;
    const src = p.source || "optimize";
    bySource[src] = (bySource[src] || 0) + 1;
  }
  const topPlatforms = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTasks = Object.entries(byTask).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const platformsCount = Object.keys(byPlatform).length;

  // LLM 生成本周观察
  let insightText = total >= 3
    ? "本期 prompt.ai 已记录到你的活跃使用,继续多用会有更精准的画像。"
    : "本周数据较少,多用几次 prompt.ai 让 AI 更懂你。";
  if (total >= 5) {
    try {
      const summary = `用户最近 7 天 AI 使用统计:
- 总 prompt 数: ${total} (跨 ${platformsCount} 个平台)
- 主要平台: ${topPlatforms.map(([p, c]) => `${p}(${c})`).join(", ")}
- 主要任务: ${topTasks.map(([t, c]) => `${t}(${c})`).join(", ")}
- 跨平台 silent capture: ${bySource.silent_capture}
- prompt.ai 主动优化: ${bySource.optimize}
- 本周新提炼偏好: ${newFacts.length} 条 ${newFacts.length > 0 ? "(" + newFacts.slice(0, 2).map(f => f.fact).join("; ") + ")" : ""}
- voice profile 本周${voiceUpdatedThisWeek ? "已更新" : "未更新"}`;

      const insightPayload = {
        model: MODEL,
        messages: [
          { role: "system", content: `你是 AI 使用习惯洞察分析师。基于用户最近 7 天的 AI 使用统计,写一段 100-180 字的本周观察。要求:1) 直接说重点,不寒暄,不复述数字 2) 用第二人称(你) 3) 给出 1 个具体观察 + 1 条小建议 4) 中文输出,口吻像懂用户的私人助理 5) 输出纯叙事,不用列表/Markdown` },
          { role: "user", content: summary },
        ],
        temperature: 0.6,
        max_tokens: 500,
      };
      const llmRes = await callMiniMaxWithRetry(env, insightPayload);
      if (llmRes.response.ok) {
        const llmData = await llmRes.response.json();
        const raw = llmData.choices?.[0]?.message?.content || "";
        const cleaned = cleanModelOutput(raw).trim();
        if (cleaned.length >= 30 && cleaned.length <= 500) insightText = cleaned;
      }
    } catch (e) {
      console.warn("Insight LLM call failed:", e?.message);
    }
  }

  // 渲染 HTML 邮件
  const dateStr = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}`;
  const subject = `📊 你这周的 AI 使用画像 · ${dateStr}`;

  // Top platforms 渲染成 mini bars
  const maxPlatformCount = topPlatforms.length > 0 ? topPlatforms[0][1] : 1;
  const platformBarsHtml = topPlatforms.map(([p, c]) => {
    const pct = Math.round((c / maxPlatformCount) * 100);
    return `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#3a3a45;margin-bottom:3px;">
        <span style="font-weight:600;">${p}</span>
        <span style="color:#71717a;">${c} 条</span>
      </div>
      <div style="height:6px;background:#f0f0f4;border-radius:3px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);"></div>
      </div>
    </div>`;
  }).join("");

  const newFactsHtml = newFacts.length > 0
    ? `<div style="background:#faf7ff;border:1px solid #e0d3f9;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:12px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">📌 本周新学到的偏好</div>
        ${newFacts.slice(0, 5).map(f => `<div style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#3a3a45;line-height:1.6;margin-bottom:6px;"><span style="color:#7c3aed;font-weight:700;">▮</span><span>${escapeHtml(f.fact)}</span></div>`).join("")}
      </div>`
    : "";

  const voiceHtml = voice
    ? `<div style="background:linear-gradient(135deg,#5d3eb8,#7c3aed);border-radius:12px;padding:20px 24px;color:white;margin-bottom:24px;">
        <div style="font-size:11px;opacity:0.8;margin-bottom:6px;letter-spacing:0.5px;">✨ 你的 AI 声音指纹 ${voiceUpdatedThisWeek ? "(本周更新)" : ""}</div>
        <div style="font-size:13px;line-height:1.7;font-family:Georgia,serif;font-weight:300;">${escapeHtml(voice.voice_profile.slice(0, 300))}${voice.voice_profile.length > 300 ? "..." : ""}</div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f6;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;">
    <!-- Header -->
    <div style="background:#18181b;border-radius:16px 16px 0 0;padding:32px;">
      <div style="font-family:Georgia,serif;font-size:1.3rem;color:#fff;margin-bottom:6px;">prompt<span style="color:#a78bfa;">.</span>ai</div>
      <h1 style="font-size:1.6rem;color:#fff;margin:8px 0 0;font-weight:700;line-height:1.3;">📊 你这周的 AI 使用画像</h1>
      <p style="color:#a1a1aa;font-size:0.9rem;margin:8px 0 0;">${dateStr}</p>
    </div>
    <!-- Body -->
    <div style="background:#fff;padding:28px 32px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
      <!-- Stats grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:10px;padding:14px;">
          <div style="font-size:1.6rem;font-weight:700;color:#18181b;">${total}</div>
          <div style="font-size:0.78rem;color:#71717a;margin-top:2px;">本周 prompts</div>
        </div>
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:10px;padding:14px;">
          <div style="font-size:1.6rem;font-weight:700;color:#18181b;">${platformsCount}</div>
          <div style="font-size:0.78rem;color:#71717a;margin-top:2px;">使用的平台</div>
        </div>
        <div style="background:#faf7ff;border:1px solid #e0d3f9;border-radius:10px;padding:14px;">
          <div style="font-size:1.6rem;font-weight:700;color:#7c3aed;">${bySource.silent_capture}</div>
          <div style="font-size:0.78rem;color:#7c6fc4;margin-top:2px;">📡 跨平台捕获</div>
        </div>
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:10px;padding:14px;">
          <div style="font-size:1.6rem;font-weight:700;color:#18181b;">${newFacts.length}</div>
          <div style="font-size:0.78rem;color:#71717a;margin-top:2px;">📌 新偏好</div>
        </div>
      </div>

      <!-- LLM insight (centerpiece) -->
      <div style="background:#fffbf0;border:1px solid #f0e4c8;border-left:4px solid #c09b3f;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
        <div style="font-size:11px;color:#c09b3f;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">✦ 本周观察</div>
        <p style="font-size:13.5px;color:#5a4a30;line-height:1.7;margin:0;font-style:italic;">${escapeHtml(insightText)}</p>
      </div>

      ${voiceHtml}

      <!-- Top platforms -->
      ${topPlatforms.length > 0 ? `<div style="margin-bottom:24px;">
        <div style="font-size:12px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">🌍 跨平台使用 TOP ${topPlatforms.length}</div>
        ${platformBarsHtml}
      </div>` : ""}

      ${newFactsHtml}
    </div>

    <!-- Footer CTA -->
    <div style="background:#18181b;border-radius:0 0 16px 16px;padding:28px 32px;text-align:center;">
      <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 16px;">你的 AI 越用越懂你 — 跨 22 平台的记忆中枢</p>
      <a href="https://prompt-ai.work" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:0.95rem;font-weight:600;">打开 prompt.ai dashboard →</a>
      <p style="color:#52525b;font-size:0.72rem;margin:18px 0 0;">prompt<span style="color:#a78bfa;">.</span>ai · <a href="mailto:lisayyyin@qq.com" style="color:#8b8b9e;text-decoration:none;">lisayyyin@qq.com</a></p>
    </div>
  </div>
</body></html>`;

  return {
    userId,
    email,
    subject,
    html,
    insight: insightText,
    summary: {
      total,
      platforms_count: platformsCount,
      top_platforms: topPlatforms,
      top_tasks: topTasks,
      by_source: bySource,
      new_facts_count: newFacts.length,
      voice_present: !!voice,
      voice_updated_this_week: voiceUpdatedThisWeek,
    },
  };
}

// HTML escape (避免 voice 或 fact 内容里的特殊字符破坏邮件)
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ─── /send-report 路由：发送 HTML 周报邮件 ───────────────
    if (url.pathname === "/send-report") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { email, name, lang = "zh", stats = {}, recentPrompts = [] } = await request.json();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: "Invalid email" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const isZh = lang === "zh";
        const displayName = name || (isZh ? "你" : "there");
        const {
          totalPrompts = 0,
          streak = 0,
          timeSaved = isZh ? "—" : "—",
          topPlatform = isZh ? "—" : "—",
          topTask = isZh ? "—" : "—",
          peakHour = isZh ? "—" : "—",
          avgQuality = null,
        } = stats;

        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`;

        const recentList = recentPrompts.slice(0, 5).map((p, i) =>
          `<li style="color:#52525b;padding:6px 0;border-bottom:1px solid #f0f0f4;">${i+1}. ${p}</li>`
        ).join("");

        const subject = isZh ? `📊 prompt.ai 周报 · ${dateStr}` : `📊 prompt.ai Weekly Report · ${dateStr}`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f6;margin:0;padding:32px 16px;">
  <div style="max-width:540px;margin:0 auto;">
    <!-- Header -->
    <div style="background:#18181b;border-radius:16px 16px 0 0;padding:28px 32px 24px;">
      <div style="font-family:Georgia,serif;font-size:1.3rem;color:#fff;margin-bottom:4px;">
        prompt<span style="color:#8b5cf6;">.</span>ai
      </div>
      <h1 style="font-size:1.5rem;color:#fff;margin:8px 0 0;font-weight:700;line-height:1.3;">
        ${isZh ? `${displayName}的周报 📊` : `${displayName}'s Weekly Report 📊`}
      </h1>
      <p style="color:#a1a1aa;font-size:0.85rem;margin:8px 0 0;">${dateStr}</p>
    </div>

    <!-- Stats Grid -->
    <div style="background:#fff;padding:24px 32px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
      <p style="color:#8b8b9e;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin:0 0 16px;">
        ${isZh ? "📈 使用概览" : "📈 Usage Overview"}
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:12px;padding:16px;">
          <div style="font-size:1.6rem;font-weight:700;color:#18181b;">${totalPrompts}</div>
          <div style="font-size:0.8rem;color:#8b8b9e;margin-top:2px;">${isZh ? "累计优化条数" : "Total Optimized"}</div>
        </div>
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:12px;padding:16px;">
          <div style="font-size:1.6rem;font-weight:700;color:#18181b;">${streak}${isZh ? "天" : "d"}</div>
          <div style="font-size:0.8rem;color:#8b8b9e;margin-top:2px;">${isZh ? "连续使用" : "Day Streak"}</div>
        </div>
        <div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:12px;padding:16px;">
          <div style="font-size:1.2rem;font-weight:700;color:#18181b;">${timeSaved}</div>
          <div style="font-size:0.8rem;color:#8b8b9e;margin-top:2px;">${isZh ? "节省时间（估算）" : "Time Saved (est.)"}</div>
        </div>
        ${avgQuality !== null ? `<div style="background:#ede9fe;border:1px solid #ddd6fe;border-radius:12px;padding:16px;">
          <div style="font-size:1.6rem;font-weight:700;color:#6366f1;">${avgQuality}</div>
          <div style="font-size:0.8rem;color:#7c6fc4;margin-top:2px;">${isZh ? "平均质量分" : "Avg Quality"}</div>
        </div>` : `<div style="background:#fafafa;border:1px solid #e8e8ec;border-radius:12px;padding:16px;">
          <div style="font-size:1.2rem;font-weight:700;color:#18181b;">${topPlatform}</div>
          <div style="font-size:0.8rem;color:#8b8b9e;margin-top:2px;">${isZh ? "最常用 AI" : "Top AI"}</div>
        </div>`}
      </div>

      <!-- Habits Row -->
      <div style="background:#f8f7ff;border:1px solid #e9e8fe;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#6366f1;font-size:0.78rem;font-weight:600;margin:0 0 10px;">
          ${isZh ? "✦ 你的 AI 使用习惯" : "✦ Your AI Habits"}
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span style="color:#52525b;">${isZh ? "最擅长任务" : "Top Task Type"}</span>
            <span style="color:#18181b;font-weight:600;">${topTask}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span style="color:#52525b;">${isZh ? "最常用平台" : "Fav Platform"}</span>
            <span style="color:#18181b;font-weight:600;">${topPlatform}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
            <span style="color:#52525b;">${isZh ? "活跃高峰" : "Peak Hours"}</span>
            <span style="color:#18181b;font-weight:600;">${peakHour}</span>
          </div>
        </div>
      </div>

      ${recentList ? `<!-- Recent Prompts -->
      <p style="color:#8b8b9e;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin:0 0 12px;">
        ${isZh ? "🕐 最近优化的 Prompt" : "🕐 Recent Prompts"}
      </p>
      <ul style="margin:0;padding-left:0;list-style:none;">
        ${recentList}
      </ul>` : ""}
    </div>

    <!-- Footer CTA -->
    <div style="background:#18181b;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
      <p style="color:#a1a1aa;font-size:0.85rem;margin:0 0 16px;">
        ${isZh ? "更好的 prompt = 更好的 AI 输出 🚀" : "Better prompts = Better AI outputs 🚀"}
      </p>
      <a href="https://prompt-ai.work" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:0.9rem;font-weight:600;">
        ${isZh ? "打开 prompt.ai" : "Open prompt.ai"}
      </a>
      <p style="color:#52525b;font-size:0.75rem;margin:16px 0 0;">
        prompt<span style="color:#8b5cf6;">.</span>ai Team · <a href="mailto:lisayyyin@qq.com" style="color:#8b8b9e;text-decoration:none;">lisayyyin@qq.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "prompt.ai <hi@prompt-ai.work>",
            to: [email],
            subject,
            html,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          console.error("Resend error:", errText);
          return new Response(JSON.stringify({ error: "Email send failed" }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Send report error:", err);
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /waitlist 路由 ────────────────────────────────────
    if (url.pathname === "/waitlist") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { email, source = "hero", lang = "en" } = await request.json();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: "Invalid email" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // 写入 Supabase
        const dbRes = await insertWaitlist(
          email, source, lang,
          env.SUPABASE_URL,
          env.SUPABASE_ANON_KEY
        );

        // 409 = 邮箱已存在，也算成功
        if (!dbRes.ok && dbRes.status !== 409) {
          const errText = await dbRes.text();
          console.error("Supabase error:", errText);
          return new Response(JSON.stringify({ error: "Database error" }), {
            status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // 发确认邮件（仅首次注册，409 不重发）
        // 用 try-catch 包裹，邮件失败不影响 waitlist 写入成功
        if (dbRes.ok || dbRes.status === 201) {
          try {
            await sendWaitlistEmail(email, lang, env.RESEND_API_KEY);
          } catch (mailErr) {
            console.error("Email send failed (non-fatal):", mailErr);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Waitlist error:", err);
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /send-invite 路由：发送邀请码邮件 ───────────────
    if (url.pathname === "/send-invite") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { email, inviteCode, lang = "zh" } = await request.json();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: "Invalid email" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        if (!inviteCode) {
          return new Response(JSON.stringify({ error: "Missing invite code" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const isZh = lang === "zh";
        const subject = isZh 
          ? "🎉 prompt.ai 内测邀请码来啦！" 
          : "🎉 Your prompt.ai Beta Invite Code!";

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'DM Sans', -apple-system, sans-serif; background: #fafafa; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 40px;">
    <div style="font-family: Georgia, serif; font-size: 1.4rem; color: #18181b; margin-bottom: 24px;">
      <a href="https://prompt-ai.work" style="color: #18181b; text-decoration: none;">prompt<span style="color: #7c3aed;">.</span>ai</a>
    </div>
    <h1 style="font-family: Georgia, serif; font-size: 1.6rem; color: #18181b; margin: 0 0 16px; line-height: 1.3;">
      ${isZh ? "你收到内测邀请啦！🎉" : "You're Invited to Beta! 🎉"}
    </h1>
    <p style="color: #52525b; line-height: 1.7; margin: 0 0 24px;">
      ${isZh 
        ? "恭喜你获得 <a href='https://prompt-ai.work' style='color:#7c3aed;text-decoration:none;'>prompt.ai</a> 内测资格！点击下方链接即可开始体验。" 
        : "Congratulations! You got early access to <a href='https://prompt-ai.work' style='color:#7c3aed;text-decoration:none;'>prompt.ai</a>. Click the link below to get started."}
    </p>
    <div style="background: #18181b; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="color: #a1a1aa; font-size: 0.85rem; margin: 0 0 8px;">
        ${isZh ? "你的邀请码" : "Your Invite Code"}
      </p>
      <div style="font-family: monospace; font-size: 1.8rem; font-weight: 700; color: #fff; letter-spacing: 0.05em;">
        ${inviteCode}
      </div>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://prompt-ai.work?code=${inviteCode}" style="display: inline-block; background: #7c3aed; color: #fff; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
        ${isZh ? "立即体验 →" : "Get Started →"}
      </a>
    </div>
    <p style="color: #a1a1aa; font-size: 0.85rem; margin: 0; line-height: 1.6;">
      ${isZh 
        ? "使用提示：安装 Chrome 插件后，在任意 AI 平台输入框点击插件图标即可优化你的 prompt。" 
        : "Tip: Install the Chrome extension, then click the plugin icon in any AI platform's input box to optimize your prompts."}
    </p>
    <div style="border-top: 1px solid #e4e4e7; margin-top: 32px; padding-top: 24px; text-align: center;">
      <p style="color: #71717a; font-size: 0.8rem; margin: 0;">
        <a href="https://prompt-ai.work" style="color: #7c3aed; text-decoration: none;">prompt.ai</a> Team · <a href="mailto:lisayyyin@qq.com" style="color: #7c3aed; text-decoration: none;">lisayyyin@qq.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "prompt.ai <onboarding@resend.dev>",
            to: [email],
            subject: subject,
            html: html,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          console.error("Resend error:", errText);
          return new Response(JSON.stringify({ error: "Failed to send email", details: errText }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Invite email sent" }), {
          status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Send invite error:", err);
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /embed 路由 (v9)：用 Cloudflare Workers AI 跑 bge-m3 拿向量 ───────
    // 前端在 optimize 前先调一次拿到 query embedding，用于：
    //   1) 调 get_top_user_prompts_semantic 做语义 few-shot 检索
    //   2) optimize 完成后，写回 prompts.embedding 列（避免再算一遍）
    // 模型 @cf/baai/bge-m3：1024 维，多语言（中文友好），免费额度 10k neurons/day
    if (url.pathname === "/embed") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        if (!env.AI) {
          return new Response(JSON.stringify({ error: "AI binding not configured (check wrangler.toml [ai] block)" }), {
            status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        const { text } = await request.json();
        const cleaned = String(text || "").trim();
        if (!cleaned) {
          return new Response(JSON.stringify({ error: "text is required" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // bge-m3 input cap: ~8192 tokens; conservatively cap chars
        const result = await env.AI.run("@cf/baai/bge-m3", {
          text: [cleaned.slice(0, 4000)],
        });

        // Workers AI bge-m3 response shape: { shape: [1, 1024], data: [[...1024]], pooling: "cls" }
        const embedding = Array.isArray(result?.data) && Array.isArray(result.data[0])
          ? result.data[0]
          : null;

        if (!embedding || embedding.length !== 1024) {
          console.error("Malformed bge-m3 response:", JSON.stringify(result).slice(0, 300));
          return new Response(JSON.stringify({ error: "Malformed embedding response" }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ embedding }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Embed error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /extract-facts 路由 (v10)：从用户最近 N 条 prompt 抽 LLM 偏好事实 ──
    // 调 MiniMax-M2.7 把"用户偏好"提炼成结构化 JSON 事实
    // 前端拿到 facts 后通过 add_user_facts RPC 写入 user_facts 表
    if (url.pathname === "/extract-facts") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { prompts } = await request.json();
        if (!Array.isArray(prompts) || prompts.length === 0) {
          return new Response(JSON.stringify({ error: "prompts array required" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        // 上限 15 条，防止 token 爆炸
        const sample = prompts.slice(0, 15).map((p, i) => {
          const orig = String(p?.original_text || "").slice(0, 200);
          const opt = String(p?.optimized_text || "").slice(0, 400);
          const tt = String(p?.task_type || "general").slice(0, 30);
          return `[${i + 1}] task=${tt}\n  raw: ${orig}\n  opt: ${opt}`;
        }).join("\n\n");

        const FACT_EXTRACTION_PROMPT = `You are a user-profile extraction expert. Your job: read a user's recent prompt-optimization records and extract STABLE PREFERENCES that should inform future optimizations.

EXTRACT (high-signal preferences):
- Professional identity ("用户是产品经理")
- Style preferences ("偏好简洁输出，不超过200字")
- Format preferences ("常用项目符号列表" / "偏好 Markdown 结构")
- Domain vocabulary ("常用 KPI、OKR、sprint 等管理术语")
- Audience patterns ("常给客户写正式邮件" / "对内沟通偏口语化")
- Tone defaults ("整体语气专业但温和")
- Task domain expertise ("精通技术文档写作")

DO NOT EXTRACT (low-signal noise):
- Single-incident phrasings (一次性的措辞，不能代表习惯)
- Personal information (姓名、邮箱、电话、公司名)
- Specific business secrets (产品代号、内部数字)
- Content topics (这是 case-by-case，不是偏好)

OUTPUT RULES:
- Output ONLY a valid JSON array, no markdown, no explanation
- Each fact: {"fact": "<chinese, 10-80 chars>", "confidence": <0.0-1.0>, "task_type": "<task name or null>"}
- task_type=null 表示全局事实；非 null 表示仅当用户做该类任务时适用
- Aim for 3-7 facts. QUALITY OVER QUANTITY.
- Skip any fact with confidence < 0.5
- Output Chinese (用户主语言)

EXAMPLE OUTPUT:
[
  {"fact": "用户身份偏向产品经理或技术管理者", "confidence": 0.85, "task_type": null},
  {"fact": "邮件类任务偏好正式、简洁、不超过200字", "confidence": 0.72, "task_type": "邮件"},
  {"fact": "常用 KPI、OKR、sprint 等英文管理术语，混在中文里", "confidence": 0.68, "task_type": null}
]`;

        const userMsg = `以下是该用户最近 ${sample.split("\n\n").length} 条 prompt 优化记录。请提炼用户的稳定偏好，输出 JSON 数组：\n\n${sample}`;

        const minimaxPayload = {
          model: MODEL,
          messages: [
            { role: "system", content: FACT_EXTRACTION_PROMPT },
            { role: "user", content: userMsg },
          ],
          temperature: 0.2,  // 抽取任务要稳，不要 creative
          max_tokens: 1500,
        };

        const { response: apiResponse, lastErrorText, lastStatus } = await callMiniMaxWithRetry(env, minimaxPayload);

        if (!apiResponse.ok) {
          console.error("MiniMax extraction error:", lastStatus, lastErrorText);
          return new Response(JSON.stringify({ error: "Extraction LLM failed", upstreamStatus: lastStatus }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const data = await apiResponse.json();
        const rawContent = data.choices?.[0]?.message?.content || "";
        const cleaned = cleanModelOutput(rawContent);

        let facts;
        try {
          facts = JSON.parse(cleaned);
          if (!Array.isArray(facts)) throw new Error("not an array");
        } catch (parseErr) {
          console.error("Fact JSON parse failed:", cleaned.slice(0, 200));
          return new Response(JSON.stringify({ error: "Failed to parse facts", raw: cleaned.slice(0, 300) }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // 严格校验 + 清洗每条 fact
        const validFacts = facts
          .filter(f => f && typeof f.fact === "string" && f.fact.trim().length >= 5)
          .map(f => ({
            fact: String(f.fact).trim().slice(0, 300),
            confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.6)),
            task_type: typeof f.task_type === "string" && f.task_type.trim() ? String(f.task_type).trim().slice(0, 30) : null,
          }))
          .filter(f => f.confidence >= 0.5)
          .slice(0, 10);  // hard cap

        return new Response(JSON.stringify({ facts: validFacts, raw_count: facts.length }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Extract-facts error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /synthesize-voice 路由 (v11)：把 facts 列表压成一段叙事性的"声音指纹" ──
    // L6: v10 给离散事实清单,v11 给 LLM 看到的是一段连贯的"用户是谁"叙事
    // 调 MiniMax-M2.7 (temp=0.4 — 需要一定创造性把事实串成自然语言)
    if (url.pathname === "/synthesize-voice") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { facts } = await request.json();
        if (!Array.isArray(facts) || facts.length === 0) {
          return new Response(JSON.stringify({ error: "facts array required" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // 整理 facts 给 LLM:按 confidence 倒序,带 task_type 标注
        const sortedFacts = facts
          .filter(f => f && typeof f.fact === "string" && f.fact.trim())
          .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
          .slice(0, 15)
          .map((f, i) => {
            const conf = Number(f.confidence || 0).toFixed(2);
            const tt = f.task_type ? ` [task=${String(f.task_type).slice(0, 30)}]` : " [全局]";
            return `${i + 1}. ${String(f.fact).slice(0, 300)}${tt} (conf=${conf})`;
          })
          .join("\n");

        if (!sortedFacts) {
          return new Response(JSON.stringify({ error: "no valid facts after filtering" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const VOICE_SYNTHESIS_PROMPT = `You are a "voice profile synthesizer" for a personal AI memory system. Given a list of preference FACTS extracted from a single user's prompt history, your job: synthesize them into ONE cohesive, executable VOICE PROFILE that will be injected as a system-prompt prefix to guide future prompt optimization.

OUTPUT REQUIREMENTS:
1. Write directly TO an LLM (用 "你正在为...工作。" 开头)
2. Length: STRICTLY 150-300 Chinese characters
3. Compress facts losslessly: keep all high-confidence info, downplay low-confidence (<0.7)
4. For task-specific facts: 用条件式表达 "做邮件类时…，做分析类时…"
5. Integration order: IDENTITY first → general STYLE → task-specific patterns
6. End with a directive sentence (e.g. "请把这套声音作为优化基线,除非当前 input 明确要求其他风格。")

DO NOT:
- Use bullet points or lists — pure flowing narrative
- Add meta commentary ("以下是用户画像", "根据事实总结", etc.)
- Mention confidence scores or fact numbering
- Output English (除非用户事实里就有英文术语,可以原样保留)

EXAMPLE OUTPUT (study format, not content):
"你正在为一位资深产品经理工作。Ta 的写作风格特征鲜明:整体语气专业、自信,沟通偏好直接说重点不过度解释,熟练使用 OKR、KR、Sprint 等英文管理术语并自然融入中文表达。做邮件类任务时严格遵循「正式简洁、200 字内、零 emoji、专业但不卑微」;做分析类任务时偏好 Markdown 结构化输出(表格+总结段落,800 字内)。请把这套声音作为优化基线,除非当前 input 明确要求其他风格。"

OUTPUT: ONLY the voice profile paragraph itself. No JSON, no markdown wrapper, no explanation.`;

        const userMsg = `请把以下 ${facts.length} 条用户偏好事实合成为一段声音指纹:\n\n${sortedFacts}`;

        const minimaxPayload = {
          model: MODEL,
          messages: [
            { role: "system", content: VOICE_SYNTHESIS_PROMPT },
            { role: "user", content: userMsg },
          ],
          temperature: 0.4,  // 需要一点创造性,但不能太散
          max_tokens: 800,
        };

        const { response: apiResponse, lastErrorText, lastStatus } = await callMiniMaxWithRetry(env, minimaxPayload);

        if (!apiResponse.ok) {
          console.error("MiniMax synthesis error:", lastStatus, lastErrorText);
          return new Response(JSON.stringify({ error: "Synthesis LLM failed", upstreamStatus: lastStatus }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const data = await apiResponse.json();
        const rawContent = data.choices?.[0]?.message?.content || "";
        const cleaned = cleanModelOutput(rawContent).trim();

        // 校验长度 (30-2000 chars,匹配 SQL CHECK)
        if (cleaned.length < 30 || cleaned.length > 2000) {
          console.error("Voice profile out of range:", cleaned.length, cleaned.slice(0, 100));
          return new Response(JSON.stringify({
            error: "Voice profile length out of range",
            got_length: cleaned.length,
            preview: cleaned.slice(0, 200),
          }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          voice_profile: cleaned,
          source_facts_count: facts.length,
        }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Synthesize-voice error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /translate-style 路由 (v16): 把 prompt 转成另一个 AI 平台的最佳风格 ──
    // 比赛级演示功能: "把这条 ChatGPT 风格 prompt 转成 Claude 风格"
    // 4 平台 style guides 显式区分,LLM 输出适配后的版本
    if (url.pathname === "/translate-style") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const { prompt, target_platform } = await request.json();
        const cleaned = String(prompt || "").trim();
        if (!cleaned || cleaned.length < 5) {
          return new Response(JSON.stringify({ error: "prompt is required" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        if (cleaned.length > 6000) {
          return new Response(JSON.stringify({ error: "prompt too long" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const STYLE_GUIDES = {
          chatgpt: {
            name: "ChatGPT (OpenAI)",
            guide: `ChatGPT-optimized style:
- Use Markdown structure: ## headers, bullet/numbered lists, **bold** for emphasis
- Clear role assignment ("You are a senior...")
- Step-by-step instructions when applicable
- Explicit output format with examples
- Code blocks for technical content
- Direct, concise tone — no excessive politeness`,
          },
          claude: {
            name: "Claude (Anthropic)",
            guide: `Claude-optimized style:
- Use XML tag structure: <context>, <task>, <constraints>, <format>, <examples>
- Provide rich context up front — Claude excels with long-form input
- Be explicit and precise about requirements (Claude follows literally)
- Use thinking tags <thinking>...</thinking> for multi-step reasoning
- Nuanced/sophisticated language tolerated and useful
- For complex tasks: structure with clear sequential phases`,
          },
          gemini: {
            name: "Gemini (Google)",
            guide: `Gemini-optimized style:
- Use clear sequential structure with numbered steps
- Moderate use of Markdown — headers + bullets, less XML
- Multimodal hints when applicable (image/code/table contexts)
- Concrete examples drive Gemini better than abstract instructions
- Specify exact output format (JSON / table / list / prose)
- Include "Be concise but complete" type guidance`,
          },
          kimi: {
            name: "Kimi (月之暗面)",
            guide: `Kimi-optimized style (Chinese-first):
- 中文优先输出,除非用户明确需要英文
- 简洁直接,避免过度工程化的西式 prompt 结构
- 用简单数字编号列表,少用复杂 Markdown 或 XML
- 中文文化/行业背景能显著提升结果质量
- Kimi 长上下文友好,可以塞较多背景资料
- 角色 + 任务 + 输出格式三段式即可,无需冗长框架`,
          },
        };

        const targetKey = String(target_platform || "").toLowerCase();
        const targetCfg = STYLE_GUIDES[targetKey];
        if (!targetCfg) {
          return new Response(JSON.stringify({
            error: "Invalid target_platform",
            supported: Object.keys(STYLE_GUIDES),
          }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const TRANSLATE_SYSTEM_PROMPT = `You are a "prompt style translator". Your job: take a prompt that may have been written for one AI platform, and re-express it in the optimal style for the target platform — WITHOUT changing the user's intent.

CRITICAL RULES:
1. Preserve the user's CORE INTENT exactly — don't add new requirements, don't remove user-specified constraints
2. Adapt ONLY the structure, formatting, vocabulary patterns to fit the target platform
3. Output ONLY the translated prompt itself — no preamble, no explanation, no "Here's the translation:"
4. Keep the same language as input (English in → English out, Chinese in → Chinese out)
5. Keep similar length unless target style demands different (Kimi tends shorter, Claude tends longer for complex tasks)

TARGET PLATFORM: ${targetCfg.name}

${targetCfg.guide}

Now translate the user's prompt to this target platform's optimal style. Output ONLY the new prompt.`;

        const minimaxPayload = {
          model: MODEL,
          messages: [
            { role: "system", content: TRANSLATE_SYSTEM_PROMPT },
            { role: "user", content: cleaned },
          ],
          temperature: 0.5,  // 需要一点创造性来重新表达,但不能漂移意图
          max_tokens: 2000,
        };

        const { response: apiResponse, lastErrorText, lastStatus } = await callMiniMaxWithRetry(env, minimaxPayload);

        if (!apiResponse.ok) {
          console.error("MiniMax translate-style error:", lastStatus, lastErrorText);
          return new Response(JSON.stringify({ error: "Translation LLM failed", upstreamStatus: lastStatus }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const data = await apiResponse.json();
        const rawContent = data.choices?.[0]?.message?.content || "";
        const translated = cleanModelOutput(rawContent).trim();

        if (!translated || translated.length < 5) {
          return new Response(JSON.stringify({ error: "Empty translation result" }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          translated,
          target_platform: targetKey,
          target_name: targetCfg.name,
          original_length: cleaned.length,
          translated_length: translated.length,
        }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Translate-style error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /generate-insights (v20): 生成本周 AI 洞察 HTML (供前端预览或邮件发送) ──
    if (url.pathname === "/generate-insights") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const result = await generateInsightsFromRequest(env, request);
        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status || 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(result), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Generate-insights error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // ─── /send-insights-email (v20): 立即发送本周洞察邮件到用户邮箱 ──
    if (url.pathname === "/send-insights-email") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      try {
        const result = await generateInsightsFromRequest(env, request);
        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status || 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        if (!result.email) {
          return new Response(JSON.stringify({ error: "User email not found" }), {
            status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        if (!env.RESEND_API_KEY) {
          return new Response(JSON.stringify({ error: "Email service not configured" }), {
            status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "prompt.ai <hi@prompt-ai.work>",
            to: [result.email],
            subject: result.subject,
            html: result.html,
          }),
        });
        if (!emailRes.ok) {
          const errText = await emailRes.text();
          return new Response(JSON.stringify({ error: "Email send failed", details: errText.slice(0, 200) }), {
            status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        // 更新 last_insights_sent_at (用户 JWT,RLS 允许)
        const authHeader = request.headers.get("Authorization") || "";
        const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (jwt && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${result.userId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": env.SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${jwt}`,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ last_insights_sent_at: new Date().toISOString() }),
          });
        }
        return new Response(JSON.stringify({ sent: true, email: result.email }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Send-insights-email error:", err);
        return new Response(JSON.stringify({ error: "Server error", message: err?.message?.slice(0, 200) }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const { prompt, targetAI = "any", tone = "Professional", lang = "zh", messages = [], isRefinement = false, userProfile = null, topExamples = null, taskType = "general", userDislikes = null, userFacts = null, userVoiceProfile = null } = await request.json();

      if (!prompt || !prompt.trim()) {
        return new Response(
          JSON.stringify({ error: "请输入需要优化的 prompt" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // ─── Guardrails 防护 ───────────────────────────────────
      const guardResult = checkGuardrails(prompt.trim());
      if (guardResult) {
        return new Response(
          JSON.stringify({
            error: "prompt_injection",
            message: guardResult === "injection"
              ? "检测到异常输入，请重新描述你的需求"
              : "检测到不支持的内容类型，请修改后重试",
          }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // ─── 构建动态系统提示词（v11: + voice profile）────
      const SYSTEM_PROMPT = buildSystemPrompt(targetAI, tone, userProfile, topExamples, taskType, userDislikes, userFacts, userVoiceProfile);

      // ─── 构建消息列表（支持多轮对话历史）────────────────────
      // 历史消息：最多保留最近 6 条，避免 token 过多
      const validHistory = Array.isArray(messages)
        ? messages.slice(-6).filter(m => m.role && m.content)
        : [];

      // 当前用户消息
      const userMessage = isRefinement
        ? prompt.trim() // 二次优化：直接用指令（前端已格式化）
        : `请优化以下 prompt（目标 AI：${targetAI}，语气风格：${tone}）：\n\n${prompt.trim()}`;

      // 组装完整消息数组：system + 历史 + 当前
      const allMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...validHistory,
        { role: "user", content: userMessage },
      ];

      // 调用 MiniMax API
      const minimaxPayload = {
        model: MODEL,
        messages: allMessages,
        temperature: 0.3,
        max_tokens: 3000,
      };

      const { response: apiResponse, lastErrorText, lastStatus } = await callMiniMaxWithRetry(env, minimaxPayload);

      if (!apiResponse.ok) {
        return new Response(
          JSON.stringify({
            error: lang === "zh" ? "AI 服务暂时不可用，请稍后再试" : "AI service is temporarily unavailable, please try again",
            details: (lastErrorText || "").slice(0, 500),
            upstreamStatus: lastStatus || apiResponse.status,
          }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const data = await apiResponse.json();
      const rawContent = data.choices?.[0]?.message?.content || "";

      if (!rawContent || !String(rawContent).trim()) {
        return new Response(
          JSON.stringify({
            error: lang === "zh" ? "AI 返回了空结果，请重试" : "AI returned an empty result, please retry",
            upstreamStatus: apiResponse.status,
          }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // 清理并解析
      const cleaned = cleanModelOutput(rawContent);

      let result;
      try {
        result = JSON.parse(cleaned);
      } catch {
        // JSON 解析失败，把整个清理后的内容作为优化结果
        result = {
          diagnosis: lang === "zh" ? "已优化" : "Optimized",
          optimized: cleaned,
          scores: { clarity: 0, specificity: 0, structure: 0 },
          tips: [],
        };
      }

      result = normalizeResult(result, lang);

      if (!result.optimized) {
        return new Response(
          JSON.stringify({
            error: lang === "zh" ? "AI 返回内容异常，请稍后重试" : "AI returned an invalid result, please try again",
          }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({
        ...result,
        _debug: {
          memory_applied: {
            voice_chars: typeof userVoiceProfile === "string" ? userVoiceProfile.length : 0,
            profile_active: Number(userProfile?.sample_count || 0) >= 3,
            examples_n: Array.isArray(topExamples) ? topExamples.length : 0,
            dislikes_n: Array.isArray(userDislikes) ? userDislikes.length : 0,
            facts_n: Array.isArray(userFacts) ? userFacts.length : 0,
          },
        },
      }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(
        JSON.stringify({ error: "服务异常，请稍后再试" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  },

  // ─── v20: Cron handler — 每周一 01:00 UTC (北京 09:00) 给所有订阅用户发洞察邮件 ─
  // wrangler.toml 必须有: [triggers] crons = ["0 1 * * 1"]
  // 必须配 SUPABASE_SERVICE_ROLE_KEY secret (cron 用,绕 RLS 拿订阅列表)
  async scheduled(event, env, ctx) {
    console.log("[cron] weekly insights triggered at", new Date().toISOString());

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.RESEND_API_KEY) {
      console.error("[cron] missing required env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY");
      return;
    }

    try {
      // 1. 用 service_role 拿所有订阅了 weekly insights 的用户
      const recipientsRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/weekly_insights_recipients?select=user_id,email,last_insights_sent_at`,
        {
          headers: {
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (!recipientsRes.ok) {
        console.error("[cron] failed to fetch recipients:", recipientsRes.status, await recipientsRes.text());
        return;
      }
      const recipients = await recipientsRes.json();
      console.log(`[cron] sending to ${recipients.length} subscribers`);

      let sent = 0;
      let failed = 0;

      for (const r of recipients) {
        try {
          // 2. 用 service_role 当 authToken 拿数据 (注意:这绕过 RLS,所以是 admin 视角)
          // 但 generateInsightsForUser 是按 user_id 严格过滤,不会泄漏其他用户数据
          const insights = await generateInsightsForUser(env, r.user_id, r.email, env.SUPABASE_SERVICE_ROLE_KEY);
          if (insights.error) {
            console.warn(`[cron] skip ${r.user_id}: ${insights.error}`);
            failed++;
            continue;
          }
          if (!insights.email) {
            console.warn(`[cron] skip ${r.user_id}: no email`);
            failed++;
            continue;
          }
          // 数据少的用户跳过 (不打扰 inactive 用户)
          if ((insights.summary?.total || 0) < 3) {
            console.log(`[cron] skip ${r.user_id}: only ${insights.summary?.total || 0} prompts this week`);
            continue;
          }

          // 3. 发邮件
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "prompt.ai <hi@prompt-ai.work>",
              to: [insights.email],
              subject: insights.subject,
              html: insights.html,
            }),
          });

          if (emailRes.ok) {
            sent++;
            // 4. 更新 last_insights_sent_at
            await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${r.user_id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({ last_insights_sent_at: new Date().toISOString() }),
            });
          } else {
            failed++;
            console.warn(`[cron] email send failed for ${r.user_id}: ${emailRes.status}`);
          }

          // 限速 — Resend free tier 10/sec,我们 1/sec 远低于上限
          await new Promise((res) => setTimeout(res, 1000));
        } catch (err) {
          failed++;
          console.error(`[cron] exception for ${r.user_id}:`, err?.message);
        }
      }

      console.log(`[cron] weekly insights done: sent=${sent}, failed=${failed}, total=${recipients.length}`);
    } catch (err) {
      console.error("[cron] fatal:", err);
    }
  },
};
