/* app.js - Quiz main logic (externalized to avoid inline-script blocks) */

/* PWA */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

/* Utils */
function mulberry32(seed){ let t = seed>>>0; return function(){ t += 0x6D2B79F5; let r = Math.imul(t ^ (t>>>15), 1|t); r ^= r + Math.imul(r ^ (r>>>7), 61|r); return ((r ^ (r>>>14))>>>0)/4294967296; }; }
function hashStringToSeed(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function shuffle(arr, rng){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function fmtTime(sec){ const m=String(Math.floor(sec/60)).padStart(2,"0"); const s=String(sec%60).padStart(2,"0"); return `${m}:${s}`; }
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function toast(msg){
  const el=document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display="block";
  clearTimeout(toast._t);
  toast._t=setTimeout(()=> el.style.display="none", 1600);
}
function cryptoRandomId(){ const a=new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,"0")).join(""); }

/* ====== 合言葉ゲート（0217） ====== */
(function passphraseGate(){
  const PASSPHRASE = "0217";
  const passed = sessionStorage.getItem("quiz_passed") === "1";

  function renderGate(){
    document.body.innerHTML = `
      <div style="max-width:760px;margin:70px auto;padding:18px;font-family:system-ui;color:#eaf0ff;">
        <div style="padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(0,0,0,.25);">
          <h2 style="margin:0 0 10px;">合言葉が必要です</h2>
          <p style="margin:0 0 14px;color:rgba(234,240,255,.75);">
            このクイズは合言葉を知っている人だけ遊べます。
          </p>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input id="pw" inputmode="numeric" placeholder="合言葉（4桁）"
                   style="padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);
                          background:rgba(255,255,255,.06);color:#eaf0ff;font-size:16px;outline:none;">
            <button id="enter"
                    style="padding:12px 14px;border-radius:12px;border:1px solid rgba(122,167,255,.45);
                           background:rgba(122,167,255,.18);color:#eaf0ff;font-weight:800;cursor:pointer;">
              入室
            </button>
          </div>

          <div id="msg" style="margin-top:10px;color:rgba(255,200,87,.95);display:none;">
            合言葉が違います。
          </div>

          <hr style="border:none;height:1px;background:rgba(255,255,255,.10);margin:16px 0;">
          <div style="font-size:12px;color:rgba(234,240,255,.65);">
            ※同じタブでは通過状態を保持（タブを閉じると再入力）。
          </div>
        </div>
      </div>
    `;
    const input = document.getElementById("pw");
    const btn = document.getElementById("enter");
    const msg = document.getElementById("msg");

    function tryEnter(){
      if (input.value === PASSPHRASE){
        sessionStorage.setItem("quiz_passed","1");
        location.reload();
      } else {
        msg.style.display = "block";
        input.select();
      }
    }
    btn.addEventListener("click", tryEnter);
    input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") tryEnter(); });
    input.focus();
  }

  if (!passed){
    renderGate();
    window.__QUIZ_BLOCKED__ = true;
  }
})();

/* ====== Quiz core ====== */
const SUBJECTS = ["国語","数学","英語","理科","社会"];
const DIFFS = ["基礎","標準","発展"];
const LEVELS = ["小","中"];

let state = {
  seedStr:"", seed:0, rng:null,
  bank:[], questions:[],
  answers:new Map(),
  perQuestionTimer:new Map(),
  startedAtMs:0, elapsedSec:0, timerHandle:null,
  submitted:false,
  chart:null
};

function destroyChart(){ if(state.chart){ state.chart.destroy(); state.chart=null; } }

function getSelectedFilters(){
  const lvls = [];
  if (document.getElementById("lvlE").checked) lvls.push("小");
  if (document.getElementById("lvlJ").checked) lvls.push("中");
  const diffs = [];
  if (document.getElementById("dB").checked) diffs.push("基礎");
  if (document.getElementById("dS").checked) diffs.push("標準");
  if (document.getElementById("dA").checked) diffs.push("発展");
  return { lvls, diffs };
}

