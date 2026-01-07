(() => {
  "use strict";

  // =========================
  // Config & Storage Keys
  // =========================
  const STORAGE = {
    LIBRARY: "ss_library",
    UI_LANG: "ss_ui_lang",
    API_URL: "ss_api_url"
  };

  const DEFAULT_API_URL = "/api/generate";
  const LIBRARY_MAX = 80;

  // =========================
  // i18n
  // =========================
  const I18N = {
    en: {
      title: "ScriptSpark | AI Content Creator",
      navCreate: "Create",
      navLibrary: "Library",
      navSettings: "Settings",
      navHelp: "Help",

      generate: "Generate",
      generating: "Generating…",
      saveToLibrary: "Save to Library",

      topicRequired: "Please write a topic first.",
      copied: "Copied!",
      saved: "Saved to Library.",
      deleted: "Deleted.",
      cleared: "Library cleared.",
      exported: "Exported JSON.",
      nothingToExport: "Nothing to export yet.",
      connectionFailed: "AI request failed. Check your API endpoint and try again.",

      hooks: "Hooks (5)",
      script: "Script",
      intro: "Intro",
      body: "Body",
      cta: "CTA",
      caption: "Caption",
      hashtags: "Hashtags",

      copyScript: "Copy Script",
      copyCaption: "Copy Caption",
      copyHashtags: "Copy Hashtags",
      copyJSON: "Copy JSON",
      deleteItem: "Delete",
      useAgain: "Use Again",

      libraryEmpty: "No items yet. Generate a script and save it.",
      noResults: "No results.",
      platformAll: "All Platforms",

      apiSaved: "Settings saved.",
      apiReset: "Settings reset."
    },
    ar: {
      title: "ScriptSpark | صانع محتوى بالذكاء الاصطناعي",
      navCreate: "إنشاء",
      navLibrary: "المكتبة",
      navSettings: "الإعدادات",
      navHelp: "مساعدة",

      generate: "توليد",
      generating: "جاري التوليد…",
      saveToLibrary: "حفظ في المكتبة",

      topicRequired: "اكتب موضوع الفيديو الأول.",
      copied: "تم النسخ!",
      saved: "تم الحفظ في المكتبة.",
      deleted: "تم الحذف.",
      cleared: "تم مسح المكتبة.",
      exported: "تم تصدير JSON.",
      nothingToExport: "لا يوجد شيء لتصديره.",
      connectionFailed: "فشل طلب الذكاء الاصطناعي. تأكد من رابط الـ API وحاول مرة أخرى.",

      hooks: "هوكات (٥)",
      script: "السكريبت",
      intro: "المقدمة",
      body: "المحتوى",
      cta: "الدعوة للفعل",
      caption: "الكابشن",
      hashtags: "هاشتاجات",

      copyScript: "نسخ السكريبت",
      copyCaption: "نسخ الكابشن",
      copyHashtags: "نسخ الهاشتاجات",
      copyJSON: "نسخ JSON",
      deleteItem: "حذف",
      useAgain: "استخدمه مرة أخرى",

      libraryEmpty: "لا توجد عناصر بعد. ولّد سكريبت ثم احفظه.",
      noResults: "لا توجد نتائج.",
      platformAll: "كل المنصات",

      apiSaved: "تم حفظ الإعدادات.",
      apiReset: "تمت إعادة الضبط."
    }
  };

  const state = {
    uiLang: "en",
    apiUrl: DEFAULT_API_URL,
    library: []
  };

  // =========================
  // DOM helpers
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const views = {
    create: $("#view-create"),
    library: $("#view-library"),
    settings: $("#view-settings"),
    help: $("#view-help")
  };

  const el = {
    main: $("#main"),

    langToggle: $("#lang-toggle"),

    form: $("#generator-form"),
    btnGenerate: $("#btn-generate"),
    btnGenerateText: $("#btn-generate .btn-text"),
    loaderDots: $("#btn-generate .loader-dots"),

    platform: $("#platform"),
    tone: $("#tone"),
    length: $("#length"),
    language: $("#language"),
    topic: $("#topic"),

    output: $("#output-container"),

    libraryList: $("#library-list"),
    librarySearch: $("#library-search"),
    libraryPlatform: $("#library-filter-platform"),
    btnExport: $("#btn-export"),
    btnClear: $("#btn-clear"),

    apiUrl: $("#api-url"),
    btnSaveSettings: $("#btn-save-settings"),
    btnResetSettings: $("#btn-reset-settings"),
    btnUiEn: $("#btn-ui-en"),
    btnUiAr: $("#btn-ui-ar")
  };

  // =========================
  // Utilities
  // =========================
  function t(key) {
    return (I18N[state.uiLang] && I18N[state.uiLang][key]) || I18N.en[key] || key;
  }

  function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const opts = { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" };
    return d.toLocaleString(state.uiLang === "ar" ? "ar-EG" : "en-US", opts);
  }

  function toast(message, type = "default", timeout = 2400) {
    const container = $("#toast-container");
    const node = document.createElement("div");
    node.className = `toast ${type === "success" ? "success" : type === "danger" ? "danger" : ""}`.trim();

    const dot = document.createElement("div");
    dot.className = "toast-dot";

    const text = document.createElement("div");
    text.className = "toast-text";
    text.textContent = message;

    node.append(dot, text);
    container.appendChild(node);

    setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      node.style.transition = "180ms ease";
      setTimeout(() => node.remove(), 220);
    }, timeout);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("copied"), "success");
      return true;
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      toast(t("copied"), "success");
      return ok;
    }
  }

  function setGenerating(isGenerating) {
    el.btnGenerate.disabled = isGenerating;
    el.btnGenerateText.textContent = isGenerating ? t("generating") : t("generate");
    el.loaderDots.style.display = isGenerating ? "flex" : "none";
  }

  function loadState() {
    state.library = safeJsonParse(localStorage.getItem(STORAGE.LIBRARY), []);
    state.uiLang = localStorage.getItem(STORAGE.UI_LANG) || detectBrowserLang();
    state.apiUrl = localStorage.getItem(STORAGE.API_URL) || DEFAULT_API_URL;
  }

  function persistLibrary() {
    localStorage.setItem(STORAGE.LIBRARY, JSON.stringify(state.library.slice(0, LIBRARY_MAX)));
  }

  function persistSettings() {
    localStorage.setItem(STORAGE.UI_LANG, state.uiLang);
    localStorage.setItem(STORAGE.API_URL, state.apiUrl);
  }

  function detectBrowserLang() {
    const nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("ar") ? "ar" : "en";
  }

  // =========================
  // I18n DOM apply
  // =========================
  function applyI18n() {
    document.documentElement.lang = state.uiLang;
    document.documentElement.dir = state.uiLang === "ar" ? "rtl" : "ltr";
    document.title = t("title");

    // Text nodes
    $$("[data-en][data-ar]").forEach((node) => {
      node.textContent = state.uiLang === "ar" ? node.dataset.ar : node.dataset.en;
    });

    // Placeholders
    $$("[data-ph-en][data-ph-ar]").forEach((node) => {
      node.setAttribute("placeholder", state.uiLang === "ar" ? node.dataset.phAr : node.dataset.phEn);
    });

    // Sync nav labels used in JS strings
    // (Links already updated by data-en/data-ar in HTML)
    // Toggle button
    el.langToggle.textContent = state.uiLang === "ar" ? "EN" : "AR";

    // Sync generator default language with UI (only if user didn't change yet)
    if (!el.language.dataset.userChanged) {
      el.language.value = state.uiLang === "ar" ? "Arabic" : "English";
    }

    // Settings buttons active
    el.btnUiEn.classList.toggle("active", state.uiLang === "en");
    el.btnUiAr.classList.toggle("active", state.uiLang === "ar");

    // Settings field
    el.apiUrl.value = state.apiUrl || DEFAULT_API_URL;

    // Re-render dynamic views
    renderLibrary();
  }

  function setUiLang(lang) {
    state.uiLang = lang === "ar" ? "ar" : "en";
    persistSettings();
    applyI18n();
  }

  // =========================
  // Routing
  // =========================
  const ROUTES = {
    "#/create": views.create,
    "#/library": views.library,
    "#/settings": views.settings,
    "#/help": views.help
  };

  function showView(hash) {
    const target = ROUTES[hash] || views.create;

    Object.values(views).forEach((v) => (v.style.display = "none"));
    target.style.display = "block";

    // Active nav
    $$(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === hash));

    // Accessibility: move focus to main container
    try { el.main.focus({ preventScroll: true }); } catch { /* noop */ }

    // Special renders
    if (target === views.library) renderLibrary();
    if (target === views.settings) {
      el.apiUrl.value = state.apiUrl || DEFAULT_API_URL;
    }
  }

  function onHashChange() {
    const hash = window.location.hash || "#/create";
    showView(hash);
  }

  // =========================
  // AI API (serverless)
  // =========================
  async function generateWithAI(payload) {
    const url = state.apiUrl || DEFAULT_API_URL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      const data = await res.json();
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  // =========================
  // UI builders
  // =========================
  function createSection(title, contentNode) {
    const section = document.createElement("div");
    section.className = "output-section";

    const h = document.createElement("div");
    h.className = "output-title";
    h.textContent = title;

    section.appendChild(h);
    section.appendChild(contentNode);
    return section;
  }

  function textBox(text, dir = null) {
    const box = document.createElement("div");
    box.className = "output-box";
    box.textContent = text || "";
    if (dir) box.dir = dir;
    return box;
  }

  function listBox(items, dir = null) {
    const ul = document.createElement("ol");
    ul.className = "output-list";
    if (dir) ul.dir = dir;
    (items || []).forEach((it) => {
      const li = document.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    });

    const wrap = document.createElement("div");
    wrap.className = "output-box";
    wrap.appendChild(ul);
    return wrap;
  }

  function buildFullScript(out) {
    const s = out?.script || {};
    return `${t("intro")}:\n${s.intro || ""}\n\n${t("body")}:\n${s.body || ""}\n\n${t("cta")}:\n${s.cta || ""}`.trim();
  }

  function buildHashtags(out) {
    return (out?.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  }

  function renderSkeleton() {
    el.output.innerHTML = "";
    el.output.style.display = "block";

    const card = document.createElement("div");
    card.className = "card output-card";

    const head = document.createElement("div");
    head.className = "output-head";

    const left = document.createElement("div");
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = "AI";

    const meta = document.createElement("div");
    meta.className = "output-meta";
    meta.textContent = "…";

    left.append(badge, meta);

    const right = document.createElement("div");
    right.className = "skeleton";
    right.style.width = "120px";
    right.style.height = "16px";

    head.append(left, right);

    const sk1 = document.createElement("div");
    sk1.className = "skeleton skel-block";
    sk1.style.marginTop = "14px";

    const sk2 = document.createElement("div");
    sk2.className = "skeleton skel-line";

    const sk3 = document.createElement("div");
    sk3.className = "skeleton skel-line";

    card.append(head, sk1, sk2, sk3);
    el.output.appendChild(card);
  }

  function renderOutput(out, metaInfo) {
    el.output.innerHTML = "";
    el.output.style.display = "block";

    const dir = metaInfo.language === "Arabic" ? "rtl" : "ltr";

    const card = document.createElement("div");
    card.className = "card output-card";

    // Header
    const head = document.createElement("div");
    head.className = "output-head";

    const left = document.createElement("div");

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = metaInfo.platform;

    const meta = document.createElement("div");
    meta.className = "output-meta";
    meta.textContent = `${metaInfo.tone} • ${metaInfo.length}s • ${metaInfo.language}`;

    left.append(badge, meta);

    const right = document.createElement("div");
    right.className = "action-row";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "btn-secondary";
    btnSave.dataset.action = "save";
    btnSave.textContent = t("saveToLibrary");

    const btnCopyScript = document.createElement("button");
    btnCopyScript.type = "button";
    btnCopyScript.className = "btn-ghost";
    btnCopyScript.dataset.action = "copy-script";
    btnCopyScript.textContent = t("copyScript");

    const btnCopyCaption = document.createElement("button");
    btnCopyCaption.type = "button";
    btnCopyCaption.className = "btn-ghost";
    btnCopyCaption.dataset.action = "copy-caption";
    btnCopyCaption.textContent = t("copyCaption");

    right.append(btnSave, btnCopyScript, btnCopyCaption);

    head.append(left, right);

    // Sections
    const hooks = createSection(t("hooks"), listBox(out.hooks, dir));
    const scriptBlock = textBox(buildFullScript(out), dir);
    const script = createSection(t("script"), scriptBlock);
    const cap = createSection(t("caption"), textBox(out.caption || "", dir));
    const tags = createSection(t("hashtags"), textBox(buildHashtags(out), "ltr"));

    // More actions (bottom)
    const actions = document.createElement("div");
    actions.className = "action-buttons";

    const btnCopyTags = document.createElement("button");
    btnCopyTags.type = "button";
    btnCopyTags.className = "btn-secondary";
    btnCopyTags.dataset.action = "copy-hashtags";
    btnCopyTags.textContent = t("copyHashtags");

    const btnCopyJson = document.createElement("button");
    btnCopyJson.type = "button";
    btnCopyJson.className = "btn-secondary";
    btnCopyJson.dataset.action = "copy-json";
    btnCopyJson.textContent = t("copyJSON");

    actions.append(btnCopyTags, btnCopyJson);

    card.append(head, hooks, script, cap, tags, actions);
    el.output.appendChild(card);

    // Store last output in DOM for actions
    el.output.dataset.lastMeta = JSON.stringify(metaInfo);
    el.output.dataset.lastOut = JSON.stringify(out);
  }

  // =========================
  // Library
  // =========================
  function addToLibrary(item) {
    state.library.unshift(item);
    state.library = state.library.slice(0, LIBRARY_MAX);
    persistLibrary();
  }

  function clearLibrary() {
    state.library = [];
    persistLibrary();
  }

  function deleteFromLibrary(id) {
    state.library = state.library.filter((x) => x.id !== id);
    persistLibrary();
  }

  function renderLibrary() {
    if (!el.libraryList) return;

    const query = (el.librarySearch?.value || "").trim().toLowerCase();
    const platform = el.libraryPlatform?.value || "all";

    const filtered = state.library.filter((item) => {
      const matchesQuery = !query || (item.topic || "").toLowerCase().includes(query);
      const matchesPlatform = platform === "all" || item.platform === platform;
      return matchesQuery && matchesPlatform;
    });

    el.libraryList.innerHTML = "";

    if (!state.library.length) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.textContent = t("libraryEmpty");
      el.libraryList.appendChild(empty);
      return;
    }

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.textContent = t("noResults");
      el.libraryList.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const details = document.createElement("details");
      details.className = "lib-item";

      const summary = document.createElement("summary");
      const left = document.createElement("div");

      const title = document.createElement("div");
      title.className = "lib-title";
      title.textContent = item.topic || "(Untitled)";

      const meta = document.createElement("div");
      meta.className = "lib-meta";
      meta.textContent = `${item.platform} • ${item.tone} • ${item.length}s • ${item.language} • ${formatTime(item.createdAt)}`;

      left.append(title, meta);

      const chev = document.createElement("div");
      chev.className = "lib-chevron";
      chev.textContent = "▾";

      summary.append(left, chev);

      const body = document.createElement("div");
      body.className = "lib-body";

      const dir = item.language === "Arabic" ? "rtl" : "ltr";
      body.append(
        createSection(t("hooks"), listBox(item.output?.hooks, dir)),
        createSection(t("script"), textBox(buildFullScript(item.output), dir)),
        createSection(t("caption"), textBox(item.output?.caption || "", dir)),
        createSection(t("hashtags"), textBox(buildHashtags(item.output), "ltr"))
      );

      const actions = document.createElement("div");
      actions.className = "action-row";
      actions.style.marginTop = "14px";

      const mkBtn = (label, action, klass) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = klass;
        b.dataset.action = action;
        b.dataset.id = item.id;
        b.textContent = label;
        return b;
      };

      actions.append(
        mkBtn(t("copyScript"), "lib-copy-script", "btn-secondary"),
        mkBtn(t("copyCaption"), "lib-copy-caption", "btn-secondary"),
        mkBtn(t("copyHashtags"), "lib-copy-hashtags", "btn-secondary"),
        mkBtn(t("copyJSON"), "lib-copy-json", "btn-secondary"),
        mkBtn(t("useAgain"), "lib-use", "btn-ghost"),
        mkBtn(t("deleteItem"), "lib-delete", "btn-ghost")
      );

      body.appendChild(actions);

      details.append(summary, body);
      el.libraryList.appendChild(details);
    });
  }

  function exportLibrary() {
    if (!state.library.length) {
      toast(t("nothingToExport"), "danger");
      return;
    }

    const blob = new Blob([JSON.stringify(state.library, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    a.download = `scriptspark_library_${date}.json`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);

    toast(t("exported"), "success");
  }

  // =========================
  // Events
  // =========================
  async function onGenerateSubmit(e) {
    if (el.btnGenerate.disabled) return;

    e.preventDefault();

    const topic = (el.topic.value || "").trim();
    if (!topic) {
      toast(t("topicRequired"), "danger");
      el.topic.focus();
      return;
    }

    const payload = {
      platform: el.platform.value,
      tone: el.tone.value,
      length: Number(el.length.value),
      language: el.language.value,
      topic
    };

    renderSkeleton();
    setGenerating(true);

    try {
      const out = await generateWithAI(payload);

      // Shape validation (soft)
      const normalized = {
        hooks: Array.isArray(out.hooks) ? out.hooks.slice(0, 5) : [],
        script: typeof out.script === "object" && out.script ? out.script : { intro: "", body: "", cta: "" },
        caption: typeof out.caption === "string" ? out.caption : "",
        hashtags: Array.isArray(out.hashtags) ? out.hashtags : []
      };

      renderOutput(normalized, payload);
    } catch (err) {
      console.error(err);
      el.output.style.display = "none";
      toast(t("connectionFailed"), "danger", 3400);
    } finally {
      setGenerating(false);
    }
  }

  function onOutputClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const lastOut = safeJsonParse(el.output.dataset.lastOut, null);
    const lastMeta = safeJsonParse(el.output.dataset.lastMeta, null);

    if (!lastOut || !lastMeta) return;

    if (action === "save") {
      addToLibrary({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        createdAt: nowIso(),
        topic: lastMeta.topic,
        platform: lastMeta.platform,
        tone: lastMeta.tone,
        length: lastMeta.length,
        language: lastMeta.language,
        output: lastOut
      });
      toast(t("saved"), "success");
      return;
    }

    if (action === "copy-script") return copyToClipboard(buildFullScript(lastOut));
    if (action === "copy-caption") return copyToClipboard(lastOut.caption || "");
    if (action === "copy-hashtags") return copyToClipboard(buildHashtags(lastOut));
    if (action === "copy-json") return copyToClipboard(JSON.stringify(lastOut, null, 2));
  }

  function onLibraryClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const item = state.library.find((x) => x.id === id);
    if (!item) return;

    if (action === "lib-delete") {
      deleteFromLibrary(id);
      renderLibrary();
      toast(t("deleted"), "success");
      return;
    }

    if (action === "lib-use") {
      // Prefill create form and navigate
      el.platform.value = item.platform;
      el.tone.value = item.tone;
      el.length.value = String(item.length);
      el.language.value = item.language;
      el.topic.value = item.topic || "";
      el.language.dataset.userChanged = "1";
      window.location.hash = "#/create";
      toast(t("copied"), "success", 1200);
      return;
    }

    if (action === "lib-copy-script") return copyToClipboard(buildFullScript(item.output));
    if (action === "lib-copy-caption") return copyToClipboard(item.output?.caption || "");
    if (action === "lib-copy-hashtags") return copyToClipboard(buildHashtags(item.output));
    if (action === "lib-copy-json") return copyToClipboard(JSON.stringify(item, null, 2));
  }

  function onSaveSettings() {
    const v = (el.apiUrl.value || "").trim();
    state.apiUrl = v || DEFAULT_API_URL;
    persistSettings();
    toast(t("apiSaved"), "success");
  }

  function onResetSettings() {
    state.apiUrl = DEFAULT_API_URL;
    localStorage.removeItem(STORAGE.API_URL);
    el.apiUrl.value = DEFAULT_API_URL;
    toast(t("apiReset"), "success");
  }

  // =========================
  // Init
  // =========================
  function init() {
    loadState();

    // Track user change on content language
    el.language.addEventListener("change", () => (el.language.dataset.userChanged = "1"));

    // Language toggle
    el.langToggle.addEventListener("click", () => {
      setUiLang(state.uiLang === "ar" ? "en" : "ar");
    });

    // Settings explicit buttons
    el.btnUiEn.addEventListener("click", () => setUiLang("en"));
    el.btnUiAr.addEventListener("click", () => setUiLang("ar"));
    el.btnSaveSettings.addEventListener("click", onSaveSettings);
    el.btnResetSettings.addEventListener("click", onResetSettings);

    // Form
    el.form.addEventListener("submit", onGenerateSubmit);
    el.output.addEventListener("click", onOutputClick);

    // Library controls
    el.librarySearch.addEventListener("input", renderLibrary);
    el.libraryPlatform.addEventListener("change", renderLibrary);
    el.btnExport.addEventListener("click", exportLibrary);
    el.btnClear.addEventListener("click", () => {
      clearLibrary();
      renderLibrary();
      toast(t("cleared"), "success");
    });
    el.libraryList.addEventListener("click", onLibraryClick);

    // Routing
    window.addEventListener("hashchange", onHashChange);

    // Initial i18n and route
    applyI18n();
    if (!window.location.hash) window.location.hash = "#/create";
    onHashChange();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
