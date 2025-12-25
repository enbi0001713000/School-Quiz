/* app.js（全文）
 * - 合言葉 0217（localStorageで解錠）
 * - 25問（各教科5問）をタグフィルタ＋パターン分散で抽出
 * - クリックで解答、時間計測（問題ごと累積）
 * - 結果：全体・教科・難易度・pattern別、レーダー
 * - AI文章分析：正誤×時間×patternから“傾向”を自然文に整形（ローカル）
 */

(() => {
  "use strict";

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);

  const unlockCard = $("unlockCard");
  const settingsCard = $("settingsCard");
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

  const btnCopy = $("btnCopy");
  const btnBackToTop = $("btnBackToTop");

  const radar = $("radar");
  const ctx = radar.getContext("2d");

  // ===== Settings =====
  const PASSPHRASE_HASH = hash("0217"); // 生の文字列は極力露出しない（完全秘匿ではないが“見つけにくい”）
  const LS_UNLOCK = "schoolQuizUnlocked_v1";

  const state = {
    bankAll: [],
    quiz: [],
    answers: [], // { chosen: number|null, correctIndex:number, isCorrect:boolean|null, timeMs:number, visits:number }
    i: 0,
    startedAt: 0,
    qShownAt: 0,
    timerT: null,
    unlocked: false,
  };

  function hash(s) {
    // FNV-1a 32bit
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function now() { return performance.now(); }

  function fmtSec(ms) { return (ms / 1000).toFixed(1) + "s"; }

  function setUnlockedUI(on) {
    state.unlocked = on;
    btnNew.disabled = !on;
    // まだクイズが無いなら他はdisabled
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

  // ===== Load bank =====
  function loadBank() {
    if (!window.SchoolQuizBank) {
      unlockMsg.textContent = "bank.js の読み込みに失敗しています。";
      unlockMsg.style.color = "#b91c1c";
      return;
    }
    state.bankAll = window.SchoolQuizBank.buildAll(500);
  }

  // ===== Quiz generation (25 questions, 5 per subject) =====
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
    // opts: { strictUnique:boolean, avoidSimilar:boolean }
    // strategy: prioritize pattern diversity and avoid repeating same pattern too often
    const strictUnique = !!opts.strictUnique;
    const avoidSimilar = !!opts.avoidSimilar;

    const picked = [];
    const usedKey = new Set();
    const patternCount = new Map();

    // shuffle copy
    const rng = Math.random;
    const shuffled = pool.slice().sort(() => rng() - 0.5);

    function score(q) {
      const p = q.pattern || "misc";
      const c = patternCount.get(p) || 0;
      // lower count => higher score
      return -c + (Math.random() * 0.05);
    }

    while (picked.length < n) {
      // candidates not used
      let cands = shuffled.filter(q => !strictUnique || !usedKey.has(q.key));
      if (!cands.length) break;

      if (avoidSimilar) {
        cands = cands.sort((a, b) => score(b) - score(a));
      }

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
    // diffWanted = ["基礎","標準","発展"] subset
    const byDiff = groupBy(pool, q => q.diff || "標準");
    const pickFrom = (d) => (byDiff.get(d) || []);
    // 2:5:3 の比率目安
    const b = Math.round(need * 0.2);
    const s = Math.round(need * 0.5);
    const a = Math.max(0, need - b - s);

    const want = { 基礎: b, 標準: s, 発展: a };
    // ただし diffWanted で弾かれるので、無い分は他に回す
    const diffs = ["基礎","標準","発展"].filter(d => diffWanted.includes(d));

    const out = [];
    for (const d of ["基礎","標準","発展"]) {
      if (!diffWanted.includes(d)) continue;
      out.push(...pickFrom(d).slice(0, want[d] + 3)); // 少し余裕
    }
    // 候補不足時の保険：diffWanted内で全追加
    if (out.length < need * 3) {
      for (const d of diffs) out.push(...pickFrom(d));
    }
    // 重複キー除去
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

    const subjects = ["国語","数学","英語","理科","社会"];

    const filtered = state.bankAll.filter(q =>
      subjects.includes(q.sub) &&
      (levels.length ? levels.includes(q.level) : true) &&
      (diffs.length ? diffs.includes(q.diff) : true)
    );

    const bySub = groupBy(filtered, q => q.sub);
    const quiz = [];
    const globalUsed = new Set();

    for (const sub of subjects) {
      let pool = (bySub.get(sub) || []).slice();

      // 難易度配分をなるべく維持：教科5問でも2:5:3を“寄せる”
      // 5問の場合：基礎1 / 標準3 / 発展1 を目標
      if (mixDifficulty) {
        const candidates = stratifiedByDifficulty(pool, 5, diffs.length ? diffs : ["基礎","標準","発展"]);
        pool = candidates.length ? candidates : pool;
      }

      // グローバル重複禁止（教科内だけでなく全体でも）
      pool = pool.filter(q => !globalUsed.has(q.key));

      const picked = sampleDistinct(pool, 5, { strictUnique, avoidSimilar });
      for (const q of picked) globalUsed.add(q.key);
      quiz.push(...picked);
    }

    // 25問に不足する場合（フィルタが厳しすぎる等）
    if (quiz.length < 25) {
      const restPool = filtered.filter(q => !globalUsed.has(q.key));
      const add = sampleDistinct(restPool, 25 - quiz.length, { strictUnique, avoidSimilar });
      quiz.push(...add);
    }

    // 最終：25に整形＆シャッフル（教科順が見えないように）
    const finalQuiz = quiz.slice(0, 25).sort(() => Math.random() - 0.5);

    // 初期化
    state.quiz = finalQuiz;
    state.answers = finalQuiz.map(q => ({
      chosen: null,
      correctIndex: q.a,
      isCorrect: null,
      timeMs: 0,
      visits: 0,
    }));
    state.i = 0;
    state.startedAt = now();
    state.qShownAt = now();
  }

  // ===== Rendering =====
  function setVisible(section) {
    quizCard.hidden = section !== "quiz";
    resultCard.hidden = section !== "result";
    // settingsCardは常に見える（トップに戻るときに分かりやすい）
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
    const labels = ["A","B","C","D"];
    q.c.forEach((txt, idx) => {
      const div = document.createElement("div");
      div.className = "choice" + (a.chosen === idx ? " selected" : "");
      div.setAttribute("role","button");
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

    // progress
    const answered = state.answers.filter(x => x.chosen !== null).length;
    progressBar.style.width = `${Math.round((answered / state.quiz.length) * 100)}%`;

    // timer
    state.qShownAt = now();
    startTimerTick();
    updateTimerUI();

    // buttons
    btnReset.disabled = false;
    btnGrade.disabled = false;
  }

  function choose(idx) {
    accumulateTime(); // 選択操作までの時間を加算
    const a = state.answers[state.i];
    a.chosen = idx;
    // 再表示
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

  // ===== Controls =====
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
    setVisible("quiz"); // いったん戻す（次に新規作成をすぐ押せる）
    // ただし問題は残す。気分で続きをやれるように。
  });

  // ===== Grading & Analysis =====
  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s,x)=>s+x,0)/arr.length;
  }

  function gradeAndShow() {
    stopTimerTick();
    accumulateTime();

    // mark correctness
    for (let i = 0; i < state.quiz.length; i++) {
      const q = state.quiz[i];
      const a = state.answers[i];
      a.isCorrect = (a.chosen === q.a);
    }

    const total = state.quiz.length;
    const correct = state.answers.filter(x => x.isCorrect).length;
    const acc = Math.round((correct / total) * 100);

    const totalTime = state.answers.reduce((s,x)=>s+x.timeMs,0);
    const avgTime = total ? totalTime / total : 0;

    scoreLine.textContent = `${correct} / ${total}（${acc}%）　合計：${fmtSec(totalTime)}　平均：${fmtSec(avgTime)}`;

    renderBreakdown();
    drawRadar();
    renderExplain();
    renderAIText();

    setVisible("result");
    window.scrollTo({ top: resultCard.offsetTop - 10, behavior: "smooth" });
  }

  function renderBreakdown() {
    const subjects = ["国語","数学","英語","理科","社会"];

    const bySub = subjects.map(sub => {
      const idxs = state.quiz.map((q,i)=>({q,i})).filter(x => x.q.sub === sub).map(x=>x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      const time = idxs.reduce((s,i)=>s+state.answers[i].timeMs,0);
      const avg = total ? time/total : 0;
      return { sub, total, cor, acc: total?Math.round(cor/total*100):0, time, avg };
    });

    const byDiff = ["基礎","標準","発展"].map(d => {
      const idxs = state.quiz.map((q,i)=>({q,i})).filter(x => x.q.diff===d).map(x=>x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      const time = idxs.reduce((s,i)=>s+state.answers[i].timeMs,0);
      const avg = total ? time/total : 0;
      return { d, total, cor, acc: total?Math.round(cor/total*100):0, time, avg };
    });

    const patterns = {};
    for (let i=0;i<state.quiz.length;i++){
      const p = state.quiz[i].pattern || "misc";
      if (!patterns[p]) patterns[p] = { p, total:0, cor:0, time:0 };
      patterns[p].total += 1;
      if (state.answers[i].isCorrect) patterns[p].cor += 1;
      patterns[p].time += state.answers[i].timeMs;
    }
    const byPattern = Object.values(patterns).map(x => ({
      ...x,
      acc: x.total ? Math.round(x.cor/x.total*100) : 0,
      avg: x.total ? x.time/x.total : 0
    })).sort((a,b)=> (a.acc - b.acc) || (b.avg - a.avg));

    breakdown.innerHTML = "";

    const blocks = [
      { k:"教科別", items: bySub.map(x => `${x.sub}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) },
      { k:"難易度別", items: byDiff.map(x => `${x.d}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) },
      { k:"パターン別（弱い順）", items: byPattern.slice(0, 12).map(x => `#${x.p}：${x.cor}/${x.total}（${x.acc}%） 平均${fmtSec(x.avg)}`) }
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

  // ===== Radar chart (5 subjects) =====
  function drawRadar() {
    const subjects = ["国語","数学","英語","理科","社会"];
    const scores = subjects.map(sub => {
      const idxs = state.quiz.map((q,i)=>({q,i})).filter(x => x.q.sub===sub).map(x=>x.i);
      const total = idxs.length;
      const cor = idxs.filter(i => state.answers[i].isCorrect).length;
      return total ? (cor/total*100) : 0;
    });

    const W = radar.width, H = radar.height;
    ctx.clearRect(0,0,W,H);

    const cx = W/2, cy = H/2 + 10;
    const R = Math.min(W,H)*0.36;

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e8dfcf";
    ctx.fillStyle = "#0d1b2a";

    for (let g=1; g<=5; g++){
      const r = (R*g)/5;
      ctx.beginPath();
      for (let i=0;i<5;i++){
        const ang = (-Math.PI/2) + (i*2*Math.PI/5);
        const x = cx + r*Math.cos(ang);
        const y = cy + r*Math.sin(ang);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // axes + labels
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#0d1b2a";
    for (let i=0;i<5;i++){
      const ang = (-Math.PI/2) + (i*2*Math.PI/5);
      const x = cx + (R+18)*Math.cos(ang);
      const y = cy + (R+18)*Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(cx + R*Math.cos(ang), cy + R*Math.sin(ang));
      ctx.stroke();

      const label = `${subjects[i]} ${Math.round(scores[i])}%`;
      ctx.fillText(label, x - (label.length*3), y + 4);
    }

    // polygon (no specific colors rule doesn't apply here; CSS-like ok. We'll use default stroke style)
    ctx.beginPath();
    for (let i=0;i<5;i++){
      const ang = (-Math.PI/2) + (i*2*Math.PI/5);
      const r = (scores[i]/100)*R;
      const x = cx + r*Math.cos(ang);
      const y = cy + r*Math.sin(ang);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
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

  // ===== Explain list =====
  function renderExplain() {
    explainList.innerHTML = "";

    const box = document.createElement("div");
    box.className = "explainBox";
    box.id = "explainBox";
    box.textContent = "番号を押すと、ここに解説が表示されます。";

    for (let i=0;i<state.quiz.length;i++){
      const q = state.quiz[i];
      const a = state.answers[i];

      const b = document.createElement("button");
      b.className = "qbtn";
      b.textContent = `${i+1}`;
      if (a.isCorrect) b.style.borderColor = "#1b7f4b";
      else if (a.chosen !== null) b.style.borderColor = "#b91c1c";
      else b.style.borderColor = "#e8dfcf";

      b.addEventListener("click", () => {
        const chosen = a.chosen === null ? "(未回答)" : q.c[a.chosen];
        const correct = q.c[q.a];
        const line =
          `【Q${i+1}】${q.sub} / ${q.level} / ${q.diff} / #${q.pattern}\n` +
          `${q.q}\n\n` +
          `あなたの解答：${chosen}\n` +
          `正解：${correct}\n` +
          `判定：${a.isCorrect ? "○" : (a.chosen===null ? "—" : "×")}\n` +
          `解説：${q.exp || "（解説なし）"}\n` +
          `この問題の累積時間：${fmtSec(a.timeMs)}（訪問回数：${a.visits}）`;
        box.textContent = line;
        box.scrollIntoView({ behavior:"smooth", block:"nearest" });
      });

      explainList.appendChild(b);
    }
    explainList.appendChild(box);
  }

  // ===== AI-like narrative analysis =====
  function renderAIText() {
    const rows = state.quiz.map((q,i)=>({
      q, a: state.answers[i]
    }));

    const answered = rows.filter(x => x.a.chosen !== null);
    const total = rows.length;
    const correct = rows.filter(x => x.a.isCorrect).length;
    const acc = total ? correct/total : 0;

    const times = rows.map(x => x.a.timeMs);
    const avg = mean(times);
    const med = median(times);
    const fastThresh = Math.max(1500, med * 0.7);
    const slowThresh = Math.max(6000, med * 1.3);

    const fastWrong = rows.filter(x => !x.a.isCorrect && x.a.chosen !== null && x.a.timeMs <= fastThresh);
    const slowWrong = rows.filter(x => !x.a.isCorrect && x.a.chosen !== null && x.a.timeMs >= slowThresh);
    const slowRight = rows.filter(x => x.a.isCorrect && x.a.timeMs >= slowThresh);
    const fastRight = rows.filter(x => x.a.isCorrect && x.a.timeMs <= fastThresh);

    // weakness by subject/pattern
    const byKey = (keyFn) => {
      const m = new Map();
      for (const x of rows) {
        const k = keyFn(x.q);
        if (!m.has(k)) m.set(k, { k, total:0, cor:0, time:0, wrong:0 });
        const o = m.get(k);
        o.total++;
        o.time += x.a.timeMs;
        if (x.a.isCorrect) o.cor++;
        else if (x.a.chosen !== null) o.wrong++;
      }
      return [...m.values()].map(o => ({
        ...o,
        acc: o.total ? o.cor/o.total : 0,
        avg: o.total ? o.time/o.total : 0
      }));
    };

    const subStats = byKey(q => q.sub).sort((a,b)=>a.acc-b.acc);
    const patStats = byKey(q => q.pattern || "misc").sort((a,b)=>a.acc-b.acc || b.avg-a.avg);

    const weakestSub = subStats[0];
    const weakestPat = patStats[0];

    // “弱点なし”判定
    const weakCandidates = patStats.filter(x => x.total >= 2 && x.acc < 0.7);
    const weakText = weakCandidates.length
      ? weakCandidates.slice(0,4).map(x => `#${x.k}（正答率${pct(x.acc)}・平均${fmtSec(x.avg)}）`).join("、")
      : "特になし（偏りなく処理できています）";

    // 学習提案（pattern別）
    const patAdvice = makeAdvice(weakCandidates.slice(0,4).map(x=>x.k));

    // 文章生成（ローカル）
    const lines = [];
    lines.push(`総合所見：正答率は ${Math.round(acc*100)}%（${correct}/${total}）。平均解答時間は ${fmtSec(avg)}。`);
    lines.push("");

    lines.push(`スピード傾向：`);
    lines.push(`- 速く正確：${fastRight.length}問（判断が速い領域）`);
    lines.push(`- 速いが誤り：${fastWrong.length}問（見落とし／早とちりの可能性）`);
    lines.push(`- 遅いが正確：${slowRight.length}問（慎重に積み上げるタイプ）`);
    lines.push(`- 遅くて誤り：${slowWrong.length}問（手が止まる論点が残存）`);
    lines.push("");

    lines.push(`苦手領域の候補：${weakText}`);
    lines.push("");

    // “全問正解などで弱点が無い場合は無し”の要望に対応
    if (weakCandidates.length === 0) {
      lines.push(`弱点判定：無し。現時点では「苦手の固定化」は見られません。`);
      lines.push(`次の伸ばし方：時間が伸びた問題（解説欄で累積時間が長い番号）を優先的に復習すると、スコアの再現性が上がります。`);
      lines.push("");
    } else {
      lines.push(`推定原因（誤答×時間からの推論）：`);
      if (fastWrong.length >= slowWrong.length) {
        lines.push(`- “速い誤答”が相対的に多めです。解法は見えているが、条件・符号・語句の取り違えが起きやすいタイプ。`);
        lines.push(`  → 対策：最初の10秒で「問われている量／条件」を指差し確認（心の中でOK）。`);
      } else {
        lines.push(`- “遅い誤答”が目立ちます。方針決定（どの公式・定理・知識を使うか）に時間を使い、最後に崩れるパターン。`);
        lines.push(`  → 対策：解法テンプレ（例：数学なら図に印→条件→定理候補3つ、理科なら式→単位→代入）を固定化。`);
      }
      lines.push("");
      lines.push(`改善アクション（短期で効く順）：`);
      for (const a of patAdvice) lines.push(`- ${a}`);
      lines.push("");
    }

    lines.push(`補足：最弱教科は「${weakestSub.k}」（正答率${pct(weakestSub.acc)}・平均${fmtSec(weakestSub.avg)}）。`);
    lines.push(`最も崩れやすい出題タイプは「#${weakestPat.k}」（正答率${pct(weakestPat.acc)}・平均${fmtSec(weakestPat.avg)}）。`);
    lines.push(`※この分析は、回答ログ（正誤・時間・出題タグ）からの統計的推定です。`);

    aiAnalysis.textContent = lines.join("\n");
  }

  function pct(x){ return `${Math.round(x*100)}%`; }

  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
  }

  function makeAdvice(patterns) {
    const map = {
      proof: "数学 #proof：理由（合同条件・角の性質）だけを“言葉で”言い切る練習。『何が等しい→なぜ等しい』を1行で。",
      pythagoras: "数学 #pythagoras：直角マーク→辺の対応（斜辺は一番長い）を先に確定してから式。",
      probability: "数学 #probability：独立か／戻すかを最初に宣言（戻さない→分母が変わる）。",
      calc_ohm: "理科 #calc_ohm：単位を書いて式V=IR、未知数を左に置いてから代入。",
      calc_density: "理科 #calc_density：密度=質量/体積を“見た瞬間”に出す。単位をセットで覚える。",
      experiment: "理科 #experiment：操作変数・統一条件・結果の3点セットで読む癖。",
      geo: "社会 #geo：地形・気候は『原因→結果』で覚える（季節風→日本海→雪）。",
      history: "社会 #history：用語を“制度・目的・結果”で1枚にまとめると誤答が減る。",
      civics: "社会 #civics：三権の役割を“すること/できないこと”で対にして整理。",
      grammar: "英語 #grammar：文の骨格（S-V）を先に取り、空欄の品詞を固定してから選択肢を見る。"
    };
    const out = [];
    for (const p of patterns) {
      if (map[p]) out.push(map[p]);
    }
    if (!out.length) {
      out.push("全体：時間が長いのに誤答だった問題を2つ選び、解説の“なぜ”を自分の言葉で言い直す（再現性が上がります）。");
    }
    return out;
  }

  // ===== Copy results =====
  btnCopy.addEventListener("click", async () => {
    try {
      const text = buildCopyText();
      await navigator.clipboard.writeText(text);
      btnCopy.textContent = "コピーしました";
      setTimeout(()=>btnCopy.textContent="結果をコピー", 1200);
    } catch {
      alert("コピーに失敗しました。ブラウザの権限をご確認ください。");
    }
  });

  function buildCopyText() {
    const total = state.quiz.length;
    const correct = state.answers.filter(x => x.isCorrect).length;
    const totalTime = state.answers.reduce((s,x)=>s+x.timeMs,0);
    const avg = total ? totalTime/total : 0;

    let s = "";
    s += `【結果】${correct}/${total}（${Math.round(correct/total*100)}%）\n`;
    s += `合計時間：${fmtSec(totalTime)} / 平均：${fmtSec(avg)}\n\n`;
    s += "【AI分析】\n";
    s += aiAnalysis.textContent + "\n\n";
    s += "【各問ログ】\n";
    for (let i=0;i<total;i++){
      const q = state.quiz[i];
      const a = state.answers[i];
      const chosen = a.chosen===null ? "未回答" : q.c[a.chosen];
      const corr = q.c[q.a];
      s += `Q${i+1} ${q.sub}/${q.diff}/#${q.pattern}：${a.isCorrect?"○":"×"} ${fmtSec(a.timeMs)}\n`;
      s += `  あなた：${chosen}\n  正解：${corr}\n`;
    }
    return s;
  }

  // ===== Init =====
  loadUnlock();

})();
