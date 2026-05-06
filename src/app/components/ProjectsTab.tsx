// ============================================================
// ProjectsTab.tsx — v25 项目工作台
// 跨 22 个 AI 平台的 prompt 项目组织
// 核心战略: prompt.ai 是"你 AI 工作的第二大脑" — 项目是组织单位
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  prompt_count: number;
  last_activity: string | null;
  top_platforms: string[] | null;
}

interface ProjectPrompt {
  id: string;
  original_text: string;
  optimized_text: string | null;
  platform: string | null;
  task_type: string | null;
  source: string | null;
  created_at: string;
}

interface ProjectsTabProps {
  user: User | null;
  lang: "zh" | "en";
  onSendToTab?: (text: string) => Promise<"filled" | "copied" | "error">;
}

// 平台 emoji 映射 (复用 MemoryPanel 的逻辑)
const PLATFORM_EMOJI: Record<string, string> = {
  chatgpt: "💚", claude: "🧡", gemini: "💎", kimi: "🌙",
  doubao: "🫘", deepseek: "🐋", hailuo: "🐚", tongyi: "💜",
  yiyan: "📝", chatglm: "🔮", mistral: "🌀", perplexity: "🔍",
  grok: "🦔", copilot: "🤖", "minimax-agent": "🧠",
  zai: "⚡", qwen: "🌟", genspark: "✨",
};
const platformEmoji = (p: string) => PLATFORM_EMOJI[p] || "🌐";

const COLOR_PALETTE = [
  "#7c3aed", // 紫 (default)
  "#3b82f6", // 蓝
  "#10b981", // 绿
  "#f59e0b", // 橙
  "#ef4444", // 红
  "#8b5cf6", // 淡紫
  "#06b6d4", // 青
  "#ec4899", // 粉
];

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString("zh-CN");
}

