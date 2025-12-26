/* bank.js
  - 5教科が必ず混在するBANKを生成
  - 4択の品質（空/重複/メタ文言）を除外
  - 追加: uid（内容ベース重複判定） / patternGroup（テンプレ群）
  - 追加: uid重複の安全装置（重複水増し停止）
  - 追加: 教科別ユニーク不足が分かるログ
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

  // 「見かけの水増し」を止めた後に、最低限確保したい“ユニーク(uid)”数の目安
  // ここを 120 にしても国語が追いつかない場合は、素材増量が必要だとログで分かる
  const MIN_UNIQUE_PER_SUBJECT = 80;

  // topUpで“新しいユニーク”が増えない時の停止閾値
  const TOPUP_ROUNDS = 4;

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

  function attachMeta(bank) {
    bank.forEach((q, i) => {
      q.key = toKey(q, i);
      if (!q.patternGroup) q.patternGroup = q.pattern || "p";
      if (!q.uid) q.uid = makeUid(q);
    });
    return bank;
  }

  function dedupeByUid(bank) {
    const out = [];
    const seen = new Set();
    for (const q of bank) {
      const uid = q?.uid;
      if (!uid) continue;
      if (seen.has(uid)) continue;
      seen.add(uid);
      out.push(q);
    }
    return out;
  }

  function calcStats(bank) {
    const total = bank.length;
    const uidSet = new Set(bank.map(q => q.uid));
    const uniqueUid = uidSet.size;

    const perSub = {};
    SUBJECTS.forEach(s => {
      const arr = bank.filter(q => q.sub === s);
      const u = new Set(arr.map(q => q.uid)).size;
      perSub[s] = { total: arr.length, unique: u };
    });

    const perGroup = {};
    for (const q of bank) {
      const g = q.patternGroup || q.pattern || "p";
      if (!perGroup[g]) perGroup[g] = 0;
      perGroup[g]++;
    }

    return { total, uniqueUid, perSub, perGroup };
  }

  function logStats(tag, bank) {
    const st = calcStats(bank);
    console.log(`[BANK] ${tag} total: ${st.total} unique(uid): ${st.uniqueUid}`);
    console.table(
      SUBJECTS.map(s => ({
        sub: s,
        total: st.perSub[s].total,
        unique: st.perSub[s].unique,
      }))
    );

    // patternGroup 上位
    const topGroups = Object.entries(st.perGroup)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([g, n]) => ({ patternGroup: g, n }));

    console.table(topGroups);
  }

  /* ========= 固定問題（最小サンプル） ========= */
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
      { subj: "Tom", base: "have", third: "has", tail: "a dog" },
      { subj: "My sister", base: "do", third: "does", tail: "her homework" },
    ];
    const past = [
      { subj: "I", base: "go", past: "went", tail: "to the park" },
      { subj: "We", base: "eat", past: "ate", tail: "lunch" },
      { subj: "They", base: "see", past: "saw", tail: "a movie" },
      { subj: "I", base: "buy", past: "bought", tail: "a book" },
      { subj: "She", base: "take", past: "took", tail: "a picture" },
      { subj: "He", base: "make", past: "made", tail: "a cake" },
    ];
    const preps = [
      { correct: "at", hint: "7 o'clock", exp: "時刻は at" },
      { correct: "on", hint: "Sunday", exp: "曜日は on" },
      { correct: "in", hint: "April", exp: "月は in" },
      { correct: "in", hint: "Japan", exp: "国は in" },
      { correct: "at", hint: "school", exp: "地点（学校）は at" },
      { correct: "on", hint: "the desk", exp: "接している面は on" },
    ];
    const comps = [
      { base: "tall", comp: "taller", diff: "標準" },
      { base: "fast", comp: "faster", diff: "標準" },
      { base: "easy", comp: "easier", diff: "標準" },
      { base: "interesting", comp: "more interesting", diff: "発展" },
      { base: "beautiful", comp: "more beautiful", diff: "発展" },
      { base: "important", comp: "more important", diff: "発展" },
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
      { sent: "I was tired, so I went to bed early.", ask: "so の意味は？", correct: "だから", wrongs: ["しかし", "もし", "そして", "たとえば", "そのため"], exp: "so は原因→結果の「だから」。" },
      { sent: "I studied hard, but I couldn't solve the problem.", ask: "but の意味は？", correct: "しかし", wrongs: ["だから", "もし", "そして", "そのため", "なぜなら"], exp: "but は逆接「しかし」。" },
      { sent: "I stayed home because it was raining.", ask: "because の意味は？", correct: "〜なので（なぜなら）", wrongs: ["しかし", "もし", "そして", "だから", "そのため"], exp: "because は理由「〜なので」。" },
      { sent: "I was sick, so I didn't go to school.", ask: "didn't は何を表す？", correct: "否定（〜しなかった）", wrongs: ["疑問", "命令", "未来", "比較", "可能"], exp: "didn't は過去の否定。" },
      { sent: "I will call you if I have time.", ask: "if の意味は？", correct: "もし〜なら", wrongs: ["だから", "しかし", "そして", "なぜなら", "〜の間"], exp: "if は条件「もし〜なら」。" },
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

  /* ========= 国語：語彙/反対語/慣用句（テンプレ分割） ========= */
  function genJapaneseVocab(n) {
    const out = [];

    // 語彙（意味）: ja_vocab
    const vocab = [
      ["適切", "状況や目的に合っている", ["無関係", "偶然", "不可能", "反対の意味"]],
      ["抽象", "形がなく概念的なこと", ["具体", "部分", "偶然", "単純"]],
      ["根拠", "理由やよりどころ", ["結論", "感想", "例外", "余談"]],
      ["簡潔", "むだがなく短いこと", ["複雑", "曖昧", "冗長", "強引"]],
      ["顕著", "目立ってはっきりしている", ["平凡", "微妙", "不明瞭", "短時間"]],
      ["慎重", "注意深く行うこと", ["軽率", "大胆", "乱暴", "無関心"]],
      ["要旨", "文章の中心となる内容", ["感想", "余談", "結末", "例外"]],
      ["主張", "自分の意見として強く述べること", ["例示", "対比", "説明", "装飾"]],
      ["妥当", "適切で無理がないこと", ["不当", "過剰", "希少", "危険"]],
      ["漠然", "はっきりしないさま", ["明確", "具体", "詳細", "確実"]],
      ["促進", "進みを早めること", ["停止", "後退", "抑制", "散漫"]],
      ["抑制", "勢いをおさえること", ["促進", "増大", "解放", "拡散"]],
      ["従来", "これまでどおり", ["将来", "例外", "偶然", "途中"]],
      ["急務", "急いで取り組む必要があること", ["余裕", "平常", "趣味", "延期"]],
      ["客観", "個人の感情に左右されない見方", ["主観", "先入観", "偏見", "思い込み"]],
      ["先入観", "前もって持つ固定的な考え", ["根拠", "客観", "事実", "結論"]],
      ["提案", "考えを出して示すこと", ["反論", "拒否", "放棄", "隠蔽"]],
      ["検討", "よく考えて調べること", ["即決", "放置", "軽視", "断念"]],
      ["把握", "内容をしっかり理解すること", ["誤解", "軽視", "回避", "転換"]],
      ["推測", "はっきりしないことを考えて当てること", ["断定", "確認", "拒否", "公表"]],
      ["継続", "続けて行うこと", ["中断", "停止", "放棄", "解散"]],
      ["顧みる", "ふり返って考える", ["進める", "忘れる", "隠す", "崩す"]],
      ["阻害", "じゃまをして進まないようにすること", ["促進", "援助", "承認", "拡大"]],
      ["改善", "悪い点をよくすること", ["悪化", "固定", "停止", "縮小"]],
      ["対処", "問題に対応して処理すること", ["回避", "放置", "反省", "転換"]],
      ["影響", "他に及ぼす働き", ["原因", "結果", "要因", "目的"]],
      ["要因", "原因となる要素", ["結果", "結論", "前提", "偶然"]],
      ["背景", "出来事のうしろにある事情", ["表面", "結末", "仮定", "例外"]],
      ["顕在", "表に現れていること", ["潜在", "隠蔽", "抑制", "停滞"]],
      ["潜在", "表に現れていないが内にあること", ["顕在", "公開", "確定", "完成"]],
      ["端的", "要点をつかんで簡潔なさま", ["冗長", "曖昧", "複雑", "迂回"]],
      ["緩和", "厳しさをやわらげること", ["強化", "悪化", "固定", "停止"]],
      ["強調", "特に目立たせること", ["軽視", "無視", "否定", "省略"]],
      ["相違", "違い", ["同一", "一致", "同様", "類似"]],
      ["類似", "よく似ていること", ["相違", "対立", "無関係", "例外"]],
      ["妨げる", "じゃまをして進ませない", ["助ける", "進める", "増やす", "褒める"]],
      ["模索", "さがし求めること", ["断念", "確定", "放置", "否定"]],
      ["傾向", "そうなりやすい流れ", ["反発", "停止", "例外", "誤解"]],
      ["前提", "物事の成り立ちの土台", ["結論", "結果", "装飾", "余談"]],
      ["妥協", "互いにゆずり合って折り合う", ["対立", "強行", "断絶", "排除"]],
      ["堅実", "確実で手堅いさま", ["軽率", "曖昧", "過激", "不明"]],
      ["稀少", "めったにないこと", ["一般", "平凡", "頻繁", "通常"]],
      ["迅速", "すばやいこと", ["遅延", "停滞", "緩慢", "後退"]],
      ["緻密", "細かいところまで行き届くこと", ["大雑把", "粗雑", "単純", "曖昧"]],
      ["概略", "おおまかな内容", ["詳細", "本質", "結論", "余談"]],
      ["本質", "物事の中心的な性質", ["表面", "装飾", "例外", "偶然"]],
      ["懸念", "気にかかって心配すること", ["安心", "確信", "確定", "祝福"]],
      ["妨害", "じゃまをして邪魔すること", ["支援", "促進", "提案", "承認"]],
      ["整合", "つじつまが合うこと", ["矛盾", "相違", "混乱", "例外"]],
      ["矛盾", "つじつまが合わないこと", ["整合", "一致", "承認", "肯定"]],
      ["逸脱", "本筋から外れること", ["順守", "維持", "一致", "整合"]],
      ["順守", "決まりを守ること", ["逸脱", "放棄", "軽視", "反発"]],
      ["妥結", "話し合いでまとまること", ["決裂", "対立", "延期", "拒否"]],
      ["決裂", "話し合いがまとまらないこと", ["妥結", "合意", "承認", "一致"]],
    ];

    // 反対語: ja_antonym
    const antonym = [
      ["拡大", "縮小", ["強化", "改善", "整合"]],
      ["増加", "減少", ["継続", "強調", "顕在"]],
      ["肯定", "否定", ["推測", "提案", "対処"]],
      ["公開", "非公開", ["従来", "一般", "平凡"]],
      ["上昇", "下降", ["緩和", "顕著", "端的"]],
      ["開始", "終了", ["継続", "促進", "強調"]],
      ["得意", "不得意", ["迅速", "堅実", "緻密"]],
      ["有利", "不利", ["重要", "迅速", "適切"]],
      ["安全", "危険", ["稀少", "一般", "平凡"]],
      ["具体", "抽象", ["詳細", "概略", "本質"]],
      ["緊張", "緩和", ["迅速", "堅実", "慎重"]],
      ["一致", "相違", ["整合", "矛盾", "類似"]],
    ];

    // 慣用句: ja_idiom
    const idiom = [
      ["目を通す", "ざっと読む", ["じっと見る", "目をそらす", "詳細に暗記する"]],
      ["手を打つ", "対策をする", ["手を洗う", "手を抜く", "手を貸す"]],
      ["腰を据える", "落ち着いて取り組む", ["急いで終える", "あきらめる", "勢いで進める"]],
      ["口を挟む", "会話に割り込む", ["黙り込む", "話をまとめる", "助言を求める"]],
      ["頭が上がらない", "相手に恩義があり逆らえない", ["偉そうにする", "自由に振る舞う", "相手を見下す"]],
      ["二の足を踏む", "ためらう", ["突き進む", "決断する", "先回りする"]],
      ["肩を並べる", "同じ程度に達する", ["引き離す", "見下ろす", "退く"]],
      ["気が引ける", "遠慮してしまう", ["得意になる", "怒り出す", "開き直る"]],
      ["後を絶たない", "次々に続いてなくならない", ["完全になくなる", "一度で終わる", "急に増える"]],
      ["見当がつく", "だいたい想像できる", ["全く分からない", "決めつける", "証明する"]],
    ];

    for (let i = 0; i < n; i++) {
      const kind = i % 3;

      if (kind === 0) {
        const it = pick(vocab, i);
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

      if (kind === 1) {
        const it = pick(antonym, i);
        const word = it[0], correct = it[1], wrongs = it[2];
        const { c, a } = force4Unique(correct, wrongs, i, ["逆の意味", "似た意味"]);
        out.push({
          sub: "国語",
          level: "中",
          diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_antonym",
          q: `「${word}」の反対の意味として最も適切なものは？`,
          c,
          a,
          exp: `「${word}」の反対は「${correct}」。`,
        });
      }

      if (kind === 2) {
        const it = pick(idiom, i);
        const phrase = it[0], correct = it[1], wrongs = it[2];
        const { c, a } = force4Unique(correct, wrongs, i, ["比ゆ的な意味", "決まり文句"]);
        out.push({
          sub: "国語",
          level: "中",
          diff: "標準",
          pattern: "vocab",
          patternGroup: "ja_idiom",
          q: `慣用句「${phrase}」の意味として最も近いものは？`,
          c,
          a,
          exp: `「${phrase}」は「${correct}」の意味。`,
        });
      }
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
      { q: "衆議院が優先されるしくみ（予算など）は？", correct: "衆議院の優越", wrongs: ["三権分立", "議院内閣制", "地方自治"] },
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

    // 生成
    bank.push(...genEnglishGrammar(220));
    bank.push(...genEnglishReading(140));
    bank.push(...genJapaneseVocab(500));     // 重要：国語を増量（テンプレ複数化）
    bank.push(...genMathLinear(240));
    bank.push(...genScienceCalc(240));
    bank.push(...genSocialTime(180));
    bank.push(...genSocialCivics(180));

    bank = attachMeta(bank).filter(validateQuestion);

    // まず現状ログ（重複水増しありの状態）
    logStats("raw(before dedupe)", bank);

    // uid重複を落として“実態”にする（安全装置）
    bank = dedupeByUid(bank);

    // 重複除去後のログ（あなたの計測ログがここで再現されるはず）
    logStats("deduped(uid)", bank);

    // ここから「ユニーク不足」を検知し、増える教科だけtopUpを試みる
    // ただし、素材が少ない教科（国語など）は増えないので、増えないこと自体をログで出す
    const uniqueCountSub = (sub, arr) => new Set(arr.filter(q => q.sub === sub).map(q => q.uid)).size;

    function genMoreForSub(sub, n) {
      if (sub === "英語") return genEnglishGrammar(Math.floor(n * 0.7)).concat(genEnglishReading(Math.ceil(n * 0.3)));
      if (sub === "国語") return genJapaneseVocab(n);
      if (sub === "数学") return genMathLinear(n);
      if (sub === "理科") return genScienceCalc(n);
      if (sub === "社会") return genSocialTime(Math.floor(n * 0.5)).concat(genSocialCivics(Math.ceil(n * 0.5)));
      return [];
    }

    function topUpUnique(sub) {
      let before = uniqueCountSub(sub, bank);
      if (before >= MIN_UNIQUE_PER_SUBJECT) return;

      let rounds = 0;
      while (rounds < TOPUP_ROUNDS) {
        const need = Math.max(0, MIN_UNIQUE_PER_SUBJECT - before);
        const batch = Math.max(80, need * 3); // ユニーク増は間引かれるので多めに生成
        let more = genMoreForSub(sub, batch);
        more = attachMeta(more).filter(validateQuestion);

        const merged = bank.concat(more);
        const ded = dedupeByUid(merged);

        const after = uniqueCountSub(sub, ded);
        const gained = after - before;

        bank = ded;
        before = after;
        rounds++;

        console.log(`[BANK topUpUnique] ${sub} round=${rounds} unique=${after} (gained +${gained})`);

        if (gained <= 0) {
          console.warn(`[BANK topUpUnique] ${sub} did NOT gain unique uids. Likely素材不足（テンプレ素材を増やす必要）`);
          break;
        }
        if (before >= MIN_UNIQUE_PER_SUBJECT) break;
      }
    }

    SUBJECTS.forEach(topUpUnique);

    // 最終ログ：この時点で「どの教科が足りないか」が確定して見える
    logStats(`final(minUnique=${MIN_UNIQUE_PER_SUBJECT})`, bank);

    const uniqSubs = [...new Set(bank.map((x) => x.sub))];
    if (uniqSubs.length < 3) {
      console.warn("[BANK] subjects seem abnormal:", uniqSubs);
    }

    return bank;
  }

  window.BANK = buildBank();
})();
