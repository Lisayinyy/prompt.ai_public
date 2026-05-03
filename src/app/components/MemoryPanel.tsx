// ============================================================
// MemoryPanel.tsx — v14 (Dashboard 视觉化升级)
// 把单调文本面板升级成评委 5 秒被打动的产品级 Dashboard
//
// 视觉结构:
//   ✨ HERO 渐变身份卡 (voice profile + 关键 stats inline)
//   🌍 跨平台使用全景 (横向 bar heatmap, 22 平台)
//   📌 偏好画像 (按 task_type 分类的 chips)
//   ⚙️ 设置 (toggle + 重新生成 + 监听捕获 mini-card)
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { toPng } from "html-to-image";
import { supabase } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

// ─── 平台显示配置: code → {显示名, emoji, 主题色} ───────────
const PLATFORM_DISPLAY: Record<string, { name: string; emoji: string; color: string }> = {
  chatgpt:        { name: "ChatGPT",     emoji: "💚", color: "#10a37f" },
  claude:         { name: "Claude",      emoji: "🧡", color: "#cc785c" },
  gemini:         { name: "Gemini",      emoji: "💎", color: "#4285f4" },
  kimi:           { name: "Kimi",        emoji: "🌙", color: "#1a1a1a" },
  doubao:         { name: "豆包",        emoji: "🫘", color: "#3a72ee" },
  deepseek:       { name: "DeepSeek",    emoji: "🐋", color: "#4d6bfe" },
  hailuo:         { name: "海螺",        emoji: "🐚", color: "#ff7857" },
  tongyi:         { name: "通义",        emoji: "💜", color: "#615ced" },
  yiyan:          { name: "文心",        emoji: "📝", color: "#3370ff" },
  chatglm:        { name: "智谱",        emoji: "🔮", color: "#5b8def" },
  mistral:        { name: "Mistral",     emoji: "🌀", color: "#fa520f" },
  perplexity:     { name: "Perplexity",  emoji: "🔍", color: "#20808d" },
  grok:           { name: "Grok",        emoji: "🦔", color: "#000000" },
  copilot:        { name: "Copilot",     emoji: "🤖", color: "#0078d4" },
  "minimax-agent":{ name: "MiniMax",     emoji: "🧠", color: "#7c3aed" },
  zai:            { name: "Z.AI",        emoji: "⚡", color: "#0ea5e9" },
  qwen:           { name: "通义千问",    emoji: "🌟", color: "#a855f7" },
  genspark:       { name: "Genspark",    emoji: "✨", color: "#f59e0b" },
};

function getPlatformDisplay(code: string) {
  return PLATFORM_DISPLAY[code] || { name: code, emoji: "🌐", color: "#71717a" };
}

interface ExtractionState {
  total_prompts: number;
  facts_count: number;
  last_extraction_at: string | null;
  prompts_since_last: number;
}

interface PlatformRow {
  platform: string;
  count: number;
  last_used_at: string;
  percentage: number;
}

interface FactRow {
  id: string;
  fact: string;
  confidence: number;
  task_type: string | null;
  extracted_at: string;
}

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onForceExtract: () => Promise<void>;
}

