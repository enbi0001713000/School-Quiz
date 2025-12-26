(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];
  const MIN_PER_SUBJECT = 130;      // 各教科の最低保証
  const MIN_ENGLISH = 220;          // 英語は不足が出やすいので多めに保証

  const pick = (arr, i) => arr[i % arr.length];
  const uniq = (arr) => {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const t = String(x ?? "").trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  };
  const toKey = (q, i) =>
    q.key || `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 30)}|${i}`;

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;
    const banned = [
      "用語の使い方が不適切","時代が違う","地域が違う","不明","わからない",
      "どれでもない","上のいずれでもない"
    ];
    return banned.includes(t);
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) return false;

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const set = new Set(choices);
    if (set.size !== 4) return false;

    if (isBadChoiceText(choices[q.a])) return false;
    return true;
  }

  // ★ 4択を「必ず4つのユニーク」にする（不足の根本対策）
  function force4Unique(correct, wrongPool, seed, extraPool = []) {
    const c = String(correct).trim();

    // 1) 正解を除外した誤答候補を作る
    const pool = uniq(wrongPool.map(String)).filter(x => x.trim() && x.trim() !== c);

    // 2) まず pool から3つ取る
    const wrongs = [];
    for (let k = 0; k < pool.length && wrongs.length < 3; k++) {
      const w = pool[(seed + k) % pool.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }

    // 3) それでも足りなければ extraPool から補う
    const extra = uniq(extraPool.map(String)).filter(x => x.trim() && x.trim() !== c);
    for (let k = 0; k < extra.length && wrongs.length < 3; k++) {
      const w = extra[(seed + k) % extra.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }

    // 4) まだ足りない場合は “安全なダミー誤答” を補填（文法系のみ想定）
    const safeFill = ["do","does","did","am","is","are","was","were","will","can"];
    for (let k = 0; k < safeFill.length && wrongs.length < 3; k++) {
      const w = safeFill[(seed + k) % safeFill.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }

    const arr = uniq([c, ...wrongs]).slice(0, 4);
    // 正解を先頭に
    const idx = arr.indexOf(c);
    if (idx > 0) [arr[0], arr[idx]] = [arr[idx], arr[0]];
    return { c: arr, a: 0 };
  }

  /* =========================
   * 固定問題（最小例。ここはあなたが増やしていく場所）
   * ========================= */
  const FIXED = {
    英語: [
      { sub:"英語", level:"中", diff:"標準", pattern:"grammar",
        q:"(　)に入る最も適切な語は？ I (   ) to school every day.",
        c:["go","goes","went","going"], a:0, exp:"I は三単現ではないので go。"
      },
      { sub:"英語", level:"中", diff:"標準", pattern:"reading",
        q:'英文："Tom was tired, so he went to bed early." 下線部 so の意味は？',
        c:["だから","しかし","もし","そして"], a:0, exp:"so は「だから」。"
      }
    ],
    国語: [],
    数学: [],
    理科: [],
    社会: []
  };

  /* =========================
   * 英語生成（安全テンプレのみ）
   * ========================= */

  // 英語：三単現・過去・比較・前置詞
  function genEnglishGrammar(n) {
    const out = [];

    const third = [
      { subj:"He", base:"play", third:"plays", tail:"soccer" },
      { subj:"She", base:"study", third:"studies", tail:"English" },
      { subj:"Ken", base:"like", third:"likes", tail:"music" },
      { subj:"My father", base:"watch", third:"watches", tail:"TV" },
    ];

    const past = [
      { subj:"I", base:"go", past:"went", tail:"to the park" },
      { subj:"We", base:"eat", past:"ate", tail:"lunch" },
      { subj:"They", base:"see", past:"saw", tail:"a movie" },
      { subj:"I", base:"buy", past:"bought", tail:"a book" },
    ];

    const preps = [
      { correct:"at", hint:"7 o'clock", exp:"時刻は at" },
      { correct:"on", hint:"Sunday", exp:"曜日は on" },
      { correct:"in", hint:"April", exp:"月は in" },
      { correct:"in", hint:"Japan", exp:"国は in" },
      { correct:"at", hint:"school", exp:"地点（学校）は at" },
    ];

    const comps = [
      { base:"tall", comp:"taller", diff:"標準" },
      { base:"fast", comp:"faster", diff:"標準" },
      { base:"easy", comp:"easier", diff:"標準" },
      { base:"interesting", comp:"more interesting", diff:"発展" },
      { base:"beautiful", comp:"more beautiful", diff:"発展" },
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 4;

      if (kind === 0) {
        const v = pick(third, i);
        const correct = v.third;
        const wrongPool = [v.base, v.base + "ed", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ["is " + v.base + "ing", "are " + v.base + "ing"]);
        out.push({
          sub:"英語", level:"中", diff:"標準", pattern:"grammar",
          q:`(　)に入る語は？ ${v.subj} (   ) ${v.tail}.`,
          c, a,
          exp:`三単現：${v.subj} は三人称単数 → ${correct}。`
        });
      }

      if (kind === 1) {
        const v = pick(past, i);
        const correct = v.past;
        const wrongPool = [v.base, v.base + "s", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ["am " + v.base + "ing", "is " + v.base + "ing"]);
        out.push({
          sub:"英語", level:"中", diff:"標準", pattern:"grammar",
          q:`(　)に入る語は？ ${v.subj} (   ) ${v.tail} yesterday.`,
          c, a,
          exp:"yesterday があるので過去形。"
        });
      }

      if (kind === 2) {
        const p = pick(preps, i);
        const correct = p.correct;
        const wrongPool = ["in","on","at","to","for","with","from"].filter(x => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, ["by","about","under"]);
        out.push({
          sub:"英語", level:"中", diff:"標準", pattern:"grammar",
          q:`(　)に入る語は？ We meet (   ) ${p.hint}.`,
          c, a,
          exp:p.exp
        });
      }

      if (kind === 3) {
        const ad = pick(comps, i);
        const correct = ad.comp;
        // ★ここが落ちやすいので「正解を誤答候補に入れない」を厳守
        const wrongPool = [
          ad.base,
          ad.base + "est",
          "the " + ad.base + "est",
          "more " + ad.base,
          "most " + ad.base
        ].filter(x => x !== correct);

        const { c, a } = force4Unique(correct, wrongPool, i, ["as " + ad.base + " as", "less " + ad.base]);
        out.push({
          sub:"英語", level:"中", diff:ad.diff, pattern:"grammar",
          q:`(　)に入る語は？ This book is (   ) than that one.`,
          c, a,
          exp:`比較級：${ad.base} → ${correct}`
        });
      }
    }
    return out;
  }

  function genEnglishReading(n) {
    const out = [];
    const items = [
      {
        sent: "I was tired, so I went to bed early.",
        ask: "so の意味は？",
        correct: "だから",
        wrongs: ["しかし","もし","そして","たとえば","そのため"],
        exp: "so は原因→結果の「だから」。"
      },
      {
        sent: "I studied hard, but I couldn't solve the problem.",
        ask: "but の意味は？",
        correct: "しかし",
        wrongs: ["だから","もし","そして","そのため","なぜなら"],
        exp: "but は逆接「しかし」。"
      },
      {
        sent: "I stayed home because it was raining.",
        ask: "because の意味は？",
        correct: "〜なので（なぜなら）",
        wrongs: ["しかし","もし","そして","だから","そのため"],
        exp: "because は理由「〜なので」。"
      },
    ];

    for (let i=0; i<n; i++) {
      const it = pick(items, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, ["それにもかかわらず","したがって"]);
      out.push({
        sub:"英語", level:"中", diff:"標準", pattern:"reading",
        q:`英文："${it.sent}"\n質問：${it.ask}`,
        c, a,
        exp:it.exp
      });
    }
    return out;
  }

  /* =========================
   * build
   * ========================= */
  function buildBank() {
    let bank = [];

    // 固定
    for (const s of SUBJECTS) {
      const pack = FIXED[s] || [];
      bank.push(...pack);
    }

    // 英語は多めに安全生成
    bank.push(...genEnglishGrammar(320));
    bank.push(...genEnglishReading(140));

    // key付与＆検品
    bank.forEach((q, i) => q.key = toKey(q, i));
    bank = bank.filter(validateQuestion);

    // ここで英語が足りないなら、さらに追い足す（検品で落ちても不足しない）
    const countSub = (sub) => bank.filter(q => q.sub === sub).length;
    while (countSub("英語") < MIN_ENGLISH) {
      const start = bank.length;
      const more = genEnglishGrammar(120).concat(genEnglishReading(60));
      more.forEach((q, i) => q.key = toKey(q, start + i));
      bank.push(...more);
      bank = bank.filter(validateQuestion);
      // 無限ループ保険：何か異常なら抜ける
      if (bank.length > 4000) break;
    }

    // 教科別数を表示（デバッグが爆速になる）
    const stats = {};
    SUBJECTS.forEach(s => stats[s] = countSub(s));
    console.log("[BANK stats]", stats, "total:", bank.length);

    return bank;
  }

  window.BANK = buildBank();
})();