export function ProjectsTab({ user, lang, onSendToTab }: ProjectsTabProps) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPrompts, setProjectPrompts] = useState<ProjectPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // 新建 modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  // 删除确认 modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // v29: 项目简报状态
  const [brief, setBrief] = useState<string | null>(null);
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefToast, setBriefToast] = useState("");
  // v32-C: 后台 brief 预生成 — 项目级缓存状态
  // ready=brief 已存在; generating=后台生成中; missing=没 brief 但有 prompts; empty=无 prompts 不生成; unknown=未检查
  const [briefStatus, setBriefStatus] = useState<Record<string, "ready" | "generating" | "missing" | "empty" | "unknown">>({});

  const API_URL = "https://prompt-optimizer-api.prompt-optimizer.workers.dev";

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrMsg("");
    try {
      const { data, error } = await supabase.rpc("list_user_projects", { p_user_id: user.id });
      if (error) throw error;
      const list = (data as Project[]) || [];
      setProjects(list);

      // v32-C: 后台扫描每个项目的 brief 状态,缺失的并行预生成 (最多 2 并发)
      list.forEach(p => {
        if (!briefStatus[p.id]) {
          setBriefStatus(prev => ({ ...prev, [p.id]: "unknown" }));
        }
      });
      void scanAndPregenerateBriefs(list);
    } catch (e) {
      setErrMsg((e as Error)?.message || "加载失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // v32-C: 扫描项目 brief 状态 + 并发预生成 (max 2)
  const scanAndPregenerateBriefs = useCallback(async (list: Project[]) => {
    if (!user || list.length === 0) return;
    // 1) 拉所有项目 meta (并行)
    const metas = await Promise.all(
      list.map(p =>
        supabase.rpc("get_project_meta", { p_project_id: p.id })
          .then(({ data }) => ({ id: p.id, meta: data as any, project: p }))
          .catch(() => ({ id: p.id, meta: null, project: p }))
      )
    );
    // 2) 根据 meta 给每个项目分类
    const newStatus: Record<string, "ready" | "missing" | "empty"> = {};
    const needsGen: { id: string; project: Project }[] = [];
    for (const { id, meta, project } of metas) {
      if (meta?.brief && typeof meta.brief === "string" && meta.brief.length > 10) {
        newStatus[id] = "ready";
      } else if (project.prompt_count > 0) {
        newStatus[id] = "missing";
        needsGen.push({ id, project });
      } else {
        newStatus[id] = "empty";
      }
    }
    setBriefStatus(prev => ({ ...prev, ...newStatus }));
    if (needsGen.length === 0) return;

    // 3) 限并发 2 跑 brief 生成
    const CONCURRENCY = 2;
    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (cursor < needsGen.length) {
        const idx = cursor++;
        const { id, project } = needsGen[idx];
        setBriefStatus(prev => ({ ...prev, [id]: "generating" }));
        try {
          // 拉前 20 条 prompts
          const { data: prompts } = await supabase.rpc("get_project_prompts", {
            p_project_id: id,
            p_limit: 20,
          });
          const ps = (prompts as ProjectPrompt[]) || [];
          if (ps.length === 0) {
            setBriefStatus(prev => ({ ...prev, [id]: "empty" }));
            continue;
          }
          const res = await fetch(`${API_URL}/synthesize-project-brief`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_name: project.name,
              project_description: project.description,
              prompts: ps.map(p => ({
                original_text: p.original_text,
                optimized_text: p.optimized_text,
                task_type: p.task_type,
                platform: p.platform,
              })),
            }),
          });
          const data = await res.json();
          if (data?.brief && typeof data.brief === "string") {
            await supabase.rpc("set_project_brief", {
              p_project_id: id,
              p_brief: data.brief,
            });
            setBriefStatus(prev => ({ ...prev, [id]: "ready" }));
          } else {
            setBriefStatus(prev => ({ ...prev, [id]: "missing" }));
          }
        } catch {
          setBriefStatus(prev => ({ ...prev, [id]: "missing" }));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, needsGen.length) }, () => runOne()));
  }, [user]);

  useEffect(() => {
    if (user && view === "list") loadProjects();
  }, [user, view, loadProjects]);

  const handleCreate = async () => {
    if (!user || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_project", {
        p_name: newName.trim(),
        p_description: newDescription.trim() || null,
        p_color: newColor,
      });
      if (error) throw error;
      setShowNewModal(false);
      setNewName("");
      setNewDescription("");
      setNewColor(COLOR_PALETTE[0]);
      await loadProjects();
    } catch (e) {
      setErrMsg((e as Error)?.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = async (project: Project) => {
    setSelectedProject(project);
    setView("detail");
    setLoading(true);
    setBrief(null);
    setBriefGeneratedAt(null);
    setBriefToast("");
    try {
      // 并行: 拉 prompts + 拉项目 meta (含 brief)
      const [{ data: prompts }, { data: meta }] = await Promise.all([
        supabase.rpc("get_project_prompts", { p_project_id: project.id, p_limit: 100 }),
        supabase.rpc("get_project_meta", { p_project_id: project.id }),
      ]);
      setProjectPrompts((prompts as ProjectPrompt[]) || []);
      const m = meta as any;
      if (m && m.brief) {
        setBrief(m.brief);
        setBriefGeneratedAt(m.brief_generated_at || null);
      }
    } catch (e) {
      setErrMsg((e as Error)?.message || "加载项目内容失败");
    } finally {
      setLoading(false);
    }
  };

  // v29: 生成 / 重新生成项目简报
  const handleGenerateBrief = async () => {
    if (!selectedProject || briefLoading) return;
    if (projectPrompts.length === 0) {
      setBriefToast("⚠ 项目里还没有 prompts,先归类一些再生成");
      setTimeout(() => setBriefToast(""), 3000);
      return;
    }
    setBriefLoading(true);
    setBriefToast("");
    try {
      const res = await fetch(`${API_URL}/synthesize-project-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: selectedProject.name,
          project_description: selectedProject.description,
          prompts: projectPrompts.slice(0, 20).map(p => ({
            original_text: p.original_text,
            optimized_text: p.optimized_text,
            task_type: p.task_type,
            platform: p.platform,
          })),
        }),
      });
      const data = await res.json();
      if (data?.brief && typeof data.brief === "string") {
        // 保存到 DB
        await supabase.rpc("set_project_brief", {
          p_project_id: selectedProject.id,
          p_brief: data.brief,
        });
        setBrief(data.brief);
        setBriefGeneratedAt(new Date().toISOString());
        setBriefToast("✓ 简报已生成");
      } else {
        setBriefToast(`✗ ${data?.error || "生成失败"}`);
      }
    } catch (e) {
      setBriefToast(`✗ ${(e as Error)?.message || "网络错误"}`);
    } finally {
      setBriefLoading(false);
      setTimeout(() => setBriefToast(""), 4000);
    }
  };

  const handleCopyBrief = () => {
    if (!brief) return;
    navigator.clipboard.writeText(brief);
    setBriefToast("✓ 已复制 — 切到任意 AI 直接粘贴");
    setTimeout(() => setBriefToast(""), 3000);
  };

  const handleDeleteProject = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      await supabase.rpc("delete_project", { p_project_id: deleteId });
      setDeleteId(null);
      setView("list");
      setSelectedProject(null);
      await loadProjects();
    } catch (e) {
      setErrMsg((e as Error)?.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="px-5 py-12 text-center">
        <div className="text-4xl mb-3">📁</div>
        <p className="text-sm text-zinc-500">登录后用项目组织你的 AI 工作流</p>
      </div>
    );
  }

  // ─── 项目详情视图 ─────────────────────────────────
  if (view === "detail" && selectedProject) {
    return (
      <div className="px-5 py-4">
        {/* 返回 + 项目头 */}
        <button
          onClick={() => { setView("list"); setSelectedProject(null); setProjectPrompts([]); }}
          className="text-[12px] text-[#7c3aed] hover:underline mb-3 flex items-center gap-1"
        >
          ← 返回项目列表
        </button>

        <div
          className="rounded-xl p-4 mb-3 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${selectedProject.color || "#7c3aed"}, ${selectedProject.color || "#a78bfa"}cc)` }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-base font-semibold">📁 {selectedProject.name}</h2>
              <button
                onClick={() => setDeleteId(selectedProject.id)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-white/40 bg-white/15 text-white hover:bg-red-500 hover:border-red-500 hover:text-white transition-all active:scale-[0.96]"
                style={{ fontWeight: 500 }}
                title="删除项目 (prompts 不会被删,只是从项目移出)"
              >
                <span>🗑️</span>
                <span>删除项目</span>
              </button>
            </div>
            {selectedProject.description && (
              <p className="text-[12px] opacity-90 mb-2">{selectedProject.description}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] opacity-90">
              <span>📊 {selectedProject.prompt_count} prompts</span>
              {selectedProject.top_platforms && selectedProject.top_platforms.length > 0 && (
                <span>📡 {selectedProject.top_platforms.map(p => `${platformEmoji(p)}${p}`).join(" ")}</span>
              )}
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{errMsg}</div>
        )}

        {/* v29: 📋 项目简报 */}
        <section className="rounded-xl border border-[#e0d3f9] bg-gradient-to-br from-[#faf7ff] to-white p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
              <span>📋</span><span>项目简报</span>
            </h3>
            {briefGeneratedAt && (
              <span className="text-[10px] text-zinc-400">
                {formatRelative(briefGeneratedAt)} 更新
              </span>
            )}
          </div>
          {brief ? (
            <>
              <p className="text-[12.5px] text-zinc-700 leading-relaxed mb-2" style={{ fontFamily: "Georgia, serif" }}>
                {brief}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyBrief}
                  className="text-[11px] h-7 px-3 bg-[#5d3eb8] hover:bg-[#7c3aed]"
                >
                  📋 复制简报到剪贴板
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={briefLoading}
                  onClick={handleGenerateBrief}
                  className="text-[11px] h-7 px-3"
                >
                  {briefLoading ? "🪄 生成中..." : "🔄 重新生成"}
                </Button>
                {briefToast && (
                  <span className={`text-[10.5px] ${briefToast.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>
                    {briefToast}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[11.5px] text-zinc-500 leading-relaxed mb-2">
                让 AI 自动总结这个项目的主题、你的风格偏好、常用术语 — 切到新 AI 工具时一键复制粘贴,新 AI 立刻 onboard。
              </p>
              <Button
                variant="default"
                size="sm"
                disabled={briefLoading || projectPrompts.length === 0}
                onClick={handleGenerateBrief}
                className="text-[11px] h-7 px-3 bg-[#5d3eb8] hover:bg-[#7c3aed]"
              >
                {briefLoading
                  ? "🪄 生成中..."
                  : projectPrompts.length === 0
                  ? "🚫 项目还没 prompt 可总结"
                  : `🪄 生成项目简报 (基于 ${Math.min(projectPrompts.length, 20)} 条 prompt)`}
              </Button>
              {briefToast && (
                <span className={`text-[10.5px] ml-2 ${briefToast.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>
                  {briefToast}
                </span>
              )}
            </>
          )}
        </section>

        {/* Prompts 时间线 */}
        <h3 className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">
          📅 prompts 时间线
        </h3>

        {loading ? (
          <div className="text-center py-8 text-xs text-zinc-400">加载中...</div>
        ) : projectPrompts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-xs text-zinc-400 text-center">
            项目还没有 prompts<br />
            优化时点 "加入项目" 或在历史里把已有 prompt 移入
          </div>
        ) : (
          <div className="space-y-2">
            {projectPrompts.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2 text-[10.5px] text-zinc-500 mb-1.5">
                  <span>{platformEmoji(p.platform || "")} {p.platform || "—"}</span>
                  <span>·</span>
                  <span>{p.task_type || "general"}</span>
                  <span>·</span>
                  <span>{formatRelative(p.created_at)}</span>
                  {p.source === "silent_capture" && (
                    <span className="ml-auto text-[10px] bg-[#faf7ff] text-[#7c3aed] px-1.5 rounded border border-[#e0d3f9]">📡</span>
                  )}
                </div>
                <p className="text-[12.5px] text-zinc-800 leading-snug">
                  {p.original_text.length > 100 ? p.original_text.slice(0, 100) + "…" : p.original_text}
                </p>
                {p.optimized_text && (
                  <p className="text-[11.5px] text-zinc-500 mt-1 line-clamp-1">
                    → {p.optimized_text.split("\n")[0]}
                  </p>
                )}
                {/* v27: 一键发到当前 AI tab */}
                {onSendToTab && (p.optimized_text || p.original_text) && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = p.optimized_text || p.original_text;
                        onSendToTab(text);
                      }}
                      className="text-[10.5px] text-white bg-[#18181b] hover:bg-[#2a2a30] px-2 py-0.5 rounded transition-colors"
                      title="发到当前 AI 网页输入框"
                    >
                      ↗ 发送到当前 AI
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* 删除项目确认 */}
        <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
          <DialogContent className="max-w-[360px]">
            <DialogHeader>
              <DialogTitle>删除项目</DialogTitle>
              <DialogDescription>
                确认删除项目「{(projects.find(p => p.id === deleteId)?.name) || selectedProject?.name || "该项目"}」?
                <span className="block mt-2 text-zinc-600 text-xs">
                  ✓ 项目内的 prompts 不会被删除,只会从此项目移出 (变成"未归类")<br />
                  ✗ 项目本身永久删除
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} disabled={deleting}>取消</Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDeleteProject}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? "删除中..." : "永久删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── 项目列表视图 ─────────────────────────────────
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">📁 我的项目</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            把 22 平台的 prompt 按项目组织,跨 AI 找回老对话
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowNewModal(true)}
          className="text-xs h-8"
        >
          + 新项目
        </Button>
      </div>

      {errMsg && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{errMsg}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xs text-zinc-400">加载中...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-sm text-zinc-700 mb-1 font-medium">还没有项目</p>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            创建第一个项目（如「创业公司官网」/「用户调研」）<br />
            把跨 AI 平台的相关 prompt 都归到一起
          </p>
          <Button variant="default" size="sm" onClick={() => setShowNewModal(true)} className="text-xs">
            🚀 创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(p => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => handleOpenDetail(p)}
              className="w-full text-left rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm transition-all overflow-hidden group"
            >
              <div className="flex items-stretch">
                <div
                  className="w-1.5 flex-shrink-0"
                  style={{ background: p.color || "#7c3aed" }}
                />
                <div className="flex-1 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[13.5px] font-semibold text-zinc-900 group-hover:text-[#5d3eb8] transition-colors">
                      📁 {p.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {/* v32-C: brief 状态指示 */}
                      {briefStatus[p.id] === "generating" && (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                          className="text-[10px] text-[#5d3eb8]"
                          title="正在生成项目简报..."
                        >
                          🪄
                        </motion.span>
                      )}
                      {briefStatus[p.id] === "ready" && (
                        <span
                          className="text-[10px] text-emerald-500"
                          title="简报已就绪 — 点开秒开"
                        >
                          ✨
                        </span>
                      )}
                      <span className="text-[10.5px] text-zinc-400 tabular-nums">
                        {p.prompt_count} 条
                      </span>
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-zinc-500 mb-1 line-clamp-1">{p.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10.5px] text-zinc-500">
                    {p.top_platforms && p.top_platforms.length > 0 && (
                      <span>📡 {p.top_platforms.slice(0, 3).map(plat => platformEmoji(plat)).join(" ")}</span>
                    )}
                    <span className="ml-auto">{formatRelative(p.last_activity || p.updated_at)}</span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* 新建项目 modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>📁 新建项目</DialogTitle>
            <DialogDescription>
              给项目起个名字,后续可以把相关 prompt 归到这里
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] font-medium text-zinc-700 block mb-1">项目名称 *</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如: 创业公司官网 / 用户调研报告"
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-700 block mb-1">描述（可选）</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="项目目标 / 关键背景..."
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-700 block mb-1.5">主题色</label>
              <div className="flex gap-1.5">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-2 ring-zinc-900 scale-110" : "hover:scale-105"}`}
                    style={{ background: c }}
                    aria-label={`选 ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)} disabled={creating}>取消</Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? "创建中..." : "创建项目"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
