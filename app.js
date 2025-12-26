(() => {
  "use strict";

  /* =========================
   * 基本設定
   * ========================= */
  const PASSPHRASE = String.fromCharCode(48, 50, 49, 55); // "0217"
  const LS_UNLOCK = "quiz_unlock_v2";
  const LS_HISTORY = "quiz_history_v2";
  const LS_LAST_UIDS = "quiz_last_uids_v1"; // 直前回のuid集合（配列で保存）
  const HISTORY_MAX = 50;

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const QUIZ_PER_SUBJECT = 5;
  const TOTAL_Q = SUBJECTS.length * QUIZ_PER_SUBJECT;

  const DIFF_TARGET = { "基礎": 0.2, "標準": 0.5, "発展": 0.3 };
  const DIFFS = ["基礎", "標準", "発展"];

  // avoidSimilar の「実効」用：原則上限（ただし成立しない教科は自動緩和）
  const DEFAULT_MAX_PER_GROUP = 2;

  // 直前回と同じuidを「強く避ける」ペナルティ
  const PENALTY_LAST_UID = 300; // 大きいほど避ける

  // patternGroup偏りペナルティ
  const PENALTY_GROUP_COUNT = 15;

  // 相対的ランダム（同点を崩す）
  const JITTER = 0.001;

  // pattern は内部コードのまま保持し、表示だけ日本語にする
  const PATTERN_LABEL = {
    kobun: "古文",
    kanbun: "漢文",
    vocab: "語彙",
    reading: "読解",
    grammar: "文法",
    civics: "公民",
    geo: "地理",
    history: "歴史",
    experiment: "実験",
    calc: "計算",
    physics: "物理",
    chemistry: "化学",
    biology: "生物",
    earth: "地学",
    function: "関数",
    geometry: "図形",
    proof: "証明",
  };
  const labelPattern = (p) => {
    const key = String(p ?? "").replace(/^#/, "").trim();
    return PATTERN_LABEL[key] || key || "";
  };

  /* =========================
   * DOM
   * ========================= */
  const $ = (id) => document.getElementById(id);
  const nowMs = () => Date.now();
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fmtPct = (x) => `${Math.round(clamp01(x) * 100)}%`;
  const fmtSec = (ms) => `${Math.round((ms || 0) / 1000)}秒`;
  const fmtSec1 = (ms) => `${((ms || 0) / 1000).toFixed(1)}s`;

  const el = {
    unlockCard: () => $("unlockCard"),
    passInput: () => $("passInput"),
    btnUnlock: () => $("btnUnlock"),

    filterCard: () => $("filterCard"),
    chkGradeE: () => $("chkGradeE"),
    chkGradeJ: () => $("chkGradeJ"),
    chkDiffB: () => $("chkDiffB"),
    chkDiffN: () => $("chkDiffN"),
    chkDiffA: () => $("chkDiffA"),
    chkAvoidSimilar: () => $("chkAvoidSimilar"),
    chkNoDup: () => $("chkNoDup"),

    btnHistoryTop: () => $("btnHistoryTop"),
    btnNew: () => $("btnNew"),
    btnReset: () => $("btnReset"),
    btnGrade: () => $("btnGrade"),

    viewQuiz: () => $("viewQuiz"),
    viewResult: () => $("viewResult"),

    qNo: () => $("qNo"),
    qChips: () => $("qChips"),
    qElapsed: () => $("qElapsed"),
    qText: () => $("qText"),
    choices: () => $("choices"),
    btnPrev: () => $("btnPrev"),
    btnNext: () => $("btnNext"),
    progressFill: () => $("progressFill"),

    resultSummary: () => $("resultSummary"),
    radarCanvas: () => $("radarCanvas"),
    analysisText: () => $("analysisText"),
    breakdown: () => $("breakdown"),
    explainList: () => $("explainList"),
    explainBox: () => $("explainBox"),

    btnToggleHistory: () => $("btnToggleHistory"),
    btnClearHistory: () => $("btnClearHistory"),
    historyPanel: () => $("historyPanel"),
    historyStats: () => $("historyStats"),
    historyCanvas: () => $("historyCanvas"),
    historyList: () => $("historyList"),
  };

  const show = (x) => { if (x) x.style.display = ""; };
  const hide = (x) => { if (x) x.style.display = "none"; };

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================
   * bank.js ロード（uid/patternGroup 保険）
   * ========================= */
  function normalizeText(s) {
    return String(s ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  function makeUid(q) {
    const sub = normalizeText(q?.sub);
    const qt = normalizeText(q?.q);
    const choices = Array.isArray(q?.c) ? q.c.map(normalizeText).join("||") : "";
    const a = Number.isFinite(q?.a) ? q.a : -1;
    return `${sub}::${qt}::${choices}::a=${a}`;
  }

  function loadBank() {
    let bank = null;
    if (Array.isArray(window.BANK)) bank = window.BANK;
    if (!bank && typeof window.getBank === "function") bank = window.getBank();
    if (!bank && typeof window.buildBank === "function") bank = window.buildBank();
    if (!Array.isArray(bank)) bank = [];

    bank.forEach((q, i) => {
      if (!q) return;
      if (!q.key) q.key = `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 24)}|${i}`;
      if (!q.patternGroup) q.patternGroup = q.pattern || "p";
      if (!q.uid) q.uid = makeUid(q);
    });

    // bank側でdedupe済みのはずだが、念のためuid重複が残っていれば落とす
    const seen = new Set();
    const ded = [];
    for (const q of bank) {
      if (!q?.uid) continue;
      if (seen.has(q.uid)) continue;
      seen.add(q.uid);
      ded.push(q);
    }

    // 簡易ログ（BANK健全性確認）
    const total = ded.length;
    const perSub = SUBJECTS.map(s => {
      const arr = ded.filter(q => q.sub === s);
      return { sub: s, total: arr.length, groups: new Set(arr.map(x => x.patternGroup)).size };
    });
    console.log("[BANK loaded] total(uid-deduped):", total);
    console.table(perSub);

    return ded;
  }
  const BANK = loadBank();

  /* =========================
   * 状態
   * ========================= */
  const state = {
    unlocked: false,
    quiz: [],
    answers: [],
    i: 0,
    shownAt: 0,
    timer: null,
    graded: false,
    explainActive: null,
  };

  /* =========================
   * LocalStorage（履歴＋直前回UID）
   * ========================= */
  const isUnlocked = () => localStorage.getItem(LS_UNLOCK) === "1";
  const setUnlocked = () => localStorage.setItem(LS_UNLOCK, "1");

  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveHistory(arr) {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(arr)); } catch {}
  }
  function appendHistory(snapshot) {
    const arr = loadHistory();
    arr.unshift(snapshot);
    if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
    saveHistory(arr);
  }

  function loadLastUids() {
    try {
      const raw = localStorage.getItem(LS_LAST_UIDS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
    } catch {
      return new Set();
    }
  }
  function saveLastUids(uids) {
    try {
      const arr = Array.from(uids).slice(0, 200); // 念のため
      localStorage.setItem(LS_LAST_UIDS, JSON.stringify(arr));
    } catch {}
  }

  /* =========================
   * UI 制御
   * ========================= */
  function setTopButtonsEnabled(enabled) {
    if (el.btnHistoryTop()) el.btnHistoryTop().disabled = false;
    if (el.btnNew()) el.btnNew().disabled = !enabled;
    if (el.btnReset()) el.btnReset().disabled = !enabled;
    if (el.btnGrade()) el.btnGrade().disabled = !enabled;
  }

  function updateLockUI() {
    state.unlocked = isUnlocked();

    if (state.unlocked) {
      hide(el.unlockCard());
      show(el.filterCard());
      show(el.viewQuiz());
      hide(el.viewResult());
    } else {
      show(el.unlockCard());
      hide(el.filterCard());
      hide(el.viewQuiz());
      hide(el.viewResult());
    }

    setTopButtonsEnabled(state.unlocked);
  }

  function onUnlock() {
    const pass = (el.passInput()?.value || "").trim();
    if (pass === PASSPHRASE) {
      setUnlocked();
      updateLockUI();
      if (!state.quiz.length) newQuiz();
    } else {
      alert("合言葉が違います。");
    }
  }

  /* =========================
   * フィルタ取得
   * ========================= */
  function getSelectedGrades() {
    const res = [];
    if (el.chkGradeE()?.checked) res.push("小");
    if (el.chkGradeJ()?.checked) res.push("中");
    return res.length ? res : ["小", "中"];
  }
  function getSelectedDiffs() {
    const res = [];
    if (el.chkDiffB()?.checked) res.push("基礎");
    if (el.chkDiffN()?.checked) res.push("標準");
    if (el.chkDiffA()?.checked) res.push("発展");
    return res.length ? res : ["基礎", "標準", "発展"];
  }
  function getOptions() {
    return {
      avoidSimilar: el.chkAvoidSimilar() ? !!el.chkAvoidSimilar().checked : true,
      noDup: el.chkNoDup() ? !!el.chkNoDup().checked : true,
      maxPerGroup: DEFAULT_MAX_PER_GROUP,
    };
  }

  /* =========================
   * 出題（実効：uid重複禁止＋patternGroup上限＋直前回回避）
   * ========================= */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function scoreCandidate(q, groupCount, lastUids) {
    let s = 0;

    // 直前回回避（強めペナルティ）
    if (lastUids.has(q.uid)) s += PENALTY_LAST_UID;

    // patternGroup偏りペナルティ（カウントが増えるほど嫌う）
    const g = q.patternGroup || q.pattern || "p";
    s += (groupCount.get(g) || 0) * PENALTY_GROUP_COUNT;

    // 同点崩し
    s += Math.random() * JITTER;
    return s;
  }

  function distinctGroups(arr) {
    return new Set(arr.map(q => q.patternGroup || q.pattern || "p")).size;
  }

  function choose5ForSubject(subject, grades, diffs, opts, usedUids, groupCount, lastUids) {
    // 基本候補
    let pool = BANK.filter(q =>
      q && q.sub === subject &&
      grades.includes(q.level) &&
      diffs.includes(q.diff) &&
      Array.isArray(q.c) && q.c.length === 4 &&
      typeof q.a === "number"
    );

    // 不足時フォールバック：diff→gradeを広げる
    if (pool.length < QUIZ_PER_SUBJECT) {
      const allDiffs = ["基礎", "標準", "発展"];
      pool = BANK.filter(q => q && q.sub === subject && grades.includes(q.level) && allDiffs.includes(q.diff));
      if (pool.length < QUIZ_PER_SUBJECT) {
        const allGrades = ["小", "中"];
        pool = BANK.filter(q => q && q.sub === subject && allGrades.includes(q.level) && allDiffs.includes(q.diff));
      }
    }
    if (pool.length < QUIZ_PER_SUBJECT) {
      throw new Error(`${subject} の問題が不足しています（BANKの素材不足）。`);
    }

    // noDup（実効）：既に選んだuidは候補から除外
    if (opts.noDup) pool = pool.filter(q => !usedUids.has(q.uid));

    // avoidSimilar 上限：成立しない教科のために「教科内群数」から自動上限を算出
    const gN = distinctGroups(pool);
    let localMaxPerGroup = opts.avoidSimilar ? Math.max(opts.maxPerGroup, Math.ceil(QUIZ_PER_SUBJECT / Math.max(1, gN))) : 999;

    if (opts.avoidSimilar && localMaxPerGroup !== opts.maxPerGroup) {
      console.log(`[quiz] ${subject} patternGroupが少ないため maxPerGroup を ${opts.maxPerGroup}→${localMaxPerGroup} に自動緩和（groups=${gN}）`);
    }

    // 難易度比率（教科内）
    const ideal = {
      "基礎": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]),
      "標準": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"]),
      "発展": QUIZ_PER_SUBJECT - (Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]) + Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"])),
    };

    const chosen = [];
    const localGroupCount = new Map();

    for (let k = 0; k < QUIZ_PER_SUBJECT; k++) {
      // 難易度優先を決める
      const counts = { "基礎": 0, "標準": 0, "発展": 0 };
      chosen.forEach(q => counts[q.diff]++);
      const preferred = DIFFS.slice().sort((a, b) => (ideal[b] - counts[b]) - (ideal[a] - counts[a]))[0];

      // まず希望diffで候補を作る
      let cands = pool.filter(q => q.diff === preferred);
      if (!cands.length) cands = pool.slice();

      // avoidSimilar（実効）：patternGroup上限に引っかかるものは候補から除外（ハード制約）
      if (opts.avoidSimilar) {
        cands = cands.filter(q => {
          const g = q.patternGroup || q.pattern || "p";
          const currentGlobal = groupCount.get(g) || 0;
          const currentLocal = localGroupCount.get(g) || 0;
          // globalは“全25問”での偏り、localは“この教科の5問”での偏り
          // 厳しすぎると成立しないので、上限は localMaxPerGroup で揃える
          return (currentLocal < localMaxPerGroup) && (currentGlobal < Math.max(localMaxPerGroup, opts.maxPerGroup));
        });
      }

      // 直前回のuidを「禁止」までにすると成立しない場合があるため、ここは基本ペナルティで避ける
      // ただし候補が十分にある時だけ“軽い除外”を行う（成立性を壊さない）
      if (lastUids.size && cands.length > 25) {
        const filtered = cands.filter(q => !lastUids.has(q.uid));
        if (filtered.length >= 5) cands = filtered;
      }

      if (!cands.length) {
        // 成立しない場合は「上限を一段緩め」て救済（ログを出す）
        if (opts.avoidSimilar) {
          localMaxPerGroup++;
          console.warn(`[quiz] ${subject} で候補枯渇 → maxPerGroup を ${localMaxPerGroup} に緩和して続行`);
          k--; // 同じ問題番号をもう一度選び直す
          continue;
        }
        // それでもダメならプール全体で救済
        cands = pool.slice();
      }

      // 最良候補（スコア最小）を選ぶ
      let best = null, bestScore = Infinity;
      for (const q of cands) {
        const s = scoreCandidate(q, groupCount, lastUids);
        if (s < bestScore) { bestScore = s; best = q; }
      }

      chosen.push(best);

      // usedUids & groupCount を更新
      usedUids.add(best.uid);

      const g = best.patternGroup || best.pattern || "p";
      groupCount.set(g, (groupCount.get(g) || 0) + 1);
      localGroupCount.set(g, (localGroupCount.get(g) || 0) + 1);

      // プールから排除（noDup実効）
      pool = pool.filter(q => q.uid !== best.uid);
    }

    return chosen;
  }

  function buildQuiz() {
    const grades = getSelectedGrades();
    const diffs = getSelectedDiffs();
    const opts = getOptions();
    const lastUids = loadLastUids();

    const usedUids = new Set();
    const groupCount = new Map();
    const quiz = [];

    for (const sub of SUBJECTS) {
      quiz.push(...choose5ForSubject(sub, grades, diffs, opts, usedUids, groupCount, lastUids));
    }
    shuffle(quiz);

    // 生成確認ログ：patternGroup分布 + 直前回との被り
    const groupDist = {};
    for (const q of quiz) {
      const g = q.patternGroup || q.pattern || "p";
      groupDist[g] = (groupDist[g] || 0) + 1;
    }
    console.log("[quiz] patternGroup distribution (this quiz):");
    console.table(Object.entries(groupDist).sort((a,b)=>b[1]-a[1]).map(([g,n])=>({patternGroup:g,n})));

    if (lastUids.size) {
      const overlap = quiz.filter(q => lastUids.has(q.uid)).length;
      console.log(`[quiz] overlap vs lastQuiz: ${overlap}/${TOTAL_Q} (${Math.round((overlap/TOTAL_Q)*100)}%)`);
    } else {
      console.log("[quiz] overlap vs lastQuiz: (no lastQuiz stored)");
    }

    if (quiz.length !== TOTAL_Q) throw new Error(`出題生成に失敗（${quiz.length}/${TOTAL_Q}）`);
    return quiz;
  }

  function newQuiz() {
    if (!state.unlocked) {
      alert("先に合言葉でロック解除してください。");
      return;
    }
    try {
      state.quiz = buildQuiz();
    } catch (e) {
      alert(String(e?.message || e));
      return;
    }

    // 「直前回」を次回のために保存（生成時点で保存＝未採点でも“次の新規”で被りにくい）
    const currentUids = new Set(state.quiz.map(q => q.uid));
    saveLastUids(currentUids);

    state.answers = state.quiz.map(() => ({ chosen: null, timeMs: 0, visits: 0 }));
    state.i = 0;
    state.graded = false;
    state.shownAt = nowMs();
    state.explainActive = null;

    show(el.viewQuiz());
    hide(el.viewResult());

    startElapsedTimer();
    renderQuestion();
  }

  /* =========================
   * 時間計測
   * ========================= */
  function accumulateTime() {
    const a = state.answers[state.i];
    if (!a) return;
    const dt = nowMs() - (state.shownAt || nowMs());
    if (dt > 0 && dt < 60 * 60 * 1000) a.timeMs += dt;
    state.shownAt = nowMs();
  }

  function startElapsedTimer() {
    stopElapsedTimer();
    state.timer = setInterval(() => {
      if (!state.quiz.length) return;
      const dt = nowMs() - (state.shownAt || nowMs());
      if (el.qElapsed()) el.qElapsed().textContent = fmtSec1(dt);
    }, 100);
  }

  function stopElapsedTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  /* =========================
   * 描画：問題
   * ========================= */
  function renderQuestion() {
    if (!state.quiz.length) return;

    const q = state.quiz[state.i];
    const a = state.answers[state.i];

    if (el.qNo()) el.qNo().textContent = `Q${state.i + 1} / ${TOTAL_Q}`;
    if (el.progressFill()) el.progressFill().style.width = `${Math.round(((state.i + 1) / TOTAL_Q) * 100)}%`;

    if (el.qChips()) {
      const chips = [
        q.sub,
        q.level,
        q.diff,
        q.pattern ? `#${labelPattern(q.pattern)}` : "",
      ].filter(Boolean);
      el.qChips().innerHTML = chips.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    }

    if (el.qText()) el.qText().textContent = q.q || "";

    if (el.choices()) {
      el.choices().innerHTML = "";
      const letters = ["A", "B", "C", "D"];
      q.c.forEach((txt, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice" + (a.chosen === idx ? " selected" : "");
        b.innerHTML = `<div class="choiceBadge">${letters[idx]}</div><div>${escapeHtml(txt)}</div>`;

        b.addEventListener("click", () => {
          if (!state.unlocked) return;
          if (state.graded) return;
          a.chosen = idx;
          renderQuestion();
        });

        el.choices().appendChild(b);
      });
    }

    if (el.btnPrev()) el.btnPrev().disabled = state.i === 0;
    if (el.btnNext()) el.btnNext().disabled = state.i === TOTAL_Q - 1;

    a.visits = (a.visits || 0) + 1;
  }

  function goPrev() {
    if (!state.quiz.length) return;
    accumulateTime();
    if (state.i > 0) state.i--;
    state.shownAt = nowMs();
    renderQuestion();
  }
  function goNext() {
    if (!state.quiz.length) return;
    accumulateTime();
    if (state.i < TOTAL_Q - 1) state.i++;
    state.shownAt = nowMs();
    renderQuestion();
  }

  function resetAnswers() {
    if (!state.unlocked) return;
    if (!state.quiz.length) return;
    if (!confirm("このクイズの解答をリセットしますか？")) return;
    state.answers = state.quiz.map(() => ({ chosen: null, timeMs: 0, visits: 0 }));
    state.i = 0;
    state.graded = false;
    state.shownAt = nowMs();
    state.explainActive = null;
    renderQuestion();
  }

  /* =========================
   * 採点・分析・結果
   * ========================= */
  function computeResult() {
    const perSub = Object.fromEntries(SUBJECTS.map(s => [s, { total: 0, correct: 0, timeMs: 0 }]));
    const perDiff = Object.fromEntries(DIFFS.map(d => [d, { total: 0, correct: 0, timeMs: 0 }]));

    let correct = 0;
    let totalTime = 0;
    const times = [];

    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];
      const chosen = a?.chosen;
      const ok = (chosen !== null && chosen === q.a);
      const t = a?.timeMs || 0;

      totalTime += t;
      times.push(t);

      if (ok) correct++;

      perSub[q.sub].total++;
      if (ok) perSub[q.sub].correct++;
      perSub[q.sub].timeMs += t;

      perDiff[q.diff].total++;
      if (ok) perDiff[q.diff].correct++;
      perDiff[q.diff].timeMs += t;
    }

    const acc = correct / TOTAL_Q;
    const avgTime = totalTime / TOTAL_Q;

    const perSubComputed = {};
    SUBJECTS.forEach(s => {
      const p = perSub[s];
      perSubComputed[s] = {
        total: p.total,
        correct: p.correct,
        acc: p.total ? p.correct / p.total : 0,
        avgTime: p.total ? p.timeMs / p.total : 0,
      };
    });

    const perDiffComputed = {};
    DIFFS.forEach(d => {
      const p = perDiff[d];
      perDiffComputed[d] = {
        total: p.total,
        correct: p.correct,
        acc: p.total ? p.correct / p.total : 0,
        avgTime: p.total ? p.timeMs / p.total : 0,
      };
    });

    const sorted = times.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[(sorted.length / 2) | 0] : 0;

    const analysis = buildAnalysisText(perSubComputed, acc, avgTime, median);

    const snapshot = {
      ts: new Date().toISOString(),
      total: TOTAL_Q,
      correct,
      acc,
      totalTime,
      avgTime,
      perSub: perSubComputed,
      perDiff: perDiffComputed,
    };

    return { correct, acc, totalTime, avgTime, perSub: perSubComputed, perDiff: perDiffComputed, analysis, snapshot };
  }

  function buildAnalysisText(perSub, totalAcc, avgTime, medianMs) {
    const lines = [];
    const speedRatio = medianMs ? avgTime / medianMs : 1;

    lines.push(`総合：正答率 ${fmtPct(totalAcc)}、平均解答時間 ${fmtSec(avgTime)}（目安）。`);

    if (speedRatio < 0.85) {
      lines.push("解答ペースは速めです。誤答が出やすい設問では、条件・否定語・単位の確認を1回挟むと安定します。");
    } else if (speedRatio > 1.15) {
      lines.push("解答ペースは慎重寄りです。方針決定（どの知識/公式を使うか）を先に固定すると時間短縮が狙えます。");
    } else {
      lines.push("解答ペースは標準的です。正確さとスピードのバランスが取れています。");
    }

    const accs = SUBJECTS.map(s => perSub[s]?.acc ?? 0);
    const avgAccSub = accs.reduce((a, b) => a + b, 0) / SUBJECTS.length;
    const worst = SUBJECTS.map(s => ({ s, acc: perSub[s]?.acc ?? 0 })).sort((a, b) => a.acc - b.acc)[0];
    const gap = avgAccSub - (worst?.acc ?? 0);

    if (gap < 0.12) {
      lines.push("教科別の凹みは小さく、現状は「弱点なし（大きな偏りなし）」と判断できます。");
    } else {
      lines.push(`相対的に弱め：${worst.s}（${fmtPct(worst.acc)}）。この教科は基礎〜標準の取りこぼしを優先して潰すと伸びやすいです。`);
    }

    const best = SUBJECTS.map(s => ({ s, acc: perSub[s]?.acc ?? 0 })).sort((a, b) => b.acc - a.acc)[0];
    if (best) lines.push(`強み候補：${best.s}（${fmtPct(best.acc)}）。この教科の解き方を他教科に転用できると全体が底上げされます。`);

    return lines.join("\n");
  }

  function gradeQuiz() {
    if (!state.unlocked) return;
    if (!state.quiz.length) return;
    accumulateTime();
    stopElapsedTimer();

    const res = computeResult();
    state.graded = true;

    appendHistory(res.snapshot);
    renderResult(res);

    hide(el.viewQuiz());
    show(el.viewResult());
  }

  function renderResult(res) {
    if (el.resultSummary()) {
      el.resultSummary().innerHTML = `
        <div class="scoreBig">${res.correct} / ${TOTAL_Q}（${fmtPct(res.acc)}）</div>
        <div class="muted">合計時間：${fmtSec(res.totalTime)}　平均：${fmtSec(res.avgTime)}</div>
      `;
    }
    if (el.analysisText()) el.analysisText().textContent = res.analysis || "";

    if (el.breakdown()) {
      let h = `<h3>教科別</h3><div class="gridMini">`;
      SUBJECTS.forEach(s => {
        const p = res.perSub[s];
        h += `
          <div class="cardMini">
            <div class="k">${escapeHtml(s)}</div>
            <div class="v">${p.correct}/${p.total}（${fmtPct(p.acc)}）</div>
            <div class="muted">平均 ${fmtSec(p.avgTime)}</div>
          </div>
        `;
      });
      h += `</div>`;

      h += `<h3 style="margin-top:14px;">難易度別</h3><div class="gridMini">`;
      DIFFS.forEach(d => {
        const p = res.perDiff[d];
        h += `
          <div class="cardMini">
            <div class="k">${escapeHtml(d)}</div>
            <div class="v">${p.correct}/${p.total}（${fmtPct(p.acc)}）</div>
            <div class="muted">平均 ${fmtSec(p.avgTime)}</div>
          </div>
        `;
      });
      h += `</div>`;

      el.breakdown().innerHTML = h;
    }

    drawRadar(el.radarCanvas(), SUBJECTS.map(s => res.perSub[s].acc));

    if (el.explainList()) {
      el.explainList().innerHTML = "";
      state.quiz.forEach((_, idx) => {
        const q = state.quiz[idx];
        const a = state.answers[idx];
        const chosen = a?.chosen ?? null;

        const isNA = (chosen === null);
        const isOK = (!isNA && chosen === q.a);
        const statusClass = isNA ? "na" : (isOK ? "ok" : "ng");
        const activeClass = (state.explainActive === idx) ? " active" : "";

        const b = document.createElement("button");
        b.type = "button";
        b.className = `mini ${statusClass}${activeClass}`;
        b.textContent = `${idx + 1}`;
        b.addEventListener("click", () => renderExplanation(idx));
        el.explainList().appendChild(b);
      });
    }

    renderHistory();
  }

  function renderExplanation(idx) {
    if (!el.explainBox()) return;
    const q = state.quiz[idx];
    const a = state.answers[idx];
    const chosen = a?.chosen;

    const your = (chosen === null) ? "未回答" : q.c[chosen];
    const correct = q.c[q.a];
    const ok = chosen !== null && chosen === q.a;

    el.explainBox().innerHTML = `
      <div class="exTitle">Q${idx + 1}：${escapeHtml(q.sub)} / ${escapeHtml(q.level)} / ${escapeHtml(q.diff)}${q.pattern ? " / #" + escapeHtml(labelPattern(q.pattern)) : ""}</div>
      <div class="exQ">${escapeHtml(q.q || "")}</div>
      <div class="exRow"><span class="tag ${ok ? "ok" : "ng"}">${ok ? "正解" : "不正解"}</span></div>
      <div class="exRow"><b>あなた：</b>${escapeHtml(your)}</div>
      <div class="exRow"><b>正解：</b>${escapeHtml(correct)}</div>
      <div class="exRow"><b>解説：</b><br>${escapeHtml(q.exp || "（解説なし）").replace(/\n/g, "<br>")}</div>
    `;
    show(el.explainBox());
    el.explainBox().scrollIntoView({ behavior: "smooth", block: "start" });

    state.explainActive = idx;
    if (el.explainList()) {
      el.explainList().querySelectorAll(".mini").forEach((btn, i) => {
        btn.classList.toggle("active", i === idx);
      });
    }
  }

  /* =========================
   * 履歴（未プレイでも見える）
   * ========================= */
  function renderHistory() {
    const hist = loadHistory();

    if (el.historyStats()) {
      if (!hist.length) {
        el.historyStats().innerHTML = `<div class="muted">履歴はまだありません（この端末で採点すると保存されます）。</div>`;
      } else {
        const avgOverall = hist.reduce((t, h) => t + (h.acc || 0), 0) / hist.length;
        const avgPerSub = {};
        SUBJECTS.forEach(s => {
          const vals = hist.map(h => h.perSub?.[s]?.acc).filter(x => typeof x === "number");
          avgPerSub[s] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });

        let htm = `<div class="muted">全期間（${hist.length}回）の平均</div><div class="scoreBig">${fmtPct(avgOverall)}</div><div class="gridMini">`;
        SUBJECTS.forEach(s => {
          htm += `<div class="cardMini"><div class="k">${escapeHtml(s)}</div><div class="v">${fmtPct(avgPerSub[s])}</div></div>`;
        });
        htm += `</div>`;
        el.historyStats().innerHTML = htm;
      }
    }

    drawHistoryLine(el.historyCanvas(), hist);

    if (el.historyList()) {
      el.historyList().innerHTML = "";
      hist.slice(0, 10).forEach((h, idx) => {
        const d = new Date(h.ts);
        const row = document.createElement("div");
        row.className = "historyRow";
        row.innerHTML = `
          <div class="hL">${idx + 1}</div>
          <div class="hM">
            <div class="hTop">${escapeHtml(d.toLocaleString())}</div>
            <div class="muted">正答率 ${fmtPct(h.acc)}（${h.correct}/${h.total}）</div>
          </div>
        `;
        el.historyList().appendChild(row);
      });
    }
  }

  function toggleHistory(forceOpen = null) {
    const panel = el.historyPanel();
    if (!panel) return;
    const hidden = panel.style.display === "none" || getComputedStyle(panel).display === "none";
    const open = forceOpen === null ? hidden : !!forceOpen;
    if (open) {
      show(panel);
      renderHistory();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      hide(panel);
    }
  }

  function clearHistory() {
    if (!confirm("この端末の履歴を全削除しますか？")) return;
    localStorage.removeItem(LS_HISTORY);
    renderHistory();
  }

  function openHistoryFromTop() {
    hide(el.viewQuiz());
    show(el.viewResult());
    toggleHistory(true);
  }

  /* =========================
   * チャート：レーダー
   * ========================= */
  function drawRadar(canvas, values01) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth || 360;
    const h = canvas.height = canvas.clientHeight || 260;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;
    const R = Math.min(w, h) * 0.33;

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (let k = 1; k <= 5; k++) {
      const r = (R * k) / 5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.font = "12px sans-serif";
    SUBJECTS.forEach((label, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
      const x = cx + (R + 18) * Math.cos(ang);
      const y = cy + (R + 18) * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.stroke();
      ctx.fillText(label, x - 10, y + 4);
    });

    ctx.beginPath();
    values01.forEach((v, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
      const r = R * clamp01(v);
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(20,60,160,0.18)";
    ctx.strokeStyle = "rgba(20,60,160,0.55)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }

  /* =========================
   * チャート：最近10回（折れ線）
   * ========================= */
  function drawHistoryLine(canvas, hist) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth || 520;
    const h = canvas.height = canvas.clientHeight || 220;
    ctx.clearRect(0, 0, w, h);

    const data = hist.slice(0, 10).reverse();
    if (!data.length) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "12px sans-serif";
      ctx.fillText("履歴がまだありません。", 12, 24);
      return;
    }

    const padL = 36, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "11px sans-serif";
    [0, 0.5, 1].forEach((p) => {
      const y = padT + plotH * (1 - p);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(p * 100)}%`, 6, y + 4);
    });

    const xs = data.map((_, i) => padL + (plotW * i) / (data.length - 1 || 1));
    const ys = data.map((d) => padT + plotH * (1 - clamp01(d.acc)));

    ctx.strokeStyle = "rgba(20,60,160,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((x, i) => {
      const y = ys[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(20,60,160,0.75)";
    xs.forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(x, ys[i], 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "11px sans-serif";
    data.forEach((_, i) => {
      if (data.length > 6 && i % 2 === 1) return;
      ctx.fillText(`${i + 1}`, xs[i] - 3, padT + plotH + 18);
    });
    ctx.fillText("（最近10回）", padL + plotW - 70, padT + plotH + 18);
  }

  /* =========================
   * イベント
   * ========================= */
  function bind() {
    el.btnUnlock()?.addEventListener("click", onUnlock);
    el.passInput()?.addEventListener("keydown", (e) => { if (e.key === "Enter") onUnlock(); });

    el.btnHistoryTop()?.addEventListener("click", openHistoryFromTop);

    el.btnNew()?.addEventListener("click", newQuiz);
    el.btnReset()?.addEventListener("click", resetAnswers);
    el.btnGrade()?.addEventListener("click", gradeQuiz);

    el.btnPrev()?.addEventListener("click", goPrev);
    el.btnNext()?.addEventListener("click", goNext);

    el.btnToggleHistory()?.addEventListener("click", () => toggleHistory());
    el.btnClearHistory()?.addEventListener("click", clearHistory);

    updateLockUI();
    renderHistory();
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