function pickQuestionsFromBank(bank, rng, filters){
  if (filters.lvls.length === 0){ filters.lvls = ["小","中"]; toast("学年が全OFFだったので小＋中で出題します"); }
  if (filters.diffs.length === 0){ filters.diffs = ["基礎","標準","発展"]; toast("難易度が全OFFだったので基礎＋標準＋発展で出題します"); }

  const strict = (filters.diffs.length === 3);

  const subjOrder = shuffle(SUBJECTS, rng);
  const typeA = new Set(subjOrder.slice(0,2)); // 2教科: 1基礎・3標準・1発展
  const perSubjPlan = {};
  for (const s of SUBJECTS){
    perSubjPlan[s] = typeA.has(s)
      ? { "基礎":1, "標準":3, "発展":1 }
      : { "基礎":1, "標準":2, "発展":2 };
  }

  function normalizePlan(plan){
    if (strict) return plan;
    const allowed = new Set(filters.diffs);
    let total=0;
    const p = { "基礎":0,"標準":0,"発展":0 };
    for (const d of DIFFS){
      if (allowed.has(d)){ p[d]=plan[d]; total += p[d]; }
    }
    if (total===0) return plan;

    const target = 5;
    const raw = DIFFS.map(d => ({d, v: allowed.has(d) ? (plan[d]/total)*target : 0}));
    let acc = 0;
    for (const x of raw){ x.f = Math.floor(x.v); acc += x.f; }
    let remain = target - acc;
    raw.sort((a,b)=> (b.v-b.f) - (a.v-a.f));
    for (let i=0;i<raw.length && remain>0;i++){
      if (raw[i].v>0){ raw[i].f += 1; remain--; }
    }
    const out = { "基礎":0,"標準":0,"発展":0 };
    for (const x of raw){ out[x.d]=x.f; }
    const sum = out["基礎"]+out["標準"]+out["発展"];
    if (sum<5){
      const d = allowed.has("標準") ? "標準" : (allowed.has("基礎") ? "基礎" : "発展");
      out[d] += (5-sum);
    }
    return out;
  }

  function poolFor(sub, diff, lvls){
    return bank.filter(q => q.sub===sub && q.diff===diff && lvls.includes(q.level));
  }
  function relaxedPool(sub, diff){
    const p1 = bank.filter(q => q.sub===sub && q.diff===diff);
    const p2 = bank.filter(q => q.sub===sub && filters.lvls.includes(q.level));
    const p3 = bank.filter(q => q.sub===sub);
    return { p1, p2, p3 };
  }

  const picked = [];
  const usedKeys = new Set();

  for (const sub of SUBJECTS){
    const plan = normalizePlan(perSubjPlan[sub]);
    for (const diff of DIFFS){
      const need = plan[diff];
      if (need<=0) continue;

      let pool = poolFor(sub, diff, filters.lvls);
      pool = pool.filter(q => !usedKeys.has(q.key));

      if (pool.length < need){
        const {p1,p2,p3} = relaxedPool(sub, diff);
        let merged = pool.slice();

        const addFrom = (arr)=>{
          for (const q of arr){
            if (merged.length >= need) break;
            if (!usedKeys.has(q.key)) merged.push(q);
          }
        };
        addFrom(p1);
        addFrom(p2);
        addFrom(p3);
        pool = merged;
      }

      if (pool.length < need){
        const fallback = bank.filter(q=>q.sub===sub && !usedKeys.has(q.key));
        toast(`プール不足：${sub}/${diff} が不足したため、同教科から補填しました`);
        pool = fallback;
      }

      const chosen = shuffle(pool, rng).slice(0, need);
      for (const q of chosen){
        usedKeys.add(q.key);
        picked.push({
          id: cryptoRandomId(),
          sub: q.sub, level: q.level, diff: q.diff,
          q: q.q, c: q.c.slice(), a: q.a, exp: q.exp,
          key: q.key
        });
      }
    }
  }

  return shuffle(picked, rng).slice(0, 25).map((x,i)=> ({...x, no:i+1}));
}

