(() => {
  "use strict";

  /* =========================
   * 基本設定
   * ========================= */
  const PASSPHRASE = String.fromCharCode(48, 50, 49, 55); // "0217"（表示しない）
  const LS_UNLOCK = "quiz_unlock_v2";
  const LS_HISTORY = "quiz_history_v2";
  const LS_NAME = "quiz_user_name_v1";
  const LS_THEME = "quiz_theme_v1";
  const HISTORY_MAX = 50;

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const QUIZ_PER_SUBJECT = 5;
  const TOTAL_Q = SUBJECTS.length * QUIZ_PER_SUBJECT;

  const DIFF_TARGET = { "基礎": 0.3, "標準": 0.4, "発展": 0.3 };
  const DIFFS = ["基礎", "標準", "発展"];
  const getTotalQuestions = () => state.quiz.length || TOTAL_Q;

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
    map: "資料",
    table: "表",
    graph: "グラフ",
  };
  const labelPattern = (p) => {
    const key = String(p ?? "").replace(/^#/, "").trim();
    return PATTERN_LABEL[key] || key || "";
  };
  const resolvePatternLabel = (q) => {
    const raw = String(q?.pattern ?? "").replace(/^#/, "").trim();
    const labeled = labelPattern(raw);
    if (labeled) return labeled;
    const group = String(q?.patternGroup ?? "").trim();
    if (!group) return "";
    return group.replace(/^[a-z]+_/, "").replaceAll("_", " ");
  };

  /* =========================
   * DOM
   * ========================= */
  const $ = (id) => document.getElementById(id);
  const nowMs = () => Date.now();
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fmtPct = (x) => `${Math.round(clamp01(x) * 100)}%`;
  const fmtSec = (ms) => `${Math.round((ms || 0) / 1000)}秒`;
  const fmtSec1 = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const TIME_GUIDE_SEC = {
    "小": { "基礎": 20, "標準": 30, "発展": 45 },
    "中": { "基礎": 25, "標準": 40, "発展": 60 },
  };
  const getTimeGuideMs = (level, diff) => {
    const sec = TIME_GUIDE_SEC?.[level]?.[diff];
    return (Number.isFinite(sec) ? sec : 30) * 1000;
  };
  const getCssVar = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };
  const getChartTheme = () => ({
    grid: getCssVar("--chart-grid", "rgba(0,0,0,0.12)"),
    axis: getCssVar("--chart-axis", "rgba(0,0,0,0.12)"),
    text: getCssVar("--chart-text", "rgba(0,0,0,0.72)"),
    guide: getCssVar("--chart-guide", "rgba(0,0,0,0.08)"),
    fill: getCssVar("--chart-accent-fill", "rgba(20,60,160,0.18)"),
    stroke: getCssVar("--chart-accent-stroke", "rgba(20,60,160,0.55)"),
    line: getCssVar("--chart-line", "rgba(20,60,160,0.65)"),
    point: getCssVar("--chart-point", "rgba(20,60,160,0.75)"),
  });

  const el = {
    unlockCard: () => $("unlockCard"),
    passInput: () => $("passInput"),
    nameInput: () => $("nameInput"),
    btnUnlock: () => $("btnUnlock"),

    filterCard: () => $("filterCard"),
    chkGradeE: () => $("chkGradeE"),
    chkGradeJ: () => $("chkGradeJ"),
    chkDiffB: () => $("chkDiffB"),
    chkDiffN: () => $("chkDiffN"),
    chkDiffA: () => $("chkDiffA"),

    // （UI上は非表示にする想定。存在しなくても落ちない）
    chkAvoidSimilar: () => $("chkAvoidSimilar"),
    chkNoDup: () => $("chkNoDup"),

    btnHistoryTop: () => $("btnHistoryTop"),
    btnTheme: () => $("btnTheme"),
    btnNew: () => $("btnNew"),
    btnReset: () => $("btnReset"),
    btnGrade: () => $("btnGrade"),
    btnReview: () => $("btnReview"),

    viewQuiz: () => $("viewQuiz"),
    viewResult: () => $("viewResult"),
    resultTitle: () => $("resultTitle"),

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
   * table描画（q.table / Markdown表）
   * ========================= */

  // #qText の直後に表コンテナを確保（無ければ作る）
  function ensureTableContainer(afterEl, id) {
    if (!afterEl) return null;
    let node = document.getElementById(id);
    if (node) return node;

    node = document.createElement("div");
    node.id = id;
    node.className = "qTableWrap";
    node.style.marginTop = "10px";

    afterEl.insertAdjacentElement("afterend", node);
    return node;
  }

  // { headers:[], rows:[[]], caption? } / { header, body } / 2D配列 / { cols, data } を吸収
  function normalizeTableData(t) {
    if (!t) return null;

    // 2D配列
    if (Array.isArray(t) && t.length && Array.isArray(t[0])) {
      return { headers: t[0].map(String), rows: t.slice(1).map(r => r.map(String)) };
    }

    // 典型キー
    const headers = t.headers || t.header || t.cols || t.columns;
    const rows = t.rows || t.body || t.data;

    if (Array.isArray(headers) && Array.isArray(rows)) {
      const h = headers.map(String);
      const r = rows.map((row) => Array.isArray(row) ? row.map(String) : [String(row)]);
      return { headers: h, rows: r, caption: t.caption ? String(t.caption) : "" };
    }

    return null;
  }

  // Markdown表（|区切り）の簡易パース：連続する表ブロックを抽出し、描画
  function extractMarkdownTables(text) {
    const lines = String(text ?? "").split("\n");
    const tables = [];
    let buf = [];
    const isTableLine = (ln) => /^\s*\|.*\|\s*$/.test(ln);

    for (const ln of lines) {
      if (isTableLine(ln)) {
        buf.push(ln.trim());
      } else {
        if (buf.length >= 2) tables.push(buf.slice());
        buf = [];
      }
    }
    if (buf.length >= 2) tables.push(buf.slice());
    return tables;
  }

  function parseMarkdownTable(lines) {
    // | a | b | の形式
    const parseRow = (ln) => ln.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(s => s.trim());
    const rows = lines.map(parseRow).filter(r => r.some(x => x !== ""));
    if (rows.length < 2) return null;

    // 2行目が --- ならヘッダ区切り扱い
    const isSep = (r) => r.every(c => /^:?-{3,}:?$/.test(c));
    let headers = rows[0];
    let body = rows.slice(1);

    if (rows.length >= 3 && isSep(rows[1])) {
      headers = rows[0];
      body = rows.slice(2);
    }
    return { headers, rows: body };
  }

  function renderTableInto(container, tableData) {
    if (!container) return;
    container.innerHTML = "";
    if (!tableData) return;

    const { headers, rows, caption } = tableData;
    const table = document.createElement("table");
    table.className = "qTable";

    if (caption) {
      const cap = document.createElement("caption");
      cap.textContent = caption;
      table.appendChild(cap);
    }

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = String(h);
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(r => {
      const tr = document.createElement("tr");
      r.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = String(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }

  function renderQuestionTables(q) {
    // 1) 構造化 q.table があればそれを描画
    const wrap = ensureTableContainer(el.qText(), "qTable");
    if (!wrap) return;

    const norm = normalizeTableData(q?.table);
    if (norm) {
      renderTableInto(wrap, norm);
      return;
    }

    // 2) q.q に Markdown表が埋め込まれていれば描画（複数対応）
    const mdTables = extractMarkdownTables(q?.q);
    if (!mdTables.length) {
      wrap.innerHTML = "";
      return;
    }

    // 複数表がある場合は縦に積む
    wrap.innerHTML = "";
    mdTables.forEach((lines, idx) => {
      const parsed = parseMarkdownTable(lines);
      if (!parsed) return;

      const subWrap = document.createElement("div");
      if (idx > 0) subWrap.style.marginTop = "10px";
      wrap.appendChild(subWrap);
      renderTableInto(subWrap, parsed);
    });
  }

  /* =========================
   * bank.js ロード
   * ========================= */
  // bank.js 側で uid/patternGroup を付けるが、古いbankでも動くよう保険
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

    // key/uid/patternGroup 付与（無ければ）
    bank.forEach((q, i) => {
      if (!q) return;
      if (!q.key) q.key = `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 24)}|${i}`;
      if (!q.patternGroup) q.patternGroup = q.pattern || "p";
      if (!q.uid) q.uid = makeUid(q);
    });

    return bank;
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
    explainActive: null, // 解説番号のactive表示用
    lastResult: null,
    lastWrongIndices: [],
  };

  /* =========================
   * LocalStorage（履歴）
   * ========================= */
  const isUnlocked = () => localStorage.getItem(LS_UNLOCK) === "1";
  const setUnlocked = () => localStorage.setItem(LS_UNLOCK, "1");
  const getUserName = () => localStorage.getItem(LS_NAME) || "";
  const setUserName = (name) => localStorage.setItem(LS_NAME, name);
  
  function requestNameIfNeeded() {
    if (getUserName()) return;
    const input = window.prompt("名前を入力してください");
    const name = (input || "").trim();
    if (name) {
      setUserName(name);
    }
  }

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

  /* =========================
   * UI 制御
   * ========================= */
  function setTopButtonsEnabled(enabled) {
    if (el.btnHistoryTop()) el.btnHistoryTop().disabled = false; // 履歴は常に可

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
      const nameValue = (el.nameInput()?.value || "").trim();
      if (nameValue) {
        setUserName(nameValue);
      }
      setUnlocked();
      updateLockUI();
      requestNameIfNeeded();
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

  // ★重要：ユーザーUIに依存せず、常時ON（非表示化しても挙動が変わらない）
  function getOptions() {
    return { avoidSimilar: true, noDup: true };
  }

  /* =========================
   * 出題（重複禁止＋テンプレ偏り回避＋不足時フォールバック）
   * ========================= */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalizeText(s) {
    return String(s ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function questionSignature(q) {
    const sub = normalizeText(q?.sub);
    const qt = normalizeText(q?.q);
    const choices = Array.isArray(q?.c)
      ? q.c.map(normalizeText).sort().join("||")
      : "";
    const aText = Array.isArray(q?.c) && Number.isFinite(q?.a)
      ? normalizeText(q.c[q.a])
      : "";
    return `${sub}::${qt}::${choices}::a=${aText}`;
  }

  function scoreCandidate(q, usedUids, usedSignatures, patternGroupCount, opts) {
    let s = 0;

    // noDup：内容ベース（uid）重複を禁止
    if (opts.noDup && (usedUids.has(q.uid) || usedSignatures.has(questionSignature(q)))) {
      s += 1e9;
    }

    // avoidSimilar：patternGroup で偏りを抑える
    if (opts.avoidSimilar) {
      const g = q.patternGroup || q.pattern || "p";
      s += (patternGroupCount.get(g) || 0) * 10;
    }

    s += Math.random();
    return s;
  }

  function choose5ForSubject(subject, grades, diffs, opts, usedUids, usedSignatures, patternGroupCount) {
    // 基本候補
    let cands = BANK.filter(q =>
      q && q.sub === subject &&
      grades.includes(q.level) &&
      diffs.includes(q.diff) &&
      Array.isArray(q.c) && q.c.length === 4 &&
      typeof q.a === "number"
    );

    // 不足時フォールバック（止めない）
    if (cands.length < QUIZ_PER_SUBJECT) {
      const allDiffs = ["基礎", "標準", "発展"];
      const allGrades = ["小", "中"];
      cands = BANK.filter(q => q && q.sub === subject && grades.includes(q.level) && allDiffs.includes(q.diff));
      if (cands.length < QUIZ_PER_SUBJECT) {
        cands = BANK.filter(q => q && q.sub === subject && allGrades.includes(q.level) && allDiffs.includes(q.diff));
      }
    }

    if (cands.length < QUIZ_PER_SUBJECT) {
      throw new Error(`${subject} の問題が不足しています（bank.js を増量してください）。`);
    }

    // 難易度比率をなるべく維持（教科内）
    const ideal = {
      "基礎": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]),
      "標準": Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"]),
      "発展": QUIZ_PER_SUBJECT - (Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["基礎"]) + Math.round(QUIZ_PER_SUBJECT * DIFF_TARGET["標準"])),
    };

    const chosen = [];
    let pool = cands.slice();

    for (let k = 0; k < QUIZ_PER_SUBJECT; k++) {
      const counts = { "基礎": 0, "標準": 0, "発展": 0 };
      chosen.forEach(q => counts[q.diff]++);

      const preferred = DIFFS.slice().sort((a, b) => (ideal[b] - counts[b]) - (ideal[a] - counts[a]))[0];
      let candidates = pool.filter(q => q.diff === preferred);
      if (!candidates.length) candidates = pool;

      let best = null, bestScore = Infinity;
      for (const q of candidates) {
        const s = scoreCandidate(q, usedUids, usedSignatures, patternGroupCount, opts);
        if (s < bestScore) { bestScore = s; best = q; }
      }

      chosen.push(best);
      usedUids.add(best.uid);
      const signature = questionSignature(best);
      usedSignatures.add(signature);

      const g = best.patternGroup || best.pattern || "p";
      patternGroupCount.set(g, (patternGroupCount.get(g) || 0) + 1);

      // 1) 同一オブジェクト再抽選防止（key）
      // 2) noDup 有効なら内容ベースでも排除（uid）
      pool = pool.filter(q => q.key !== best.key && (!opts.noDup || (q.uid !== best.uid && questionSignature(q) !== signature)));
    }

    return chosen;
  }

  function buildQuiz() {
    const grades = getSelectedGrades();
    const diffs = getSelectedDiffs();
    const opts = getOptions();

    const usedUids = new Set();
    const usedSignatures = new Set();
    const patternGroupCount = new Map();
    const quiz = [];

    for (const sub of SUBJECTS) {
      quiz.push(...choose5ForSubject(sub, grades, diffs, opts, usedUids, usedSignatures, patternGroupCount));
    }
    shuffle(quiz);

    if (quiz.length !== TOTAL_Q) {
      throw new Error(`出題生成に失敗（${quiz.length}/${TOTAL_Q}）`);
    }
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
    const totalQ = getTotalQuestions();

    if (el.qNo()) el.qNo().textContent = `Q${state.i + 1} / ${totalQ}`;
    if (el.progressFill()) el.progressFill().style.width = `${Math.round(((state.i + 1) / totalQ) * 100)}%`;

    // chips（patternは日本語表示）
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

    // ★表があるなら描画（q.table または Markdown表）
    renderQuestionTables(q);

    // choices（必ず A/B/C/D + 選択肢文）
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
    if (el.btnNext()) el.btnNext().disabled = state.i === totalQ - 1;

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
    if (state.i < getTotalQuestions() - 1) state.i++;
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
    const perFocus = {};
    const wrongItems = [];
    const wrongIndices = [];
    const timeBias = { fast: 0, slow: 0, totalWrong: 0 };

    let correct = 0;
    let totalTime = 0;
    const times = [];

    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];
      const chosen = a?.chosen;
      const ok = (chosen !== null && chosen === q.a);
      const t = a?.timeMs || 0;
      const patternLabel = resolvePatternLabel(q);
      const guideMs = getTimeGuideMs(q.level, q.diff);

      totalTime += t;
      times.push(t);

      if (ok) correct++;

      perSub[q.sub].total++;
      if (ok) perSub[q.sub].correct++;
      perSub[q.sub].timeMs += t;

      perDiff[q.diff].total++;
      if (ok) perDiff[q.diff].correct++;
      perDiff[q.diff].timeMs += t;

      const focusKey = `${q.sub}||${patternLabel || "その他"}||${q.diff}`;
      if (!perFocus[focusKey]) {
        perFocus[focusKey] = {
          sub: q.sub,
          pattern: patternLabel || "その他",
          diff: q.diff,
          total: 0,
          correct: 0,
          timeMs: 0,
          guideMs: 0,
          wrong: 0,
          wrongTimeMs: 0,
        };
      }
      const f = perFocus[focusKey];
      f.total += 1;
      if (ok) f.correct += 1;
      f.timeMs += t;
      f.guideMs += guideMs;

      if (!ok) {
        wrongIndices.push(i);
        f.wrong += 1;
        f.wrongTimeMs += t;
        wrongItems.push({
          sub: q.sub,
          pattern: patternLabel || "その他",
          diff: q.diff,
          level: q.level,
          timeMs: t,
          guideMs,
        });
        timeBias.totalWrong += 1;
        if (t < guideMs * 0.7) timeBias.fast += 1;
        if (t > guideMs * 1.3) timeBias.slow += 1;
      }
    }

    const totalQ = getTotalQuestions();
    const acc = totalQ ? correct / totalQ : 0;
    const avgTime = totalQ ? totalTime / totalQ : 0;

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

    const analysis = buildAnalysisText({
      perSub: perSubComputed,
      perDiff: perDiffComputed,
      totalAcc: acc,
      avgTime,
      medianMs: median,
      perFocus,
      wrongItems,
      timeBias,
    });

    const snapshot = {
      ts: new Date().toISOString(),
      total: totalQ,
      correct,
      acc,
      totalTime,
      avgTime,
      perSub: perSubComputed,
      perDiff: perDiffComputed,
      analysis,
    };

    return {
      correct,
      acc,
      totalTime,
      avgTime,
      perSub: perSubComputed,
      perDiff: perDiffComputed,
      analysis,
      snapshot,
      wrongIndices,
    };
  }

  function buildAnalysisText({ perSub, perDiff, totalAcc, avgTime, medianMs, perFocus, wrongItems, timeBias }) {
    const lines = [];
    const speedRatio = medianMs ? avgTime / medianMs : 1;

    lines.push(`【正答率】${fmtPct(totalAcc)}（平均解答時間 ${fmtSec(avgTime)} / 目安）`);

    if (speedRatio < 0.85) {
      lines.push("【解答ペース】速めです。誤答が出やすい設問では、条件・否定語・単位の確認を1回挟むと安定します。");
    } else if (speedRatio > 1.15) {
      lines.push("【解答ペース】慎重寄りです。方針決定（どの知識/公式を使うか）を先に固定すると時間短縮が狙えます。");
    } else {
      lines.push("【解答ペース】標準的です。正確さとスピードのバランスが取れています。");
    }

    const accs = SUBJECTS.map(s => perSub[s]?.acc ?? 0);
    const avgAccSub = accs.reduce((a, b) => a + b, 0) / SUBJECTS.length;
    const worst = SUBJECTS.map(s => ({ s, acc: perSub[s]?.acc ?? 0 })).sort((a, b) => a.acc - b.acc)[0];
    const gap = avgAccSub - (worst?.acc ?? 0);

    const best = SUBJECTS.map(s => ({ s, acc: perSub[s]?.acc ?? 0 })).sort((a, b) => b.acc - a.acc)[0];
    if (best) {
      lines.push(`【強み】${best.s}（${fmtPct(best.acc)}）。この教科の解き方を他教科に転用できると全体が底上げされます。`);
    }

    const strongPatterns = Object.values(perFocus || {})
      .filter(x => x.total >= 2 && x.correct / x.total >= 0.8)
      .sort((a, b) => (b.correct / b.total) - (a.correct / a.total))
      .slice(0, 2);
    if (strongPatterns.length) {
      const detail = strongPatterns
        .map(x => `${x.sub}/${x.pattern}（${fmtPct(x.correct / x.total)}）`)
        .join("、");
      lines.push(`【得意パターン】${detail}`);
    }

    if (gap < 0.12) {
      lines.push("【弱点】教科別の凹みは小さく、現状は大きな偏りがありません。");
    } else if (worst) {
      lines.push(`【弱点】${worst.s}（${fmtPct(worst.acc)}）。基礎〜標準の取りこぼしを優先して埋めると伸びやすいです。`);
    }

    const weakFocus = Object.values(perFocus || {})
      .filter(x => x.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || (a.correct / a.total) - (b.correct / b.total))
      .slice(0, 3);
    if (weakFocus.length) {
      lines.push("【間違えた傾向】");
      weakFocus.forEach((x) => {
        const acc = x.correct / x.total;
        const avg = x.timeMs / x.total;
        const guide = x.guideMs / x.total;
        lines.push(`・${x.sub}/${x.pattern}（${x.diff}）: ${x.correct}/${x.total}（${fmtPct(acc)}）, 平均${fmtSec(avg)} / 目安${fmtSec(guide)}`);
      });
    }

    const diffWeak = DIFFS.map(d => ({ d, acc: perDiff?.[d]?.acc ?? 0 }))
      .sort((a, b) => a.acc - b.acc)[0];
    if (diffWeak) {
      lines.push(`【難易度別】相対的に低いのは${diffWeak.d}（${fmtPct(diffWeak.acc)}）。`);
    }

    if (wrongItems?.length) {
      const fastRatio = timeBias.totalWrong ? timeBias.fast / timeBias.totalWrong : 0;
      const slowRatio = timeBias.totalWrong ? timeBias.slow / timeBias.totalWrong : 0;
      if (fastRatio >= 0.4 && fastRatio > slowRatio) {
        lines.push("【対策】解答時間が短い誤答が多めです。設問条件の読み落とし対策として「問題文の数字・否定語にマーカー」を意識しましょう。");
      } else if (slowRatio >= 0.4 && slowRatio > fastRatio) {
        lines.push("【対策】時間をかけた誤答が多めです。解法の型を先に確認し、基礎公式の当てはめから着手する練習が有効です。");
      } else {
        lines.push("【対策】誤答の原因は混在しています。弱点教科の代表パターンを1日1セットで解き直し→解説の言語化を行うと改善が早いです。");
      }
    }

    return lines.join("\n");
  }

  function gradeQuiz() {
    if (!state.unlocked) return;
    if (!state.quiz.length) return;
    accumulateTime();
    stopElapsedTimer();

    const res = computeResult();
    state.graded = true;
    state.lastWrongIndices = res.wrongIndices || [];

    appendHistory(res.snapshot);
    renderResult(res);

    hide(el.viewQuiz());
    show(el.viewResult());
  }

  function startReviewMode() {
    const indices = (state.lastWrongIndices || []).filter((i) => Number.isInteger(i));
    if (!indices.length) return;

    const unique = [...new Set(indices)].sort((a, b) => a - b);
    const quiz = unique.map(i => state.quiz[i]).filter(Boolean);
    if (!quiz.length) return;

    state.quiz = quiz;
    state.answers = quiz.map(() => ({ chosen: null, timeMs: 0, visits: 0 }));
    state.i = 0;
    state.graded = false;
    state.explainActive = null;
    state.shownAt = nowMs();

    show(el.viewQuiz());
    hide(el.viewResult());

    startElapsedTimer();
    renderQuestion();
  }

  function renderResult(res) {
    state.lastResult = res;
    const totalQ = getTotalQuestions();
    if (el.resultTitle()) {
      const name = getUserName();
      el.resultTitle().textContent = name ? `${name}さんの結果` : "結果";
    }
    if (el.resultSummary()) {
      el.resultSummary().innerHTML = `
        <div class="scoreBig">${res.correct} / ${totalQ}（${fmtPct(res.acc)}）</div>
        <div class="muted">合計時間：${fmtSec(res.totalTime)}　平均：${fmtSec(res.avgTime)}</div>
      `;
    }
    if (el.btnReview()) {
      const hasWrong = (res.wrongIndices || []).length > 0;
      el.btnReview().style.display = hasWrong ? "" : "none";
      el.btnReview().disabled = !hasWrong;
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

    // 解説番号：正誤/未回答で色分け + active
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

    // 解説内にも表があるなら描画できるよう、ここでは q.q のMarkdown表を別枠に描く
    // （q.table がある場合は正規化して出す）
    let tableHtml = "";
    const norm = normalizeTableData(q?.table);
    if (norm) {
      tableHtml = buildTableHtml(norm);
    } else {
      const mdTables = extractMarkdownTables(q?.q);
      if (mdTables.length) {
        const blocks = mdTables
          .map(lines => parseMarkdownTable(lines))
          .filter(Boolean)
          .map(t => buildTableHtml(t));
        tableHtml = blocks.join("");
      }
    }

    el.explainBox().innerHTML = `
      <div class="exTitle">Q${idx + 1}：${escapeHtml(q.sub)} / ${escapeHtml(q.level)} / ${escapeHtml(q.diff)}${q.pattern ? " / #" + escapeHtml(labelPattern(q.pattern)) : ""}</div>
      <div class="exQ">${escapeHtml(q.q || "").replace(/\n/g, "<br>")}</div>
      ${tableHtml ? `<div class="exTable">${tableHtml}</div>` : ""}
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

  // 説明欄用：tableをHTML文字列で生成（escape済み）
  function buildTableHtml(t) {
    const headers = (t.headers || t.header || []).map(String);
    const rows = (t.rows || t.body || []).map(r => Array.isArray(r) ? r.map(String) : [String(r)]);
    const caption = t.caption ? String(t.caption) : "";

    let h = `<table class="qTable">`;
    if (caption) h += `<caption>${escapeHtml(caption)}</caption>`;
    if (headers.length) {
      h += `<thead><tr>${headers.map(x => `<th>${escapeHtml(x)}</th>`).join("")}</tr></thead>`;
    }
    h += `<tbody>`;
    rows.forEach(r => {
      h += `<tr>${r.map(x => `<td>${escapeHtml(x)}</td>`).join("")}</tr>`;
    });
    h += `</tbody></table>`;
    return h;
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
    const chart = getChartTheme();

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;
    const R = Math.min(w, h) * 0.33;

    ctx.strokeStyle = chart.grid;
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

    ctx.fillStyle = chart.text;
    ctx.font = "12px sans-serif";
    SUBJECTS.forEach((label, i) => {
      const ang = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
      const x = cx + (R + 18) * Math.cos(ang);
      const y = cy + (R + 18) * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      ctx.strokeStyle = chart.axis;
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
    ctx.fillStyle = chart.fill;
    ctx.strokeStyle = chart.stroke;
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
    const chart = getChartTheme();
    ctx.clearRect(0, 0, w, h);

    const data = hist.slice(0, 10).reverse();
    if (!data.length) {
      ctx.fillStyle = chart.text;
      ctx.font = "12px sans-serif";
      ctx.fillText("履歴がまだありません。", 12, 24);
      return;
    }

    const padL = 36, padR = 14, padT = 14, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.strokeStyle = chart.grid;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = chart.text;
    ctx.font = "11px sans-serif";
    [0, 0.5, 1].forEach((p) => {
      const y = padT + plotH * (1 - p);
      ctx.strokeStyle = chart.guide;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(p * 100)}%`, 6, y + 4);
    });

    const xs = data.map((_, i) => padL + (plotW * i) / (data.length - 1 || 1));
    const ys = data.map((d) => padT + plotH * (1 - clamp01(d.acc)));

    ctx.strokeStyle = chart.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((x, i) => {
      const y = ys[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = chart.point;
    xs.forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(x, ys[i], 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = chart.text;
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
  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (el.btnTheme()) {
      el.btnTheme().textContent = next === "dark" ? "ライトモード" : "ダークモード";
    }
    try { localStorage.setItem(LS_THEME, next); } catch {}
    if (state.lastResult) {
      renderResult(state.lastResult);
    } else {
      renderHistory();
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function bind() {
    initTheme();
    el.btnUnlock()?.addEventListener("click", onUnlock);
    el.passInput()?.addEventListener("keydown", (e) => { if (e.key === "Enter") onUnlock(); });
    el.nameInput()?.addEventListener("keydown", (e) => { if (e.key === "Enter") onUnlock(); });

    el.btnTheme()?.addEventListener("click", toggleTheme);
    el.btnHistoryTop()?.addEventListener("click", openHistoryFromTop);

    el.btnNew()?.addEventListener("click", newQuiz);
    el.btnReset()?.addEventListener("click", resetAnswers);
    el.btnGrade()?.addEventListener("click", gradeQuiz);
    el.btnReview()?.addEventListener("click", startReviewMode);

    el.btnPrev()?.addEventListener("click", goPrev);
    el.btnNext()?.addEventListener("click", goNext);

    el.btnToggleHistory()?.addEventListener("click", () => toggleHistory());
    el.btnClearHistory()?.addEventListener("click", clearHistory);

    updateLockUI();
    renderHistory();
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
