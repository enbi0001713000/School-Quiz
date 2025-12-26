/* bank.js
   - 固定問題 + 一部テンプレ生成
   - 不適切な選択肢（"-"やメタ文章）を含む問題は validateQuestion で除外
   - pattern は内部コード（kobun/geo/civics等）で保持し、表示は app.js 側で日本語化
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  function makeKey(q, i) {
    return q.key || `${q.sub}|${q.level}|${q.diff}|${q.pattern || "p"}|${(q.q || "").slice(0, 28)}|${i}`;
  }

  function isBadChoiceText(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (t === "-" || t === "—" || t === "–") return true;

    // メタっぽい文言は絶対に混ぜない
    const banned = [
      "用語の使い方が不適切",
      "時代が違う",
      "地域が違う",
      "不明",
      "わからない",
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

    const choices = q.c.map(x => String(x ?? "").trim());
    if (choices.some(isBadChoiceText)) return false;

    const uniq = new Set(choices);
    if (uniq.size !== 4) return false;

    if (isBadChoiceText(choices[q.a])) return false;

    return true;
  }

  /* =========================
   * 固定問題（社会：選択肢を“迷うが筋が通る”に寄せる）
   * ========================= */
  const fixed = [
    // --- 社会（公民） ---
    {
      sub: "社会", level: "中", diff: "標準", pattern: "civics",
      q: "裁判所が法律や命令などが憲法に反しないかを判断する権限は？",
      c: ["違憲審査権", "国政調査権", "弾劾裁判所の権限", "予算先議権"],
      a: 0,
      exp: "裁判所が法令等を憲法に照らして判断する権限は違憲審査権。"
    },
    {
      sub: "社会", level: "中", diff: "標準", pattern: "geo",
      q: "経度が15°東へ移動すると、時刻は一般にどうなる？",
      c: ["1時間進む", "1時間遅れる", "30分進む", "2時間進む"],
      a: 0,
      exp: "地球は360°を24時間で回るので15°で1時間。東へ行くほど時刻は進む。"
    },
    {
      sub: "社会", level: "中", diff: "標準", pattern: "civics",
      q: "衆議院の解散があるのは、二院制におけるどの特徴と関係が深い？",
      c: ["衆議院の優越", "司法権の独立", "地方自治の保障", "基本的人権の尊重"],
      a: 0,
      exp: "衆議院が民意をより反映するという位置づけ（優越）があり、解散で民意を問える。"
    },
    {
      sub: "社会", level: "中", diff: "標準", pattern: "history",
      q: "江戸時代、幕府が諸大名を江戸と領地に交代で住まわせた制度は？",
      c: ["参勤交代", "鎖国", "楽市楽座", "兵農分離"],
      a: 0,
      exp: "参勤交代は大名の統制・財政負担を通じて幕府の支配を強めた。"
    },
    {
      sub: "社会", level: "中", diff: "発展", pattern: "geo",
      q: "日本の地形や気候に関して正しい説明はどれ？",
      c: ["山地が多く、短い河川が急流になりやすい", "年中乾燥し、砂漠が広がる", "海に面していない内陸国である", "高緯度にあり、極夜が毎年ある"],
      a: 0,
      exp: "日本は山地が多く河川は短く流れが速い傾向がある。"
    },

    // --- 理科 ---
    {
      sub: "理科", level: "中", diff: "標準", pattern: "experiment",
      q: "光合成でデンプンができたことを確かめるために、ヨウ素液をかけると葉はどうなる？",
      c: ["青紫色になる", "赤色になる", "無色になる", "黄緑色になる"],
      a: 0,
      exp: "ヨウ素液はデンプンに反応して青紫色になる。"
    },
    {
      sub: "理科", level: "中", diff: "標準", pattern: "physics",
      q: "直列回路で豆電球を1個から2個に増やすと、電流の大きさは一般にどうなる？",
      c: ["小さくなる", "大きくなる", "変わらない", "0になる"],
      a: 0,
      exp: "直列では抵抗が増えるため電流は小さくなる。"
    },
    {
      sub: "理科", level: "中", diff: "発展", pattern: "calc",
      q: "密度2.0g/cm³の物体の体積が30cm³のとき、質量は？",
      c: ["60g", "15g", "32g", "90g"],
      a: 0,
      exp: "質量=密度×体積=2.0×30=60g。"
    },

    // --- 数学 ---
    {
      sub: "数学", level: "中", diff: "標準", pattern: "function",
      q: "一次関数 y = 2x + 1 の y切片は？",
      c: ["1", "2", "-1", "0"],
      a: 0,
      exp: "y切片は x=0 のときのy。y=1。"
    },
    {
      sub: "数学", level: "中", diff: "標準", pattern: "geometry",
      q: "直角三角形で、斜辺が5、他の一辺が3のとき、残りの一辺は？",
      c: ["4", "2", "8", "√34"],
      a: 0,
      exp: "三平方：5^2=3^2+□^2 → 25=9+□^2 → □=4。"
    },
    {
      sub: "数学", level: "中", diff: "発展", pattern: "proof",
      q: "証明：△ABCでAB=ACのとき、∠B=∠C。根拠として正しいのは？",
      c: ["二等辺三角形の性質（底角は等しい）", "円周角の定理", "平行線の錯角が等しい", "対頂角が等しい"],
      a: 0,
      exp: "AB=ACなら二等辺三角形なので底角（∠Bと∠C）は等しい。"
    },

    // --- 英語 ---
    {
      sub: "英語", level: "中", diff: "標準", pattern: "grammar",
      q: "次の文の（　）に入る最も適切な語は？ I (   ) to school every day.",
      c: ["go", "goes", "went", "going"],
      a: 0,
      exp: "主語Iは三単現ではないので go。"
    },
    {
      sub: "英語", level: "中", diff: "発展", pattern: "reading",
      q: "英文：\"Tom was tired, so he went to bed early.\" 下線部 so の意味は？",
      c: ["だから", "しかし", "もし", "そして"],
      a: 0,
      exp: "so は原因→結果の「だから」。"
    },

    // --- 国語 ---
    {
      sub: "国語", level: "中", diff: "標準", pattern: "vocab",
      q: "「一目瞭然」の意味として最も近いものは？",
      c: ["見ただけではっきり分かる", "目で見るのが難しい", "一度見ても覚えられない", "見ない方がよい"],
      a: 0,
      exp: "一目で明らか、という意味。"
    },
    {
      sub: "国語", level: "中", diff: "標準", pattern: "kobun",
      q: "古文の助動詞「けり」が表す意味として代表的なのは？",
      c: ["過去・詠嘆", "推量", "打消", "完了"],
      a: 0,
      exp: "「けり」は過去の回想や詠嘆を表すことが多い。"
    },
    {
      sub: "国語", level: "中", diff: "発展", pattern: "kanbun",
      q: "漢文の返り点「レ点」は何を示す？",
      c: ["その字を後から読む", "同じ字を二度読む", "その字を読まない", "下から順に読む"],
      a: 0,
      exp: "レ点は一字下の字を先に読み、その後でレ点の字を読むことを示す。"
    },
  ];

  /* =========================
   * テンプレ生成（不足しにくくする／ただし品質重視で安全な範囲）
   * ========================= */
  function randInt(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }
  function uniqChoices(arr) {
    const out = [];
    const set = new Set();
    for (const x of arr) {
      const t = String(x).trim();
      if (!t) continue;
      if (set.has(t)) continue;
      set.add(t);
      out.push(t);
    }
    return out;
  }

  // 数学：一次関数（中・標準〜発展）
  function genMathFunction(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = randInt(-4, 4) || 2;
      const b = randInt(-6, 6);
      const x = randInt(-3, 4);
      const y = a * x + b;
      const q = {
        sub: "数学", level: "中", diff: (i % 3 === 0 ? "発展" : "標準"), pattern: "function",
        q: `一次関数 y = ${a}x ${b >= 0 ? "+ " + b : "- " + Math.abs(b)} について、x=${x} のときの y は？`,
        c: [],
        a: 0,
        exp: `y=ax+b に代入：y=${a}×${x}${b >= 0 ? "+" + b : "-" + Math.abs(b)}=${y}。`,
      };
      const wrong1 = y + randInt(1, 4);
      const wrong2 = y - randInt(1, 4);
      const wrong3 = (a * (x + 1) + b);
      q.c = uniqChoices([String(y), String(wrong1), String(wrong2), String(wrong3)]);
      while (q.c.length < 4) q.c.push(String(y + randInt(5, 9)));
      // 正解位置をシャッフル
      const correct = String(y);
      q.c = uniqChoices(q.c).slice(0, 4);
      const idx = q.c.indexOf(correct);
      if (idx !== 0) {
        [q.c[0], q.c[idx]] = [q.c[idx], q.c[0]];
      }
      q.a = 0;
      out.push(q);
    }
    return out;
  }

  // 社会：経度と時差（中・標準）— “-”が混ざらない固定式
  function genSocialTimeZone(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const step = [15, 30, 45][i % 3];
      const hours = step / 15;
      const dir = (i % 2 === 0) ? "東" : "西";
      const correct = (dir === "東") ? `${hours}時間進む` : `${hours}時間遅れる`;
      const w1 = (dir === "東") ? `${hours}時間遅れる` : `${hours}時間進む`;
      const w2 = (hours === 1) ? "30分進む" : "1時間進む";
      const w3 = (hours === 1) ? "2時間進む" : "30分遅れる";

      const q = {
        sub: "社会", level: "中", diff: "標準", pattern: "geo",
        q: `経度が${step}°${dir}へ移動すると、時刻は一般に？`,
        c: uniqChoices([correct, w1, w2, w3]).slice(0, 4),
        a: 0,
        exp: `地球は360°を24時間で回るので15°で1時間。${dir}へ行くと時刻は${dir === "東" ? "進む" : "遅れる"}。`,
      };
      // 正解を先頭へ
      const idx = q.c.indexOf(correct);
      if (idx > 0) [q.c[0], q.c[idx]] = [q.c[idx], q.c[0]];
      q.a = 0;
      out.push(q);
    }
    return out;
  }

  // 国語：語彙（中・標準）— 安全な範囲で固定拡張
  function genJapaneseVocab() {
    const items = [
      ["適切", "状況や目的に合っている", ["無関係", "偶然", "不可能"]],
      ["抽象", "形がなく概念的なこと", ["具体", "偶然", "部分"]],
      ["根拠", "理由やよりどころ", ["結論", "感想", "例外"]],
      ["簡潔", "むだがなく短いこと", ["複雑", "曖昧", "冗長"]],
      ["顕著", "目立ってはっきりしている", ["平凡", "微妙", "不明瞭"]],
    ];
    return items.map(([word, meaning, wrongs], i) => {
      const correct = meaning;
      const c = uniqChoices([correct, ...wrongs]).slice(0, 4);
      return {
        sub: "国語", level: "中", diff: "標準", pattern: "vocab",
        q: `「${word}」の意味として最も近いものは？`,
        c: [c[0], c[1], c[2], c[3]],
        a: 0,
        exp: `「${word}」は「${meaning}」という意味。`,
      };
    });
  }

  /* =========================
   * build & export
   * ========================= */
  function buildBank() {
    const bank = [];

    bank.push(...fixed);

    // 生成で不足しにくくする（数は控えめ：品質優先）
    bank.push(...genMathFunction(36));
    bank.push(...genSocialTimeZone(18));
    bank.push(...genJapaneseVocab());

    // key付与
    bank.forEach((q, i) => { q.key = makeKey(q, i); });

    // 検品：不適切選択肢を含む問題を除外
    const cleaned = bank.filter(validateQuestion);

    // 教科別に最低数があるか簡易チェック（不足は app.js がフォールバック）
    // console.log("[bank] size:", cleaned.length);

    return cleaned;
  }

  window.BANK = buildBank();
})();