export function MemoryPanel({ open, onClose, user, onForceExtract }: MemoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);
  const [voiceUpdatedAt, setVoiceUpdatedAt] = useState<string | null>(null);
  const [facts, setFacts] = useState<FactRow[]>([]);
  const [state, setState] = useState<ExtractionState | null>(null);
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ optimize: number; silent_capture: number; manual: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [captureEnabled, setCaptureEnabled] = useState<boolean>(true);
  const [shareMode, setShareMode] = useState<boolean>(false); // v17: 截图分享模式
  // v20: weekly insights 订阅状态
  const [insightsEnabled, setInsightsEnabled] = useState<boolean>(false);
  const [insightsLastSent, setInsightsLastSent] = useState<string | null>(null);
  const [insightsEmail, setInsightsEmail] = useState<string | null>(null);
  const [sendingInsights, setSendingInsights] = useState<boolean>(false);
  const [insightsToast, setInsightsToast] = useState<string>("");
  // v21: PNG 分享卡下载状态
  const [downloadingPng, setDownloadingPng] = useState<boolean>(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // chrome.storage 同步 captureEnabled
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome?.storage?.local) return;
    chrome.storage.local.get(["promptai_capture_enabled"], (res) => {
      setCaptureEnabled(res.promptai_capture_enabled !== false);
    });
  }, [open]);

  const handleToggleCapture = (next: boolean) => {
    setCaptureEnabled(next);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ promptai_capture_enabled: next });
    }
  };

  // v20: 加载 weekly insights 订阅状态
  useEffect(() => {
    if (!open || !user) return;
    supabase.rpc("get_weekly_insights_status").then(({ data }) => {
      const d = data as any;
      setInsightsEnabled(d?.enabled === true);
      setInsightsLastSent(d?.last_sent_at || null);
      setInsightsEmail(d?.email || user.email || null);
    });
  }, [open, user]);

  const handleToggleInsights = async (next: boolean) => {
    setInsightsEnabled(next); // optimistic
    try {
      await supabase.rpc("set_weekly_insights_enabled", { p_enabled: next });
    } catch {
      setInsightsEnabled(!next);
    }
  };

  const handleSendInsightsNow = async () => {
    if (!user || sendingInsights) return;
    setSendingInsights(true);
    setInsightsToast("");
    try {
      // 拿当前 session JWT
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error("No active session");

      const res = await fetch(`${API_URL}/send-insights-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data?.sent) {
        setInsightsToast(`✓ 已发送到 ${data.email}`);
        setInsightsLastSent(new Date().toISOString());
      } else {
        setInsightsToast(`✗ ${data?.error || "发送失败"}`);
      }
    } catch (e) {
      setInsightsToast(`✗ ${(e as Error)?.message || "网络错误"}`);
    } finally {
      setSendingInsights(false);
      setTimeout(() => setInsightsToast(""), 4000);
    }
  };

  // v21: 一键下载 PNG 分享卡
  const handleDownloadPng = async () => {
    if (!shareCardRef.current || downloadingPng) return;
    setDownloadingPng(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 2,        // 2x 高清
        backgroundColor: "#ffffff",
        cacheBust: true,
        // 跳过会被 share mode 隐藏的元素 (DialogHeader / Footer / 设置区都通过 className=hidden 隐藏)
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = node.className || "";
            if (typeof cls === "string" && cls.includes("hidden")) return false;
          }
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `prompt-ai-memory-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[prompt.ai] PNG download failed:", e);
    } finally {
      setDownloadingPng(false);
    }
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");
    try {
      // 5 路并行: voice / facts / extraction state / source breakdown / platform breakdown
      const [voiceRes, factsRes, stateRes, sourceRes, platformRes] = await Promise.all([
        supabase.rpc("get_user_voice_profile", { p_user_id: user.id }),
        supabase
          .from("user_facts")
          .select("id, fact, confidence, task_type, extracted_at")
          .eq("user_id", user.id)
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .order("extracted_at", { ascending: false })
          .limit(20),
        supabase.rpc("get_extraction_state", { p_user_id: user.id }),
        supabase.rpc("get_prompt_source_breakdown", { p_user_id: user.id }),
        supabase.rpc("get_user_platform_breakdown", { p_user_id: user.id, p_days: 90 }),
      ]);

      const v = (voiceRes.data as any)?.voice_profile;
      setVoiceProfile(typeof v === "string" && v.trim() ? v : null);
      setVoiceUpdatedAt((voiceRes.data as any)?.synthesized_at || null);
      setFacts(Array.isArray(factsRes.data) ? (factsRes.data as any) : []);
      setState((stateRes.data as any) || null);
      setSourceBreakdown((sourceRes.data as any) || { optimize: 0, silent_capture: 0, manual: 0 });
      setPlatforms(Array.isArray(platformRes.data) ? (platformRes.data as any) : []);
    } catch (e) {
      setErrorMsg((e as Error)?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  const handleDeleteFact = async (factId: string) => {
    if (!user) return;
    setFacts(prev => prev.filter(f => f.id !== factId));
    try {
      await supabase.rpc("delete_user_fact", { p_fact_id: factId });
    } catch {
      await loadAll();
    }
  };

  const handleForceRegenerate = async () => {
    setRefreshing(true);
    setErrorMsg("");
    try {
      await onForceExtract();
      await new Promise(r => setTimeout(r, 1500));
      await loadAll();
    } catch (e) {
      setErrorMsg((e as Error)?.message || "重新生成失败");
    } finally {
      setRefreshing(false);
    }
  };

  // ─── 工具: facts 按 task_type 分组 ─────────────────────────
  const factsByTask = useMemo(() => {
    const groups: Record<string, FactRow[]> = {};
    for (const f of facts) {
      const key = f.task_type || "全局";
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    // 全局放最前,其他按 facts 数量倒序
    const entries = Object.entries(groups);
    entries.sort(([a, _aFacts], [b, _bFacts]) => {
      if (a === "全局") return -1;
      if (b === "全局") return 1;
      return _bFacts.length - _aFacts.length;
    });
    return entries;
  }, [facts]);

  // ─── 工具: confidence 分级 ────────────────────────────────
  const getConfTone = (c: number) => {
    if (c >= 0.85) return { bg: "#5d3eb8", text: "#fff", label: "高" };
    if (c >= 0.7)  return { bg: "#a78bfa", text: "#fff", label: "中" };
    return { bg: "#e9d5ff", text: "#5d3eb8", label: "低" };
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小时前`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} 天前`;
    return d.toLocaleDateString("zh-CN");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setShareMode(false); onClose(); } }}>
      <DialogContent className="max-w-[680px] max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* ─── HEADER ──────────────────────────────────────── */}
        <DialogHeader className={`px-5 pt-5 pb-3 border-b border-zinc-100 ${shareMode ? "hidden" : ""}`}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>🧠</span>
            <span>我的 AI 记忆</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            prompt.ai 在 22 个 AI 平台学到的你 — 跨平台、可控、属于你
          </DialogDescription>
        </DialogHeader>

        {/* v17: Share Mode 顶部品牌头 (替代普通 header) — 包在 ref 里供 PNG 截图 */}
        <div ref={shareCardRef} className="bg-white">
          {shareMode && (
            <div className="px-5 pt-5 pb-3 text-center bg-gradient-to-b from-[#faf7ff] to-white">
              <div className="text-[11px] text-zinc-500 mb-1">我的 AI 记忆 · powered by</div>
              <div className="font-bold text-lg" style={{ fontFamily: "Georgia, serif" }}>
                prompt<span className="text-[#7c3aed]">.</span>ai
              </div>
            </div>
          )}

        {!user ? (
          <div className="py-12 text-center text-sm text-zinc-500 px-5">
            请先登录查看你的 AI 记忆
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-sm text-zinc-500 px-5">加载中...</div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            {errorMsg && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </div>
            )}

            {/* ─── ✨ HERO 身份卡 ──────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="relative overflow-hidden rounded-2xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, #5d3eb8 0%, #7c3aed 50%, #a78bfa 100%)",
              }}
            >
              {/* 背景装饰 */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/5 blur-3xl pointer-events-none" />

              <div className="relative p-5 text-white">
                <div className="flex items-center gap-2 mb-2 text-xs opacity-80">
                  <span>✨</span>
                  <span>你的 AI 声音指纹</span>
                  {voiceUpdatedAt && (
                    <span className="ml-auto text-[10px] opacity-70">
                      {formatTime(voiceUpdatedAt)} 更新
                    </span>
                  )}
                </div>
                <p
                  className="text-[13.5px] leading-relaxed font-light min-h-[80px]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {voiceProfile ?? (
                    <span className="opacity-70 italic">
                      还没生成声音指纹。多用几次 prompt.ai 自动学习,或点下方「重新生成」立即开始。
                    </span>
                  )}
                </p>

                {/* 关键 stats inline */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">📊</span>
                    <span className="font-semibold">{state?.total_prompts ?? 0}</span>
                    <span className="opacity-70">prompt</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">📌</span>
                    <span className="font-semibold">{state?.facts_count ?? 0}</span>
                    <span className="opacity-70">偏好</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">📡</span>
                    <span className="font-semibold">{sourceBreakdown?.silent_capture ?? 0}</span>
                    <span className="opacity-70">跨平台</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">🌍</span>
                    <span className="font-semibold">{platforms.length}</span>
                    <span className="opacity-70">平台</span>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ─── 🌍 跨平台使用全景 ───────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <span>🌍</span> <span>跨平台使用全景</span>
                </h3>
                <span className="text-[10px] text-zinc-400">最近 90 天</span>
              </div>
              {platforms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-400 text-center">
                  还没有平台数据 — 在 ChatGPT/Claude/Kimi 等任一平台发条 prompt 试试
                </div>
              ) : (
                <div className="space-y-1.5">
                  {platforms.map((p, idx) => {
                    const display = getPlatformDisplay(p.platform);
                    return (
                      <motion.div
                        key={p.platform}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.05 * idx }}
                        className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                      >
                        {/* 背景填充 bar */}
                        <div
                          className="absolute inset-y-0 left-0 opacity-15 transition-opacity group-hover:opacity-25"
                          style={{
                            width: `${Math.max(p.percentage, 2)}%`,
                            background: display.color,
                          }}
                        />
                        <div className="relative px-3 py-2 flex items-center gap-2">
                          <span className="text-base">{display.emoji}</span>
                          <span className="text-sm font-medium text-zinc-900 flex-1">
                            {display.name}
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {p.count} 条
                          </span>
                          <span
                            className="text-xs font-semibold tabular-nums w-12 text-right"
                            style={{ color: display.color }}
                          >
                            {p.percentage}%
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>

            {/* ─── 📌 偏好画像 (按 task 分组) ──────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <span>📌</span> <span>偏好画像</span>
                  <span className="text-zinc-400 font-normal">({facts.length})</span>
                </h3>
              </div>
              {facts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-400 text-center">
                  暂无偏好 — 累计 10 条 prompt 后系统会自动抽取
                </div>
              ) : (
                <div className="space-y-2.5">
                  {factsByTask.map(([taskName, taskFacts]) => (
                    <div key={taskName}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">
                          {taskName}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          ({taskFacts.length})
                        </span>
                        <div className="flex-1 h-px bg-zinc-100" />
                      </div>
                      <div className="space-y-1">
                        {taskFacts.map((f) => {
                          const tone = getConfTone(f.confidence);
                          return (
                            <div
                              key={f.id}
                              className="flex items-start gap-2 group rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 hover:border-zinc-300 transition-colors"
                            >
                              <span
                                className="flex-shrink-0 inline-flex items-center justify-center text-[10px] font-bold rounded px-1.5 h-5 mt-0.5 tabular-nums"
                                style={{ background: tone.bg, color: tone.text }}
                                title={`置信度 ${(f.confidence * 100).toFixed(0)}%`}
                              >
                                {(f.confidence * 100).toFixed(0)}
                              </span>
                              <span className="flex-1 text-[13px] text-zinc-700 leading-snug">
                                {f.fact}
                              </span>
                              <button
                                onClick={() => handleDeleteFact(f.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 text-xs flex-shrink-0 px-1"
                                aria-label="删除此偏好"
                                title="删除此偏好"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* ─── ⚙️ 设置 ───────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className={`rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2.5 ${shareMode ? "hidden" : ""}`}
            >
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                <span>⚙️</span> <span>设置</span>
              </h3>

              {/* 跨平台监听 toggle */}
              <div className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 border border-zinc-200">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
                    <span>📡</span> 跨平台监听
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    {captureEnabled
                      ? `已开启 · 在所有 AI 平台自动学习你的偏好`
                      : "已关闭 · 仅 prompt.ai 主动优化的会被记录"}
                  </p>
                </div>
                <Switch
                  checked={captureEnabled}
                  onCheckedChange={handleToggleCapture}
                  aria-label="跨平台监听开关"
                />
              </div>

              {/* 重新生成按钮 */}
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={handleForceRegenerate}
                className="w-full text-xs h-8"
              >
                {refreshing ? "🪄 生成中..." : "🪄 重新生成画像 (跳过 10 条阈值)"}
              </Button>

              {/* v20: AI Weekly Insights 订阅 */}
              <div className="rounded-md bg-white px-3 py-2 border border-zinc-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
                      <span>📨</span> 每周 AI 洞察邮件
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      {insightsEnabled
                        ? `每周一早上发到 ${insightsEmail || "你的邮箱"}`
                        : "订阅后每周一收到「你的 AI 使用画像」"}
                    </p>
                    {insightsLastSent && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        上次发送: {new Date(insightsLastSent).toLocaleDateString("zh-CN")}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={insightsEnabled}
                    onCheckedChange={handleToggleInsights}
                    aria-label="周报订阅开关"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendingInsights}
                  onClick={handleSendInsightsNow}
                  className="w-full text-xs h-7 border-[#e0d3f9] hover:bg-[#faf7ff]"
                >
                  {sendingInsights ? "🚀 发送中..." : "🚀 立即发送一次预览到邮箱"}
                </Button>
                {insightsToast && (
                  <div className={`text-[11px] text-center ${insightsToast.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                    {insightsToast}
                  </div>
                )}
              </div>

              {/* v17: 分享按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareMode(true)}
                className="w-full text-xs h-8 border-[#e0d3f9] hover:bg-[#faf7ff]"
              >
                📸 进入截图分享模式
              </Button>
            </motion.section>

            {/* v17: Share Mode 水印 (在 share mode 下显示在内容底部) */}
            {shareMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center pt-2 pb-1 border-t border-dashed border-zinc-200"
              >
                <div className="text-[10px] text-zinc-400">
                  生成于 prompt.ai · 跨平台 AI 记忆中枢
                </div>
                <div className="text-[10px] text-[#7c3aed] mt-0.5 font-medium">
                  prompt-ai.work
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ─── FOOTER ─────────────────────────────────────── */}
        </div>
        <div className="border-t border-zinc-100 px-5 py-3 bg-zinc-50/50">
          {shareMode ? (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadPng}
                disabled={downloadingPng}
                className="flex-1 text-xs h-8"
              >
                {downloadingPng ? "⏳ 生成中..." : "📥 下载分享图"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareMode(false)}
                className="text-xs h-8 px-3"
              >
                ← 退出
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" onClick={onClose} className="w-full text-xs h-8">
              关闭
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