function buildQuiz(){
  const filters = getSelectedFilters();

  // bank.js が読み込めてない場合はここで止まる
  if (!window.SchoolQuizBank){
    alert("bank.js が読み込めていません（SchoolQuizBank未定義）");
    return;
  }

  if (!state.bank.length){
    state.bank = window.SchoolQuizBank.buildAll(500);
  }

  const seedStr = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const seed = hashStringToSeed(seedStr);
  const rng = mulberry32(seed);

  const questions = pickQuestionsFromBank(state.bank, rng, filters);

  state.seedStr = seedStr;
  state.seed = seed;
  state.rng = rng;
  state.questions = questions;
  state.answers = new Map();
  state.perQuestionTimer = new Map();
  state.startedAtMs = Date.now();
  state.elapsedSec = 0;
  state.submitted = false;

  document.getElementById("seedPill").textContent = `Seed: ${seed.toString(16)}`;
  document.getElementById("btnSubmit").disabled = true;
  document.getElementById("btnCopy").disabled = true;

  setKpisPlaceholders();
  renderQuestions();
  renderNumStrip();
  renderAnalysisPlaceholder();
  destroyChart();
  startGlobalTimer();
  updateProgress();
}

function startGlobalTimer(){
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerHandle = setInterval(()=>{
    state.elapsedSec = Math.floor((Date.now() - state.startedAtMs)/1000);
    document.getElementById("timerPill").textContent = `Time: ${fmtTime(state.elapsedSec)}`;
  }, 250);
}

