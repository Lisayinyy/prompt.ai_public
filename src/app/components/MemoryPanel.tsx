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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";

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
  lang?: "zh" | "en";
}

export function MemoryPanel({ open, onClose, user, onForceExtract, lang = "zh" }: MemoryPanelProps) {
  // v32-H / v33: worker base URL — 跟 Sidebar / ProjectsTab 保持一致
  const API_URL = "https://prompt-optimizer-api.prompt-optimizer.workers.dev";
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);
  const [voiceUpdatedAt, setVoiceUpdatedAt] = useState<string | null>(null);
  const [facts, setFacts] = useState<FactRow[]>([]);
  const [state, setState] = useState<ExtractionState | null>(null);
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ optimize: number; silent_capture: number; manual: number } | null>(null);
  // v33-α: 项目活跃 + 模板使用排行 (兑现 pitch 承诺)
  const [topProjects, setTopProjects] = useState<Array<{ id: string; name: string; color: string | null; prompt_count: number; last_activity: string | null }>>([]);
  const [topTemplates, setTopTemplates] = useState<Array<{ id: string; name: string; use_count: number; variables: string[] }>>([]);
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
  // v32-E: 9:16 竖版故事图状态
  const [downloadingStoryPng, setDownloadingStoryPng] = useState<boolean>(false);
  const storyCardRef = useRef<HTMLDivElement>(null);
  // v22: 数据导出 + 删除账号状态
  const [exporting, setExporting] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [deleting, setDeleting] = useState<boolean>(false);
  const [dataToast, setDataToast] = useState<string>("");
  // v33-η: 清除示例数据状态
  const [clearingDemo, setClearingDemo] = useState<boolean>(false);
  const [clearDemoToast, setClearDemoToast] = useState<string>("");

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

  // v32-E: 9:16 竖版故事图下载 — 适合社媒 (小红书/IG/朋友圈)
  const handleDownloadStoryPng = async () => {
    if (!storyCardRef.current || downloadingStoryPng) return;
    setDownloadingStoryPng(true);
    try {
      const dataUrl = await toPng(storyCardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0a0418",
        cacheBust: true,
        width: 720,
        height: 1280,
      });
      const link = document.createElement("a");
      link.download = `prompt-ai-story-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[prompt.ai] story PNG download failed:", e);
    } finally {
      setDownloadingStoryPng(false);
    }
  };

  // v22: 一键导出全部用户数据为 JSON
  const handleExportData = async () => {
    if (!user || exporting) return;
    setExporting(true);
    setDataToast("");
    try {
      const [promptsRes, factsRes, voiceRes, profileRes] = await Promise.all([
        supabase.from("prompts").select("*").eq("user_id", user.id),
        supabase.from("user_facts").select("*").eq("user_id", user.id),
        supabase.from("user_voice_profiles").select("*").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id),
      ]);

      const exportData = {
        meta: {
          exported_at: new Date().toISOString(),
          exported_by: "prompt.ai memory panel v22",
          user_id: user.id,
          user_email: user.email,
          schema_version: "v20260506",
        },
        profile: profileRes.data?.[0] || null,
        prompts: promptsRes.data || [],
        user_facts: factsRes.data || [],
        user_voice_profile: voiceRes.data?.[0] || null,
        counts: {
          prompts: promptsRes.data?.length || 0,
          facts: factsRes.data?.length || 0,
          has_voice_profile: !!voiceRes.data?.[0],
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `prompt-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDataToast(`✓ 已导出 ${exportData.counts.prompts} prompts + ${exportData.counts.facts} facts`);
    } catch (e) {
      setDataToast(`✗ 导出失败: ${(e as Error)?.message || "未知错误"}`);
    } finally {
      setExporting(false);
      setTimeout(() => setDataToast(""), 5000);
    }
  };

  // v33-η: 清除示例数据 (clear_demo_data RPC)
  const handleClearDemo = async () => {
    if (!user || clearingDemo) return;
    if (typeof window !== "undefined" && !window.confirm(
      "确定清除所有示例数据? 这会删除:\n- source='demo' 的全部 prompts\n- 名称以「示例」开头的项目和模板"
    )) return;
    setClearingDemo(true);
    setClearDemoToast("");
    try {
      const { data, error } = await supabase.rpc("clear_demo_data");
      if (error) throw error;
      const r = (data || {}) as { ok?: boolean; prompts_deleted?: number; projects_deleted?: number; templates_deleted?: number; error?: string };
      if (r.error) throw new Error(r.error);
      const total = (r.prompts_deleted || 0) + (r.projects_deleted || 0) + (r.templates_deleted || 0);
      if (total === 0) {
        setClearDemoToast("ℹ 当前账号没有示例数据");
      } else {
        setClearDemoToast(`✓ 已清除 ${r.prompts_deleted}p / ${r.projects_deleted} 项目 / ${r.templates_deleted} 模板`);
        await loadAll();
      }
    } catch (e) {
      setClearDemoToast(`✗ 清除失败: ${(e as Error)?.message || "未知错误"}`);
    } finally {
      setClearingDemo(false);
      setTimeout(() => setClearDemoToast(""), 5000);
    }
  };

  // v22: 删除账号 (永久,GDPR-ready)
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || deleting) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error("No active session");

      const res = await fetch(`${API_URL}/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
      });
      const data = await res.json();
      if (!data?.deleted) {
        setDataToast(`✗ ${data?.error || "删除失败,请重试"}`);
        setDeleting(false);
        return;
      }
      // 删除成功 → 强制登出 → 关闭 modal → reload
      await supabase.auth.signOut();
      setDeleteConfirmOpen(false);
      onClose();
      // 用 setTimeout 让 onClose 先生效再 reload
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 300);
    } catch (e) {
      setDataToast(`✗ ${(e as Error)?.message || "网络错误"}`);
      setDeleting(false);
    }
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");
    try {
      // 5 路并行: voice / facts / extraction state / source breakdown / platform breakdown
      // v33-α: +2 路 — top projects + top templates
      // v34: 用 allSettled, 任意一路失败不再让整个 dashboard 卡死
      const settled = await Promise.allSettled([
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
        supabase.rpc("list_user_projects", { p_user_id: user.id }),
        supabase.rpc("list_user_templates", { p_user_id: user.id }),
      ]);
      const pickData = (idx: number) => settled[idx].status === "fulfilled"
        ? (settled[idx] as PromiseFulfilledResult<any>).value
        : { data: null, error: (settled[idx] as PromiseRejectedResult).reason };
      const [voiceRes, factsRes, stateRes, sourceRes, platformRes, projectsRes, templatesRes] =
        [0, 1, 2, 3, 4, 5, 6].map(pickData);

      const v = (voiceRes.data as any)?.voice_profile;
      setVoiceProfile(typeof v === "string" && v.trim() ? v : null);
      setVoiceUpdatedAt((voiceRes.data as any)?.synthesized_at || null);
      setFacts(Array.isArray(factsRes.data) ? (factsRes.data as any) : []);
      setState((stateRes.data as any) || null);
      setSourceBreakdown((sourceRes.data as any) || { optimize: 0, silent_capture: 0, manual: 0 });
      setPlatforms(Array.isArray(platformRes.data) ? (platformRes.data as any) : []);
      // v33-α: 取前 5 项目 (按 last_activity desc) + 前 5 模板 (按 use_count desc)
      const projects = Array.isArray(projectsRes.data) ? (projectsRes.data as any[]) : [];
      setTopProjects(
        projects
          .filter(p => (p.prompt_count || 0) > 0)
          .sort((a, b) => {
            const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
            const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
            return tb - ta;
          })
          .slice(0, 5)
          .map(p => ({ id: p.id, name: p.name, color: p.color, prompt_count: p.prompt_count, last_activity: p.last_activity }))
      );
      const templates = Array.isArray(templatesRes.data) ? (templatesRes.data as any[]) : [];
      setTopTemplates(
        templates
          .filter(t => (t.use_count || 0) > 0)
          .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
          .slice(0, 5)
          .map(t => ({ id: t.id, name: t.name, use_count: t.use_count, variables: t.variables || [] }))
      );
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
        {/* v22: 删除账号二次确认 modal (放在 Dialog 内部不影响其他逻辑) */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">⚠️ 永久删除账号</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">此操作将<b>永久</b>删除你的:</span>
                <span className="block ml-2 text-zinc-700 text-sm">
                  • 所有 prompts 历史<br/>
                  • 所有提取的偏好 facts<br/>
                  • voice profile<br/>
                  • profile 个人资料<br/>
                  • 登录账号本身
                </span>
                <span className="block text-red-600 font-semibold">此操作不可撤销,数据无法恢复。</span>
                <span className="block">如果只是想暂时离开,直接登出即可。要确认永久删除,请在下方输入 <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-red-600">DELETE</code>:</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="输入 DELETE 确认"
              className="font-mono"
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? "删除中..." : "永久删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── HEADER ──────────────────────────────────────── */}
        <DialogHeader className={`px-5 pt-5 pb-3 border-b border-zinc-100 ${shareMode ? "hidden" : ""}`}>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>🧠</span>
            <span>{lang === "zh" ? "我的 AI 记忆" : "My AI Memory"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            prompt.ai {lang === "zh" ? "在 22 个 AI 平台学到的你 — 跨平台、可控、属于你" : "knows you across 22 AI platforms — cross-platform, transparent, owned by you"}
          </DialogDescription>
        </DialogHeader>

        {/* v17: Share Mode 顶部品牌头 (替代普通 header) — 包在 ref 里供 PNG 截图 */}
        <div ref={shareCardRef} className="bg-white">
          {shareMode && (
            <div className="px-5 pt-5 pb-3 text-center bg-gradient-to-b from-[#faf7ff] to-white">
              <div className="text-[11px] text-zinc-500 mb-1">{lang === "zh" ? "我的 AI 记忆 · powered by" : "My AI Memory · powered by"}</div>
              <div className="font-bold text-lg" style={{ fontFamily: "Georgia, serif" }}>
                prompt<span className="text-[#7c3aed]">.</span>ai
              </div>
            </div>
          )}

        {!user ? (
          <div className="py-12 text-center text-sm text-zinc-500 px-5">
            {lang === "zh" ? "请先登录查看你的 AI 记忆" : "Sign in to view your AI memory"}
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-sm text-zinc-500 px-5">{lang === "zh" ? "加载中..." : "Loading..."}</div>
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
                  <span>{lang === "zh" ? "你的 AI 声音指纹" : "Your AI Voice Fingerprint"}</span>
                  {voiceUpdatedAt && (
                    <span className="ml-auto text-[10px] opacity-70">
                      {formatTime(voiceUpdatedAt)} {lang === "zh" ? "更新" : "updated"}
                    </span>
                  )}
                </div>
                <p
                  className="text-[13.5px] leading-relaxed font-light min-h-[80px]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {voiceProfile ?? (
                    <span className="opacity-70 italic">
                      {lang === "zh"
                        ? "还没生成声音指纹。多用几次 prompt.ai 自动学习,或点下方「重新生成」立即开始。"
                        : "No voice fingerprint yet. Use prompt.ai a few more times to auto-learn, or click \"Regenerate\" below to start now."}
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
                    <span className="opacity-70">{lang === "zh" ? "偏好" : "facts"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">📡</span>
                    <span className="font-semibold">{sourceBreakdown?.silent_capture ?? 0}</span>
                    <span className="opacity-70">{lang === "zh" ? "跨平台" : "captures"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-70">🌍</span>
                    <span className="font-semibold">{platforms.length}</span>
                    <span className="opacity-70">{lang === "zh" ? "平台" : "platforms"}</span>
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
                  <span>🌍</span> <span>{lang === "zh" ? "跨平台使用全景" : "Cross-Platform Usage"}</span>
                </h3>
                <span className="text-[10px] text-zinc-400">{lang === "zh" ? "最近 90 天" : "Last 90 days"}</span>
              </div>
              {platforms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-400 text-center">
                  {lang === "zh"
                    ? "还没有平台数据 — 在 ChatGPT/Claude/Kimi 等任一平台发条 prompt 试试"
                    : "No platform data yet — send a prompt on ChatGPT/Claude/Kimi or any AI platform"}
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
                            {p.count} {lang === "zh" ? "条" : ""}
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
                  <span>📌</span> <span>{lang === "zh" ? "偏好画像" : "Preference Profile"}</span>
                  <span className="text-zinc-400 font-normal">({facts.length})</span>
                </h3>
              </div>
              {facts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-400 text-center">
                  {lang === "zh"
                    ? "暂无偏好 — 累计 10 条 prompt 后系统会自动抽取"
                    : "No facts yet — system auto-extracts after 10 prompts"}
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
                                aria-label={lang === "zh" ? "删除此偏好" : "Delete this fact"}
                                title={lang === "zh" ? "删除此偏好" : "Delete this fact"}
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

            {/* v33-α: 📁 项目活跃度 + 📚 模板使用 Top 5 (兑现 pitch 承诺) */}
            {(topProjects.length > 0 || topTemplates.length > 0) && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.12 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {/* 项目活跃度 */}
                {topProjects.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[12.5px] font-semibold text-zinc-900 flex items-center gap-1.5">
                        <span>📁</span> <span>{lang === "zh" ? "项目活跃度" : "Active Projects"}</span>
                      </h3>
                      <span className="text-[10px] text-zinc-400">{lang === "zh" ? "最近活动" : "Recent activity"}</span>
                    </div>
                    <div className="space-y-1.5">
                      {topProjects.map((p, idx) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-50 transition-colors"
                        >
                          <span className="text-[10.5px] text-zinc-400 tabular-nums w-4 text-right">{idx + 1}</span>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: p.color || "#7c3aed" }}
                          />
                          <span className="flex-1 text-[12px] text-zinc-700 truncate">{p.name}</span>
                          <span className="text-[10.5px] text-zinc-400 tabular-nums">{p.prompt_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 模板使用 Top 5 */}
                {topTemplates.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[12.5px] font-semibold text-zinc-900 flex items-center gap-1.5">
                        <span>📚</span> <span>{lang === "zh" ? "模板 Top 5" : "Top 5 Templates"}</span>
                      </h3>
                      <span className="text-[10px] text-zinc-400">{lang === "zh" ? "按使用次数" : "By usage count"}</span>
                    </div>
                    <div className="space-y-1.5">
                      {topTemplates.map((t, idx) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#faf7ff] transition-colors"
                        >
                          <span className="text-[10.5px] text-zinc-400 tabular-nums w-4 text-right">{idx + 1}</span>
                          <span className="text-[12px] text-zinc-700 flex-1 truncate" title={t.name}>
                            {t.name}
                          </span>
                          {t.variables.length > 0 && (
                            <span className="text-[9.5px] text-[#5d3eb8] bg-[#faf7ff] border border-[#e0d3f9] px-1 rounded">
                              {t.variables.length} var
                            </span>
                          )}
                          <span className="text-[10.5px] text-zinc-400 tabular-nums">×{t.use_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* ─── ⚙️ 设置 ───────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className={`rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2.5 ${shareMode ? "hidden" : ""}`}
            >
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                <span>⚙️</span> <span>{lang === "zh" ? "设置" : "Settings"}</span>
              </h3>

              {/* 跨平台监听 toggle */}
              <div className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 border border-zinc-200">
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
                    <span>📡</span> {lang === "zh" ? "跨平台监听" : "Cross-Platform Capture"}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    {captureEnabled
                      ? (lang === "zh" ? `已开启 · 在所有 AI 平台自动学习你的偏好` : "Enabled · auto-learning your preferences across all AI platforms")
                      : (lang === "zh" ? "已关闭 · 仅 prompt.ai 主动优化的会被记录" : "Disabled · only ✨ Optimize actions are recorded")}
                  </p>
                </div>
                <Switch
                  checked={captureEnabled}
                  onCheckedChange={handleToggleCapture}
                  aria-label={lang === "zh" ? "跨平台监听开关" : "Cross-platform capture toggle"}
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
                {refreshing
                  ? (lang === "zh" ? "🪄 生成中..." : "🪄 Generating...")
                  : (lang === "zh" ? "🪄 重新生成画像 (跳过 10 条阈值)" : "🪄 Regenerate Profile (skip 10-prompt threshold)")}
              </Button>

              {/* v20: AI Weekly Insights 订阅 */}
              <div className="rounded-md bg-white px-3 py-2 border border-zinc-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
                      <span>📨</span> {lang === "zh" ? "每周 AI 洞察邮件" : "Weekly AI Insights Email"}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      {insightsEnabled
                        ? (lang === "zh" ? `每周一早上发到 ${insightsEmail || "你的邮箱"}` : `Every Monday morning to ${insightsEmail || "your email"}`)
                        : (lang === "zh" ? "订阅后每周一收到「你的 AI 使用画像」" : "Subscribe to get \"Your AI Usage Profile\" every Monday")}
                    </p>
                    {insightsLastSent && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {lang === "zh" ? "上次发送" : "Last sent"}: {new Date(insightsLastSent).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={insightsEnabled}
                    onCheckedChange={handleToggleInsights}
                    aria-label={lang === "zh" ? "周报订阅开关" : "Weekly insights toggle"}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendingInsights}
                  onClick={handleSendInsightsNow}
                  className="w-full text-xs h-7 border-[#e0d3f9] hover:bg-[#faf7ff]"
                >
                  {sendingInsights
                    ? (lang === "zh" ? "🚀 发送中..." : "🚀 Sending...")
                    : (lang === "zh" ? "🚀 立即发送一次预览到邮箱" : "🚀 Send a preview to your email now")}
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
                {lang === "zh" ? "📸 进入截图分享模式" : "📸 Enter share-card mode"}
              </Button>

              {/* v22: 数据管理 (导出 + 删除) */}
              <div className="rounded-md bg-white px-3 py-2 border border-zinc-200 space-y-2">
                <div className="text-[13px] font-medium text-zinc-900 flex items-center gap-1.5">
                  <span>🗂️</span> {lang === "zh" ? "数据管理" : "Data Management"}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {lang === "zh"
                    ? "你的数据完全属于你 — 可一键导出 / 永久删除"
                    : "Your data belongs to you — export anytime / delete permanently"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting}
                    onClick={handleExportData}
                    className="flex-1 text-xs h-7"
                  >
                    {exporting
                      ? (lang === "zh" ? "📦 导出中..." : "📦 Exporting...")
                      : (lang === "zh" ? "📦 导出全部数据 (JSON)" : "📦 Export All Data (JSON)")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDeleteConfirmText(""); setDeleteConfirmOpen(true); }}
                    className="text-xs h-7 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {lang === "zh" ? "🗑️ 删除账号" : "🗑️ Delete Account"}
                  </Button>
                </div>
                {/* v33-η: 清除示例数据 */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearingDemo}
                    onClick={handleClearDemo}
                    className="flex-1 text-xs h-7 border-amber-200 text-amber-700 hover:bg-amber-50"
                    title={lang === "zh" ? "只删 source='demo' 的 prompts + 名称以「示例」开头的项目/模板,不影响你自己的内容" : "Only deletes source='demo' prompts + projects/templates starting with \"示例\", your own data is untouched"}
                  >
                    {clearingDemo
                      ? (lang === "zh" ? "🗑️ 清除中..." : "🗑️ Clearing...")
                      : (lang === "zh" ? "🗑️ 清除示例数据" : "🗑️ Clear Demo Data")}
                  </Button>
                </div>
                {clearDemoToast && (
                  <div className={`text-[11px] text-center ${clearDemoToast.startsWith("✓") ? "text-green-600" : clearDemoToast.startsWith("ℹ") ? "text-zinc-500" : "text-red-500"}`}>
                    {clearDemoToast}
                  </div>
                )}
                {dataToast && (
                  <div className={`text-[11px] text-center ${dataToast.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                    {dataToast}
                  </div>
                )}
              </div>
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

        {/* v32-E: 9:16 竖版故事图 — offscreen,只供 toPng 截图 */}
        <div
          ref={storyCardRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-99999px",
            top: 0,
            width: "720px",
            height: "1280px",
            background: "linear-gradient(160deg, #0a0418 0%, #2a0e5a 35%, #5d3eb8 75%, #a78bfa 100%)",
            color: "#fff",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif",
            padding: "60px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {/* 装饰光斑 */}
          <div style={{ position: "absolute", top: "-120px", right: "-160px", width: "420px", height: "420px", borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.45), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-180px", left: "-100px", width: "380px", height: "380px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)", pointerEvents: "none" }} />

          {/* HEADER */}
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: "20px", fontWeight: 600, opacity: 0.7, letterSpacing: "1px" }}>
              prompt<span style={{ color: "#fbbf24" }}>.</span>ai
            </div>
            <div style={{ marginTop: "12px", fontSize: "44px", fontWeight: 800, lineHeight: 1.15 }}>
              我和 AI<br/>一起工作了
            </div>
            <div style={{ marginTop: "18px", display: "flex", alignItems: "baseline", gap: "12px" }}>
              <span style={{ fontSize: "108px", fontWeight: 900, lineHeight: 1, letterSpacing: "-3px", color: "#fbbf24" }}>
                {state?.total_prompts ?? 0}
              </span>
              <span style={{ fontSize: "32px", fontWeight: 600, opacity: 0.85 }}>条 prompt</span>
            </div>
            <div style={{ marginTop: "8px", fontSize: "18px", opacity: 0.65 }}>
              横跨 {platforms.length} 个 AI 平台 · 沉淀 {state?.facts_count ?? 0} 条偏好
            </div>
          </div>

          {/* MIDDLE — voice profile */}
          <div style={{ position: "relative", margin: "32px 0" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, opacity: 0.65, letterSpacing: "1.5px", marginBottom: "12px" }}>
              ✨ MY AI VOICE
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "24px 26px",
                fontSize: "20px",
                lineHeight: 1.55,
                fontStyle: "italic",
                fontWeight: 400,
                fontFamily: "Georgia, serif",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
              }}
            >
              {voiceProfile
                ? (voiceProfile.length > 165 ? voiceProfile.slice(0, 162) + "…" : voiceProfile)
                : "继续用 prompt.ai,系统会自动学习你的声音指纹"}
            </div>
          </div>

          {/* BOTTOM — top platforms + 水印 */}
          <div style={{ position: "relative" }}>
            {platforms.length > 0 && (
              <>
                <div style={{ fontSize: "14px", fontWeight: 600, opacity: 0.65, letterSpacing: "1.5px", marginBottom: "12px" }}>
                  🌍 TOP PLATFORMS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "26px" }}>
                  {platforms.slice(0, 4).map((p) => {
                    const display = getPlatformDisplay(p.platform);
                    return (
                      <div
                        key={p.platform}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          background: "rgba(255,255,255,0.08)",
                          borderRadius: "12px",
                          padding: "10px 16px",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <span style={{ fontSize: "24px", marginRight: "12px" }}>{display.emoji}</span>
                        <span style={{ fontSize: "18px", fontWeight: 600, flex: 1 }}>{display.name}</span>
                        <span style={{ fontSize: "16px", fontWeight: 700, opacity: 0.9 }}>{p.count} 条</span>
                        <span style={{ fontSize: "14px", marginLeft: "12px", opacity: 0.6, minWidth: "44px", textAlign: "right" }}>{p.percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {/* 底部品牌 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", opacity: 0.55, letterSpacing: "1px" }}>POWERED BY</div>
                <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>
                  prompt<span style={{ color: "#fbbf24" }}>.</span>ai
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", opacity: 0.55 }}>跨 22 平台 AI 第二大脑</div>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px", color: "#fbbf24" }}>prompt-ai.work</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 px-5 py-3 bg-zinc-50/50">
          {shareMode ? (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadPng}
                disabled={downloadingPng || downloadingStoryPng}
                className="flex-1 text-xs h-8"
              >
                {downloadingPng
                  ? (lang === "zh" ? "⏳ 生成中..." : "⏳ Generating...")
                  : (lang === "zh" ? "📥 横版" : "📥 Landscape")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadStoryPng}
                disabled={downloadingPng || downloadingStoryPng}
                className="flex-1 text-xs h-8 bg-[#5d3eb8] hover:bg-[#7c3aed]"
              >
                {downloadingStoryPng
                  ? (lang === "zh" ? "⏳ 生成中..." : "⏳ Generating...")
                  : (lang === "zh" ? "📱 9:16 故事图" : "📱 9:16 Story")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareMode(false)}
                className="text-xs h-8 px-3"
              >
                {lang === "zh" ? "← 退出" : "← Exit"}
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" onClick={onClose} className="w-full text-xs h-8">
              {lang === "zh" ? "关闭" : "Close"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
