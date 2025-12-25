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
      statusTag.textContent = "未採点";
      statusTag.id = `status-${item.id}`;

      const ansTag = document.createElement("span");
      ansTag.className = "tag";
      ansTag.textContent = "未回答";
      ansTag.id = `ans-${item.id}`;
      right.appendChild(statusTag);
      right.appendChild(ansTag);

      top.appendChild(left);
      top.appendChild(right);

      const choices = document.createElement("div");
      choices.className = "choices";

      item.c.forEach((text, idx) => {
        const label = document.createElement("label");
        label.className = "choice";
        label.innerHTML = `
          <input type="radio" name="q-${item.id}" value="${idx}" />
          <div><b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(text)}</div>
        `;

        label.addEventListener("click", () => {
          if (state.submitted) return;
          const now = Date.now();

          const prev = state.answers.get(item.id);
          if (!prev) {
            state.answers.set(item.id, {
              choiceIndex: idx,
              firstAtMs: now,
              lastAtMs: now,
              changeCount: 1,
              timeSpentSec: 0,
            });
          } else {
            prev.choiceIndex = idx;
            prev.lastAtMs = now;
            prev.changeCount = (prev.changeCount || 0) + 1;
          }

          const box = root.querySelector(`.q[data-qid="${item.id}"]`);
          box.querySelectorAll(".choice").forEach((ch) => ch.classList.remove("selected"));
          label.classList.add("selected");
          $("ans-" + item.id).textContent = `回答: ${String.fromCharCode(65 + idx)}`;

          updateProgress();
        });

        choices.appendChild(label);
      });

      qEl.appendChild(top);
      qEl.appendChild(choices);
      root.appendChild(qEl);
    }
  }

  function updateProgress() {
    const answered = state.answers.size;
    $("progressPill").textContent = `Answered: ${answered} / 25`;
    $("btnSubmit").disabled = answered < 25 || state.submitted;
    if (!state.submitted) renderNumStrip();
  }

  function renderNumStrip() {
    const strip = $("numStrip");
    strip.innerHTML = "";
    for (const item of state.questions) {
      const btn = document.createElement("button");
      btn.textContent = item.no;
      btn.disabled = !state.submitted;
      btn.className = "neutral";

      if (state.submitted) {
        const ok = isCorrect(item.id);
        btn.className = ok ? "good" : "bad";
      }

      btn.addEventListener("click", () => {
        if (!state.submitted) return;
        openExplanation(item.no);
      });

      strip.appendChild(btn);
    }
  }

  // ===== Timer =====
  function startTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = setInterval(() => {
      state.elapsedSec = Math.floor((Date.now() - state.startedAtMs) / 1000);
      $("timerPill").textContent = `Time: ${fmtTime(state.elapsedSec)}`;
    }, 250);
  }

  // ===== Scoring =====
  function isCorrect(qid) {
    const q = state.questions.find((x) => x.id === qid);
    const a = state.answers.get(qid);
    if (!q || !a) return false;
    return a.choiceIndex === q.a;
  }

  // 放置時間を除外：最初の選択〜最後の選択まで
  function finalizeTimes() {
    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      if (!a) continue;
      const first = safeNumber(a.firstAtMs);
      const last = safeNumber(a.lastAtMs) || first;
      const sec = first ? Math.max(1, Math.round((last - first) / 1000)) : 0;
      a.timeSpentSec = sec;
    }
  }

  function submit() {
    if (state.submitted) return;
    if (state.answers.size < 25) {
      toast("全問回答してから提出してください");
      return;
    }

    finalizeTimes();
    state.submitted = true;

    $("btnSubmit").disabled = true;
    $("btnCopy").disabled = false;

    const root = $("quizRoot");

    for (const item of state.questions) {
      const box = root.querySelector(`.q[data-qid="${item.id}"]`);
      const choices = Array.from(box.querySelectorAll(".choice"));
      const radios = Array.from(box.querySelectorAll('input[type="radio"]'));
      radios.forEach((r) => (r.disabled = true));

      const ans = state.answers.get(item.id);
      const chosen = ans.choiceIndex;
      const correct = item.a;

      choices.forEach((ch, idx) => {
        ch.classList.remove("selected", "correct", "wrong");
        if (idx === chosen) ch.classList.add("selected");
        if (idx === correct) ch.classList.add("correct");
        if (idx === chosen && chosen !== correct) ch.classList.add("wrong");
      });

      const ok = chosen === correct;
      const st = $("status-" + item.id);
      st.className = `tag ${ok ? "good" : "bad"}`;
      st.textContent = ok ? "正解" : "不正解";
    }

    renderNumStrip();
    renderResultsAndAnalysis();
    toast("採点しました（番号から解説が開けます）");
  }

  function buildPersonAnalysis({ perQTimes, perQOk, changeCounts, byDiff, bySub }) {
    const avg = mean(perQTimes);
    const sd = stdev(perQTimes);

    const okTimes = perQTimes.filter((_, i) => perQOk[i]);
    const ngTimes = perQTimes.filter((_, i) => !perQOk[i]);
    const avgOk = mean(okTimes);
    const avgNg = mean(ngTimes);

    const avgChange = mean(changeCounts);
    const changeHeavy = avgChange >= 1.8;

    // スピード傾向
    let speedType = "標準ペース型";
    if (avg <= 6) speedType = "高速処理型（即断で回す）";
    else if (avg >= 14) speedType = "熟考型（時間を使って精度を取りに行く）";

    // ムラ
    let stability = "安定型";
    if (sd >= 8) stability = "ムラ型（問題相性で時間が跳ねやすい）";
    else if (sd >= 5) stability = "ややムラあり";

    // 誤答と時間の関係
    let errorStyle = "バランス型";
    if (ngTimes.length >= 3) {
      if (avgNg - avgOk >= 4) errorStyle = "考え込むほど外しやすい（方針迷子になりがち）";
      else if (avgOk - avgNg >= 4) errorStyle = "直感ミス型（急ぐほど落とす）";
    }

    // 難易度耐性
    const acc = (x) => (x.total ? x.correct / x.total : 0);
    const aB = acc(byDiff["基礎"]);
    const aS = acc(byDiff["標準"]);
    const aA = acc(byDiff["発展"]);
    let diffType = "難易度耐性：良好";
    if (aA <= aS - 0.25) diffType = "難易度耐性：発展で落ちやすい（解法の型が未固定）";
    if (aS <= aB - 0.25) diffType = "難易度耐性：標準で落ちやすい（手順の精度を要改善）";

    // 教科偏差
    const subScores = SUBJECTS.map((s) => bySub[s].correct);
    const min = Math.min(...subScores);
    const max = Math.max(...subScores);
    let subType = "教科バランス：良好";
    if (max - min >= 3) subType = "教科バランス：得意不得意が大きい（学習配分で伸びる）";
    else if (max - min === 2) subType = "教科バランス：やや偏りあり";

    // 変更回数（迷い）
    let decide = "選択の迷い：少なめ";
    if (changeHeavy) decide = "選択の迷い：多め（見直し癖あり／時間配分に注意）";

    return [
      `<b>受験スタイル分析（正誤×時間×迷い）</b>`,
      `・${speedType}`,
      `・${stability}`,
      `・${errorStyle}`,
      `・${diffType}`,
      `・${subType}`,
      `・${decide}`,
      `<span class="muted tiny">指標：平均${Math.round(avg)}秒、時間ばらつき(σ)${Math.round(sd)}秒、正解時${Math.round(avgOk)}秒/不正解時${Math.round(avgNg)}秒、平均変更回数${avgChange.toFixed(2)}回</span>`,
    ];
  }

  function renderResultsAndAnalysis() {
    const bySub = Object.fromEntries(SUBJECTS.map((s) => [s, { correct: 0, total: 0, time: 0 }]));
    const byDiff = Object.fromEntries(DIFFS.map((d) => [d, { correct: 0, total: 0 }]));
    const byLvl = Object.fromEntries(LEVELS.map((l) => [l, { correct: 0, total: 0 }]));

    const perQTimes = [];
    const perQOk = [];
    const changeCounts = [];

    let totalCorrect = 0;
    let totalTime = 0;

    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      const ok = a.choiceIndex === q.a;

      bySub[q.sub].total++;
      bySub[q.sub].time += safeNumber(a.timeSpentSec);

      byDiff[q.diff].total++;
      byLvl[q.level].total++;

      perQTimes.push(safeNumber(a.timeSpentSec));
      perQOk.push(ok);
      changeCounts.push(safeNumber(a.changeCount));

      if (ok) {
        totalCorrect++;
        bySub[q.sub].correct++;
        byDiff[q.diff].correct++;
        byLvl[q.level].correct++;
      }

      totalTime += safeNumber(a.timeSpentSec);
    }

    const pct = Math.round((totalCorrect / 25) * 100);
    const avgTime = Math.round(totalTime / 25);

    const subCorrects = SUBJECTS.map((s) => bySub[s].correct);
    const minSub = Math.min(...subCorrects);
    const maxSub = Math.max(...subCorrects);

    const strongest =
      SUBJECTS.slice().sort((a, b) => bySub[b].correct - bySub[a].correct)[0];

    // ★ 弱点判定：全教科5/5なら「なし」、それ以外で同点ばかりなら「均等」
    let weakestText = "";
    if (minSub === 5) {
      weakestText = "なし（全教科満点）";
    } else if (maxSub === minSub) {
      weakestText = "均等（教科差なし）";
    } else {
      const weakest = SUBJECTS.slice().sort((a, b) => bySub[a].correct - bySub[b].correct)[0];
      weakestText = `${weakest}（${bySub[weakest].correct}/5）`;
    }

    // KPI
    $("kpiGrid").innerHTML = "";
    const kpis = [
      { v: `${totalCorrect} / 25`, k: "総合スコア" },
      { v: `${pct}%`, k: "正答率" },
      { v: `${avgTime}秒/問`, k: "平均回答時間" },
      { v: weakestText, k: "弱点教科" },
    ];
    for (const x of kpis) {
      const el = document.createElement("div");
      el.className = "kpi";
      el.innerHTML = `<div class="v">${escapeHtml(x.v)}</div><div class="k">${escapeHtml(x.k)}</div>`;
      $("kpiGrid").appendChild(el);
    }

    // Analysis text
    const lines = [];
    lines.push(`<b>分析サマリ</b>`);
    lines.push(`強み：<b>${escapeHtml(strongest)}</b> ／ 弱点：<b>${escapeHtml(weakestText)}</b>`);
    lines.push(`<div class="hr"></div>`);

    lines.push(`<b>教科別</b>`);
    for (const s of SUBJECTS) {
      lines.push(`・${escapeHtml(s)}：${bySub[s].correct}/5（平均 ${Math.round(bySub[s].time / 5)}秒/問）`);
    }

    lines.push(`<div class="hr"></div>`);
    lines.push(`<b>難易度別</b>`);
    for (const d of DIFFS) {
      const t = byDiff[d].total || 1;
      lines.push(`・${escapeHtml(d)}：${byDiff[d].correct}/${byDiff[d].total}（${Math.round((byDiff[d].correct / t) * 100)}%）`);
    }

    lines.push(`<div class="hr"></div>`);
    lines.push(`<b>学年別</b>`);
    for (const l of LEVELS) {
      const t = byLvl[l].total || 1;
      lines.push(`・${escapeHtml(l)}：${byLvl[l].correct}/${byLvl[l].total}（${Math.round((byLvl[l].correct / t) * 100)}%）`);
    }

    lines.push(`<div class="hr"></div>`);
    lines.push(...buildPersonAnalysis({ perQTimes, perQOk, changeCounts, byDiff, bySub }));

    $("analysisBox").innerHTML = lines.join("<br>");

    // Radar
    drawRadar(SUBJECTS.map((s) => bySub[s].correct));
  }

  function destroyChart() {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
  }

  function drawRadar(scores) {
    const canvas = $("radar");
    destroyChart();

    if (!window.Chart) {
      toast("Chart.js が読み込めないため、レーダーチャートを省略しました");
      return;
    }

    state.chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: SUBJECTS,
        datasets: [
          {
            label: "得点（各5点満点）",
            data: scores,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1 },
            pointLabels: { font: { size: 12, weight: "600" } },
          },
        },
      },
    });
  }

  // ===== Explanation Modal =====
  function openExplanation(no) {
    const item = state.questions.find((x) => x.no === no);
    if (!item) return;

    const ans = state.answers.get(item.id);
    const yourIdx = ans?.choiceIndex;
    const correctIdx = item.a;

    const your =
      yourIdx === undefined
        ? "未回答"
        : `${String.fromCharCode(65 + yourIdx)}. ${item.c[yourIdx]}`;
    const corr = `${String.fromCharCode(65 + correctIdx)}. ${item.c[correctIdx]}`;
    const ok = yourIdx === correctIdx;

    $("modalSub").textContent = `Q${item.no} / ${item.sub} / ${item.level} / ${item.diff} / ${ok ? "正解" : "不正解"}`;
    $("modalBody").innerHTML = `
      <div style="font-weight:900;font-size:16px;">${escapeHtml(item.q)}</div>
      <div class="hr"></div>
      <div><b>あなたの回答：</b> ${escapeHtml(your)}</div>
      <div><b>正解：</b> ${escapeHtml(corr)}</div>
      <div class="hr"></div>
      <div><b>解説：</b><br>${escapeHtml(item.exp)}</div>
      <div class="hr"></div>
      <div class="muted tiny">※提出後のみ閲覧可</div>
    `;

    $("modalBack").style.display = "flex";
    $("modalBack").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("modalBack").style.display = "none";
    $("modalBack").setAttribute("aria-hidden", "true");
  }

  // ===== Copy Results =====
  async function copyResults() {
    if (!state.submitted) {
      toast("提出後にコピーできます");
      return;
    }

    let totalCorrect = 0;
    for (const q of state.questions) if (isCorrect(q.id)) totalCorrect++;

    const lines = [];
    lines.push("【義務教育5教科クイズ 結果】");
    lines.push(`Seed: ${state.seed.toString(16)}`);
    lines.push(`Time: ${fmtTime(state.elapsedSec)}`);
    lines.push(`Score: ${totalCorrect}/25`);
    lines.push("");

    for (const q of state.questions) {
      const a = state.answers.get(q.id);
      const your = String.fromCharCode(65 + a.choiceIndex);
      const corr = String.fromCharCode(65 + q.a);
      const ok = your === corr ? "〇" : "×";
      lines.push(`Q${q.no} [${q.sub}/${q.level}/${q.diff}] ${ok} あなた:${your} 正解:${corr}`);
      lines.push(`  問: ${q.q}`);
      lines.push(`  解説: ${q.exp}`);
      lines.push(`  解答時間: ${a.timeSpentSec}秒 / 変更回数: ${a.changeCount}回`);
      lines.push("");
    }

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast("結果をコピーしました");
    } catch {
      const ok = copyTextFallback(text);
      ok ? toast("結果をコピーしました") : toast("コピーできませんでした");
    }
  }

  // ===== Reset =====
  function resetAnswers() {
    state.answers = new Map();
    state.submitted = false;

    $("btnCopy").disabled = true;
    $("btnSubmit").disabled = true;
    setKpisPlaceholders();
    renderAnalysisPlaceholder();
    destroyChart();
    renderQuestions();
    renderNumStrip();
    updateProgress();
    toast("回答をリセットしました");
  }

  // ===== Events =====
  function wireEvents() {
    $("btnNew").addEventListener("click", buildQuiz);
    $("btnReset").addEventListener("click", resetAnswers);
    $("btnSubmit").addEventListener("click", submit);
    $("btnCopy").addEventListener("click", copyResults);

    $("btnCloseModal").addEventListener("click", closeModal);
    $("modalBack").addEventListener("click", (e) => {
      if (e.target.id === "modalBack") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    ["lvlE", "lvlJ", "dB", "dS", "dA"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        toast("設定を変更しました（新しいクイズで反映）");
      });
    });
  }

  // ===== Boot =====
  if (!ensurePass()) return;
  wireEvents();
  buildQuiz();
})();
