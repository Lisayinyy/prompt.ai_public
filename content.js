// ============================================================
// prompt.ai — Content Script
// 在 AI 对话网站上注入「✨ 优化」浮动按钮 + 接收填入消息
// ============================================================

(function () {
  "use strict";

  const API_URL = "https://prompt-optimizer-api.prompt-optimizer.workers.dev";

  // v13: silent capture 配置
  const SUPABASE_URL = "https://vyuzkbdxsweaqftyqifh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_x_ruVcqxkYJNLEVDeQDwwg_H3my-InQ";

  // 平台名映射 (hostname → 简短 platform code)
  const PLATFORM_MAP = {
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "claude.ai": "claude",
    "kimi.com": "kimi",
    "www.kimi.com": "kimi",
    "kimi.moonshot.cn": "kimi",
    "chat.deepseek.com": "deepseek",
    "gemini.google.com": "gemini",
    "www.doubao.com": "doubao",
    "hailuoai.com": "hailuo",
    "tongyi.aliyun.com": "tongyi",
    "yiyan.baidu.com": "yiyan",
    "chatglm.cn": "chatglm",
    "chat.mistral.ai": "mistral",
    "www.perplexity.ai": "perplexity",
    "grok.com": "grok",
    "copilot.microsoft.com": "copilot",
    "agent.minimax.io": "minimax-agent",
    "chat.z.ai": "zai",
    "qwen.ai": "qwen",
    "www.genspark.ai": "genspark",
    "genspark.ai": "genspark",
  };

  // 输入框选择器（按优先级排列）
  const INPUT_SELECTORS = [
    "#prompt-textarea",                              // ChatGPT
    "textarea.j-search-input",                       // Genspark
    "textarea.search-input",                         // Genspark (备用)
    "div.chat-input-editor[contenteditable='true']", // Kimi (kimi.com)
    "div.ProseMirror[contenteditable='true']",        // Claude
    "div[contenteditable='true'][spellcheck]",        // Kimi (旧域名)
    "div.ql-editor[contenteditable='true']",          // Gemini
    "[role='textbox'][contenteditable='true']",       // 通用 ARIA
    "div[contenteditable='true']",                    // 通用 contenteditable
    "textarea:not([style*='display: none']):not([style*='opacity: 0'])",  // 可见 textarea
  ];

  let floatBtn = null;
  let activeInput = null;
  let currentLang = "zh";

  // v13: silent capture 状态
  let lastInputText = "";              // 输入框上一次的非空文本 (清空时拿这个)
  let recentlyFilledByExt = false;     // 插件刚 fillInput,2s 内忽略清空
  const capturedHashes = new Set();    // 最近 5s 抓过的文本 hash 去重
  let captureEnabled = true;           // 默认开,用户在 MemoryPanel 可关
  let jwt = null;                      // 由 Sidebar 同步到 chrome.storage
  let userId = null;
  let captureWatcherStarted = false;   // watchForCapture 单例 guard

  // 从 storage 读取语言设置
  if (typeof chrome !== "undefined" && chrome?.storage) {
    chrome.storage.local.get(["promptai_lang"], (res) => {
      if (res.promptai_lang) currentLang = res.promptai_lang;
    });

    // v13: 加载 silent capture 配置 (JWT / userId / captureEnabled)
    chrome.storage.local.get(
      ["promptai_jwt", "promptai_user_id", "promptai_capture_enabled"],
      (res) => {
        jwt = res.promptai_jwt || null;
        userId = res.promptai_user_id || null;
        captureEnabled = res.promptai_capture_enabled !== false; // 默认 true
      }
    );

    // v13: 监听 storage 变化 (用户登录/登出/切 toggle 实时生效)
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.promptai_jwt) jwt = changes.promptai_jwt.newValue || null;
        if (changes.promptai_user_id) userId = changes.promptai_user_id.newValue || null;
        if (changes.promptai_capture_enabled) {
          captureEnabled = changes.promptai_capture_enabled.newValue !== false;
        }
      });
    }
  }

  // ========= 查找可见输入框 =========
  function findVisibleInput() {
    for (const sel of INPUT_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) return el;
      }
    }
    return null;
  }

  // ========= 填入文本到输入框 =========
  function fillInput(el, text) {
    // v13: 标记"插件刚填入",防止 silent capture 误抓 (插件填入也会触发 input 事件)
    recentlyFilledByExt = true;
    setTimeout(() => { recentlyFilledByExt = false; }, 2500);

    el.focus();

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      // React 项目需要通过 nativeInputValueSetter 触发，否则 onChange 不会响应
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(el, text);
      } else {
        el.value = text;
      }
      // 依次触发多个事件，确保 React / Vue 等框架都能响应
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
      // Genspark 特殊处理：模拟用户真实输入
      if (el.classList.contains("j-search-input") || el.classList.contains("search-input")) {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
    } else {
      // contenteditable
      el.textContent = "";
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("insertText", false, text);

      // 兜底
      if (!el.textContent || el.textContent.trim() === "") {
        el.textContent = text;
      }

      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ========= 获取输入框文本 =========
  function getInputText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    return el.innerText || el.textContent || "";
  }

  // ========= v13: silent capture helpers =========

  // hostname → platform code
  function getCurrentPlatform() {
    const host = (location.hostname || "").toLowerCase();
    return PLATFORM_MAP[host] || host.split(".")[0] || "unknown";
  }

  // 极简字符串 hash (用于 5s 去重)
  function quickHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  // 主 capture 函数: POST 到 Supabase prompts 表 (用户 JWT auth, RLS 自动校验)
  async function captureSilentPrompt(text) {
    if (!captureEnabled) {
      console.warn("[prompt.ai capture] skip: captureEnabled=false");
      return;
    }
    if (!jwt || !userId) {
      console.warn("[prompt.ai capture] skip: not logged in (no JWT)");
      return;
    }
    const trimmed = String(text || "").trim();
    if (trimmed.length < 10) {
      console.warn("[prompt.ai capture] skip: too short (" + trimmed.length + " chars)");
      return;
    }
    if (trimmed.length > 8000) {
      console.warn("[prompt.ai capture] skip: too long (" + trimmed.length + " chars)");
      return;
    }
    // 占位符/系统文案过滤 (常见的"输入..." / "Reply..." 等模板)
    const placeholders = /^(send a message|reply|message |输入|请输入|发送消息|回复|ask anything)/i;
    if (placeholders.test(trimmed)) {
      console.warn("[prompt.ai capture] skip: placeholder-like text");
      return;
    }

    // 5 秒去重 (防 React 重渲染时 input 事件重复触发)
    const hash = quickHash(trimmed);
    if (capturedHashes.has(hash)) {
      console.warn("[prompt.ai capture] skip: duplicate within 5s window");
      return;
    }
    capturedHashes.add(hash);
    setTimeout(() => capturedHashes.delete(hash), 5000);

    const platform = getCurrentPlatform();
    const preview = trimmed.length > 50 ? trimmed.slice(0, 50) + "..." : trimmed;
    console.log(`[prompt.ai capture] platform=${platform} text="${preview}"`);

    // 重试 1 次 (网络瞬断容错,demo 必备)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${jwt}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            user_id: userId,
            original_text: trimmed,
            source: "silent_capture",
            platform: platform,
            task_type: "general",
          }),
        });
        if (res.ok) {
          console.log(`[prompt.ai capture] ✓ saved to ${platform}`);
          return;
        }
        // 401 = JWT 过期,不重试 (重试也没用)
        if (res.status === 401) {
          console.error("[prompt.ai capture] ✗ 401 unauthorized — JWT 可能过期,请刷新 sidebar");
          return;
        }
        console.warn(`[prompt.ai capture] attempt ${attempt + 1} failed: ${res.status}`);
      } catch (err) {
        console.warn(`[prompt.ai capture] attempt ${attempt + 1} network error:`, err?.message);
      }
      // 1 秒后重试
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
    console.error("[prompt.ai capture] ✗ all retries failed");
  }

  // 输入框监听: 检测"清空"动作 = 用户发送了 prompt
  function watchForCapture() {
    if (captureWatcherStarted) return;
    captureWatcherStarted = true;

    document.addEventListener("input", (e) => {
      const el = e.target;
      if (!el || !el.matches) return;
      // 只在已知 input selector 上工作
      let isKnownInput = false;
      for (const sel of INPUT_SELECTORS) {
        try { if (el.matches(sel)) { isKnownInput = true; break; } } catch {}
      }
      if (!isKnownInput) return;

      const currentText = getInputText(el).trim();

      // 检测"清空": 上次有文本 → 现在空 = 大概率是用户按了 Enter / 点了 Send
      if (lastInputText && !currentText) {
        if (recentlyFilledByExt) {
          // 是插件刚 fillInput → 不算用户发送 (但更新 lastInputText 防下轮触发)
          lastInputText = currentText;
          return;
        }
        // 真用户发送了
        captureSilentPrompt(lastInputText);
      }

      lastInputText = currentText;
    }, true);
  }

  // ========= 创建浮动按钮 =========
  function createFloatBtn() {
    const btn = document.createElement("button");
    btn.className = "po-float-btn";
    btn.innerHTML = currentLang === "zh" ? "✨ 优化" : "✨ Optimize";
    btn.title = "prompt.ai";
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleOptimize();
    });
    document.body.appendChild(btn);
    return btn;
  }

  // ========= 定位按钮 =========
  function positionBtn(el) {
    if (!floatBtn) floatBtn = createFloatBtn();
    floatBtn.innerHTML = currentLang === "zh" ? "✨ 优化" : "✨ Optimize";

    const rect = el.getBoundingClientRect();
    floatBtn.style.position = "fixed";
    floatBtn.style.top = (rect.top - 32) + "px";
    floatBtn.style.left = (rect.right - 80) + "px";
    floatBtn.style.display = "flex";
  }

  // ========= 优化逻辑 =========
  async function handleOptimize() {
    if (!activeInput) return;
    const text = getInputText(activeInput).trim();
    if (!text) {
      showToast(currentLang === "zh" ? "⚠️ 请先输入内容" : "⚠️ Type something first");
      return;
    }

    floatBtn.classList.add("po-loading");
    floatBtn.innerHTML = '<span class="po-spinner"></span> ' +
      (currentLang === "zh" ? "优化中" : "Optimizing");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      if (data.optimized) {
        fillInput(activeInput, data.optimized);
        showToast(currentLang === "zh" ? "✅ 已优化" : "✅ Optimized");
      }
    } catch {
      showToast(currentLang === "zh" ? "❌ 优化失败" : "❌ Failed");
    } finally {
      floatBtn.classList.remove("po-loading");
      floatBtn.innerHTML = currentLang === "zh" ? "✨ 优化" : "✨ Optimize";
    }
  }

  // ========= Toast =========
  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "po-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add("po-fade-out"); setTimeout(() => t.remove(), 300); }, 2000);
  }

  // ========= 监听消息（Side Panel 发来的填入请求） =========
  if (typeof chrome !== "undefined" && chrome?.runtime) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "FILL_INPUT") {
        const input = findVisibleInput();
        if (input) {
          fillInput(input, msg.text);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, reason: "no_input" });
        }
      }
      if (msg.type === "SET_LANG") {
        currentLang = msg.lang;
        if (floatBtn) {
          floatBtn.innerHTML = currentLang === "zh" ? "✨ 优化" : "✨ Optimize";
        }
      }
      return true;
    });
  }

  // ========= 监听输入框 focus =========
  function watchInputs() {
    document.addEventListener("focusin", (e) => {
      const el = e.target;
      for (const sel of INPUT_SELECTORS) {
        if (el.matches && el.matches(sel)) {
          activeInput = el;
          // v15: 重置 lastInputText (新输入框 → 切换会话/页面,旧文本失效)
          lastInputText = getInputText(el).trim();
          positionBtn(el);
          return;
        }
      }
    }, true);

    // 定期检查（有些 SPA 动态渲染输入框）
    setInterval(() => {
      const input = findVisibleInput();
      if (input && input !== activeInput) {
        activeInput = input;
        // v15: 同样重置 lastInputText
        lastInputText = getInputText(input).trim();
      }
    }, 2000);

    window.addEventListener("scroll", () => {
      if (activeInput && floatBtn?.style.display !== "none") {
        positionBtn(activeInput);
      }
    }, { passive: true });
  }

  // ========= 初始化 =========
  function init() {
    // v13: silent capture 监听独立启动 (不依赖 activeInput,document 级 input 事件)
    watchForCapture();

    const observer = new MutationObserver(() => {
      const el = findVisibleInput();
      if (el) {
        observer.disconnect();
        watchInputs();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); watchInputs(); }, 5000);

    // 立即检查
    if (findVisibleInput()) watchInputs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
