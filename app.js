(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const unlockCard = $("unlockCard");
  const quizCard = $("quizCard");
  const resultCard = $("resultCard");

  const passInput = $("passInput");
  const btnUnlock = $("btnUnlock");
  const unlockMsg = $("unlockMsg");

  const btnNew = $("btnNew");
  const btnReset = $("btnReset");
  const btnGrade = $("btnGrade");

  const btnPrev = $("btnPrev");
  const btnNext = $("btnNext");

  const qIndex = $("qIndex");
  const qTags = $("qTags");
  const qText = $("qText");
  const choices = $("choices");
  const timerNow = $("timerNow");
  const progressBar = $("progressBar");

  const scoreLine = $("scoreLine");
  const breakdown = $("breakdown");
  const explainList = $("explainList");
  const aiAnalysis = $("aiAnalysis");

  const btnToggleHistory = $("btnToggleHistory");
  const historyPanel = $("historyPanel");
  const btnClearHistory = $("btnClearHistory");
  const historyAverages = $("historyAverages");
  const historyChart = $("historyChart");
  const historySummary = $("historySummary");
  const historyList = $("historyList");

  const btnCopy = $("btnCopy");
  const btnBackToTop = $("btnBackToTop");

  const radar = $("radar");
  const ctx = radar.getContext("2d");

  // ===== Settings =====
  const PASSPHRASE_HASH = hash("0217");
  const LS_UNLOCK = "schoolQuizUnlocked_v1";
  const LS_HISTORY = "schoolQuizHistory_v1";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];

  const state = {
    bankAll: [],
    quiz: [],
    answers: [],
    i: 0,
    qShownAt: 0,
    timerT: null,
    unlocked: false,
  };

  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function now() { return performance.now(); }
  function fmtSec(ms) { return (ms / 1000).toFixed(1) + "s"; }
  function pct(x) { return `${Math.round(x * 100)}%`; }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, x) => s + x, 0) / arr.length;
  }
  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function setUnlockedUI(on) {
    state.unlocked = on;
    btnNew.disabled = !on;
    if (!state.quiz.length) {
      btnReset.disabled = true;
      btnGrade.disabled = true;
    }
  }

  function readTags(selector) {
    return [...document.querySelectorAll(selector)]
      .filter(x => x.checked)
      .map(x => x.value);
  }

  // ===== Unlock =====
  function loadUnlock() {
    const v = localStorage.getItem(LS_UNLOCK);
    if (v === "1") {
      unlockCard.hidden = true;
      setUnlockedUI(true);
      loadBank();
    } else {
      unlockCard.hidden = false;
      setUnlockedUI(false);
    }
  }

  btnUnlock.addEventListener("click", () => {
    const entered = (passInput.value || "").trim();
    if (!entered) {
      unlockMsg.textContent = "合言葉を入力してください。";
      unlockMsg.style.color = "#b91c1c";
      return;
    }
    if (hash(entered) === PASSPHRASE_HASH) {
      localStorage.setItem(LS_UNLOCK, "1");
      unlockMsg.textContent = "解除しました。上の「新しいクイズ」から開始できます。";
      unlockMsg.style.color = "#1b7f4b";
      unlockCard.hidden = true;
      setUnlockedUI(true);
      loadBank();
    } else {
      unlockMsg.textContent = "合言葉が違います。";
      unlockMsg.style.color = "#b91c1c";
    }
  });

  function loadBank() {
    if (!window.SchoolQuizBank) {
      unlockMsg.textContent = "bank.js の読み込みに失敗しています。";
      unlockMsg.style.color = "#b91c1c";
      return;
    }
    state.bankAll = window.SchoolQuizBank.buildAll(500);
  }

  // ===== Quiz generation =====
  function groupBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  }

  function sampleDistinct(pool, n, opts) {
    const strictUnique = !!opts.strictUnique;
    const avoidSimilar = !!opts.avoidSimilar;

    const picked = [];
    const usedKey = new Set();
    const patternCount = new Map();

    const shuffled = pool.slice().sort(() => Math.random() - 0.5);

    function score(q) {
      const p = q.pattern || "misc";
      const c = patternCount.get(p) || 0;
      return -c + (Math.random() * 0.05);
    }

    while (picked.length < n) {
      let cands = shuffled.filter(q => !strictUnique || !usedKey.has(q.key));
      if (!cands.length) break;

      if (avoidSimilar) cands = cands.sort((a, b) => score(b) - score(a));
      const q = cands[0];
      if (!q) break;

      picked.push(q);
      usedKey.add(q.key);
      const p = q.pattern || "misc";
      patternCount.set(p, (patternCount.get(p) || 0) + 1);
    }
    return picked;
  }

  function stratifiedByDifficulty(pool, need, diffWanted) {
    const byDiff = groupBy(pool, q => q.diff || "標準");
    const pickFrom = (d) => (byDiff.get(d) || []);
    const b = Math.round(need * 0.2);
    const s = Math.round(need * 0.5);
    const a = Math.max(0, need - b - s);
    const want = { 基礎: b, 標準: s, 発展: a };

    const diffs = ["基礎", "標準", "発展"].filter(d => diffWanted.includes(d));
    const out = [];
    for (const d of ["基礎", "標準", "発展"]) {
      if (!diffWanted.includes(d)) continue;
      out.push(...pickFrom(d).slice(0, want[d] + 3));
    }
    if (out.length < need * 3) {
      for (const d of diffs) out.push(...pickFrom(d));
    }

    const seen = new Set();
    const uniq = [];
    for (const q of out) {
      if (seen.has(q.key)) continue;
      seen.add(q.key);
      uniq.push(q);
    }
    return uniq;
  }

  function buildQuiz() {
    const levels = readTags(".tagLevel");
    const diffs = readTags(".tagDiff");
    const strictUnique = $("strictUnique").checked;
    const avoidSimilar = $("avoidSimilar").checked;
    const mixDifficulty = $("mixDifficulty").checked;

    const filtered = state.bankAll.filter(q =>
      SUBJECTS.includes(q.sub) &&
      (levels.length ? levels.includes(q.level) : true) &&
      (diffs.length ? diffs.includes(q.diff) : true)
    );

    const bySub = groupBy(filtered, q => q.sub);
    const quiz = [];
    const globalUsed = new Set();

    for (const sub of SUBJECTS) {
      let pool = (bySub.get(sub) || []).slice();
      if (mixDifficulty) {
        const candidates = stratifiedByDifficulty(pool, 5, diffs.length ? diffs : ["基礎", "標準", "発展"]);
        pool = candidates.length ? candidates : pool;
      }
      pool = pool.filter(q => !globalUsed.has(q.key));
      const picked = sampleDistinct(pool, 5, { strictUnique, avoidSimilar });
      for (const q of picked) globalUsed.add(q.key);
      quiz.push(...picked);
    }

    if (quiz.length < 25) {
      const restPool = filtered.filter(q => !globalUsed.has(q.key));
      const add = sampleDistinct(restPool, 25 - quiz.length, { strictUnique, avoidSimilar });
      quiz.push(...add);
    }

    state.quiz = quiz.slice(0, 25).sort(() => Math.random() - 0.5);
    state.answers = state.quiz.map(q => ({
      chosen: null,
      correctIndex: q.a,
      isCorrect: null,
      timeMs: 0,
      visits: 0,
    }));
    state.i = 0;
    state.qShownAt = now();
  }

  function setVisible(section) {
    quizCard.hidden = section !== "quiz";
    resultCard.hidden = section !== "result";
  }

  function tagPill(text) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = text;
    return span;
  }

  function updateTimerUI() {
    const a = state.answers[state.i];
    const cur = now();
    const elapsed = a.timeMs + (cur - state.qShownAt);
    timerNow.textContent = fmtSec(elapsed);
  }

  function startTimerTick() {
    stopTimerTick();
    state.timerT = setInterval(updateTimerUI, 120);
  }
  function stopTimerTick() {
    if (state.timerT) clearInterval(state.timerT);
    state.timerT = null;
  }

  function accumulateTime() {
    const a = state.answers[state.i];
    const cur = now();
    a.timeMs += (cur - state.qShownAt);
    state.qShownAt = cur;
  }

  function renderQuestion() {
    if (!state.quiz.length) return;

    const q = state.quiz[state.i];
    const a = state.answers[state.i];
    a.visits += 1;

    qIndex.textContent = `Q${state.i + 1} / ${state.quiz.length}`;
    qTags.innerHTML = "";
    qTags.appendChild(tagPill(q.sub));
    qTags.appendChild(tagPill(`${q.level}`));
    qTags.appendChild(tagPill(`${q.diff}`));
    qTags.appendChild(tagPill(`#${q.pattern || "misc"}`));

    qText.textContent = q.q;

    choices.innerHTML = "";
    const labels = ["A", "B", "C", "D"];
    q.c.forEach((txt, idx) => {
      const div = document.createElement("div");
      div.className = "choice" + (a.chosen === idx ? " selected" : "");
      div.setAttribute("role", "button");
      div.tabIndex = 0;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = labels[idx];

      const body = document.createElement("div");
      body.textContent = txt;

      div.appendChild(badge);
      div.appendChild(body);

      div.addEventListener("click", () => choose(idx));
      div.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose(idx);
        }
      });

      choices.appendChild(div);
    });

    btnPrev.disabled = state.i === 0;
    btnNext.textContent = (state.i === state.quiz.length - 1) ? "採点へ" : "次へ";

    const answered = state.answers.filter(x => x.chosen !== null).length;
    progressBar.style.width = `${Math.round((answered / state.quiz.length) * 100)}%`;

    state.qShownAt = now();
    startTimerTick();
    updateTimerUI();

    btnReset.disabled = false;
    btnGrade.disabled = false;
  }

  function choose(idx) {
    accumulateTime();
    state.answers[state.i].chosen = idx;
    renderQuestion();
  }

  function next() {
    accumulateTime();
    if (state.i === state.quiz.length - 1) {
      gradeAndShow();
      return;
    }
    state.i += 1;
    renderQuestion();
  }

  function prev() {
    accumulateTime();
    state.i = Math.max(0, state.i - 1);
    renderQuestion();
  }

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);

  btnNew.addEventListener("click", () => {
    if (!state.unlocked) return;
    buildQuiz();
    setVisible("quiz");
    renderQuestion();
  });

  btnReset.addEventListener("click", () => {
    if (!state.quiz.length) return;
    if (!confirm("解答をすべてリセットしますか？")) return;
    accumulateTime();
    state.answers = state.quiz.map(q => ({
      chosen: null, correctIndex: q.a, isCorrect: null, timeMs: 0, visits: 0
    }));
    state.i = 0;
    renderQuestion();
  });

  btnGrade.addEventListener("click", () => {
    if (!state.quiz.length) return;
    gradeAndShow();
  });

  btnBackToTop.addEventListener("click", () => {
    stopTimerTick();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setVisible("quiz");
  });

  // ===== Grading & Analysis =====
  function gradeAndShow() {
    stopTimerTick();
    accumulateTime();

    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];
      a.isCorrect = (a.chosen === q.a);
    }

    const total = state.quiz.length;
    const correct = state.answers.filter(x => x.isCorrect).length;

    const totalTime = state.answers.reduce((s, x) => s + x.timeMs, 0);
    const avgTime = total ? totalTime / total : 0;

    scoreLine.textContent = `${correct} / ${total}（${Math.round(correct / total * 100)}%）　合計：${fmtSec(totalTime)}　平均：${fmtSec(avgTime)}`;

    renderBreakdown();
    drawRadar();
    renderExplain();
    renderAIText();

    // 履歴保存 → 表示は「開いた時」にまとめて更新
    saveHistorySnapshot();
    if (historyPanel && !historyPanel.hidden) renderHistoryPanel();

    setVisible("result");
    window.scrollTo({ top: resultCard.offsetTop - 10, behavior: "smooth" });
  }

  function renderBreakdown() {
    const bySub = SUBJECTS.map(sub => {
      const idxs = state.quiz.map((q, i) => ({ q, i })).filter(x => x.q.sub === sub).map(x => x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      const time = idxs.reduce((s, i) => s + state.answers[i].timeMs, 0);
      const avg = total ? time / total : 0;
      return { sub, total, cor, acc: total ? Math.round(cor / total * 100) : 0, avg };
    });

    const byDiff = ["基礎", "標準", "発展"].map(d => {
      const idxs = state.quiz.map((q, i) => ({ q, i })).filter(x => x.q.diff === d).map(x => x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      const time = idxs.reduce((s, i) => s + state.answers[i].timeMs, 0);
      const avg = total ? time / total : 0;
      return { d, total, cor, acc: total ? Math.round(cor / total * 100) : 0, avg };
    });

    const patterns = {};
    for (let i = 0; i < state.quiz.length; i++) {
      const p = state.quiz[i].pattern || "misc";
      if (!patterns[p]) patterns[p] = { p, total: 0, cor: 0, time: 0 };
      patterns[p].total += 1;
      if (state.answers[i].isCorrect) patterns[p].cor += 1;
      patterns[p].time += state.answers[i].timeMs;
    }
    const byPattern = Object.values(patterns).map(x => ({
      ...x,
      acc: x.total ? Math.round(x.cor / x.total * 100) : 0,
      avg: x.total ? x.time / x.total : 0
    })).sort((a, b) => (a.acc - b.acc) || (b.avg - a.avg));

    breakdown.innerHTML = "";

    const blocks = [
      { k: "教科別", items: bySub.map(x => `${x.sub}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) },
      { k: "難易度別", items: byDiff.map(x => `${x.d}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) },
      { k: "パターン別（弱い順）", items: byPattern.slice(0, 12).map(x => `#${x.p}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) }
    ];

    for (const b of blocks) {
      const box = document.createElement("div");
      box.className = "kpi";

      const k = document.createElement("div");
      k.className = "k";
      k.textContent = b.k;

      const v = document.createElement("div");
      v.className = "v";
      v.textContent = b.items[0] || "-";

      const list = document.createElement("div");
      list.className = "muted small";
      list.style.marginTop = "8px";
      list.textContent = b.items.slice(1).join(" / ");

      box.appendChild(k);
      box.appendChild(v);
      box.appendChild(list);
      breakdown.appendChild(box);
    }
  }

  function drawRadar() {
    const scores = SUBJECTS.map(sub => {
      const idxs = state.quiz.map((q, i) => ({ q, i })).filter(x => x.q.sub === sub).map(x => x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      return total ? (cor / total * 100) : 0;
    });

    const W = radar.width, H = radar.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2 + 10;
    const R = Math.min(W, H) * 0.36;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e8dfcf";

    for (let g = 1; g <= 5; g++) {
      const r = (R * g) / 5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (-Math.PI / 2) + (i * 2 * Math.PI / 5);
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.font = "12px system-ui";
    ctx.fillStyle = "#0d1b2a";
    for (let i = 0; i < 5; i++) {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.stroke();

      const x = cx + (R + 18) * Math.cos(ang);
      const y = cy + (R + 18) * Math.sin(ang);
      const label = `${SUBJECTS[i]} ${Math.round(scores[i])}%`;
      ctx.fillText(label, x - (label.length * 3), y + 4);
    }

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI / 5);
      const r = (scores[i] / 100) * R;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#1f4aa8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#1f4aa8";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function renderExplain() {
    explainList.innerHTML = "";
    const box = document.createElement("div");
    box.className = "explainBox";
    box.id = "explainBox";
    box.textContent = "番号を押すと、ここに解説が表示されます。";

    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];

      const b = document.createElement("button");
      b.className = "qbtn";
      b.textContent = `${i + 1}`;
      if (a.isCorrect) b.style.borderColor = "#1b7f4b";
      else if (a.chosen !== null) b.style.borderColor = "#b91c1c";
      else b.style.borderColor = "#e8dfcf";

      b.addEventListener("click", () => {
        const chosen = a.chosen === null ? "(未回答)" : q.c[a.chosen];
        const correct = q.c[q.a];
        const line =
          `【Q${i + 1}】${q.sub} / ${q.level} / ${q.diff} / #${q.pattern}\n` +
          `${q.q}\n\n` +
          `あなたの解答：${chosen}\n` +
          `正解：${correct}\n` +
          `判定：${a.isCorrect ? "○" : (a.chosen === null ? "—" : "×")}\n` +
          `解説：${q.exp || "（解説なし）"}\n` +
          `この問題の累積時間：${fmtSec(a.timeMs)}（訪問回数：${a.visits}）`;
        box.textContent = line;
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      explainList.appendChild(b);
    }
    explainList.appendChild(box);
  }

  function renderAIText() {
    const rows = state.quiz.map((q, i) => ({ q, a: state.answers[i] }));
    const total = rows.length;
    const correct = rows.filter(x => x.a.isCorrect).length;
    const acc = total ? correct / total : 0;

    const times = rows.map(x => x.a.timeMs);
    const avgT = mean(times);
    const medT = median(times);

    const fastThresh = Math.max(1500, medT * 0.7);
    const slowThresh = Math.max(6000, medT * 1.3);

    const fastWrong = rows.filter(x => !x.a.isCorrect && x.a.chosen !== null && x.a.timeMs <= fastThresh);
    const slowWrong = rows.filter(x => !x.a.isCorrect && x.a.chosen !== null && x.a.timeMs >= slowThresh);
    const slowRight = rows.filter(x => x.a.isCorrect && x.a.timeMs >= slowThresh);
    const fastRight = rows.filter(x => x.a.isCorrect && x.a.timeMs <= fastThresh);

    const byKey = (keyFn) => {
      const m = new Map();
      for (const x of rows) {
        const k = keyFn(x.q);
        if (!m.has(k)) m.set(k, { k, total: 0, cor: 0, time: 0 });
        const o = m.get(k);
        o.total++;
        o.time += x.a.timeMs;
        if (x.a.isCorrect) o.cor++;
      }
      return [...m.values()].map(o => ({
        ...o,
        acc: o.total ? o.cor / o.total : 0,
        avg: o.total ? o.time / o.total : 0
      }));
    };

    const subStats = byKey(q => q.sub).sort((a, b) => a.acc - b.acc);
    const patStats = byKey(q => q.pattern || "misc").sort((a, b) => a.acc - b.acc || b.avg - a.avg);

    const weakestSub = subStats[0];
    const weakestPat = patStats[0];

    const weakCandidates = patStats.filter(x => x.total >= 2 && x.acc < 0.7);
    const weakText = weakCandidates.length
      ? weakCandidates.slice(0, 4).map(x => `#${x.k}（正答率${pct(x.acc)}・平均${fmtSec(x.avg)}）`).join("、")
      : "特になし（偏りなく処理できています）";

    const lines = [];
    lines.push(`総合所見：正答率は ${Math.round(acc * 100)}%（${correct}/${total}）。平均解答時間は ${fmtSec(avgT)}。`);
    lines.push("");
    lines.push(`スピード傾向：`);
    lines.push(`- 速く正確：${fastRight.length}問`);
    lines.push(`- 速いが誤り：${fastWrong.length}問`);
    lines.push(`- 遅いが正確：${slowRight.length}問`);
    lines.push(`- 遅くて誤り：${slowWrong.length}問`);
    lines.push("");
    lines.push(`苦手領域の候補：${weakText}`);
    lines.push("");

    if (weakCandidates.length === 0) {
      lines.push(`弱点判定：無し。`);
      lines.push(`次の伸ばし方：時間が伸びた問題（解説で累積時間が長い番号）を優先復習すると再現性が上がります。`);
      lines.push("");
    } else {
      if (fastWrong.length >= slowWrong.length) {
        lines.push(`推定原因：速い誤答が多め → 条件取り違え・見落としが発生しやすい型。`);
        lines.push(`対策：最初の10秒で「問われている量／条件」を一度言語化。`);
      } else {
        lines.push(`推定原因：遅い誤答が目立つ → 方針決定に時間がかかり最後に崩れる型。`);
        lines.push(`対策：解法テンプレ（図に印→条件→定理候補、式→単位→代入）を固定化。`);
      }
      lines.push("");
    }

    lines.push(`補足：最弱教科は「${weakestSub.k}」（正答率${pct(weakestSub.acc)}・平均${fmtSec(weakestSub.avg)}）。`);
    lines.push(`最も崩れやすい出題タイプは「#${weakestPat.k}」（正答率${pct(weakestPat.acc)}・平均${fmtSec(weakestPat.avg)}）。`);

    aiAnalysis.textContent = lines.join("\n");
  }

  // ===== History storage =====
  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveHistory(arr) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr.slice(-50)));
  }

  function computeStatsSnapshot() {
    const total = state.quiz.length;
    const correct = state.answers.filter(x => x.isCorrect).length;
    const totalTime = state.answers.reduce((s, x) => s + x.timeMs, 0);
    const avgTime = total ? totalTime / total : 0;

    const sub = {};
    for (const s of SUBJECTS) {
      const idxs = state.quiz.map((q, i) => ({ q, i })).filter(x => x.q.sub === s).map(x => x.i);
      const t = idxs.length;
      const c = idxs.filter(i => state.answers[i].isCorrect).length;
      const time = idxs.reduce((sum, i) => sum + state.answers[i].timeMs, 0);
      sub[s] = { total: t, correct: c, acc: t ? c / t : 0, avgTime: t ? time / t : 0 };
    }

    return {
      ts: new Date().toISOString(),
      total,
      correct,
      acc: total ? correct / total : 0,
      totalTime,
      avgTime,
      sub
    };
  }

  function saveHistorySnapshot() {
    const hist = loadHistory();
    hist.push(computeStatsSnapshot());
    saveHistory(hist);
  }

  // ===== History chart =====
  function drawHistoryChart(hist) {
    if (!historyChart) return;
    const c = historyChart.getContext("2d");
    const W = historyChart.width, H = historyChart.height;
    c.clearRect(0, 0, W, H);

    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, W, H);

    const padL = 52, padR = 18, padT = 18, padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const data = hist.slice(-10);
    if (data.length === 0) {
      c.fillStyle = "#5c6670";
      c.font = "14px system-ui";
      c.fillText("履歴がありません。", padL, padT + 20);
      return;
    }

    const ys = data.map(x => Math.round(x.acc * 100));
    const n = ys.length;

    c.strokeStyle = "#e8dfcf";
    c.lineWidth = 1;
    c.font = "12px system-ui";
    c.fillStyle = "#5c6670";

    for (const tick of [0, 25, 50, 75, 100]) {
      const y = padT + plotH - (tick / 100) * plotH;
      c.beginPath();
      c.moveTo(padL, y);
      c.lineTo(padL + plotW, y);
      c.stroke();
      c.fillText(`${tick}%`, 8, y + 4);
    }

    c.strokeStyle = "#e8dfcf";
    c.beginPath();
    c.moveTo(padL, padT);
    c.lineTo(padL, padT + plotH);
    c.lineTo(padL + plotW, padT + plotH);
    c.stroke();

    const xAt = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
    const yAt = (val) => padT + plotH - (val / 100) * plotH;

    c.fillStyle = "#5c6670";
    c.fillText(`最近${n}回`, padL, H - 12);

    c.strokeStyle = "#1f4aa8";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(ys[i]);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    c.fillStyle = "#1f4aa8";
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(ys[i]);
      c.beginPath();
      c.arc(x, y, 3.5, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "#0d1b2a";
      c.font = "12px system-ui";
      c.fillText(`${ys[i]}%`, x - 14, y - 10);
      c.fillStyle = "#1f4aa8";
    }
  }

  // ===== History analysis render =====
  function renderHistoryAverages(hist) {
    if (!historyAverages) return;
    historyAverages.innerHTML = "";

    if (!hist.length) return;

    // 全体平均（履歴全回の acc / avgTime）
    const overallAcc = mean(hist.map(h => h.acc));
    const overallAvgTime = mean(hist.map(h => h.avgTime));

    // 教科別平均
    const per = {};
    for (const s of SUBJECTS) {
      const accArr = hist.map(h => (h.sub && h.sub[s] ? h.sub[s].acc : null)).filter(v => typeof v === "number");
      const timeArr = hist.map(h => (h.sub && h.sub[s] ? h.sub[s].avgTime : null)).filter(v => typeof v === "number");
      per[s] = {
        acc: accArr.length ? mean(accArr) : 0,
        avgTime: timeArr.length ? mean(timeArr) : 0,
      };
    }

    const blocks = [
      {
        title: "全体平均（5教科）",
        main: `${pct(overallAcc)} / 平均${fmtSec(overallAvgTime)}`,
        sub: `対象：${hist.length}回分`
      },
      ...SUBJECTS.map(s => ({
        title: `${s} 平均`,
        main: `${pct(per[s].acc)} / 平均${fmtSec(per[s].avgTime)}`,
        sub: "（各回の5問平均）"
      }))
    ];

    for (const b of blocks) {
      const box = document.createElement("div");
      box.className = "kpi";

      const k = document.createElement("div");
      k.className = "k";
      k.textContent = b.title;

      const v = document.createElement("div");
      v.className = "v";
      v.textContent = b.main;

      const t = document.createElement("div");
      t.className = "muted small";
      t.style.marginTop = "8px";
      t.textContent = b.sub;

      box.appendChild(k);
      box.appendChild(v);
      box.appendChild(t);
      historyAverages.appendChild(box);
    }
  }

  function renderHistoryPanel() {
    const hist = loadHistory();

    if (!hist.length) {
      if (historySummary) historySummary.textContent = "まだ履歴がありません。採点するとこの端末に蓄積されます。";
      if (historyList) historyList.innerHTML = "";
      if (historyAverages) historyAverages.innerHTML = "";
      drawHistoryChart(hist);
      return;
    }

    const last = hist[hist.length - 1];

    // 推移：直近3回 vs その前3回
    const last3 = hist.slice(-3);
    const prev3 = hist.slice(-6, -3);
    const avgAcc = (a) => a.length ? mean(a.map(x => x.acc)) : null;

    const aLast = avgAcc(last3);
    const aPrev = avgAcc(prev3);

    let trend = "横ばい";
    if (aPrev !== null) {
      if (aLast - aPrev > 0.05) trend = "上向き";
      else if (aPrev - aLast > 0.05) trend = "下向き";
    } else {
      trend = "データ蓄積中";
    }

    // 弱め教科（履歴平均）
    const perAvg = SUBJECTS.map(s => {
      const accArr = hist.map(h => h.sub?.[s]?.acc).filter(v => typeof v === "number");
      return { s, acc: accArr.length ? mean(accArr) : 1 };
    }).sort((a, b) => a.acc - b.acc);

    const weakLine = perAvg.slice(0, 2).map(x => `${x.s} ${pct(x.acc)}`).join(" / ");

    historySummary.textContent =
      `履歴：${hist.length}回分（最大50回）\n` +
      `直近：${pct(last.acc)}（${last.correct}/${last.total}） / 平均${fmtSec(last.avgTime)}\n` +
      `推移：${trend}\n` +
      `弱めの教科（履歴平均）：${weakLine || "特になし"}`;

    // 最近10回の一覧
    historyList.innerHTML = "";
    const show = hist.slice(-10).reverse();
    for (const h of show) {
      const div = document.createElement("div");
      div.className = "historyItem";

      const top = document.createElement("div");
      top.className = "top";
      const d = new Date(h.ts);
      top.textContent = `${d.toLocaleString()}　${pct(h.acc)}（${h.correct}/${h.total}）`;

      const meta = document.createElement("div");
      meta.className = "meta";
      const subLine = SUBJECTS.map(s => `${s}:${pct(h.sub[s].acc)}`).join("  ");
      meta.textContent = `平均 ${fmtSec(h.avgTime)} / 合計 ${fmtSec(h.totalTime)}\n${subLine}`;

      div.appendChild(top);
      div.appendChild(meta);
      historyList.appendChild(div);
    }

    // 平均カード＆グラフ
    renderHistoryAverages(hist);
    drawHistoryChart(hist);
  }

  // ===== History toggle / clear =====
  if (btnToggleHistory && historyPanel) {
    btnToggleHistory.addEventListener("click", () => {
      const willShow = historyPanel.hidden;
      historyPanel.hidden = !willShow;
      btnToggleHistory.textContent = willShow ? "履歴を閉じる" : "履歴を表示";
      if (willShow) renderHistoryPanel();
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      if (!confirm("この端末の履歴をすべて削除しますか？")) return;
      localStorage.removeItem(LS_HISTORY);
      renderHistoryPanel();
    });
  }

  // ===== Copy results =====
  btnCopy.addEventListener("click", async () => {
    try {
      const text = buildCopyText();
      await navigator.clipboard.writeText(text);
      btnCopy.textContent = "コピーしました";
      setTimeout(() => btnCopy.textContent = "結果をコピー", 1200);
    } catch {
      alert("コピーに失敗しました。ブラウザの権限をご確認ください。");
    }
  });

  function buildCopyText() {
    const total = state.quiz.length;
    const correct = state.answers.filter(x => x.isCorrect).length;
    const totalTime = state.answers.reduce((s, x) => s + x.timeMs, 0);
    const avg = total ? totalTime / total : 0;

    let s = "";
    s += `【結果】${correct}/${total}（${Math.round(correct / total * 100)}%）\n`;
    s += `合計時間：${fmtSec(totalTime)} / 平均：${fmtSec(avg)}\n\n`;
    s += "【AI分析】\n";
    s += (aiAnalysis.textContent || "") + "\n\n";
    return s;
  }

  // ===== Init =====
  loadUnlock();
  // 初回は閉じている想定。開いた時に最新を描画するが、内部状態は整えておく。
  renderHistoryPanel();

})();
