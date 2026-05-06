// ============================================================
// prompt.ai — Content Script
// Inject the floating "Optimize" button on AI chat sites and handle fill messages
// ============================================================

(function () {
  "use strict";

  const API_URL = "https://prompt-optimizer-api.prompt-optimizer.workers.dev";

  // Silent capture endpoints
  const SUPABASE_URL = "https://vyuzkbdxsweaqftyqifh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_x_ruVcqxkYJNLEVDeQDwwg_H3my-InQ";

  // Map hostname → short platform code
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

  // Input box selectors (in priority order)
  const INPUT_SELECTORS = [
    "#prompt-textarea",                              // ChatGPT
    "textarea.j-search-input",                       // Genspark
    "textarea.search-input",                         // Genspark (fallback)
    "div.chat-input-editor[contenteditable='true']", // Kimi (kimi.com)
    "div.ProseMirror[contenteditable='true']",        // Claude
    "div[contenteditable='true'][spellcheck]",        // Kimi (legacy domain)
    "div.ql-editor[contenteditable='true']",          // Gemini
    "[role='textbox'][contenteditable='true']",       // Generic ARIA
    "div[contenteditable='true']",                    // Generic contenteditable
    "textarea:not([style*='display: none']):not([style*='opacity: 0'])",  // Visible textarea
  ];

  let floatBtn = null;
  let activeInput = null;
  let currentLang = "zh";

  // Silent capture state
  let lastInputText = "";              // last non-empty input value (used to recover text on clear)
  let recentlyFilledByExt = false;     // ignore clears within 2s of an extension-driven fillInput
  const capturedHashes = new Set();    // 5s dedup window of recently captured text hashes
  let captureEnabled = true;           // default on, user can toggle in MemoryPanel
  let jwt = null;                      // synced from Sidebar via chrome.storage
  let userId = null;
  let captureWatcherStarted = false;   // singleton guard for watchForCapture

  // Read language preference from storage
  if (typeof chrome !== "undefined" && chrome?.storage) {
    chrome.storage.local.get(["promptai_lang"], (res) => {
      if (res.promptai_lang) currentLang = res.promptai_lang;
    });

    // Load silent capture config (JWT / userId / captureEnabled)
    chrome.storage.local.get(
      ["promptai_jwt", "promptai_user_id", "promptai_capture_enabled"],
      (res) => {
        jwt = res.promptai_jwt || null;
        userId = res.promptai_user_id || null;
        captureEnabled = res.promptai_capture_enabled !== false; // default true
      }
    );

    // React to storage changes (login/logout/toggle take effect immediately)
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

  // ========= Find a visible input box =========
  function findVisibleInput() {
    for (const sel of INPUT_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) return el;
      }
    }
    return null;
  }

  // ========= Fill text into input =========
  function fillInput(el, text) {
    // Mark "extension just filled"; prevents silent capture from misreading the synthetic input event
    recentlyFilledByExt = true;
    setTimeout(() => { recentlyFilledByExt = false; }, 2500);

    el.focus();

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      // React needs nativeInputValueSetter; otherwise onChange won't fire
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(el, text);
      } else {
        el.value = text;
      }
      // Dispatch multiple events so React/Vue/etc. all respond
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
      // Genspark needs a real InputEvent to register
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

      // Fallback if execCommand left the field empty
      if (!el.textContent || el.textContent.trim() === "") {
        el.textContent = text;
      }

      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ========= Read text from an input =========
  function getInputText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    return el.innerText || el.textContent || "";
  }

  // ========= Silent capture helpers =========

  // hostname → platform code
  function getCurrentPlatform() {
    const host = (location.hostname || "").toLowerCase();
    return PLATFORM_MAP[host] || host.split(".")[0] || "unknown";
  }

  // Minimal string hash (for 5s dedup)
  function quickHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  // Main capture: POST to Supabase prompts table (user JWT auth, RLS enforces ownership)
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
    // Filter placeholder/system text (common "type here..." / "Reply..." templates)
    const placeholders = /^(send a message|reply|message |输入|请输入|发送消息|回复|ask anything)/i;
    if (placeholders.test(trimmed)) {
      console.warn("[prompt.ai capture] skip: placeholder-like text");
      return;
    }

    // 5s dedup (React can re-fire input events on rerender)
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

    // One retry (transient-network tolerant; required for demo reliability)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${jwt}`,
            // Need the inserted row id back so we can patch ai_response_text later
            "Prefer": "return=representation",
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
          let promptId = null;
          try {
            const rows = await res.json();
            promptId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
          } catch {}
          console.log(`[prompt.ai capture] ✓ saved to ${platform} id=${promptId}`);
          // Start AI-response capture for the 4 supported platforms
          if (promptId && (platform === "chatgpt" || platform === "claude" || platform === "kimi" || platform === "deepseek")) {
            scheduleResponseCapture(promptId, platform);
          }
          return;
        }
        // 401 = JWT expired; retry won't help
        if (res.status === 401) {
          console.error("[prompt.ai capture] ✗ 401 unauthorized — JWT may be expired, refresh sidebar");
          return;
        }
        console.warn(`[prompt.ai capture] attempt ${attempt + 1} failed: ${res.status}`);
      } catch (err) {
        console.warn(`[prompt.ai capture] attempt ${attempt + 1} network error:`, err?.message);
      }
      // Wait 1s before retry
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
    console.error("[prompt.ai capture] ✗ all retries failed");
  }

  // ========= AI response capture (ChatGPT + Claude + Kimi + DeepSeek) =========
  // Selectors target the latest assistant message; multiple fallbacks per platform so DOM tweaks don't break us.
  const ASSISTANT_SELECTORS = {
    chatgpt: [
      "[data-message-author-role='assistant']",
      "div[data-message-author-role='assistant']",
    ],
    claude: [
      "div.font-claude-message",
      "[data-testid^='message-content']",
      "div.font-claude-response",
    ],
    // Kimi (kimi.com) — markdown container / role=assistant fallbacks
    kimi: [
      "div[class*='assistant']",
      "div[class*='answer-bubble']",
      "div.markdown-container",
      ".markdown-body:not(:has(textarea))",
      "div[data-role='assistant']",
    ],
    // DeepSeek (chat.deepseek.com) — same pattern
    deepseek: [
      "div[class*='ds-markdown']",
      "div[data-role='assistant']",
      "div.markdown-body:not(:has(textarea))",
      "div[class*='message-content'][class*='assistant']",
    ],
  };

  function findLatestAssistantText(platform) {
    const sels = ASSISTANT_SELECTORS[platform] || [];
    for (const sel of sels) {
      let nodes;
      try { nodes = document.querySelectorAll(sel); } catch { continue; }
      if (nodes && nodes.length > 0) {
        const last = nodes[nodes.length - 1];
        const text = (last.innerText || last.textContent || "").trim();
        // Avoid false hits: must be > 20 chars and not a placeholder
        if (text.length > 20) return text;
      }
    }
    return null;
  }

  // Schedule: ~3s after prompt insert, poll every 1.5s until text is stable for 3s or 60s timeout
  function scheduleResponseCapture(promptId, platform) {
    let prevText = "";
    let stableSince = 0;
    let totalElapsed = 0;
    const POLL_MS = 1500;
    const STABLE_MS = 3000;
    const TIMEOUT_MS = 60000;
    const startDelay = 2500; // give the AI time to start streaming

    setTimeout(function tick() {
      totalElapsed += POLL_MS;
      const text = findLatestAssistantText(platform);
      if (text && text.length > 20) {
        if (text === prevText) {
          stableSince += POLL_MS;
          if (stableSince >= STABLE_MS) {
            // Stable → write back to DB
            patchPromptResponse(promptId, text);
            return;
          }
        } else {
          prevText = text;
          stableSince = 0;
        }
      }
      if (totalElapsed >= TIMEOUT_MS) {
        if (prevText) {
          // Timed out but we have text → still write (better partial than nothing for demo)
          console.warn(`[prompt.ai response] timeout but writing partial (${prevText.length} chars)`);
          patchPromptResponse(promptId, prevText);
        } else {
          console.warn("[prompt.ai response] timeout no text, giving up");
        }
        return;
      }
      setTimeout(tick, POLL_MS);
    }, startDelay);
  }

  async function patchPromptResponse(promptId, responseText) {
    if (!jwt || !userId || !promptId) return;
    const trimmed = String(responseText || "").trim().slice(0, 16000); // cap at 16K
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/prompts?id=eq.${promptId}&user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${jwt}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            ai_response_text: trimmed,
            ai_response_captured_at: new Date().toISOString(),
          }),
        }
      );
      if (res.ok) {
        console.log(`[prompt.ai response] ✓ captured ${trimmed.length} chars for prompt ${promptId}`);
      } else {
        console.warn(`[prompt.ai response] ✗ patch failed ${res.status}`);
      }
    } catch (err) {
      console.warn("[prompt.ai response] patch error", err?.message);
    }
  }

  // Input watcher: detect "clear" action = user submitted prompt
  function watchForCapture() {
    if (captureWatcherStarted) return;
    captureWatcherStarted = true;

    document.addEventListener("input", (e) => {
      const el = e.target;
      if (!el || !el.matches) return;
      // Only on known input selectors
      let isKnownInput = false;
      for (const sel of INPUT_SELECTORS) {
        try { if (el.matches(sel)) { isKnownInput = true; break; } } catch {}
      }
      if (!isKnownInput) return;

      const currentText = getInputText(el).trim();

      // Detect "clear": had text → now empty = likely user pressed Enter / clicked Send
      if (lastInputText && !currentText) {
        if (recentlyFilledByExt) {
          // Extension just filled → not a user submit (but update lastInputText to suppress next round)
          lastInputText = currentText;
          return;
        }
        // Real user submit
        captureSilentPrompt(lastInputText);
      }

      lastInputText = currentText;
    }, true);
  }

  // ========= Create floating button =========
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

  // ========= Position the button =========
  function positionBtn(el) {
    if (!floatBtn) floatBtn = createFloatBtn();
    floatBtn.innerHTML = currentLang === "zh" ? "✨ 优化" : "✨ Optimize";

    const rect = el.getBoundingClientRect();
    floatBtn.style.position = "fixed";
    floatBtn.style.top = (rect.top - 32) + "px";
    floatBtn.style.left = (rect.right - 80) + "px";
    floatBtn.style.display = "flex";
  }

  // ========= Optimize handler =========
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

  // ========= Listen for messages (fill requests from Side Panel) =========
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

  // ========= Watch input focus =========
  function watchInputs() {
    document.addEventListener("focusin", (e) => {
      const el = e.target;
      for (const sel of INPUT_SELECTORS) {
        if (el.matches && el.matches(sel)) {
          activeInput = el;
          // Reset lastInputText when switching inputs (new chat / new page → old text is stale)
          lastInputText = getInputText(el).trim();
          positionBtn(el);
          return;
        }
      }
    }, true);

    // Periodic check (some SPAs re-render the input dynamically)
    setInterval(() => {
      const input = findVisibleInput();
      if (input && input !== activeInput) {
        activeInput = input;
        // Same reset on dynamic swap
        lastInputText = getInputText(input).trim();
      }
    }, 2000);

    window.addEventListener("scroll", () => {
      if (activeInput && floatBtn?.style.display !== "none") {
        positionBtn(activeInput);
      }
    }, { passive: true });
  }

  // ========= Init =========
  function init() {
    // Silent capture watcher starts independently of activeInput (document-level input event)
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

    // Immediate check
    if (findVisibleInput()) watchInputs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
