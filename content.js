// ============================================================
// prompt.ai — Content Script
// 在 AI 对话网站上注入「✨ 优化」浮动按钮 + 接收填入消息
// ============================================================

(function () {
  "use strict";

  const API_URL = "https://prompt-optimizer-api.prompt-optimizer.workers.dev";

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

  // 从 storage 读取语言设置
  if (typeof chrome !== "undefined" && chrome?.storage) {
    chrome.storage.local.get(["promptai_lang"], (res) => {
      if (res.promptai_lang) currentLang = res.promptai_lang;
    });
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
