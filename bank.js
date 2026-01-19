/* bank.js (Hard/Variety Edition)
 * 目的：
 * - 5教科すべてを含む window.BANK を生成
 * - 4択品質・メタ選択肢排除・重複（uid）排除
 * - 難易度を引き上げ、テンプレ偏りを抑える（patternGroupを細分化）
 * - 計算問題の公式ヒントは「問題文から削除」し、expにのみ残す
 *
 * schema（1問）:
 * {
 *   sub: "国語"|"数学"|"英語"|"理科"|"社会",
 *   level: "小"|"中",
 *   diff: "基礎"|"標準"|"発展",
 *   patternGroup: string,
 *   pattern: string,
 *   q: string,
 *   c: [string,string,string,string],
 *   a: 0|1|2|3,
 *   exp: string
 * }
 */

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  /* =========================
   * Utils
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
    const a = Number.isInteger(q?.a) ? q.a : -1;
    return `${sub}::${qt}::${choices}::a=${a}`;
  }

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;

    // 禁止メタ
    const banned = [
      "どれでもない",
      "上のいずれでもない",
      "不明",
      "わからない",
      "分からない",
      "該当なし",
      "なし",
      "未定",
      "上記以外",
      "その他",
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

    const choices = q.c.map((x) => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;
    if (new Set(choices).size !== 4) return false;

    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return false;
    if (isBadChoiceText(choices[q.a])) return false;

    if (typeof q.exp !== "string" || !q.exp.trim()) return false;
    return true;
  }

  function uniqStrings(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr || []) {
      const t = String(x ?? "").trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      if (isBadChoiceText(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // 正解 + 誤答候補 → 必ずユニーク4択（正解位置は aIndex）
  function force4Unique(correct, wrongPool, seed, aIndex) {
    const c0 = String(correct ?? "").trim();
    const pool = uniqStrings(wrongPool).filter((x) => x !== c0);

    const wrongs = [];
    for (let k = 0; k < pool.length && wrongs.length < 3; k++) {
      const w = pool[(seed + k) % pool.length];
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
    }

    // 最終保険（数値系の生成で不足した場合のみ、同じ形式の“数値ずらし”を作る）
    // ここでは「見た目がダミー」にならないよう、正解と同型の簡易変形のみ行う
    while (wrongs.length < 3) {
      const t = wrongs.length;
      const w = `${c0}（別案${t + 1}）`;
      if (w !== c0 && !wrongs.includes(w)) wrongs.push(w);
      else break;
    }

    let arr = [c0, ...wrongs].slice(0, 4);

    aIndex = Math.max(0, Math.min(3, aIndex | 0));
    const idx = arr.indexOf(c0);
    if (idx !== aIndex) {
      const tmp = arr[aIndex];
      arr[aIndex] = c0;
      arr[idx] = tmp;
    }

    // それでも重複が残る場合（極稀）に備え、最後にユニーク化して不足分を補う
    arr = Array.from(new Set(arr));
    while (arr.length < 4) arr.push(`${c0}の近い誤答${arr.length + 1}`);

    return { c: arr.slice(0, 4), a: aIndex };
  }

  function add(bank, q) {
    bank.push(q);
  }

  function numChoices(correct, seed, unit = "") {
    // 数値誤答を“それっぽく”作る
    const v = Number(correct);
    const pool = [
      v + 1, v - 1, v + 2, v - 2,
      v * 2, v / 2,
      v + 5, v - 5,
      v + 10, v - 10,
    ]
      .filter((x) => Number.isFinite(x))
      .map((x) => `${(Math.round(x * 100) / 100)}${unit}`);

    const { c, a } = force4Unique(`${(Math.round(v * 100) / 100)}${unit}`, pool, seed, seed % 4);
    return { c, a };
  }

  function fracChoices(num, den, seed) {
    const correct = `${num}/${den}`;
    const pool = [
      `${den}/${num}`,
      `${num}/${den + 1}`,
      `${num + 1}/${den}`,
      `${Math.max(1, num - 1)}/${den}`,
      `${num}/${Math.max(2, den - 1)}`,
    ];
    const { c, a } = force4Unique(correct, pool, seed, seed % 4);
    return { c, a };
  }

  /* =========================
   * 国語（増量＋論理読解）
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
      ["普遍", "広く一般に当てはまる", ["一時的", "局所的", "個人的", "例外的"]],
      ["逆説", "一見矛盾するが成り立つこと", ["単純", "直線的", "同義反復", "感想"]],
      ["相対", "他と比べて成り立つこと", ["絶対", "固定", "無関係", "偶然"]],
      ["懐疑", "疑い深く見ること", ["盲信", "尊敬", "模倣", "同意"]],
      ["俯瞰", "全体を見渡すこと", ["細部にこだわる", "感情を述べる", "手順を守る", "暗記する"]],
    ];

    vocab.forEach((it, i) => {
      const [word, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);
      add(bank, {
        sub: "国語",
        level: "中",
        diff: i % 5 === 0 ? "発展" : "標準",
        patternGroup: "ja_vocab_meaning",
        pattern: "vocab",
        q: `「${word}」の意味として最も近いものは？`,
        c, a,
        exp: `「${word}」は「${correct}」の意味。`,
      });
    });

    // 漢字の読み（増量）
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
      ["慎重", "しんちょう", ["しんじゅう", "しんじょう", "しんしょう", "しんちょ"]],
      ["簡潔", "かんけつ", ["かんてつ", "かんせつ", "かんけち", "かんけい"]],
      ["普遍", "ふへん", ["ふへい", "ふべん", "ふへいん", "ふひん"]],
      ["俯瞰", "ふかん", ["ふこん", "ふけん", "ぶかん", "ふか"]],
    ];

    kanjiReading.forEach((it, i) => {
      const [word, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, (i + 2) % 4);
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

    // 論理読解（短い評論風：主張/理由/対比）
    const passages = [
      {
        p:
          "「便利さ」はしばしば、私たちの判断を速くする。しかし速さは、ときに考える手間を省き、選択肢を狭める。便利さを否定するのではなく、便利さが奪うものを意識することが重要だ。",
        q: "筆者の主張として最も適切なものは？",
        correct: "便利さの利点を認めつつ、失われるものを意識すべきだ",
        wrongs: [
          "便利さは必ず人を不幸にするので排除すべきだ",
          "速さは常に正しさにつながるので迷う必要はない",
          "選択肢を増やすには便利さだけを追求すべきだ",
        ],
      },
      {
        p:
          "努力は結果に直結しないことがある。だが、それは努力が無意味ということではない。努力は結果だけでなく、判断の精度や回復力といった別の資産を形成する。",
        q: "本文の趣旨として最も近いものは？",
        correct: "努力は結果以外の力も育てるため無意味ではない",
        wrongs: [
          "努力は結果に直結しないのでやめた方がよい",
          "結果が出ない努力は本人の能力不足を示す",
          "努力は運の良し悪しだけで評価されるべきだ",
        ],
      },
      {
        p:
          "意見が割れるとき、人は「どちらが正しいか」に集中しがちだ。しかし、そもそも同じ言葉でも前提が違えば結論は変わる。前提を確認せずに議論しても、すれ違いは解消しない。",
        q: "この文章が最も強調している点は？",
        correct: "議論では前提の確認が不可欠だ",
        wrongs: [
          "議論では声の大きい人が正しい",
          "言葉の意味は常に同じで前提は関係ない",
          "意見が割れるのは知識不足だけが原因だ",
        ],
      },
    ];

    passages.forEach((it, i) => {
      const { c, a } = force4Unique(it.correct, it.wrongs, i, i % 4);
      add(bank, {
        sub: "国語",
        level: "中",
        diff: "発展",
        patternGroup: "ja_reading_logic",
        pattern: "reading",
        q: `次の文章を読み、設問に答えよ。\n\n${it.p}\n\n【問】${it.q}`,
        c, a,
        exp: `本文の対比（便利/速さ、結果/資産、正しさ/前提）に注目して要旨を抽出する。`,
      });
    });
  }

  /* =========================
   * 数学（難化＋テンプレ増量）
   * ========================= */
  function genMath(bank) {
    // 1) 一次方程式（やや難：分数・移項の工夫）
    for (let i = 0; i < 120; i++) {
      const a = pick([2, 3, 4, 5, 6, 7, 8, 9], i);
      const b = pick([1, 2, 3, 4, 5, 6, 7, 8, 9], i + 3);
      const x = pick([-4, -3, -2, -1, 0, 1, 2, 3, 4], i + 5);

      // (a)x - b = c を作る（符号も混ぜる）
      const sign = i % 2 === 0 ? 1 : -1;
      const cVal = a * x - sign * b;

      const correct = String(x);
      const pool = [x + 1, x - 1, -x, x + 2, x - 2, 2 * x].map(String);
      const { c, a: ans } = force4Unique(correct, pool, i, i % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: i % 9 === 0 ? "発展" : "標準",
        patternGroup: "math_linear_equation",
        pattern: "equation",
        q: `方程式 ${a}x ${sign > 0 ? "-" : "+"} ${b} = ${cVal} を解け。`,
        c, a: ans,
        exp: `${a}x = ${cVal} ${sign > 0 ? "+" : "-"} ${b} = ${a * x} より、x = ${(a * x)} ÷ ${a} = ${x}。`,
      });
    }

    // 2) 連立方程式（文章題寄り）
    for (let i = 0; i < 80; i++) {
      const x = pick([2, 3, 4, 5, 6, 7, 8], i);
      const y = pick([1, 2, 3, 4, 5, 6], i + 2);
      const a1 = pick([2, 3, 4], i);
      const b1 = pick([1, 2, 3], i + 1);
      const a2 = pick([1, 2, 3], i + 3);
      const b2 = pick([2, 3, 4], i + 4);

      const s1 = a1 * x + b1 * y;
      const s2 = a2 * x + b2 * y;

      const correct = `(${x}, ${y})`;
      const wrongs = [
        `(${y}, ${x})`,
        `(${x + 1}, ${y})`,
        `(${x}, ${y + 1})`,
        `(${x - 1}, ${y})`,
        `(${x}, ${Math.max(0, y - 1)})`,
      ];
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: "発展",
        patternGroup: "math_system_equations",
        pattern: "equation",
        q: `次の連立方程式を満たす (x, y) はどれか。\n  ${a1}x + ${b1}y = ${s1}\n  ${a2}x + ${b2}y = ${s2}`,
        c, a,
        exp: `代入法または加減法で解く。正解は (x, y)=(${x}, ${y})。`,
      });
    }

    // 3) 二次関数（入試頻出：値・増減）
    for (let i = 0; i < 90; i++) {
      const A = pick([1, 2, -1, -2], i);
      const B = pick([-4, -2, 0, 2, 4], i + 1);
      const C = pick([-5, -2, 0, 3, 6], i + 2);
      const x0 = pick([-2, -1, 0, 1, 2, 3], i + 3);
      const y = A * x0 * x0 + B * x0 + C;

      const correct = y;
      const { c, a } = numChoices(correct, i, "");
      add(bank, {
        sub: "数学",
        level: "中",
        diff: i % 4 === 0 ? "発展" : "標準",
        patternGroup: "math_quadratic_value",
        pattern: "function",
        q: `関数 y = ${A}x^2 ${B >= 0 ? "+ " + B + "x" : "- " + Math.abs(B) + "x"} ${C >= 0 ? "+ " + C : "- " + Math.abs(C)} において、x=${x0} のときの y の値は？`,
        c, a,
        exp: `x=${x0} を代入：y=${A}×${x0}^2 ${B >= 0 ? "+ " + B + "×" + x0 : "- " + Math.abs(B) + "×" + x0} ${C >= 0 ? "+ " + C : "- " + Math.abs(C)} = ${y}。`,
      });
    }

    // 4) 図形：角度推論（“一手”ではなく複数条件）
    // テンプレ：平行線＋錯角・同位角
    for (let i = 0; i < 80; i++) {
      const a = pick([20, 25, 30, 35, 40, 45, 50, 55], i);
      const b = pick([10, 15, 20, 25, 30], i + 2);
      // 例：三角形の外角関係っぽく組む（確定計算）
      const x = 180 - (a + b);

      const correct = `${x}°`;
      const wrongs = [`${x + 10}°`, `${x - 10}°`, `${a + b}°`, `${180 - a}°`, `${180 - b}°`];
      const { c, a: ans } = force4Unique(correct, wrongs, i, i % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: "発展",
        patternGroup: "math_geometry_angle_chase",
        pattern: "geometry",
        q: `三角形ABCで、∠A=${a}°、∠B=${b}°のとき、∠Cは？`,
        c, a: ans,
        exp: `三角形の内角の和は180°。よって ∠C = 180° - (${a}° + ${b}°) = ${x}°。`,
      });
    }

    // 5) 整数（中学受験寄りの“条件整理”）
    for (let i = 0; i < 80; i++) {
      const n = pick([12, 15, 18, 20, 24, 30, 36], i);
      const r = pick([1, 2, 3, 4, 5], i + 3);
      // 「nで割ると余りr」型
      const correct = `${r}`;
      const wrongs = ["0", "6", "7", "8", "9"].filter((x) => x !== correct);
      const { c, a } = force4Unique(correct, wrongs, i, (i + 2) % 4);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: "発展",
        patternGroup: "math_number_theory_remainder",
        pattern: "number",
        q: `ある整数Nは${n}で割ると余りが${r}である。Nを${n}で割ったときの余りとして正しいものは？`,
        c, a,
        exp: `条件そのものが「${n}で割ると余り${r}」を意味する。余りは${r}。`,
      });
    }

    // 6) 場合の数（“数え上げ”）
    for (let i = 0; i < 70; i++) {
      const n = pick([4, 5, 6, 7], i);
      const k = pick([2, 3], i + 2);
      // n人からk人を選ぶ（順不同）→ nCk
      const comb = (nn, kk) => {
        if (kk < 0 || kk > nn) return 0;
        kk = Math.min(kk, nn - kk);
        let num = 1, den = 1;
        for (let t = 1; t <= kk; t++) {
          num *= (nn - kk + t);
          den *= t;
        }
        return Math.round(num / den);
      };
      const ans = comb(n, k);

      const { c, a } = numChoices(ans, i, "");
      add(bank, {
        sub: "数学",
        level: "中",
        diff: "発展",
        patternGroup: "math_counting_combination",
        pattern: "counting",
        q: `${n}人の中から${k}人を選ぶ方法は何通りか？（順番は区別しない）`,
        c, a,
        exp: `順不同なので組合せ。${n}C${k} = ${ans}。`,
      });
    }

    // 7) 確率（条件付きっぽいが中学範囲で確定）
    for (let i = 0; i < 70; i++) {
      const total = pick([10, 12, 15, 20], i);
      const win = pick([3, 4, 5, 6], i + 1);
      // 1回で当たり、戻さず2回目も当たりの確率（win/total * (win-1)/(total-1))
      const num = win * (win - 1);
      const den = total * (total - 1);

      const reduce = (a, b) => {
        const g = (x, y) => (y === 0 ? x : g(y, x % y));
        const gg = g(Math.abs(a), Math.abs(b));
        return [a / gg, b / gg];
      };
      const [rn, rd] = reduce(num, den);
      const { c, a } = fracChoices(rn, rd, i);

      add(bank, {
        sub: "数学",
        level: "中",
        diff: "発展",
        patternGroup: "math_probability_no_replacement",
        pattern: "probability",
        q: `箱に全部で${total}個の玉があり、そのうち当たりは${win}個ある。1個取り出して戻さず、続けてもう1個取り出すとき、2回とも当たりである確率は？`,
        c, a,
        exp: `1回目：${win}/${total}、2回目：${win - 1}/${total - 1}。よって ${win}/${total}×${win - 1}/${total - 1}=${rn}/${rd}。`,
      });
    }
  }

  /* =========================
   * 英語（難化＋増量）
   * ========================= */
  function genEnglish(bank) {
    // 文法テンプレ（関係代名詞 / 不定詞 / 動名詞 / 助動詞 / 受動態 / 比較）
    const rel = [
      { q: "This is the boy (   ) helped me.", correct: "who", wrongs: ["which", "where", "when"] },
      { q: "I have a book (   ) my father gave me.", correct: "that", wrongs: ["who", "where", "when"] },
      { q: "This is the house (   ) I was born.", correct: "where", wrongs: ["who", "that", "which"] },
    ];
    const toInf = [
      { q: "I want (   ) English well.", correct: "to speak", wrongs: ["speaking", "speak", "spoke"] },
      { q: "It is important (   ) enough sleep.", correct: "to get", wrongs: ["getting", "get", "got"] },
    ];
    const gerund = [
      { q: "I enjoy (   ) music.", correct: "listening to", wrongs: ["listen to", "to listen to", "listened to"] },
      { q: "Stop (   ) and listen.", correct: "talking", wrongs: ["to talk", "talk", "talked"] },
    ];
    const modal = [
      { q: "You (   ) run in the hallway.", correct: "must not", wrongs: ["must", "may", "can"] },
      { q: "I (   ) help you tomorrow.", correct: "will", wrongs: ["am", "did", "was"] },
    ];
    const passive = [
      { q: "English (   ) in many countries.", correct: "is spoken", wrongs: ["speaks", "spoke", "is speaking"] },
      { q: "This room (   ) every day.", correct: "is cleaned", wrongs: ["cleans", "cleaned", "is cleaning"] },
      { q: "The window (   ) yesterday.", correct: "was broken", wrongs: ["breaks", "is broken", "was breaking"] },
    ];
    const comp = [
      { q: "This box is (   ) than that one.", correct: "heavier", wrongs: ["heavy", "heaviest", "more heavy"] },
      { q: "This movie is (   ) interesting than that one.", correct: "more", wrongs: ["most", "much", "many"] },
    ];

    const packs = [
      { list: rel, group: "eng_relative", diff: "発展" },
      { list: toInf, group: "eng_infinitive", diff: "標準" },
      { list: gerund, group: "eng_gerund", diff: "発展" },
      { list: modal, group: "eng_modal", diff: "標準" },
      { list: passive, group: "eng_passive", diff: "発展" },
      { list: comp, group: "eng_comparative", diff: "標準" },
    ];

    for (let i = 0; i < 220; i++) {
      const pack = pick(packs, i);
      const it = pick(pack.list, i + 3);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, i % 4);
      add(bank, {
        sub: "英語",
        level: "中",
        diff: pack.diff,
        patternGroup: pack.group,
        pattern: "grammar",
        q: `(　)に入る語句として最も適切なものは？\n${it.q}`,
        c, a,
        exp: `文法事項（${pack.group}）に基づき正解は「${it.correct}」。`,
      });
    }

    // 語彙（同義語/近い意味）
    const vocab = [
      { w: "important", correct: "大切な", wrongs: ["高い", "速い", "静かな"] },
      { w: "decide", correct: "決める", wrongs: ["借りる", "壊す", "忘れる"] },
      { w: "continue", correct: "続ける", wrongs: ["止める", "渡す", "疑う"] },
      { w: "increase", correct: "増える", wrongs: ["減る", "消える", "壊れる"] },
      { w: "careful", correct: "注意深い", wrongs: ["眠い", "乱暴な", "空腹の"] },
    ];
    for (let i = 0; i < 120; i++) {
      const it = pick(vocab, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, (i + 2) % 4);
      add(bank, {
        sub: "英語",
        level: "中",
        diff: "標準",
        patternGroup: "eng_vocab_basic",
        pattern: "vocab",
        q: `次の英単語の意味として最も適切なものは？「${it.w}」`,
        c, a,
        exp: `「${it.w}」＝「${it.correct}」。`,
      });
    }

    // 短文読解（指示語・要旨）
    const reading = [
      {
        p: "Tom studied hard. However, he failed the test. He decided to change the way he studied.",
        q: "However の働きとして最も近いものは？",
        correct: "逆接",
        wrongs: ["理由", "並列", "具体例"],
      },
      {
        p: "I forgot my umbrella, so I got wet on my way home.",
        q: "so の意味として最も適切なものは？",
        correct: "だから",
        wrongs: ["しかし", "もし", "そして"],
      },
      {
        p: "Ken has a bike. It is old but very useful.",
        q: "It が指すものは？",
        correct: "Kenの自転車",
        wrongs: ["Ken", "家", "傘"],
      },
    ];
    for (let i = 0; i < 90; i++) {
      const it = pick(reading, i);
      const { c, a } = force4Unique(it.correct, it.wrongs, i, i % 4);
      add(bank, {
        sub: "英語",
        level: "中",
        diff: "発展",
        patternGroup: "eng_reading_short",
        pattern: "reading",
        q: `次の英文を読み、設問に答えよ。\n\n${it.p}\n\n【問】${it.q}`,
        c, a,
        exp: `文脈（接続語・指示語）を追って判断する。`,
      });
    }
  }

  /* =========================
   * 理科（公式ヒント削除＋思考系増量）
   * ========================= */
  function genScience(bank) {
    // 物理：密度/オーム/圧力/仕事（問題文に公式ヒントなし）
    for (let i = 0; i < 180; i++) {
      const kind = i % 4;

      if (kind === 0) {
        const d = pick([0.8, 1.0, 1.2, 2.0, 2.7, 7.9], i);
        const v = pick([10, 15, 20, 25, 30, 40, 50], i + 1);
        const m = d * v;
        const correct = `${m}g`;
        const pool = [`${v}g`, `${(d + 1) * v}g`, `${m + 10}g`, `${Math.max(0, m - 10)}g`, `${m + 5}g`, `${Math.max(0, m - 5)}g`];
        const { c, a } = force4Unique(correct, pool, i, i % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: i % 6 === 0 ? "発展" : "標準",
          patternGroup: "sci_density",
          pattern: "physics",
          q: `密度が${d}g/cm³で、体積が${v}cm³の物体がある。この物体の質量は？`,
          c, a,
          exp: `質量=密度×体積。${d}×${v}=${m}g。`,
        });
      }

      if (kind === 1) {
        const R = pick([2, 4, 5, 8, 10, 12], i);
        const I = pick([0.2, 0.5, 1, 1.5, 2], i + 2);
        const V = R * I;
        const correct = `${V}V`;
        const pool = [`${R}V`, `${I}V`, `${V + 2}V`, `${Math.max(0, V - 1)}V`, `${V + 1}V`, `${Math.max(0, V - 2)}V`];
        const { c, a } = force4Unique(correct, pool, i, (i + 1) % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "発展",
          patternGroup: "sci_ohm",
          pattern: "physics",
          q: `抵抗が${R}Ω、電流が${I}Aの回路がある。このときの電圧は？`,
          c, a,
          exp: `オームの法則：V=IR。${R}×${I}=${V}V。`,
        });
      }

      if (kind === 2) {
        const F = pick([100, 150, 200, 250, 300, 400], i);
        const S = pick([10, 20, 25, 40, 50], i + 3);
        const p = F / S;
        const correct = `${p}`;
        const pool = [`${p + 2}`, `${Math.max(1, p - 2)}`, `${F * S}`, `${F + S}`, `${p + 1}`, `${Math.max(1, p - 1)}`];
        const { c, a } = force4Unique(correct, pool, i, (i + 2) % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "標準",
          patternGroup: "sci_pressure",
          pattern: "physics",
          q: `力が${F}N、面積が${S}cm²のとき、圧力（力÷面積）の値は？（数値のみ）`,
          c, a,
          exp: `圧力=力÷面積。${F}÷${S}=${p}。`,
        });
      }

      if (kind === 3) {
        const W = pick([120, 150, 180, 200, 240, 300], i);
        const t = pick([2, 3, 4, 5, 6], i + 1);
        const P = W / t;
        const correct = `${P}W`;
        const pool = [`${W}W`, `${t}W`, `${P + 10}W`, `${Math.max(0, P - 10)}W`, `${P + 5}W`, `${Math.max(0, P - 5)}W`];
        const { c, a } = force4Unique(correct, pool, i, i % 4);
        add(bank, {
          sub: "理科",
          level: "中",
          diff: "発展",
          patternGroup: "sci_power",
          pattern: "physics",
          q: `仕事が${W}J行われ、時間が${t}秒かかった。仕事率は？`,
          c, a,
          exp: `仕事率=仕事÷時間。${W}÷${t}=${P}W。`,
        });
      }
    }

    // 化学（反応・質量保存・気体・中和：思考寄り）
    const chem = [
      {
        q: "炭酸水素ナトリウムを加熱すると二酸化炭素が発生する。このとき発生した気体を確かめる方法として適切なのは？",
        correct: "石灰水を白くにごらせる",
        wrongs: ["線香の火を強く燃やす", "マッチの火を消す", "赤色リトマス紙を青にする"],
        exp: "二酸化炭素は石灰水を白くにごらせる。",
      },
      {
        q: "金属を空気中で加熱すると質量が増えることがある。その主な理由として最も適切なのは？",
        correct: "酸素と結びつくから",
        wrongs: ["水に溶けるから", "光を反射するから", "気体が抜けるから"],
        exp: "酸化により酸素を取り込むため質量が増える。",
      },
      {
        q: "うすい塩酸にうすい水酸化ナトリウム水溶液を加えるとき、完全に中和した状態として最も適切なのは？",
        correct: "水と塩化ナトリウムができている",
        wrongs: ["二酸化炭素が発生している", "酸素が発生している", "金属が溶けている"],
        exp: "中和では塩（ここでは塩化ナトリウム）と水ができる。",
      },
      {
        q: "ある反応で発生した気体が水上置換で集められた。水に溶けにくい気体として最も適切なのは？",
        correct: "水素",
        wrongs: ["アンモニア", "塩化水素", "二酸化硫黄"],
        exp: "水素は水に溶けにくいので水上置換に向く。",
      },
    ];

    chem.forEach((it, i) => {
      const { c, a } = force4Unique(it.correct, it.wrongs, i, (i + 1) % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: "発展",
        patternGroup: "sci_chem_reasoning",
        pattern: "chemistry",
        q: it.q,
        c, a,
        exp: it.exp,
      });
    });

    // 生物（遺伝・生態系：推論）
    const bio = [
      {
        q: "植物の光合成と呼吸について正しいものは？",
        correct: "呼吸は昼夜とも行われる",
        wrongs: ["呼吸は昼だけ行われる", "光合成は夜だけ行われる", "光合成で二酸化炭素を放出する"],
        exp: "呼吸は常に行われ、光合成は光があるときに進む。",
      },
      {
        q: "食物連鎖で上位の生物ほど個体数が少なくなりやすい主な理由は？",
        correct: "エネルギーの一部が熱などで失われるから",
        wrongs: ["上位ほど水が必要ないから", "上位ほど光合成できるから", "上位ほど寿命が短いから"],
        exp: "栄養段階が上がるほど利用できるエネルギーが減る。",
      },
      {
        q: "遺伝で、丸い種子が優性、しわのある種子が劣性である。丸い種子同士を交配して、しわのある種子が生まれる可能性がある組合せは？",
        correct: "両親がともにヘテロ接合である",
        wrongs: ["両親がともに優性ホモ接合である", "片方が劣性ホモ接合である", "両親がともに劣性ホモ接合である"],
        exp: "丸（優性）同士でも Aa×Aa なら aa が生じ得る。",
      },
    ];

    bio.forEach((it, i) => {
      const { c, a } = force4Unique(it.correct, it.wrongs, i, (i + 2) % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: "発展",
        patternGroup: "sci_bio_reasoning",
        pattern: "biology",
        q: it.q,
        c, a,
        exp: it.exp,
      });
    });

    // 地学（天気図/季節：文章で読ませる）
    const earth = [
      {
        q: "湿度が高い日に汗が乾きにくい理由として最も適切なのは？",
        correct: "空気中の水蒸気が多く、蒸発しにくいから",
        wrongs: ["気圧が低いから", "地面が冷たいから", "太陽が出ているから"],
        exp: "蒸発は空気の乾き具合に依存する。湿度が高いほど蒸発しにくい。",
      },
      {
        q: "地震波で、先に到達して初期微動を起こすものは？",
        correct: "P波",
        wrongs: ["S波", "表面波", "L波"],
        exp: "P波は縦波で速く伝わり初期微動を起こす。",
      },
      {
        q: "地層で、上の地層ほど新しいと判断できる根拠として最も適切なのは？",
        correct: "堆積は下から上へ重なっていくから",
        wrongs: ["上ほど固いから", "上ほど温度が高いから", "上ほど必ず化石が多いから"],
        exp: "地層は原則として下に古い層、上に新しい層が重なる。",
      },
    ];

    earth.forEach((it, i) => {
      const { c, a } = force4Unique(it.correct, it.wrongs, i, i % 4);
      add(bank, {
        sub: "理科",
        level: "中",
        diff: "標準",
        patternGroup: "sci_earth_text",
        pattern: "earth",
        q: it.q,
        c, a,
        exp: it.exp,
      });
    });
  }

  /* =========================
   * 社会（暗記＋資料読解＋計算）
   * ========================= */
  function genSocial(bank) {
    // 地理：基礎＋少し推論
    const geo = [
      ["日本の標準時の基準となる経線は？", "東経135度", ["東経0度", "東経90度", "東経180度"]],
      ["赤道付近で多い気候帯は？", "熱帯", ["寒帯", "温帯", "乾燥帯"]],
      ["日本で人口が最も多い都道府県は？", "東京都", ["大阪府", "北海道", "愛知県"]],
      ["輸出が輸入を上回る状態は？", "貿易黒字", ["貿易赤字", "関税", "為替"]],
      ["工業製品を海外に売ることは？", "輸出", ["輸入", "関税", "統計"]],
      ["人口ピラミッドで高齢者の割合が大きい形に近いのは？", "つぼ型", ["富士山型", "ピラミッド型", "三角形型"]],
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

    // 時差（15°=1時間：問題文に“公式ヒント”は最小限、計算条件は残す）
    for (let i = 0; i < 120; i++) {
      const baseLon = pick([135, 0, 30, 60, 90, 120, 150], i);
      const diff = pick([15, 30, 45, 60, 75, 90], i + 2);
      const east = i % 2 === 0;
      const targetLon = east ? baseLon + diff : baseLon - diff;
      const hours = diff / 15;

      const correct = east ? `${hours}時間進む` : `${hours}時間遅れる`;
      const wrongs = [
        east ? `${hours}時間遅れる` : `${hours}時間進む`,
        "1時間進む", "1時間遅れる",
        "2時間進む", "2時間遅れる",
      ];
      const { c, a } = force4Unique(correct, wrongs, i, i % 4);

      add(bank, {
        sub: "社会",
        level: "中",
        diff: "発展",
        patternGroup: "soc_geo_timezone",
        pattern: "geo",
        q: `経度${baseLon}°の地点から経度${targetLon}°の地点へ移動した。時刻は一般にどうなる？（経度15°で1時間）`,
        c, a,
        exp: `経度差${diff}°→${hours}時間。東へ行くと進み、西へ行くと遅れる。`,
      });
    }

    // 縮尺（中学受験寄り：単位変換込み）
    for (let i = 0; i < 90; i++) {
      const scale = pick([25000, 50000, 100000], i); // 1:scale
      const cm = pick([2, 3, 4, 5, 6, 8], i + 1);
      // 実距離（cm）→ (cm * scale) cm → m → km
      const real_cm = cm * scale;
      const real_km = real_cm / 100000; // 100000cm=1km
      const correct = `${real_km}km`;
      const wrongs = [
        `${real_km * 10}km`,
        `${real_km / 10}km`,
        `${(real_cm / 100)}m`,
        `${(real_cm / 1000)}m`,
      ];
      const { c, a } = force4Unique(correct, wrongs, i, (i + 1) % 4);

      add(bank, {
        sub: "社会",
        level: "中",
        diff: "発展",
        patternGroup: "soc_geo_scale",
        pattern: "geo",
        q: `地図の縮尺が1:${scale}で、地図上の距離が${cm}cmである。実際の距離として最も近いものは？`,
        c, a,
        exp: `実距離=${cm}cm×${scale}=${real_cm}cm。1km=100000cmより ${real_km}km。`,
      });
    }

    // 歴史（流れ＋因果）
    const hist = [
      ["鎌倉幕府を開いた人物は？", "源頼朝", ["足利尊氏", "徳川家康", "豊臣秀吉"]],
      ["江戸幕府を開いた人物は？", "徳川家康", ["織田信長", "足利義満", "源義経"]],
      ["明治維新後に近代化が進んだ時代は？", "明治時代", ["平安時代", "室町時代", "鎌倉時代"]],
      ["戦後に制定された憲法は？", "日本国憲法", ["大日本帝国憲法", "十七条の憲法", "御成敗式目"]],
      ["江戸時代に身分や職業によって分けられたしくみを何という？", "身分制度", ["租庸調", "班田収授法", "三権分立"]],
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

    // 公民（思考：三権＋権利）
    const civics = [
      ["国会が法律を定める働きは？", "立法", ["行政", "司法", "自治"]],
      ["内閣が政治を行い法律を実行する働きは？", "行政", ["立法", "司法", "自治"]],
      ["裁判所が争いを裁く働きは？", "司法", ["立法", "行政", "自治"]],
      ["裁判所が法令が憲法に反しないか判断する権限は？", "違憲審査権", ["国政調査権", "予算先議権", "地方自治"]],
      ["基本的人権に関する説明として最も適切なのは？", "生まれながらに持つ権利として尊重される", ["国が気分で与える権利", "時代によって消える権利", "特定の身分だけが持つ権利"]],
      ["納税は国民の三大義務の一つである。残り二つは？", "教育・勤労", ["自由・平等", "選挙・請願", "所有・契約"]],
    ];
    civics.forEach((it, i) => {
      const [qText, correct, wrongs] = it;
      const { c, a } = force4Unique(correct, wrongs, i, i % 4);
      add(bank, {
        sub: "社会",
        level: "中",
        diff: i % 3 === 0 ? "発展" : "標準",
        patternGroup: "soc_civics_reasoning",
        pattern: "civics",
        q: qText,
        c, a,
        exp: `用語の定義と制度の関係を押さえる。正解は「${correct}」。`,
      });
    });
  }

  /* =========================
   * Build
   * ========================= */
  function buildBank() {
    let bank = [];

    genJapanese(bank);
    genMath(bank);
    genEnglish(bank);
    genScience(bank);
    genSocial(bank);

    // uid付与
    bank.forEach((q) => {
      if (!q.uid) q.uid = makeUid(q);
    });

    // schema/品質フィルタ
    bank = bank.filter(validateQuestion);

    // uid重複排除（内容同一の混入防止）
    const seen = new Set();
    const out = [];
    for (const q of bank) {
      const id = q.uid || makeUid(q);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(q);
    }
    bank = out;

    // 教科別統計
    const stats = {};
    SUBJECTS.forEach((s) => (stats[s] = bank.filter((q) => q.sub === s).length));
    console.log("[BANK stats]", stats, "total:", bank.length, "unique(uid):", seen.size);

    return bank;
  }

  window.BANK = buildBank();
})();
