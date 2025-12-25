/* app.js（改修版）
 * 改修:
 * 1) 弱点教科：全教科満点(5/5)なら「なし」
 * 2) 回答時間の計測を改善：firstAtMs〜lastAtMs（放置時間を除外）
 * 3) 正誤×時間×難易度の傾向から「受験スタイル分析」を出力
 * 4) 出題重複ゼロ＋似た型の偏り抑制（前回実装を維持）
 */

(() => {
  "use strict";

  // ===== PWA (Service Worker) =====
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // ===== Constants =====
  const PASSPHRASE = "0217";
  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const DIFFS = ["基礎", "標準", "発展"];
  const LEVELS = ["小", "中"];

  // ===== Utilities =====
  const $ = (id) => document.getElementById(id);

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 1700);
  }

  function safeNumber(n) {
    return Number.isFinite(n) ? n : 0;
  }

  function copyTextFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }

  function cryptoId() {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, x) => s + x, 0) / arr.length;
  }
  function stdev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = mean(arr.map((x) => (x - m) ** 2));
    return Math.sqrt(v);
  }

  // ===== Gate =====
  function renderGate() {
    document.body.innerHTML = `
      <div style="max-width:760px;margin:70px auto;padding:18px;font-family:system-ui;color:#0B1B3A;">
        <div style="padding:18px;border:1px solid rgba(11,27,58,.18);border-radius:16px;background:rgba(255,255,255,.78);
                    box-shadow:0 14px 36px rgba(11,27,58,.12);">
          <h2 style="margin:0 0 10px;">合言葉が必要です</h2>
          <p style="margin:0 0 14px;color:rgba(11,27,58,.70);">
            このクイズは合言葉を知っている人だけ遊べます。
          </p>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input id="pw" inputmode="numeric" placeholder="合言葉（4桁）"
                   style="padding:12px 14px;border-radius:12px;border:1px solid rgba(11,27,58,.20);
                          background:rgba(255,255,255,.85);color:#0B1B3A;font-size:16px;outline:none;">
            <button id="enter"
                    style="padding:12px 14px;border-radius:12px;border:1px solid rgba(11,27,58,.28);
                           background:rgba(11,27,58,.86);color:#fff;font-weight:900;cursor:pointer;">
              入室
            </button>
          </div>

          <div id="msg" style="margin-top:10px;color:rgba(220,53,69,.95);display:none;font-weight:900;">
            合言葉が違います。
          </div>

          <hr style="border:none;height:1px;background:rgba(11,27,58,.14);margin:16px 0;">
          <div style="font-size:12px;color:rgba(11,27,58,.65);">
            ※同じタブでは通過状態を保持（タブを閉じると再入力）。
          </div>
        </div>
      </div>
    `;

    const input = document.getElementById("pw");
    const btn = document.getElementById("enter");
    const msg = document.getElementById("msg");

    function tryEnter() {
      if (input.value === PASSPHRASE) {
        sessionStorage.setItem("quiz_passed", "1");
        location.reload();
      } else {
        msg.style.display = "block";
        input.select();
      }
    }
    btn.addEventListener("click", tryEnter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryEnter();
    });
    input.focus();
  }

  function ensurePass() {
    const forceGate = new URLSearchParams(location.search).get("gate") === "1";
    const passed = sessionStorage.getItem("quiz_passed") === "1";
    if (forceGate || !passed) {
      renderGate();
      return false;
    }
    return true;
  }

  // ===== State =====
  const state = {
    seedStr: "",
    seed: 0,
    rng: null,
    bank: [],
    questions: [],
    // answers: qid -> {choiceIndex, firstAtMs, lastAtMs, changeCount, timeSpentSec}
    answers: new Map(),
    submitted: false,
    startedAtMs: 0,
    elapsedSec: 0,
    timerHandle: null,
    chart: null,
  };

  // ===== Filters =====
  function getFilters() {
    const lvls = [];
    if ($("lvlE")?.checked) lvls.push("小");
    if ($("lvlJ")?.checked) lvls.push("中");

    const diffs = [];
    if ($("dB")?.checked) diffs.push("基礎");
    if ($("dS")?.checked) diffs.push("標準");
    if ($("dA")?.checked) diffs.push("発展");

    if (lvls.length === 0) {
      lvls.push("小", "中");
      toast("学年が全OFFだったため、小＋中で出題します");
    }
    if (diffs.length === 0) {
      diffs.push("基礎", "標準", "発展");
      toast("難易度が全OFFだったため、基礎＋標準＋発展で出題します");
    }
    return { lvls, diffs };
  }

  // ===== Bank =====
  function ensureBankLoaded() {
    if (!window.SchoolQuizBank) {
      alert("bank.js が読み込めていません（SchoolQuizBank未定義）");
      return false;
    }
    if (!state.bank.length) {
      state.bank = window.SchoolQuizBank.buildAll(500);
    }
    return true;
  }

  // ===== Pattern inference / constraints =====
  function getPattern(q) {
    if (q.pattern) return String(q.pattern);
    const k = String(q.key || "");
    const parts = k.split("_").filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}_${parts[1]}`;
    return parts[0] || "unknown";
  }

  function normalizeText(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[、。．，,.!?！？「」『』（）()\[\]【】]/g, "")
      .slice(0, 60);
  }

  function diffPlanPerSubject(rng) {
    const pickTwo = shuffle(SUBJECTS, rng).slice(0, 2);
    const setTwo = new Set(pickTwo);
    const plan = {};
    for (const s of SUBJECTS) {
      plan[s] = setTwo.has(s)
        ? { 基礎: 1, 標準: 3, 発展: 1 }
        : { 基礎: 1, 標準: 2, 発展: 2 };
    }
    return plan;
  }

  function pickOneWithConstraints({
    pool,
    rng,
    usedKeys,
    usedTextSig,
    subPatternCount,
    globalPatternCount,
    limits,
    subject,
  }) {
    const shuffled = shuffle(pool, rng);
    const modes = ["strict", "relaxed", "free"];

    for (const mode of modes) {
      for (const q of shuffled) {
        if (!q) continue;

        if (usedKeys.has(q.key)) continue;
        const sig = normalizeText(q.q);
        if (usedTextSig.has(sig)) continue;

        const pat = getPattern(q);
        if (mode !== "free") {
          const subMap = subPatternCount.get(subject) || new Map();
          const subCnt = subMap.get(pat) || 0;
          const glbCnt = globalPatternCount.get(pat) || 0;

          if (mode === "strict") {
            if (subCnt >= limits.maxPerSubjectPattern) continue;
            if (glbCnt >= limits.maxGlobalPattern) continue;
          } else {
            if (subCnt >= limits.maxPerSubjectPatternRelaxed) continue;
            if (glbCnt >= limits.maxGlobalPattern) continue;
          }
        }

        usedKeys.add(q.key);
        usedTextSig.add(sig);

        const subMap2 = subPatternCount.get(subject) || new Map();
        subMap2.set(pat, (subMap2.get(pat) || 0) + 1);
        subPatternCount.set(subject, subMap2);
        globalPatternCount.set(pat, (globalPatternCount.get(pat) || 0) + 1);

        return q;
      }
    }
    return null;
  }

  function pickFiveForSubject({
    subject,
    bank,
    rng,
    filters,
    plan,
    usedKeys,
    usedTextSig,
    subPatternCount,
    globalPatternCount,
    limits,
  }) {
    const chosen = [];
    const desired = [];
    for (const d of DIFFS) for (let i = 0; i < (plan[d] || 0); i++) desired.push(d);
    const desiredOrder = shuffle(desired, rng);

    for (const diff of desiredOrder) {
      if (!filters.diffs.includes(diff)) continue;
      const pool = bank.filter(
        (q) => q.sub === subject && q.diff === diff && filters.lvls.includes(q.level)
      );
      const q1 = pickOneWithConstraints({
        pool, rng, usedKeys, usedTextSig, subPatternCount, globalPatternCount, limits, subject
      });
      if (q1) chosen.push({ ...q1, id: cryptoId() });
      if (chosen.length >= 5) break;
    }

    while (chosen.length < 5) {
      const pool2 = bank.filter(
        (q) =>
          q.sub === subject &&
          filters.lvls.includes(q.level) &&
          filters.diffs.includes(q.diff)
      );
      const q2 = pickOneWithConstraints({
        pool: pool2, rng, usedKeys, usedTextSig, subPatternCount, globalPatternCount, limits, subject
      });
      if (!q2) break;
      chosen.push({ ...q2, id: cryptoId() });
    }

    while (chosen.length < 5) {
      toast(`設定の都合で ${subject} の条件を一部緩和して補填しました`);
      const pool3 = bank.filter((q) => q.sub === subject && filters.lvls.includes(q.level));
      const q3 = pickOneWithConstraints({
        pool: pool3, rng, usedKeys, usedTextSig, subPatternCount, globalPatternCount, limits, subject
      });
      if (!q3) break;
      chosen.push({ ...q3, id: cryptoId() });
    }

    while (chosen.length < 5) {
      toast(`プール不足：${subject} を同教科から最終補填しました`);
      const pool4 = bank.filter((q) => q.sub === subject);
      const q4 = pickOneWithConstraints({
        pool: pool4, rng, usedKeys, usedTextSig, subPatternCount, globalPatternCount, limits, subject
      });
      if (!q4) break;
      chosen.push({ ...q4, id: cryptoId() });
    }

    return chosen.slice(0, 5);
  }

  function uniqueByKey(arr) {
    const seen = new Set();
    const out = [];
    for (const q of arr) {
      if (seen.has(q.key)) continue;
      seen.add(q.key);
      out.push(q);
    }
    return out;
  }

  // ===== Build Quiz =====
  function buildQuiz() {
    if (!ensureBankLoaded()) return;

    const seedStr = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const seed = hashSeed(seedStr);
    const rng = mulberry32(seed);

    state.seedStr = seedStr;
    state.seed = seed;
    state.rng = rng;

    state.answers = new Map();
    state.submitted = false;
    state.startedAtMs = Date.now();
    state.elapsedSec = 0;

    $("seedPill").textContent = `Seed: ${seed.toString(16)}`;
    $("timerPill").textContent = `Time: 00:00`;
    $("progressPill").textContent = `Answered: 0 / 25`;
    $("btnSubmit").disabled = true;
    $("btnCopy").disabled = true;

    setKpisPlaceholders();
    renderAnalysisPlaceholder();
    destroyChart();
    $("numStrip").innerHTML = "";
    $("quizRoot").innerHTML = "";

    const filters = getFilters();

    const limits = {
      maxPerSubjectPattern: 2,
      maxPerSubjectPatternRelaxed: 3,
      maxGlobalPattern: 6,
    };

    const usedKeys = new Set();
    const usedTextSig = new Set();
    const subPatternCount = new Map();
    const globalPatternCount = new Map();

    const planBySub = diffPlanPerSubject(rng);

    let picked = [];
    for (const sub of SUBJECTS) {
      const plan = planBySub[sub];
      const five = pickFiveForSubject({
        subject: sub,
        bank: state.bank,
        rng,
        filters,
        plan,
        usedKeys,
        usedTextSig,
        subPatternCount,
        globalPatternCount,
        limits,
      });
      picked = picked.concat(five);
    }

    picked = uniqueByKey(picked);

    while (picked.length < 25) {
      toast("プール不足のため全教科から補填しています");
      const pool = state.bank.filter(
        (q) => filters.lvls.includes(q.level) && filters.diffs.includes(q.diff)
      );
      const q = pickOneWithConstraints({
        pool,
        rng,
        usedKeys,
        usedTextSig,
        subPatternCount,
        globalPatternCount,
        limits: { ...limits, maxPerSubjectPattern: 3, maxPerSubjectPatternRelaxed: 4, maxGlobalPattern: 8 },
        subject: "補填",
      });
      if (!q) break;
      picked.push({ ...q, id: cryptoId() });
      picked = uniqueByKey(picked);
    }

    picked = shuffle(picked, rng).slice(0, 25).map((q, i) => ({
      ...q,
      no: i + 1,
    }));

    picked = uniqueByKey(picked);
    if (picked.length < 25) {
      const hardLimits = { maxPerSubjectPattern: 4, maxPerSubjectPatternRelaxed: 5, maxGlobalPattern: 10 };
      while (picked.length < 25) {
        const pool = state.bank.filter((q) => filters.lvls.includes(q.level));
        const q = pickOneWithConstraints({
          pool,
          rng,
          usedKeys,
          usedTextSig,
          subPatternCount,
          globalPatternCount,
          limits: hardLimits,
          subject: "補填",
        });
        if (!q) break;
        picked.push({ ...q, id: cryptoId(), no: picked.length + 1 });
        picked = uniqueByKey(picked);
      }
      picked = picked.slice(0, 25).map((q, i) => ({ ...q, no: i + 1 }));
    }

    if (picked.length < 25) {
      toast("問題数が不足しています。bank.js の問題数（固定データ/テンプレ）を増やしてください。");
    }

    state.questions = picked;

    renderQuestions();
    renderNumStrip();
    startTimer();
    updateProgress();
    toast("新しいクイズを生成しました（重複ゼロ＆偏り抑制）");
  }

  // ===== Rendering =====
  function setKpisPlaceholders() {
    const k = $("kpiGrid");
    k.innerHTML = `
      <div class="kpi"><div class="v">-</div><div class="k">総合スコア</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">正答率</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">平均回答時間</div></div>
      <div class="kpi"><div class="v">-</div><div class="k">弱点教科</div></div>
    `;
  }

  function renderAnalysisPlaceholder() {
    $("analysisBox").innerHTML = `
      <b>提出すると</b>、ここに分析が出ます。
      <ul>
        <li>教科別：得点・傾向</li>
        <li>難易度別：得点（基礎/標準/発展）</li>
        <li>学年別：得点（小/中）</li>
        <li>正誤×時間からの「受験スタイル分析」</li>
      </ul>
      <div class="muted tiny">※番号ボタンで解説は提出後に表示</div>
    `;
  }

  function renderQuestions() {
    const root = $("quizRoot");
    root.innerHTML = "";

    for (const item of state.questions) {
      const qEl = document.createElement("div");
      qEl.className = "q";
      qEl.dataset.qid = item.id;

      const top = document.createElement("div");
      top.className = "qtop";

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="qtitle">Q${item.no}. ${escapeHtml(item.q)}</div>
        <div class="qmeta">
          <span class="tag">${escapeHtml(item.sub)}</span>
          <span class="tag">${escapeHtml(item.level)}</span>
          <span class="tag">${escapeHtml(item.diff)}</span>
        </div>
      `;

      const right = document.createElement("div");
      const statusTag = document.createElement("span");
      statusTag.className = "tag warn";