function renderQuestions(){
  const root = document.getElementById("quizRoot");
  root.innerHTML = "";

  for (const item of state.questions){
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

    item.c.forEach((text, idx)=>{
      const label = document.createElement("label");
      label.className = "choice";
      label.innerHTML = `
        <input type="radio" name="q-${item.id}" value="${idx}" ${state.submitted ? "disabled": ""}/>
        <div><b>${String.fromCharCode(65+idx)}.</b> ${escapeHtml(text)}</div>
      `;
      label.addEventListener("click", ()=>{
        if (state.submitted) return;
        if (!state.perQuestionTimer.has(item.id)) state.perQuestionTimer.set(item.id, Date.now());

        state.answers.set(item.id, { choiceIndex: idx, timeSpentSec: 0 });

        const box = root.querySelector(\`.q[data-qid="\${item.id}"]\`);
        box.querySelectorAll(".choice").forEach(ch => ch.classList.remove("selected"));
        label.classList.add("selected");
        document.getElementById(\`ans-\${item.id}\`).textContent = `回答: ${String.fromCharCode(65+idx)}`;

        updateProgress();
      });
      choices.appendChild(label);
    });

    qEl.appendChild(top);
    qEl.appendChild(choices);
    root.appendChild(qEl);
  }
}

function updateProgress(){
  const answered = state.answers.size;
  document.getElementById("progressPill").textContent = `Answered: ${answered} / 25`;
  document.getElementById("btnSubmit").disabled = (answered < 25) || state.submitted;
  if (!state.submitted) renderNumStrip();
}

function renderNumStrip(){
  const strip = document.getElementById("numStrip");
  strip.innerHTML = "";
  for (const item of state.questions){
    const btn = document.createElement("button");
    btn.textContent = item.no;
    btn.className = "neutral";
    btn.disabled = !state.submitted;
    if (state.submitted){
      const ok = isQuestionCorrect(item.id);
      btn.className = ok ? "good" : "bad";
    }
    btn.addEventListener("click", ()=>{ if (state.submitted) openExplanation(item.no); });
    strip.appendChild(btn);
  }
}

function openExplanation(questionNo){
  const item = state.questions.find(x=>x.no===questionNo);
  if (!item) return;

  const ans = state.answers.get(item.id);
  const yourIdx = ans?.choiceIndex;
  const correctIdx = item.a;
  const your = (yourIdx===undefined) ? "未回答" : `${String.fromCharCode(65+yourIdx)}. ${item.c[yourIdx]}`;
  const corr = `${String.fromCharCode(65+correctIdx)}. ${item.c[correctIdx]}`;
  const ok = (yourIdx === correctIdx);

  document.getElementById("modalSub").textContent = `Q${item.no} / ${item.sub} / ${item.level} / ${item.diff} / ${ok ? "正解" : "不正解"}`;
  document.getElementById("modalBody").innerHTML = `
    <div style="font-weight:900; font-size:16px;">${escapeHtml(item.q)}</div>
    <div class="hr"></div>
    <div><b>あなたの回答：</b> ${escapeHtml(your)}</div>
    <div><b>正解：</b> ${escapeHtml(corr)}</div>
    <div class="hr"></div>
    <div><b>解説：</b><br>${escapeHtml(item.exp)}</div>
    <div class="hr"></div>
    <div class="muted tiny">※提出後のみ閲覧可</div>
  `;
  const back = document.getElementById("modalBack");
  back.style.display="flex";
  back.setAttribute("aria-hidden","false");
}
function closeModal(){
  const back = document.getElementById("modalBack");
  back.style.display="none";
  back.setAttribute("aria-hidden","true");
}

function isQuestionCorrect(qid){
  const q = state.questions.find(x=>x.id===qid);
  const a = state.answers.get(qid);
  return a && a.choiceIndex === q.a;
}
function computeTimes(){
  const now = Date.now();
  for (const q of state.questions){
    const started = state.perQuestionTimer.get(q.id);
    const ans = state.answers.get(q.id);
    if (!ans) continue;
    ans.timeSpentSec = started ? Math.max(0, Math.round((now-started)/1000)) : 0;
  }
}

function submit(){
  if (state.submitted) return;
  if (state.answers.size < 25){ toast("全問回答してから提出してください"); return; }
  computeTimes();
  state.submitted = true;
  document.getElementById("btnCopy").disabled = false;

  const root = document.getElementById("quizRoot");
  for (const item of state.questions){
    const box = root.querySelector(`.q[data-qid="${item.id}"]`);
    const choices = Array.from(box.querySelectorAll(".choice"));
    const radios = Array.from(box.querySelectorAll("input[type=radio]"));
    radios.forEach(r=> r.disabled = true);

    const ans = state.answers.get(item.id);
    const chosen = ans.choiceIndex;
    const correct = item.a;

    choices.forEach((ch, idx)=>{
      ch.classList.remove("selected");
      if (idx === chosen) ch.classList.add("selected");
      if (idx === correct) ch.classList.add("correct");
      if (idx === chosen && chosen !== correct) ch.classList.add("wrong");
    });

    const ok = (chosen === correct);
    const st = document.getElementById(`status-${item.id}`);
    st.className = `tag ${ok ? "good" : "bad"}`;
    st.textContent = ok ? "正解" : "不正解";
  }

  renderNumStrip();
  renderResults();
  document.getElementById("btnSubmit").disabled = true;
}

function setKpisPlaceholders(){
  document.getElementById("kpiGrid").innerHTML = `
    <div class="kpi"><div class="v">-</div><div class="k">総合スコア</div></div>
    <div class="kpi"><div class="v">-</div><div class="k">正答率</div></div>
    <div class="kpi"><div class="v">-</div><div class="k">平均回答時間</div></div>
    <div class="kpi"><div class="v">-</div><div class="k">弱点教科</div></div>
  `;
}
function renderAnalysisPlaceholder(){
  document.getElementById("analysisBox").innerHTML = `
    <b>提出すると</b>、ここに分析が出ます。
    <ul>
      <li>教科別：得点・傾向</li>
      <li>難易度別：得点（基礎/標準/発展）</li>
      <li>学年別：得点（小/中）</li>
    </ul>
    <div class="muted tiny">※番号ボタンで解説は提出後に表示</div>
  `;
}

function drawRadar(scores){
  const ctx = document.getElementById("radar");
  destroyChart();
  if (!window.Chart){
    toast("Chart.jsが読み込めないため、チャートを省略します");
    return;
  }
  state.chart = new Chart(ctx, {
    type: "radar",
    data: { labels: SUBJECTS, datasets: [{ label: "得点（各5点満点）", data: scores, fill: true, borderWidth: 2, pointRadius: 3 }] },
    options: {
      responsive:true,
      scales:{ r:{ min:0, max:5, ticks:{stepSize:1}, grid:{circular:false}, pointLabels:{ font:{ size:12, weight:"600" } } } },
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(ctx)=>` ${ctx.raw}/5` } } }
    }
  });
}

function renderResults(){
  const bySub = {}; SUBJECTS.forEach(s=> bySub[s]={correct:0,total:0,timeSum:0});
  const byDiff = {}; DIFFS.forEach(d=> byDiff[d]={correct:0,total:0});
  const byLvl = {}; LEVELS.forEach(l=> byLvl[l]={correct:0,total:0});

  let totalCorrect=0, totalTime=0;

  for (const q of state.questions){
    const ans = state.answers.get(q.id);
    const ok = ans.choiceIndex === q.a;

    bySub[q.sub].total += 1;
    bySub[q.sub].timeSum += ans.timeSpentSec;
    byDiff[q.diff].total += 1;
    byLvl[q.level].total += 1;

    if (ok){
      bySub[q.sub].correct += 1;
      byDiff[q.diff].correct += 1;
      byLvl[q.level].correct += 1;
      totalCorrect++;
    }
    totalTime += ans.timeSpentSec;
  }

  const pct = Math.round((totalCorrect/25)*100);
  const avgTime = Math.round(totalTime/25);
  const weakest = SUBJECTS.slice().sort((a,b)=> (bySub[a].correct - bySub[b].correct))[0];
  const strength = SUBJECTS.slice().sort((a,b)=> (bySub[b].correct - bySub[a].correct))[0];

  const grid = document.getElementById("kpiGrid");
  grid.innerHTML = "";
  [
    {v:`${totalCorrect} / 25`, k:"総合スコア"},
    {v:`${pct}%`, k:"正答率"},
    {v:`${avgTime}秒/問`, k:"平均回答時間"},
    {v:`${weakest}（${bySub[weakest].correct}/5）`, k:"弱点教科"},
  ].forEach(x=>{
    const el=document.createElement("div");
    el.className="kpi";
    el.innerHTML=`<div class="v">${escapeHtml(x.v)}</div><div class="k">${escapeHtml(x.k)}</div>`;
    grid.appendChild(el);
  });

  drawRadar(SUBJECTS.map(s=>bySub[s].correct));

  document.getElementById("analysisBox").innerHTML = `<b>分析サマリ</b><br>強み：<b>${escapeHtml(strength)}</b> ／ 弱点：<b>${escapeHtml(weakest)}</b>`;
}

async function copyResults(){
  const text = "（結果コピーは省略版。必要なら拡張します）";
  try{ await navigator.clipboard.writeText(text); toast("結果をコピーしました"); }
  catch{ toast("コピーできませんでした"); }
}

function resetAnswers(){
  state.answers = new Map();
  state.perQuestionTimer = new Map();
  state.submitted = false;
  document.getElementById("btnCopy").disabled = true;
  setKpisPlaceholders();
  renderAnalysisPlaceholder();
  destroyChart();
  renderQuestions();
  renderNumStrip();
  updateProgress();
  toast("回答をリセットしました");
}

function wireEvents(){
  document.getElementById("btnNew").addEventListener("click", buildQuiz);
  document.getElementById("btnReset").addEventListener("click", resetAnswers);
  document.getElementById("btnSubmit").addEventListener("click", submit);
  document.getElementById("btnCopy").addEventListener("click", copyResults);
  document.getElementById("btnCloseModal").addEventListener("click", closeModal);
  document.getElementById("modalBack").addEventListener("click", (e)=>{ if (e.target.id==="modalBack") closeModal(); });
  document.addEventListener("keydown", (e)=>{ if (e.key==="Escape") closeModal(); });

  ["lvlE","lvlJ","dB","dS","dA"].forEach(id=>{
    document.getElementById(id).addEventListener("change", ()=>{
      toast("設定を変更しました。『新しいクイズ』で反映されます。");
    });
  });
}

if (!window.__QUIZ_BLOCKED__) {
  wireEvents();
  buildQuiz();
}
