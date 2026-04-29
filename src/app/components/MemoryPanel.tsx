// ============================================================
// MemoryPanel.tsx — v12 (L7) AI 记忆透明面板
// 让用户能看见、删除、重建系统了解到的他们
//
// 4 个 section:
//   🎤 Voice Profile   (合成的声音指纹,可重新生成)
//   📌 Facts list      (LLM 抽取的偏好,每条可单独删除)
//   📊 Memory Stats    (count 类指标)
//   🪄 手动触发        (一键 bootstrap / 强制重新抽取)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

interface UserFact {
  fact: string;
  confidence: number;
  task_type: string | null;
  // get_user_facts 不返回 id, 删除时按 fact 字符串匹配查 id
}

interface ExtractionState {
  total_prompts: number;
  facts_count: number;
  last_extraction_at: string | null;
  prompts_since_last: number;
}

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  // 由 Sidebar 注入: force=true 时跳过 prompts_since_last >= 10 阈值
  onForceExtract: () => Promise<void>;
}

export function MemoryPanel({ open, onClose, user, onForceExtract }: MemoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);
  const [voiceUpdatedAt, setVoiceUpdatedAt] = useState<string | null>(null);
  const [facts, setFacts] = useState<Array<{ id: string; fact: string; confidence: number; task_type: string | null; extracted_at: string }>>([]);
  const [state, setState] = useState<ExtractionState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // v13: silent capture
  const [captureEnabled, setCaptureEnabled] = useState<boolean>(true);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ optimize: number; silent_capture: number; manual: number } | null>(null);

  // v13: 读 chrome.storage.local 的 captureEnabled (mount 时 + open 时刷新)
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome?.storage?.local) return;
    chrome.storage.local.get(["promptai_capture_enabled"], (res) => {
      setCaptureEnabled(res.promptai_capture_enabled !== false);
    });
  }, [open]);

  const handleToggleCapture = (next: boolean) => {
    setCaptureEnabled(next); // optimistic
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ promptai_capture_enabled: next });
    }
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");
    try {
      // 三路并行: voice / facts (从 user_facts 表直接拉,带 id 用于删除) / extraction state
      // v13: 加第 4 路 source breakdown
      const [voiceRes, factsRes, stateRes, sourceRes] = await Promise.all([
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
      ]);

      const v = (voiceRes.data as any)?.voice_profile;
      setVoiceProfile(typeof v === "string" && v.trim() ? v : null);
      setVoiceUpdatedAt((voiceRes.data as any)?.synthesized_at || null);

      setFacts(Array.isArray(factsRes.data) ? factsRes.data as any : []);
      setState((stateRes.data as any) || null);
      setSourceBreakdown((sourceRes.data as any) || { optimize: 0, silent_capture: 0, manual: 0 });
    } catch (e) {
      setErrorMsg((e as Error)?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // open 时自动加载
  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  const handleDeleteFact = async (factId: string) => {
    if (!user) return;
    // optimistic update
    setFacts(prev => prev.filter(f => f.id !== factId));
    try {
      await supabase.rpc("delete_user_fact", { p_fact_id: factId });
    } catch (e) {
      // 回滚 + 重新加载
      await loadAll();
    }
  };

  const handleForceRegenerate = async () => {
    setRefreshing(true);
    setErrorMsg("");
    try {
      await onForceExtract();
      // 等 1 秒让后端写入完成,再 refresh UI
      await new Promise(r => setTimeout(r, 1500));
      await loadAll();
    } catch (e) {
      setErrorMsg((e as Error)?.message || "重新生成失败");
    } finally {
      setRefreshing(false);
    }
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🧠</span>
            <span>我的 AI 记忆</span>
          </DialogTitle>
          <DialogDescription>
            prompt.ai 基于你的历史 prompt 学到的偏好画像。所有数据只属于你,可随时删除。
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            请先登录查看你的 AI 记忆
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">加载中...</div>
        ) : (
          <div className="space-y-5 py-2">
            {errorMsg && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </div>
            )}

            {/* 📡 跨平台监听 (v13) */}
            <section className="rounded-lg border border-[#e0d3f9] bg-[#faf7ff] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <span>📡</span> <span>跨平台监听</span>
                </h3>
                <Switch
                  checked={captureEnabled}
                  onCheckedChange={handleToggleCapture}
                  aria-label="跨平台监听开关"
                />
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {captureEnabled
                  ? `已开启。在 ChatGPT/Claude/Gemini 等 22 个 AI 平台,你发送的 prompt 会被自动记录到你的 prompt.ai 记忆。已捕获 ${sourceBreakdown?.silent_capture ?? 0} 条。`
                  : "已关闭。仅在 prompt.ai 主动优化的 prompt 才会记录。"}
              </p>
            </section>

            {/* 🎤 Voice Profile */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <span>🎤</span> <span>你的声音</span>
                </h3>
                <span className="text-xs text-zinc-400">
                  {voiceUpdatedAt ? `更新于 ${formatTime(voiceUpdatedAt)}` : "尚未生成"}
                </span>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700 min-h-[80px]">
                {voiceProfile ?? (
                  <span className="text-zinc-400 italic">
                    还没有声音画像。多用几次 prompt.ai,系统会自动学习;或点下面「重新生成」立即开始。
                  </span>
                )}
              </div>
            </section>

            {/* 📌 Facts */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <span>📌</span> <span>提取出的偏好</span>
                  <span className="text-zinc-400 font-normal">({facts.length} 条)</span>
                </h3>
              </div>
              {facts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-xs text-zinc-400 text-center">
                  暂无偏好数据
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {facts.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:border-zinc-300 transition-colors"
                    >
                      <span className="flex-1">
                        {f.fact}
                        <span className="ml-2 text-xs text-zinc-400">
                          {f.task_type ? `[${f.task_type}]` : "[全局]"} · {(f.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                      <button
                        onClick={() => handleDeleteFact(f.id)}
                        className="text-zinc-400 hover:text-red-500 transition-colors text-xs flex-shrink-0 px-1.5"
                        aria-label="删除此偏好"
                        title="删除此偏好"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 📊 Stats */}
            <section>
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5 mb-2">
                <span>📊</span> <span>记忆系统状态</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-zinc-50 px-3 py-2">
                  <div className="text-zinc-500">已优化 prompt</div>
                  <div className="text-base font-semibold text-zinc-900">{state?.total_prompts ?? "—"}</div>
                </div>
                <div className="rounded-md bg-zinc-50 px-3 py-2">
                  <div className="text-zinc-500">提取出的偏好</div>
                  <div className="text-base font-semibold text-zinc-900">{state?.facts_count ?? "—"}</div>
                </div>
                <div className="rounded-md bg-[#faf7ff] px-3 py-2 border border-[#e0d3f9]">
                  <div className="text-[#7c3aed]">📡 跨平台捕获</div>
                  <div className="text-base font-semibold text-[#5d3eb8]">
                    {sourceBreakdown?.silent_capture ?? "—"}
                  </div>
                </div>
                <div className="rounded-md bg-zinc-50 px-3 py-2">
                  <div className="text-zinc-500">距上次抽取</div>
                  <div className="text-base font-semibold text-zinc-900">
                    +{state?.prompts_since_last ?? 0} 条
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="flex flex-row sm:justify-between gap-2 pt-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={handleForceRegenerate}
              className="text-xs"
            >
              {refreshing ? "🪄 生成中..." : "🪄 重新生成画像"}
            </Button>
          )}
          <Button variant="default" size="sm" onClick={onClose} className="text-xs">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
