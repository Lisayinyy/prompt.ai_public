// ============================================================
// OnboardingCard.tsx — v23 首次体验引导
// 新用户登录后第一次开 sidebar 时弹一次,4 步引导
// localStorage 'promptai_onboarded' 标记后不再弹
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface OnboardingCardProps {
  open: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    emoji: "👋",
    title: "欢迎来到 prompt.ai",
    body: "你的跨平台 AI 记忆中枢。",
    detail: "ChatGPT / Claude / Gemini / Kimi 等 22 个 AI 平台 — 一个统一的「你」",
    accent: "linear-gradient(135deg, #5d3eb8, #7c3aed)",
  },
  {
    emoji: "📡",
    title: "自动学习,无需配置",
    body: "在任意 AI 平台发的 prompt,自动被记录。",
    detail: "不需要复制粘贴 / 不需要切换工具 / 数据只属于你",
    accent: "linear-gradient(135deg, #7c3aed, #a78bfa)",
  },
  {
    emoji: "🧠",
    title: "声音指纹,随你成长",
    body: "系统自动提炼你的偏好,生成「AI 看到的你」。",
    detail: "邮件偏好简洁 / 分析偏好 Markdown / 常用 OKR 术语 — 一切都被记住",
    accent: "linear-gradient(135deg, #a78bfa, #c4b5fd)",
  },
  {
    emoji: "🪄",
    title: "立即开始体验",
    body: "在任意 AI 网站发条 prompt,或在这里点「优化」。",
    detail: "10 条之后,你的画像就会自动浮现。点 🧠 按钮可随时查看。",
    accent: "linear-gradient(135deg, #5d3eb8, #c4b5fd)",
  },
];

export function OnboardingCard({ open, onClose }: OnboardingCardProps) {
  const [step, setStep] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[step];
  const isLast = step === total - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleFinish = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("promptai_onboarded", "1");
    }
    setStep(0); // 重置以备未来重看
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleFinish(); }}>
      <DialogContent className="max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Hero with gradient */}
        <div
          className="relative px-6 pt-8 pb-6 text-center text-white overflow-hidden"
          style={{ background: slide.accent }}
        >
          {/* 装饰光晕 */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-12 w-32 h-32 rounded-full bg-white/10 blur-3xl pointer-events-none" />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              <div className="text-5xl mb-3">{slide.emoji}</div>
              <DialogTitle className="text-xl font-bold mb-2 text-white">
                {slide.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-white/90 font-normal">
                {slide.body}
              </DialogDescription>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Detail body */}
        <div className="px-6 py-4 min-h-[60px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={`detail-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="text-[12.5px] text-zinc-600 text-center leading-relaxed"
            >
              {slide.detail}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-[#5d3eb8]" : "w-1.5 bg-zinc-300 hover:bg-zinc-400"
              }`}
              aria-label={`跳到第 ${i + 1} 步`}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 pb-5">
          {step > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="text-xs h-8 px-3"
            >
              ← 上一步
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFinish}
              className="text-xs h-8 px-3 text-zinc-500 hover:text-zinc-700"
            >
              跳过
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleNext}
            className="flex-1 text-xs h-8"
            style={{ background: slide.accent }}
          >
            {isLast ? "🚀 开始使用 prompt.ai" : `下一步 (${step + 1}/${total}) →`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
