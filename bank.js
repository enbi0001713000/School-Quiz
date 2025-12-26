/* bank.js
  - 5教科が必ず混在するBANKを生成
  - 4択の品質（空/重複/メタ文言）を除外
  - 教科別最低数を満たすまで自動追い足し（不足事故を防止）
  - 追加: uid（内容ベース重複判定） / patternGroup（テンプレ群）
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  // 教科別の最低保証（抽選でフィルタされても枯れにくいよう多め）
  const MIN_PER_SUBJECT = 120;

  /* ========= ユーティリティ ========= */
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
    q.key || `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 40)}|${i}`;

  // 内容ベース重複判定用 uid
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
    // level/diff は含めない：同内容なら重複として弾く
    return `${sub}::${qt}::${choices}::a=${a}`;
  }

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;

    // “選択肢として成立しない”メタ文言
    const banned = [
      "用語の使い方が不適切",
      "時代が違う",
      "地域が違う",
      "不明",
      "わからない",
      "どれでもない",
      "上のいずれでもない",
    ];
    if (banned.includes(t)) return true;

    return false;
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

  // 正解 + 誤答候補から「必ずユニーク4択」を作る（正解は先頭固定）
  function force4Unique(correct, wrongPool, seed, extraPool = []) {
    const c = String(correct).trim();
    const pool = uniq(wrongPool.map(String)).filter((x) => x.trim() && x.trim() !== c);
    const extra = uniq(extraPool.map(String)).filter((x) => x.trim() && x.trim() !== c);

    const wrongs = [];
    for (let k = 0; k < pool.length && wrongs.length < 3; k++) {
      const w = pool[(seed + k) % pool.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }
    for (let k = 0; k < extra.length && wrongs.length < 3; k++) {
      const w = extra[(seed + k) % extra.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }

    // 最後の保険（穴埋め用の無難な語）
    const safeFill = ["do", "does", "did", "am", "is", "are", "was", "were", "will", "can"];
    for (let k = 0; k < safeFill.length && wrongs.length < 3; k++) {
      const w = safeFill[(seed + k) % safeFill.length];
      if (w !== c && !wrongs.includes(w)) wrongs.push(w);
    }

    const arr = uniq([c, ...wrongs]).slice(0, 4);
    const idx = arr.indexOf(c);
    if (idx > 0) [arr[0], arr[idx]] = [arr[idx], arr[0]];
    return { c: arr, a: 0 };
  }

  /* ========= 固定問題（最小サンプル：ここは増やしやすい） ========= */
  const FIXED = {
    国語: [
      {
        sub: "国語",
        level: "中",
        diff: "標準",
        pattern: "vocab",
        patternGroup: "ja_vocab",
        q: "「一目瞭然」の意味として最も近いものは？",
        c: ["見ただけではっきり分かる", "一度見ても覚えられない", "目で見るのが難しい", "見ない方がよい"],
        a: 0,
        exp: "一目で明らか、という意味。",
      },
    ],
    数学: [
      {
        sub: "数学",
        level: "中",
        diff: "標準",
        pattern: "function",
        patternGroup: "math_linear",
        q: "一次関数 y = 2x + 1 の y切片は？",
        c: ["1", "2", "-1", "0"],
        a: 0,
        exp: "x=0のとき y=1。",
      },
    ],
    英語: [
      {
        sub: "英語",
        level: "中",
        diff: "標準",
        pattern: "grammar",
        patternGroup: "eng_present",
        q: "(　)に入る最も適切な語は？ I (   ) to school every day.",
        c: ["go", "goes", "went", "going"],
        a: 0,
        exp: "I は三単現ではないので go。",
      },
    ],
    理科: [
      {
        sub: "理科",
        level: "中",
        diff: "標準",
        pattern: "calc",
        patternGroup: "sci_density",
        q: "密度2.0g/cm³の物体の体積が30cm³のとき、質量は？",
        c: ["60g", "15g", "32g", "90g"],
        a: 0,
        exp: "質量=密度×体積=2.0×30=60g。",
      },
    ],
    社会: [
      {
        sub: "社会",
        level: "中",
        diff: "標準",
        pattern: "civics",
        patternGroup: "soc_civics",
        q: "国会が法律を定める働きを何という？",
        c: ["立法", "行政", "司法", "自治"],
        a: 0,
        exp: "法律をつくる＝立法。",
      },
    ],
  };

  /* ========= 生成：英語（安全テンプレのみ） ========= */
  function genEnglishGrammar(n) {
    const out = [];
    const third = [
      { subj: "He", base: "play", third: "plays", tail: "soccer" },
      { subj: "She", base: "study", third: "studies", tail: "English" },
      { subj: "Ken", base: "like", third: "likes", tail: "music" },
      { subj: "My father", base: "watch", third: "watches", tail: "TV" },
    ];
    const past = [
      { subj: "I", base: "go", past: "went", tail: "to the park" },
      { subj: "We", base: "eat", past: "ate", tail: "lunch" },
      { subj: "They", base: "see", past: "saw", tail: "a movie" },
      { subj: "I", base: "buy", past: "bought", tail: "a book" },
    ];
    const preps = [
      { correct: "at", hint: "7 o'clock", exp: "時刻は at" },
      { correct: "on", hint: "Sunday", exp: "曜日は on" },
      { correct: "in", hint: "April", exp: "月は in" },
      { correct: "in", hint: "Japan", exp: "国は in" },
      { correct: "at", hint: "school", exp: "地点（学校）は at" },
    ];
    const comps = [
      { base: "tall", comp: "taller", diff: "標準" },
      { base: "fast", comp: "faster", diff: "標準" },
      { base: "easy", comp: "easier", diff: "標準" },
      { base: "interesting", comp: "more interesting", diff: "発展" },
      { base: "beautiful", comp: "more beautiful", diff: "発展" },
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 4;

      if (kind === 0) {
        const v = pick(third, i);
        const correct = v.third;
        const wrongPool = [v.base, v.base + "ed", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ["is " + v.base + "ing"]);
        out.push({
          sub: "英語",
          level: "中",
          diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_third_person",
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail}.`,
          c,
          a,
          exp: `三単現：${v.subj} は三人称単数 → ${correct}。`,
        });
      }

      if (kind === 1) {
        const v = pick(past, i);
        const correct = v.past;
        const wrongPool = [v.base, v.base + "s", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, ["am " + v.base + "ing"]);
        out.push({
          sub: "英語",
          level: "中",
          diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_past",
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail} yesterday.`,
          c,
          a,
          exp: "yesterday があるので過去形。",
        });
      }

      if (kind === 2) {
        const p = pick(preps, i);
        const correct = p.correct;
        const wrongPool = ["in", "on", "at", "to", "for", "with", "from"].filter((x) => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, ["by", "about"]);
        out.push({
          sub: "英語",
          level: "中",
          diff: "標準",
          pattern: "grammar",
          patternGroup: "eng_preposition",
          q: `(　)に入る語は？ We meet (   ) ${p.hint}.`,
          c,
          a,
          exp: p.exp,
        });
      }

      if (kind === 3) {
        const ad = pick(comps, i);
        const correct = ad.comp;
        const wrongPool = [
          ad.base,
          ad.base + "est",
          "the " + ad.base + "est",
          "more " + ad.base,
          "most " + ad.base,
        ].filter((x) => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, ["as " + ad.base + " as", "less " + ad.base]);
        out.push({
          sub: "英語",
          level: "中",
          diff: ad.diff,
          pattern: "grammar",
          patternGroup: "eng_comparative",
          q: `(　)に入る語は？ This book is (   ) than that one.`,
          c,
          a,
          exp: `比較級：${ad.base} → ${correct}`,
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
        wrongs: ["しかし", "もし", "そして", "たとえば", "そのため"],
        exp: "so は原因→結果の「だから」。",
      },
      {
        sent: "I studied hard, but I couldn't solve the problem.",
        ask: "but の意味は？",
        correct: "しかし",
        wrongs: ["だから", "もし", "そして", "そのため", "なぜなら"],
        exp: "but は逆接「しかし」。",
      },
      {
        sent: "I stayed home because it was raining.",
        ask: "because の意味は？",
        correct: "〜なので（なぜなら）",
        wrongs: ["しかし", "もし", "そして", "だから", "そのため"],
        exp: "because は理由「〜なので」。",
      },
    ];

    for (let i = 0; i < n; i++) {
      const it = pick(items, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, ["それにもかかわらず", "したがって"]);
      out.push({
        sub: "英語",
        level: "中",
        diff: "標準",
        pattern: "reading",
        patternGroup: "eng_reading_connector",
        q: `英文："${it.sent}"\n質問：${it.ask}`,
        c,
        a,
        exp: it.exp,
      });
    }
    return out;
  }

  /* ========= 生成：国語（語彙中心：安全領域） ========= */
  function genJapaneseVocab(n) {
    const out = [];
    const items = [
      ["適切", "状況や目的に合っている", ["無関係", "偶然", "不可能", "反対の意味"]],
      ["抽象", "形がなく概念的なこと", ["具体", "部分", "偶然", "単純"]],
      ["根拠", "理由やよりどころ", ["結論", "感想", "例外", "余談"]],
      ["簡潔", "むだがなく短いこと", ["複雑", "曖昧", "冗長", "強引"]],
      ["顕著", "目立ってはっきりしている", ["平凡", "微妙", "不明瞭", "短時間"]],
      ["慎重", "注意深く行うこと", ["軽率", "大胆", "乱暴", "無関心"]],
      ["要旨", "文章の中心となる内容", ["感想", "余談", "結末", "例外"]],
      ["主張", "自分の意見として強く述べること", ["例示", "対比", "説明", "装飾"]],
    ];

    for (let i = 0; i < n; i++) {
      const it = pick(items, i);
      const word = it[0], correct = it[1], wrongs = it[2];
      const { c, a } = force4Unique(correct, wrongs, i, ["反対の意味", "細かい部分"]);
      out.push({
        sub: "国語",
        level: "中",
        diff: "標準",
        pattern: "vocab",
        patternGroup: "ja_vocab",
        q: `「${word}」の意味として最も近いものは？`,
        c,
        a,
        exp: `「${word}」＝「${correct}」。`,
      });
    }
    return out;
  }

  /* ========= 生成：数学（一次関数の代入：安全計算） ========= */
  function genMathLinear(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const aCoef = pick([-4, -3, -2, -1, 1, 2, 3, 4], i);
      const bConst = pick([-6, -3, -1, 0, 2, 5, 7], i + 3);
      const x = pick([-3, -2, -1, 0, 1, 2, 3], i + 5);
      const y = aCoef * x + bConst;

      const correct = String(y);
      const wrongPool = [String(y + 1), String(y - 1), String(aCoef * (x + 1) + bConst), String(aCoef * x - bConst)];
      const { c, a } = force4Unique(correct, wrongPool, i, [String(aCoef + x + bConst)]);

      out.push({
        sub: "数学",
        level: "中",
        diff: (i % 6 === 0 ? "発展" : "標準"),
        pattern: "function",
        patternGroup: "math_linear",
        q: `一次関数 y = ${aCoef}x ${bConst >= 0 ? "+ " + bConst : "- " + Math.abs(bConst)} において、x=${x} のとき y は？`,
        c,
        a,
        exp: `代入：y=${aCoef}×${x}${bConst >= 0 ? "+" + bConst : "-" + Math.abs(bConst)}=${y}。`,
      });
    }
    return out;
  }

  /* ========= 生成：理科（密度・オーム：安全計算） ========= */
  function genScienceCalc(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) {
        const d = pick([0.8, 1.2, 2.0, 2.7, 7.9], i);
        const v = pick([10, 15, 20, 25, 30, 40], i + 1);
        const m = d * v;
        const correct = `${m}g`;
        const wrongPool = [`${v}g`, `${(d + 1) * v}g`, `${m + 10}g`, `${m - 10}g`];
        const { c, a } = force4Unique(correct, wrongPool, i, [`${m + d}g`]);
        out.push({
          sub: "理科",
          level: "中",
          diff: "標準",
          pattern: "calc",
          patternGroup: "sci_density",
          q: `密度${d}g/cm³の物体の体積が${v}cm³のとき、質量は？`,
          c,
          a,
          exp: `質量=密度×体積=${d}×${v}=${m}g。`,
        });
      } else {
        const R = pick([2, 4, 5, 8, 10], i);
        const I = pick([0.2, 0.5, 1, 1.5, 2], i + 2);
        const V = R * I;
        const correct = `${V}V`;
        const wrongPool = [`${R}V`, `${I}V`, `${V + 2}V`, `${Math.max(0, V - 1)}V`];
        const { c, a } = force4Unique(correct, wrongPool, i, [`${R + I}V`]);
        out.push({
          sub: "理科",
          level: "中",
          diff: "発展",
          pattern: "physics",
          patternGroup: "sci_ohm",
          q: `抵抗${R}Ω、電流${I}Aのとき、電圧は？（V=IR）`,
          c,
          a,
          exp: `V=IR=${R}×${I}=${V}V。`,
        });
      }
    }
    return out;
  }

  /* ========= 生成：社会（時差・公民定義：安全領域） ========= */
  function genSocialTime(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const step = pick([15, 30, 45, 60], i);
      const hours = step / 15;
      const dir = i % 2 === 0 ? "東" : "西";
      const correct = dir === "東" ? `${hours}時間進む` : `${hours}時間遅れる`;
      const wrongPool = [
        dir === "東" ? `${hours}時間遅れる` : `${hours}時間進む`,
        "30分進む",
        "30分遅れる",
        "2時間進む",
        "2時間遅れる",
      ];
      const { c, a } = force4Unique(correct, wrongPool, i);
      out.push({
        sub: "社会",
        level: "中",
        diff: "標準",
        pattern: "geo",
        patternGroup: "soc_time",
        q: `経度が${step}°${dir}へ移動すると、時刻は一般に？`,
        c,
        a,
        exp: `15°で1時間。${dir}へ行くと時刻は${dir === "東" ? "進む" : "遅れる"}。`,
      });
    }
    return out;
  }

  function genSocialCivics(n) {
    const out = [];
    const items = [
      { q: "裁判所が法令が憲法に反しないか判断する権限は？", correct: "違憲審査権", wrongs: ["国政調査権", "予算先議権", "地方自治"] },
      { q: "国会が法律をつくるはたらきは？", correct: "立法", wrongs: ["行政", "司法", "自治"] },
      { q: "内閣が政治を行い法律を実行するはたらきは？", correct: "行政", wrongs: ["立法", "司法", "自治"] },
      { q: "裁判所が争いを裁くはたらきは？", correct: "司法", wrongs: ["立法", "行政", "自治"] },
      { q: "地方公共団体が地域のことを自主的に行うしくみは？", correct: "地方自治", wrongs: ["三権分立", "国民主権", "議院内閣制"] },
    ];

    for (let i = 0; i < n; i++) {
      const it = pick(items, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i);
      out.push({
        sub: "社会",
        level: "中",
        diff: "標準",
        pattern: "civics",
        patternGroup: "soc_civics",
        q: it.q,
        c,
        a,
        exp: "基本用語の定義問題。",
      });
    }
    return out;
  }

  /* ========= BANK 組み立て ========= */
  function buildBank() {
    let bank = [];

    // 固定
    for (const s of SUBJECTS) {
      bank.push(...(FIXED[s] || []));
    }

    // 生成（ここで必ず5教科を混ぜる）
    bank.push(...genEnglishGrammar(220));
    bank.push(...genEnglishReading(120));
    bank.push(...genJapaneseVocab(220));
    bank.push(...genMathLinear(240));
    bank.push(...genScienceCalc(240));
    bank.push(...genSocialTime(160));
    bank.push(...genSocialCivics(160));

    // key/uid/patternGroup 付与 & 検品
    bank.forEach((q, i) => {
      q.key = toKey(q, i);
      if (!q.patternGroup) q.patternGroup = q.pattern || "p";
      if (!q.uid) q.uid = makeUid(q);
    });
    bank = bank.filter(validateQuestion);

    // 教科別に不足していれば追い足し（不足事故を潰す）
    const countSub = (sub) => bank.filter((q) => q.sub === sub).length;

    const topUp = (sub) => {
      const need = Math.max(0, MIN_PER_SUBJECT - countSub(sub));
      if (need <= 0) return;

      let more = [];
      if (sub === "英語") more = genEnglishGrammar(need + 80).concat(genEnglishReading(need + 40));
      if (sub === "国語") more = genJapaneseVocab(need + 120);
      if (sub === "数学") more = genMathLinear(need + 120);
      if (sub === "理科") more = genScienceCalc(need + 120);
      if (sub === "社会") more = genSocialTime(need + 80).concat(genSocialCivics(need + 80));

      const start = bank.length;
      more.forEach((q, i) => {
        q.key = toKey(q, start + i);
        if (!q.patternGroup) q.patternGroup = q.pattern || "p";
        if (!q.uid) q.uid = makeUid(q);
      });
      bank.push(...more);
      bank = bank.filter(validateQuestion);
    };

    SUBJECTS.forEach(topUp);

    // ここで “英語だけ” など異常なら即分かるよう統計出力
    const stats = {};
    SUBJECTS.forEach((s) => (stats[s] = countSub(s)));
    console.log("[BANK stats]", stats, "total:", bank.length);

    // 安全装置：教科が1つしかないなら明確にエラーを出す（調査を楽にする）
    const uniqSubs = [...new Set(bank.map((x) => x.sub))];
    if (uniqSubs.length < 3) {
      console.warn("[BANK] subjects seem abnormal:", uniqSubs);
    }

    return bank;
  }

  window.BANK = buildBank();
})();
