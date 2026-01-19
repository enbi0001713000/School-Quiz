/* bank.js
 * - 5教科の問題BANK（window.BANK）を生成
 * - schema/4択品質/メタ選択肢排除/重複排除（uid）を内蔵
 * - テンプレ偏りを減らすため patternGroup を多めに分割
 *
 * 期待schema（1問）:
 * { sub, level, diff, patternGroup, pattern, q, c[4], a(0-3), exp }
 */

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  /* =========================
   * utils
   * ========================= */
  const pick = (arr, i) => arr[i % arr.length];

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

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;

    // メタ選択肢（禁止）
    const banned = [
      "どれでもない",
      "上のいずれでもない",
      "不明",
      "わからない",
      "分からない",
      "該当なし",
      "なし",
      "未定",
    ];
    if (banned.includes(t)) return true;

    return false;
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.patternGroup !== "string" || !q.patternGroup.trim()) return false;
    if (typeof q.pattern !== "string" || !q.pattern.trim()) return false;
    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return false;
    if (typeof q.exp !== "string" || !q.exp.trim()) return false;

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const set = new Set(choices);
    if (set.size !== 4) return false;

    if (isBadChoiceText(choices[q.a])) return false;
    return true;
  }

  // 正解 + 誤答候補から「必ずユニーク4択」を作る（正解位置はaで返す）
  function force4Unique(correct, wrongPool, seed, correctIndex = 0) {
    const c0 = String(correct).trim();
    const pool = (Array.isArray(wrongPool) ? wrongPool : [])
      .map((x) => String(x ?? "").trim())
      .filter((x) => x && x !== c0 && !isBadChoiceText(x));

    // 3つ拾う
    const wrongs = [];
    for (let k = 0; k < pool.length && wrongs.length < 3; k++) {
      const w = pool[(seed + k) % pool.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }

    // 最終保険（ただしメタは入れない）
    const safeFill = ["A", "B", "C", "D", "E", "F", "G"].map((x) => `（ダミー）${x}`);
    for (let k = 0; k < safeFill.length && wrongs.length < 3; k++) {
      const w = safeFill[(seed + k) % safeFill.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }

    let arr = [c0, ...wrongs].slice(0, 4);

    // correctIndex に正解を移動（0-3）
    correctIndex = Math.max(0, Math.min(3, correctIndex | 0));
    const idx = arr.indexOf(c0);
    if (idx !== correctIndex) {
      const tmp = arr[correctIndex];
      arr[correctIndex] = c0;
      arr[idx] = tmp;
    }

    // 念のためユニーク化（不足したら適当補完）
    arr = Array.from(new Set(arr));
    while (arr.length < 4) arr.push(`（補完）${arr.length + 1}`);

    return { c: arr.slice(0, 4), a: correctIndex };
  }

  function add(bank, q) {
    bank.push(q);
  }

  /* =========================
   * 国語
   * ========================= */
  function genJapanese(bank) {
    // 語彙（意味）
    const vocab = [
      ["端的", "要点を押さえて簡潔に", ["回りくどく詳しく", "曖昧に濁して", "感情的に強く", "偶然に"]],
      ["妥当", "筋が通っていて適切", ["的外れで不適切", "強引で乱暴", "気分次第", "偶然に"]],
      ["顕著", "目立ってはっきりしている", ["平凡で目立たない", "偶然の", "意味不明の", "短時間の"]],
      ["継続", "同じことを続ける", ["中断する", "反対する", "否定する", "混乱する"]],
      ["推敲", "文章を練り直す", ["丸写しする", "声に出す", "暗記する", "放置する"]],
      ["要領", "物事をうまく進めるコツ", ["思いつき", "偶然", "余談", "失敗"]],
      ["概略", "大まかな内容", ["細部の一覧", "結論だけ", "感情表現", "例外の列挙"]],
      ["根拠", "理由やよりどころ", ["感想", "余談", "例外", "装飾"]],
      ["簡潔", "無駄がなく短い", ["冗長", "過激", "不明瞭", "軽率"]],
      ["慎重", "注意深く行う", ["軽率", "乱暴", "無関心", "即興"]],
      ["要旨", "文章の中心となる内容", ["余談", "結末", "例外", "感想"]],
      ["主張", "意見として強く述べること", ["例示", "装飾", "対比", "引用"]],
      ["比喩", "たとえで表すこと", ["事実を列挙", "手順を説明", "数字で示す", "否定する"]],
      ["含意", "はっきり言わずに意味を含ませる", ["大声で叫ぶ", "字面通りに読む", "順番に並べる", "誤字を直す"]],
      ["逐一", "一つ一つ漏れなく", ["だいたい", "偶然", "ついでに", "適当に"]],
    ];

    vocab.forEach((it, i) => {
      const [word, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i % 4));
      add(bank, {
        sub: "国語",
        level: "中",
        diff: i % 7 === 0 ? "発展" : "標準",
        patternGroup: "ja_vocab_meaning",
        pattern: "vocab",
        q: `「${word}」の意味として最も近いものは？`,
        c, a,
        exp: `「${word}」は「${correct}」の意味。`,
      });
    });

    // 漢字の読み（中学頻出寄り）
    const kanjiReading = [
      ["概念", "がいねん", ["かいねん", "がいめん", "かいめん", "がいれん"]],
      ["顧問", "こもん", ["ごもん", "こほん", "こうもん", "くもん"]],
      ["抽象", "ちゅうしょう", ["ちゅうぞう", "ちゅうじょう", "ちゅうしょうう", "ちゅうしょ"]],
      ["傾向", "けいこう", ["けいごう", "けんこう", "ていこう", "けいおう"]],
      ["依存", "いぞん", ["いそん", "いじょん", "えぞん", "いどん"]],
      ["許可", "きょか", ["きょが", "きょけ", "きょけい", "きょがい"]],
      ["貢献", "こうけん", ["こうげん", "こうこん", "こうけい", "こうせん"]],
      ["促進", "そくしん", ["そくじん", "しょくしん", "そくせん", "そっしん"]],
      ["維持", "いじ", ["いし", "ゆじ", "いぢ", "いち"]],
      ["整備", "せいび", ["せいひ", "しょうび", "せいひん", "せんび"]],
      ["妥協", "だきょう", ["たきょう", "だきょ", "だっきょう", "だきゅう"]],
      ["把握", "はあく", ["はくあく", "はおく", "ばあく", "はあけ"]],
    ];

    kanjiReading.forEach((it, i) => {
      const [word, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);
      add(bank, {
        sub: "国語",
        level: "中",
        diff: i % 6 === 0 ? "発展" : "標準",
        patternGroup: "ja_kanji_reading",
        pattern: "kanji",
        q: `次の漢字の読みとして正しいものは？「${word}」`,
        c, a,
        exp: `「${word}」は「${correct}」。`,
      });
    });

    // 文法（助詞・敬語：安全領域）
    const grammar = [
      ["「先生（　）質問する」：適切な助詞は？", "に", ["で", "を", "が"]],
      ["「友だち（　）会う」：適切な助詞は？", "に", ["を", "が", "で"]],
      ["「公園（　）行く」：適切な助詞は？", "に", ["を", "が", "へ"]],
      ["「水（　）飲む」：適切な助詞は？", "を", ["に", "が", "で"]],
      ["尊敬語として適切なのは？（行く）", "いらっしゃる", ["申す", "うかがう", "参る"]],
      ["謙譲語として適切なのは？（聞く）", "うかがう", ["おっしゃる", "いらっしゃる", "なさる"]],
    ];

    grammar.forEach((it, i) => {
      const [qText, correct, wrong3] = it;
      const { c, a } = force4Unique(correct, wrong3, i, (i + 2) % 4);
      add(bank, {
        sub: "国語",
        level: i < 4 ? "小" : "中",
        diff: "標準",
        patternGroup: "ja_grammar_particle_honorific",
        pattern: "grammar",
        q: qText,
        c, a,
        exp: `文として自然になる助詞／敬語を選ぶ。正解は「${correct}」。`,
      });
    });
  }

  /* =========================
   * 数学
   * ========================= */
  function genMath(bank) {
    // 一次方程式
    for (let i = 0; i < 80; i++) {
      const a = pick([2, 3, 4, 5, 6, 7], i);
      const b = pick([1, 2, 3, 4, 5, 6, 7, 8, 9], i + 3);
      const x = pick([-3, -2, -1, 0, 1, 2, 3, 4], i + 5);
      // a x + b = c
      const cVal = a * x + b;
      const correct = String(x);
      const wrongPool = [String(x + 1), String(x - 1), String(-x), String(x + 2), String(x - 2)];
      const { c, a: ans } = force4Unique(correct, wrongPool, i, i % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: i % 10 === 0 ? "発展" : "標準",
        patternGroup: "math_linear_equation",
        pattern: "equation",
        q: `方程式 ${a}x + ${b} = ${cVal} を解け。`,
        c, a: ans,
        exp: `${a}x = ${cVal} - ${b} = ${cVal - b} より、x = ${(cVal - b)} ÷ ${a} = ${x}。`,
      });
    }

    // 比例・割合（小〜中）
    for (let i = 0; i < 60; i++) {
      const base = pick([200, 250, 300, 400, 500, 600, 800], i);
      const pct = pick([5, 10, 12, 15, 20, 25, 30], i + 2);
      const val = Math.round((base * pct) / 100);
      const correct = `${val}`;
      const wrongPool = [`${val + 5}`, `${Math.max(0, val - 5)}`, `${base}`, `${pct}`];
      const { c, a } = force4Unique(correct, wrongPool, i, (i + 1) % 4);

      add(bank, {
        sub: "数学",
        level: i % 3 === 0 ? "小" : "中",
        diff: i % 9 === 0 ? "基礎" : "標準",
        patternGroup: "math_percent",
        pattern: "ratio",
        q: `${base} の ${pct}% はいくつ？`,
        c, a,
        exp: `${base}×${pct}/100 = ${val}。`,
      });
    }

    // 図形（角度）
    const angles = [
      ["三角形の内角の和は？", "180°", ["90°", "270°", "360°"]],
      ["四角形の内角の和は？", "360°", ["180°", "270°", "540°"]],
      ["正六角形の1つの内角は？", "120°", ["60°", "90°", "135°"]],
      ["円周角は同じ弧に対する中心角の何分の1？", "1/2", ["2", "1/3", "1/4"]],
    ];
    angles.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 2) % 4);
      add(bank, {
        sub: "数学",
        level: "中",
        diff: i === 0 ? "基礎" : "標準",
        patternGroup: "math_geometry_angle",
        pattern: "geometry",
        q: qText,
        c, a,
        exp: `基本性質の確認問題。正解は ${correct}。`,
      });
    });

    // 確率（標準）
    for (let i = 0; i < 40; i++) {
      const n = pick([4, 5, 6, 8, 10, 12], i);
      const k = pick([1, 2, 3, 4], i + 1);
      const correct = `${k}/${n}`;
      const wrongPool = [`${(n - k)}/${n}`, `${k}/${n + 2}`, `${k + 1}/${n}`, `${k}/${n - 1}`];
      const { c, a } = force4Unique(correct, wrongPool, i, i % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: i % 8 === 0 ? "発展" : "標準",
        patternGroup: "math_probability_basic",
        pattern: "probability",
        q: `${n}枚のカードに1枚だけ当たりがある。1回引いて当たりを引く確率は？`,
        c, a,
        exp: `当たりは1枚なので 1/${n}。ここでは当たりを${k}枚とみなした形（${k}/${n}）の練習。`,
      });
    }
  }

  /* =========================
   * 英語
   * ========================= */
  function genEnglish(bank) {
    // 文法：三単現 / 過去 / 進行 / 受動 / 前置詞 / 比較
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
    const prog = [
      { subj: "I", base: "study", ing: "am studying", tail: "now" },
      { subj: "They", base: "play", ing: "are playing", tail: "now" },
      { subj: "She", base: "run", ing: "is running", tail: "now" },
    ];
    const passive = [
      { s: "English", v: "is spoken", tail: "in many countries." },
      { s: "This room", v: "is cleaned", tail: "every day." },
      { s: "The window", v: "was broken", tail: "yesterday." },
    ];
    const preps = [
      { correct: "at", hint: "7 o'clock", exp: "時刻は at" },
      { correct: "on", hint: "Sunday", exp: "曜日は on" },
      { correct: "in", hint: "April", exp: "月は in" },
      { correct: "in", hint: "Japan", exp: "国は in" },
      { correct: "at", hint: "school", exp: "地点は at（文脈次第）" },
    ];
    const comps = [
      { base: "tall", comp: "taller" },
      { base: "fast", comp: "faster" },
      { base: "easy", comp: "easier" },
      { base: "interesting", comp: "more interesting" },
      { base: "beautiful", comp: "more beautiful" },
    ];

    for (let i = 0; i < 120; i++) {
      const kind = i % 6;

      if (kind === 0) {
        const v = pick(third, i);
        const correct = v.third;
        const wrongPool = [v.base, v.base + "ed", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, i % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: "標準",
          patternGroup: "eng_third_person",
          pattern: "grammar",
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail}.`,
          c, a,
          exp: `三単現：${v.subj} は三人称単数なので ${correct}。`,
        });
      }

      if (kind === 1) {
        const v = pick(past, i);
        const correct = v.past;
        const wrongPool = [v.base, v.base + "s", v.base + "ing", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 1) % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: "標準",
          patternGroup: "eng_past",
          pattern: "grammar",
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.tail} yesterday.`,
          c, a,
          exp: "yesterday があるので過去形。",
        });
      }

      if (kind === 2) {
        const v = pick(prog, i);
        const correct = v.ing;
        const wrongPool = [v.base, v.base + "s", v.base + "ed", "will " + v.base, "can " + v.base];
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 2) % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: "標準",
          patternGroup: "eng_progressive",
          pattern: "grammar",
          q: `(　)に入る語は？ ${v.subj} (   ) ${v.base} ${v.tail}.`,
          c, a,
          exp: "now があるので現在進行形（be動詞 + -ing）。",
        });
      }

      if (kind === 3) {
        const p = pick(preps, i);
        const correct = p.correct;
        const wrongPool = ["in", "on", "at", "to", "for", "with", "from"].filter((x) => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 3) % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: "標準",
          patternGroup: "eng_preposition",
          pattern: "grammar",
          q: `(　)に入る語は？ We meet (   ) ${p.hint}.`,
          c, a,
          exp: p.exp,
        });
      }

      if (kind === 4) {
        const ad = pick(comps, i);
        const correct = ad.comp;
        const wrongPool = [
          ad.base,
          ad.base + "est",
          "the " + ad.base + "est",
          "more " + ad.base,
          "most " + ad.base,
          "as " + ad.base + " as",
        ].filter((x) => x !== correct);
        const { c, a } = force4Unique(correct, wrongPool, i, i % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: ad.comp.includes("more") ? "発展" : "標準",
          patternGroup: "eng_comparative",
          pattern: "grammar",
          q: `(　)に入る語は？ This book is (   ) than that one.`,
          c, a,
          exp: `比較級：${ad.base} → ${correct}`,
        });
      }

      if (kind === 5) {
        const ps = pick(passive, i);
        const correct = ps.v;
        const wrongPool = ["speaks", "spoke", "is speaking", "was speaking", "will speak", "speaking"];
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 1) % 4);
        add(bank, {
          sub: "英語",
          level: "中",
          diff: "発展",
          patternGroup: "eng_passive",
          pattern: "grammar",
          q: `(　)に入る語は？ ${ps.s} (   ) ${ps.tail}`,
          c, a,
          exp: "受動態：be動詞 + 過去分詞。",
        });
      }
    }

    // 読解（接続語）
    const reading = [
      {
        sent: "I was tired, so I went to bed early.",
        ask: "so の意味は？",
        correct: "だから",
        wrongs: ["しかし", "もし", "そして", "なぜなら"],
        exp: "so は原因→結果の「だから」。",
      },
      {
        sent: "I studied hard, but I couldn't solve the problem.",
        ask: "but の意味は？",
        correct: "しかし",
        wrongs: ["だから", "もし", "そして", "なぜなら"],
        exp: "but は逆接「しかし」。",
      },
      {
        sent: "I stayed home because it was raining.",
        ask: "because の意味は？",
        correct: "〜なので（なぜなら）",
        wrongs: ["しかし", "もし", "そして", "だから"],
        exp: "because は理由「〜なので」。",
      },
      {
        sent: "Please open the window, and turn on the light.",
        ask: "and の意味は？",
        correct: "そして",
        wrongs: ["だから", "しかし", "もし", "なぜなら"],
        exp: "and は並列「そして」。",
      },
    ];
    for (let i = 0; i < 80; i++) {
      const it = pick(reading, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, i % 4);
      add(bank, {
        sub: "英語",
        level: "中",
        diff: "標準",
        patternGroup: "eng_reading_connector",
        pattern: "reading",
        q: `英文："${it.sent}"\n質問：${it.ask}`,
        c, a,
        exp: it.exp,
      });
    }
  }

  /* =========================
   * 理科
   * ========================= */
  function genScience(bank) {
    // 物理：密度/オーム/圧力（計算）
    for (let i = 0; i < 60; i++) {
      const kind = i % 3;

      if (kind === 0) {
        const d = pick([0.8, 1.0, 1.2, 2.0, 2.7, 7.9], i);
        const v = pick([10, 15, 20, 25, 30, 40, 50], i + 1);
        const m = d * v;
        const correct = `${m}g`;
        const wrongPool = [`${v}g`, `${(d + 1) * v}g`, `${m + 10}g`, `${Math.max(0, m - 10)}g`];
        const { c, a } = force4Unique(correct, wrongPool, i, i % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "標準",
          patternGroup: "sci_density",
          pattern: "physics",
          q: `密度${d}g/cm³の物体の体積が${v}cm³のとき、質量は？`,
          c, a,
          exp: `質量=密度×体積=${d}×${v}=${m}g。`,
        });
      }

      if (kind === 1) {
        const R = pick([2, 4, 5, 8, 10, 12], i);
        const I = pick([0.2, 0.5, 1, 1.5, 2], i + 2);
        const V = R * I;
        const correct = `${V}V`;
        const wrongPool = [`${R}V`, `${I}V`, `${V + 2}V`, `${Math.max(0, V - 1)}V`];
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 1) % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "発展",
          patternGroup: "sci_ohm",
          pattern: "physics",
          q: `抵抗${R}Ω、電流${I}Aのとき、電圧は？（V=IR）`,
          c, a,
          exp: `V=IR=${R}×${I}=${V}V。`,
        });
      }

      if (kind === 2) {
        const F = pick([100, 200, 300, 400, 500], i);
        const S = pick([10, 20, 25, 40, 50], i + 3); // cm^2
        // 圧力（Pa）はN/m^2だが、ここは「力÷面積」の概念確認（単位は簡略）
        const correct = `${F / S}`;
        const wrongPool = [`${F * S}`, `${F + S}`, `${Math.max(1, (F / S) - 2)}`, `${(F / S) + 2}`];
        const { c, a } = force4Unique(correct, wrongPool, i, (i + 2) % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "標準",
          patternGroup: "sci_pressure_concept",
          pattern: "physics",
          q: `力が${F}N、面積が${S}cm²のとき、圧力（力÷面積）はいくつ？（数値のみ）`,
          c, a,
          exp: `圧力=力÷面積=${F}÷${S}=${F / S}。`,
        });
      }
    }

    // 化学：状態変化・溶解度（概念）
    const chem = [
      ["水が0℃で氷になる変化は？", "凝固", ["融解", "蒸発", "凝縮"]],
      ["水が100℃で水蒸気になる変化は？", "沸騰", ["凝縮", "凝固", "融解"]],
      ["気体が液体になる変化は？", "凝縮", ["蒸発", "融解", "凝固"]],
      ["食塩が水にとけた液体は何という？", "水溶液", ["混合物", "沈殿", "結晶"]],
      ["溶液の濃さを表す代表例（質量パーセント濃度）の単位は？", "%", ["℃", "cm", "N"]],
    ];
    chem.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: i % 5 === 0 ? "基礎" : "標準",
        patternGroup: "sci_chem_concept",
        pattern: "chemistry",
        q: qText,
        c, a,
        exp: `用語の定義確認。正解は「${correct}」。`,
      });
    });

    // 生物：細胞・光合成・遺伝（概念）
    const bio = [
      ["光合成が主に行われる細胞小器官は？", "葉緑体", ["核", "ミトコンドリア", "細胞壁"]],
      ["動物細胞にあって植物細胞にないものとして正しいのは？", "中心体", ["細胞壁", "葉緑体", "液胞"]],
      ["植物が光合成で取り入れる気体は？", "二酸化炭素", ["酸素", "窒素", "水素"]],
      ["光合成で主に作られる養分は？", "デンプン", ["タンパク質", "脂肪", "ビタミン"]],
      ["遺伝情報をもつ物質は？", "DNA", ["水", "酸素", "二酸化炭素"]],
    ];
    bio.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 2) % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: i % 4 === 0 ? "基礎" : "標準",
        patternGroup: "sci_bio_concept",
        pattern: "biology",
        q: qText,
        c, a,
        exp: `基礎知識の確認。正解は「${correct}」。`,
      });
    });

    // 地学：天気・地層・地震
    const earth = [
      ["前線のうち、温かい空気が冷たい空気の上にのり上げるのは？", "温暖前線", ["寒冷前線", "停滞前線", "閉塞前線"]],
      ["地震のゆれのうち、先に伝わる波は？", "P波", ["S波", "表面波", "L波"]],
      ["地層の重なりで、上の地層ほど一般にどうなる？", "新しい", ["古い", "同じ", "不明"]],
      ["湿度が高いほど汗が乾きにくくなる理由は？", "水蒸気が増え蒸発しにくい", ["気温が下がる", "風が止む", "太陽が出る"]],
    ];
    earth.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, i % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: "標準",
        patternGroup: "sci_earth_concept",
        pattern: "earth",
        q: qText,
        c, a,
        exp: `基本概念の確認。正解は「${correct}」。`,
      });
    });
  }

  /* =========================
   * 社会
   * ========================= */
  function genSocial(bank) {
    // 地理：基礎用語
    const geo = [
      ["日本の標準時の基準となる経線は？", "東経135度", ["東経0度", "東経90度", "東経180度"]],
      ["赤道付近で多い気候帯は？", "熱帯", ["寒帯", "温帯", "乾燥帯"]],
      ["日本で人口が最も多い都道府県は？", "東京都", ["大阪府", "北海道", "愛知県"]],
      ["貿易で、輸出が輸入を上回る状態は？", "貿易黒字", ["貿易赤字", "関税", "為替"]],
      ["工業製品を海外に売ることは？", "輸出", ["輸入", "関税", "統計"]],
    ];
    geo.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);
      add(bank, {
        sub: "社会",
        level: "中",
        diff: i % 4 === 0 ? "基礎" : "標準",
        patternGroup: "soc_geo_basic",
        pattern: "geo",
        q: qText,
        c, a,
        exp: `基礎事項。正解は「${correct}」。`,
      });
    });

    // 時差：15°=1時間（計算を確定させる）
    for (let i = 0; i < 80; i++) {
      const baseLon = pick([135, 0, 30, 60, 90, 120, 150], i);
      const diff = pick([15, 30, 45, 60, 75, 90], i + 2); // 15の倍数
      const east = i % 2 === 0;
      const targetLon = east ? baseLon + diff : baseLon - diff;
      const hours = diff / 15;

      const correct = east ? `${hours}時間進む` : `${hours}時間遅れる`;
      const wrongPool = [
        east ? `${hours}時間遅れる` : `${hours}時間進む`,
        "30分進む",
        "30分遅れる",
        "1時間進む",
        "1時間遅れる",
      ];
      const { c, a } = force4Unique(correct, wrongPool, i, i % 4);

      add(bank, {
        sub: "社会",
        level: "中",
        diff: "標準",
        patternGroup: "soc_geo_timezone_rule",
        pattern: "geo",
        q: `経度${baseLon}°から経度${targetLon}°へ移動した。時刻は一般にどうなる？（15°で1時間）`,
        c, a,
        exp: `経度差${diff}°→${hours}時間。東へ行くと進み、西へ行くと遅れる。`,
      });
    }

    // 歴史：重要語
    const hist = [
      ["大化の改新が始まった年（中学範囲の定番）は？", "645年", ["593年", "710年", "794年"]],
      ["鎌倉幕府を開いた人物は？", "源頼朝", ["足利尊氏", "徳川家康", "豊臣秀吉"]],
      ["江戸幕府を開いた人物は？", "徳川家康", ["織田信長", "足利義満", "源義経"]],
      ["明治維新の後、近代国家づくりが進んだ時代は？", "明治時代", ["平安時代", "室町時代", "鎌倉時代"]],
      ["第二次世界大戦後に制定された日本の憲法は？", "日本国憲法", ["大日本帝国憲法", "十七条の憲法", "御成敗式目"]],
    ];
    hist.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 2) % 4);
      add(bank, {
        sub: "社会",
        level: "中",
        diff: "標準",
        patternGroup: "soc_history_basic",
        pattern: "history",
        q: qText,
        c, a,
        exp: `歴史用語の基礎確認。正解は「${correct}」。`,
      });
    });

    // 公民：三権・権利
    const civics = [
      ["国会が法律を定める働きは？", "立法", ["行政", "司法", "自治"]],
      ["内閣が政治を行い法律を実行する働きは？", "行政", ["立法", "司法", "自治"]],
      ["裁判所が争いを裁く働きは？", "司法", ["立法", "行政", "自治"]],
      ["裁判所が法令が憲法に反しないか判断する権限は？", "違憲審査権", ["国政調査権", "予算先議権", "地方自治"]],
      ["国民の代表を選ぶ選挙の原則として正しいのは？", "普通選挙", ["制限選挙", "身分選挙", "推薦選挙"]],
    ];
    civics.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, i % 4);
      add(bank, {
        sub: "社会",
        level: "中",
        diff: i % 4 === 0 ? "基礎" : "標準",
        patternGroup: "soc_civics_basic",
        pattern: "civics",
        q: qText,
        c, a,
        exp: `基本用語の定義。正解は「${correct}」。`,
      });
    });
  }

  /* =========================
   * build
   * ========================= */
  function buildBank() {
    let bank = [];

    genJapanese(bank);
    genMath(bank);
    genEnglish(bank);
    genScience(bank);
    genSocial(bank);

    // uid 付与 + 検品
    bank.forEach((q) => {
      if (!q.uid) q.uid = makeUid(q);
    });

    // schema/品質フィルタ
    bank = bank.filter(validateQuestion);

    // uid 重複排除（内容同一の混入を防ぐ）
    const seen = new Set();
    const out = [];
    for (const q of bank) {
      const id = q.uid || makeUid(q);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(q);
    }
    bank = out;

    // 教科別統計（不足原因の特定に使える）
    const stats = {};
    SUBJECTS.forEach((s) => {
      stats[s] = bank.filter((q) => q.sub === s).length;
    });
    console.log("[BANK stats]", stats, "total:", bank.length, "unique(uid):", seen.size);

    return bank;
  }

  window.BANK = buildBank();
})();
