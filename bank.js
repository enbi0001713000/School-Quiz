/* bank.js（コピペ用・全文）
 * 目的：
 * - 小〜中（義務教育）5教科の問題バンク生成（各教科500問規模をテンプレ生成で実現）
 * - 難易度比率：基礎2割 / 標準5割 / 発展3割（教科ごと）
 * - タグ：level（小/中）・diff（基礎/標準/発展）・pattern（出題タイプ）
 * - 選択肢の質改善：重複排除、誤答バリエーション、ダミー補填
 *
 * app.js からは window.SchoolQuizBank.buildAll(500) の形式で呼ばれます。
 */

(() => {
  "use strict";

  // ===== RNG utilities =====
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function ri(a, b, rng) {
    return a + Math.floor(rng() * (b - a + 1));
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // ===== Question constructor (improved choices) =====
  function makeMCQ({ key, sub, level, diff, pattern, q, correct, wrongs, exp }, rng) {
    // 4択：重複排除＋誤答バリエーション＋足りない場合の補填
    const seen = new Set();
    const opts = [];

    function add(x) {
      const v = String(x);
      if (!v) return;
      if (seen.has(v)) return;
      seen.add(v);
      opts.push(v);
    }

    add(correct);
    for (const w of wrongs || []) add(w);

    // 補填（“見た目”を割って、同型の誤答が並び過ぎるのを防ぐ）
    const fillers = {
      国語: ["どれも当てはまらない", "文脈による", "表現として不自然"],
      数学: ["上のどれでもない", "条件が足りない", "計算手順が誤り"],
      英語: ["いずれでもない", "文脈による", "語順が不適切"],
      理科: ["変化しない", "条件によって異なる", "別の要因が必要"],
      社会: ["時代が違う", "地域が違う", "用語が不適切"],
    };

    while (opts.length < 4) {
      const f = fillers[sub] || ["上のどれでもない"];
      add(f[Math.floor(rng() * f.length)]);
    }

    // 4個に固定（正解が消えないようにする）
    let options = opts.slice(0, 4);
    if (!options.includes(String(correct))) options[0] = String(correct);

    // シャッフル
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const a = options.indexOf(String(correct));

    return { key, sub, level, diff, pattern, q, c: options, a, exp };
  }

  // ===== Difficulty plan =====
  function diffCounts(n) {
    // 基礎2割 / 標準5割 / 発展3割
    const b = Math.round(n * 0.2);
    const s = Math.round(n * 0.5);
    const a = Math.max(0, n - b - s);
    return { 基礎: b, 標準: s, 発展: a };
  }

  // ===== Fixed knowledge pools (dense) =====
  // ※ここは「知識問題の密度」を上げるための固定データ（必要に応じて増やせます）
  const JP_VOCAB = [
    // {w, m, ds:[...]}  ※ds=誤答
    { w: "端的", m: "要点をついていて簡潔なさま", ds: ["回りくどいさま", "派手で目立つさま", "時間がかかるさま"] },
    { w: "妥当", m: "適切で筋が通っていること", ds: ["無関係であること", "無理があること", "気まぐれであること"] },
    { w: "措置", m: "状況に応じて取る手だて", ds: ["誤りを認めること", "強く反対すること", "問題を放置すること"] },
    { w: "漠然", m: "はっきりしないさま", ds: ["具体的なさま", "確実なさま", "正確なさま"] },
    { w: "顕著", m: "はっきり目立つさま", ds: ["分かりにくいさま", "変化がないさま", "偶然のさま"] },
    { w: "緩和", m: "厳しさ・程度をやわらげること", ds: ["悪化させること", "固定すること", "禁止すること"] },
    { w: "概ね", m: "だいたい", ds: ["必ず", "決して", "突然"] },
    { w: "必然", m: "そうならざるを得ないこと", ds: ["偶然", "気まぐれ", "誤解"] },
    { w: "精査", m: "細かく調べること", ds: ["大まかに見ること", "捨てること", "隠すこと"] },
    { w: "喚起", m: "注意や意識を呼び起こすこと", ds: ["同意を取り消すこと", "反対を集めること", "情報を削除すること"] },
    { w: "憂慮", m: "心配すること", ds: ["安心すること", "喜ぶこと", "怒ること"] },
    { w: "踏襲", m: "前のやり方をそのまま受け継ぐこと", ds: ["全面的に否定すること", "勝手に変えること", "やめてしまうこと"] },
    { w: "逸脱", m: "決められた範囲から外れること", ds: ["範囲内に収まること", "増やすこと", "整えること"] },
    { w: "収斂", m: "まとまって一つに近づくこと", ds: ["ばらばらに広がること", "取り消すこと", "急に止めること"] },
    { w: "同様", m: "同じようすであること", ds: ["正反対であること", "偶然であること", "疑わしいこと"] },
    { w: "優先", m: "他より先にすること", ds: ["後回しにすること", "無視すること", "禁止すること"] },
    { w: "対処", m: "問題に応じて処理すること", ds: ["放置すること", "責任転嫁すること", "拡大すること"] },
    { w: "反映", m: "あることが結果に現れること", ds: ["無関係であること", "隠れること", "消えること"] },
    { w: "乖離", m: "かけ離れること", ds: ["一致すること", "増えること", "保存すること"] },
    { w: "把握", m: "状況をつかむこと", ds: ["無視すること", "捨てること", "曖昧にすること"] },
  ];

  const JP_KANJI = [
    { k: "継続", r: "けいぞく", ds: ["けいぞう", "けいそく", "けいぞくう"] },
    { k: "抑制", r: "よくせい", ds: ["よくさい", "よくぜい", "よくせ"] },
    { k: "施策", r: "しさく", ds: ["しさつ", "せさく", "ししゃく"] },
    { k: "基盤", r: "きばん", ds: ["きはん", "きばんう", "きばんん"] },
    { k: "抽象", r: "ちゅうしょう", ds: ["ちゅうぞう", "ちゅうしょうう", "ちゅしょう"] },
    { k: "妥協", r: "だきょう", ds: ["だきゅう", "たきょう", "だきょ"] },
    { k: "促進", r: "そくしん", ds: ["しょくしん", "そくじん", "そっしん"] },
    { k: "確保", r: "かくほ", ds: ["かくぽ", "かっこ", "かくぼ"] },
    { k: "顧客", r: "こきゃく", ds: ["こかく", "ここく", "こきゃ"] },
    { k: "緻密", r: "ちみつ", ds: ["ちみち", "ちみっ", "ちびつ"] },
  ];

  const EN_VOCAB = [
    { w: "increase", m: "増やす", ds: ["減らす", "失う", "止める"] },
    { w: "provide", m: "提供する", ds: ["拒否する", "盗む", "壊す"] },
    { w: "prevent", m: "防ぐ", ds: ["促進する", "集める", "褒める"] },
    { w: "include", m: "含む", ds: ["除外する", "隠す", "止める"] },
    { w: "describe", m: "説明する", ds: ["誤解する", "破壊する", "縮める"] },
    { w: "improve", m: "改善する", ds: ["悪化させる", "放置する", "分解する"] },
    { w: "reduce", m: "減らす", ds: ["増やす", "続ける", "作る"] },
    { w: "continue", m: "続ける", ds: ["始める", "止める", "忘れる"] },
    { w: "require", m: "必要とする", ds: ["提供する", "減らす", "祝う"] },
    { w: "consider", m: "考慮する", ds: ["無視する", "壊す", "運ぶ"] },
  ];

  const EN_GRAMMAR = [
    { q: "He (  ) to school every day.", a: "goes", ds: ["go", "going", "gone"], exp: "三単現のs：He goes." },
    { q: "I have (  ) this book before.", a: "read", ds: ["reads", "reading", "to read"], exp: "have + 過去分詞：have read." },
    { q: "She is (  ) than me.", a: "taller", ds: ["tall", "tallest", "more tall"], exp: "比較級：taller." },
    { q: "They (  ) playing soccer now.", a: "are", ds: ["is", "was", "be"], exp: "現在進行形：They are playing." },
    { q: "If it (  ), we will stay home.", a: "rains", ds: ["rain", "rained", "is raining"], exp: "条件節は現在形：If it rains..." },
  ];

  const SCI_FIXED = [
    { q: "光が空気中から水中へ入るとき、一般にどうなる？", a: "屈折する", ds: ["反射だけする", "必ず消える", "温度が上がる"], exp: "媒質が変わると屈折が起こりやすい。" , diff:"基礎", level:"小", pattern:"light"},
    { q: "植物が光を利用してでんぷんなどをつくるはたらきは？", a: "光合成", ds: ["呼吸", "蒸散", "消化"], exp: "光合成で二酸化炭素と水から養分をつくる。", diff:"基礎", level:"小", pattern:"bio"},
    { q: "水を電気分解すると、主に何と何に分かれる？", a: "水素と酸素", ds: ["窒素と酸素", "二酸化炭素と水素", "塩素と水素"], exp: "H2O → H2 と O2。", diff:"標準", level:"中", pattern:"chem"},
    { q: "電流の大きさを表す単位は？", a: "アンペア(A)", ds: ["ボルト(V)", "ワット(W)", "オーム(Ω)"], exp: "電流A、電圧V、抵抗Ω。", diff:"基礎", level:"中", pattern:"electric"},
    { q: "地球の自転によって起こる現象として正しいのは？", a: "昼と夜が生じる", ds: ["季節が生じる", "月の満ち欠け", "潮の満ち引き"], exp: "季節は公転＋地軸の傾き。", diff:"基礎", level:"小", pattern:"earth"},
    { q: "音の大きさは主に何の大きさで決まる？", a: "振幅", ds: ["周波数", "波長", "速さ"], exp: "振幅が大きいほど音は大きい。", diff:"標準", level:"中", pattern:"wave"},
    { q: "密度の式として正しいのは？", a: "密度=質量÷体積", ds: ["密度=体積÷質量", "密度=質量×体積", "密度=質量−体積"], exp: "ρ=m/V。", diff:"標準", level:"中", pattern:"density"},
    { q: "火山灰が固まってできる岩石として適切なのは？", a: "凝灰岩", ds: ["花こう岩", "玄武岩", "石灰岩"], exp: "凝灰岩は火山灰などが固結。", diff:"発展", level:"中", pattern:"geo"},
    { q: "てこの原理で、支点からの距離が2倍なら必要な力は？", a: "半分になる", ds: ["2倍になる", "変わらない", "4倍になる"], exp: "モーメント＝力×距離。", diff:"標準", level:"小", pattern:"lever"},
    { q: "遺伝で、両親から受け継ぐ形質を決める要素は？", a: "遺伝子", ds: ["細胞壁", "血しょう", "葉緑体"], exp: "遺伝子が形質の情報をもつ。", diff:"発展", level:"中", pattern:"genetics"},
  ];

  const SOC_FIXED = [
    { q: "日本の国会は何から成る？", a: "衆議院と参議院", ds: ["内閣と裁判所", "都道府県と市町村", "総理と大臣"], exp: "国会は二院制。", diff:"基礎", level:"小", pattern:"civics"},
    { q: "三権分立の三権に含まれないのは？", a: "報道", ds: ["立法", "行政", "司法"], exp: "立法・行政・司法が三権。", diff:"標準", level:"中", pattern:"civics"},
    { q: "日本の最高裁判所が行うのは？", a: "違憲審査", ds: ["法律の制定", "予算の編成", "条約の締結"], exp: "最高裁は違憲審査権をもつ。", diff:"標準", level:"中", pattern:"civics"},
    { q: "米作がさかんな新潟県が属する地方は？", a: "中部地方", ds: ["東北地方", "関東地方", "近畿地方"], exp: "新潟は中部（北陸）。", diff:"基礎", level:"小", pattern:"geo"},
    { q: "江戸幕府を開いた人物は？", a: "徳川家康", ds: ["織田信長", "豊臣秀吉", "源頼朝"], exp: "1603年に家康が征夷大将軍。", diff:"基礎", level:"小", pattern:"history"},
    { q: "明治時代の身分制度の廃止として正しいのは？", a: "四民平等", ds: ["鎖国", "楽市楽座", "班田収授法"], exp: "身分差を制度上なくした。", diff:"標準", level:"中", pattern:"history"},
    { q: "円高になると、一般に起こりやすいのは？", a: "輸入品が安くなる", ds: ["輸入品が高くなる", "海外旅行が高くなる", "外国通貨が安くなる"], exp: "円の価値が上がると輸入が有利。", diff:"発展", level:"中", pattern:"economy"},
    { q: "地方自治で、住民が条例の制定を請求できる権利は？", a: "直接請求", ds: ["請願権", "参政権", "団体自治"], exp: "住民による直接請求制度。", diff:"発展", level:"中", pattern:"civics"},
    { q: "世界の三大宗教に含まれないのは？", a: "神道", ds: ["キリスト教", "イスラム教", "仏教"], exp: "三大宗教はキリスト・イスラム・仏教。", diff:"標準", level:"中", pattern:"culture"},
    { q: "地図で等高線が密なところは一般に？", a: "傾斜が急", ds: ["傾斜が緩", "海面より低い", "必ず平地"], exp: "等高線が詰むほど急。", diff:"基礎", level:"小", pattern:"geo"},
  ];

  // ===== Generators =====

  function genJapanese(rng, countByDiff) {
    const out = [];

    // 固定：語彙（意味）
    const vocabPool = shuffle(JP_VOCAB, rng);
    let idx = 0;

    function pushVocab(diff, level) {
      const x = vocabPool[idx % vocabPool.length];
      idx++;
      out.push(
        makeMCQ(
          {
            key: `JP_vocab_${diff}_${level}_${x.w}_${idx}`,
            sub: "国語",
            level,
            diff,
            pattern: "vocab",
            q: `「${x.w}」の意味として最も適切なのは？`,
            correct: x.m,
            wrongs: x.ds,
            exp: `「${x.w}」＝${x.m}。`,
          },
          rng
        )
      );
    }

    // 固定：漢字読み
    const kanjiPool = shuffle(JP_KANJI, rng);
    let kidx = 0;

    function pushKanji(diff, level) {
      const x = kanjiPool[kidx % kanjiPool.length];
      kidx++;
      out.push(
        makeMCQ(
          {
            key: `JP_kanji_${diff}_${level}_${x.k}_${kidx}`,
            sub: "国語",
            level,
            diff,
            pattern: "kanji",
            q: `「${x.k}」の読みとして正しいのは？`,
            correct: x.r,
            wrongs: x.ds,
            exp: `「${x.k}」は「${x.r}」。`,
          },
          rng
        )
      );
    }

    // テンプレ：ことわざ/慣用句
    const idioms = [
      { q: "「石の上にも三年」が表す意味は？", a: "辛抱強く続ければ成果が出る", ds: ["すぐ諦めた方がよい", "石は必ず壊れる", "三年は短い"] },
      { q: "「足が出る」の意味は？", a: "予算を超える", ds: ["走るのが速い", "足が長い", "外出する"] },
      { q: "「目を通す」の意味は？", a: "ざっと読む", ds: ["目を閉じる", "暗記する", "破って捨てる"] },
      { q: "「腹を割る」の意味は？", a: "本音で話す", ds: ["食事をする", "怒って黙る", "勝負をする"] },
    ];

    function pushIdiom(diff, level, i) {
      const x = idioms[i % idioms.length];
      out.push(
        makeMCQ(
          {
            key: `JP_idiom_${diff}_${level}_${i}`,
            sub: "国語",
            level,
            diff,
            pattern: "idiom",
            q: x.q,
            correct: x.a,
            wrongs: x.ds,
            exp: x.a + "（慣用句/ことわざの意味）",
          },
          rng
        )
      );
    }

    // 配分に沿って生成
    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    for (let i = 0; i < countByDiff["基礎"]; i++) {
      const level = i % 2 === 0 ? "小" : "中";
      if (i % 3 === 0) pushKanji("基礎", level);
      else pushVocab("基礎", level);
    }
    for (let i = 0; i < countByDiff["標準"]; i++) {
      const level = i % 3 === 0 ? "小" : "中";
      if (i % 4 === 0) pushIdiom("標準", level, i);
      else if (i % 2 === 0) pushKanji("標準", level);
      else pushVocab("標準", level);
    }
    for (let i = 0; i < countByDiff["発展"]; i++) {
      const level = "中";
      if (i % 3 === 0) pushIdiom("発展", level, i + 10);
      else if (i % 2 === 0) pushKanji("発展", level);
      else pushVocab("発展", level);
    }

    // 念のため、過不足が出たらトリム
    return out.slice(0, total);
  }

  function genEnglish(rng, countByDiff) {
    const out = [];
    const vocabPool = shuffle(EN_VOCAB, rng);
    let vidx = 0;

    function pushVocab(diff, level) {
      const x = vocabPool[vidx % vocabPool.length];
      vidx++;
      out.push(
        makeMCQ(
          {
            key: `EN_vocab_${diff}_${level}_${x.w}_${vidx}`,
            sub: "英語",
            level,
            diff,
            pattern: "vocab",
            q: `「${x.w}」の意味として正しいのは？`,
            correct: x.m,
            wrongs: x.ds,
            exp: `${x.w}＝${x.m}。`,
          },
          rng
        )
      );
    }

    // 固定：文法穴埋め
    const gramPool = shuffle(EN_GRAMMAR, rng);
    let gidx = 0;

    function pushGrammar(diff, level) {
      const x = gramPool[gidx % gramPool.length];
      gidx++;
      out.push(
        makeMCQ(
          {
            key: `EN_gram_${diff}_${level}_${gidx}`,
            sub: "英語",
            level,
            diff,
            pattern: "grammar",
            q: x.q.replace("(  )", "(    )"),
            correct: x.a,
            wrongs: x.ds,
            exp: x.exp,
          },
          rng
        )
      );
    }

    // テンプレ：並べ替え（簡易）
    const reorder = [
      { words: ["I", "am", "from", "Japan"], a: "I am from Japan.", exp: "主語+be+from+場所。" },
      { words: ["She", "likes", "to", "read"], a: "She likes to read.", exp: "三単現 likes。" },
      { words: ["They", "are", "playing", "tennis"], a: "They are playing tennis.", exp: "進行形。" },
      { words: ["Do", "you", "have", "time"], a: "Do you have time?", exp: "疑問文：Do+主語+動詞。" },
    ];

    function pushReorder(diff, level, i) {
      const x = reorder[i % reorder.length];
      const correct = x.a;
      const wrongs = [
        x.words.slice().reverse().join(" ") + ".",
        x.words.join(" ") + ".", // スペースのみのやつ（見た目を割るため）
        " ".concat(x.words.join(" ")).trim(), // 句点なし
      ];
      out.push(
        makeMCQ(
          {
            key: `EN_reorder_${diff}_${level}_${i}`,
            sub: "英語",
            level,
            diff,
            pattern: "reorder",
            q: `次の語を並べ替えて文を完成させなさい：${x.words.join(" / ")}`,
            correct,
            wrongs,
            exp: x.exp,
          },
          rng
        )
      );
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    for (let i = 0; i < countByDiff["基礎"]; i++) {
      const level = "小";
      if (i % 2 === 0) pushVocab("基礎", level);
      else pushGrammar("基礎", level);
    }
    for (let i = 0; i < countByDiff["標準"]; i++) {
      const level = i % 3 === 0 ? "小" : "中";
      if (i % 4 === 0) pushReorder("標準", level, i);
      else if (i % 2 === 0) pushGrammar("標準", level);
      else pushVocab("標準", level);
    }
    for (let i = 0; i < countByDiff["発展"]; i++) {
      const level = "中";
      if (i % 3 === 0) pushReorder("発展", level, i + 10);
      else pushGrammar("発展", level);
    }

    return out.slice(0, total);
  }

  function genScience(rng, countByDiff) {
    const out = [];
    const fixed = shuffle(SCI_FIXED, rng).map((x, i) => {
      return makeMCQ(
        {
          key: `SC_fixed_${x.diff}_${x.level}_${x.pattern}_${i}`,
          sub: "理科",
          level: x.level,
          diff: x.diff,
          pattern: x.pattern,
          q: x.q,
          correct: x.a,
          wrongs: x.ds,
          exp: x.exp,
        },
        rng
      );
    });

    // テンプレ（追加）：基礎〜発展の知識密度を上げる
    function pushTemplate(diff, level, i) {
      const t = i % 6;

      if (t === 0) {
        // 天体：月の満ち欠け
        out.push(
          makeMCQ(
            {
              key: `SC_moon_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "earth",
              q: "月が満ち欠けして見える主な理由は？",
              correct: "太陽光の当たる部分が変わるから",
              wrongs: ["月が自ら光るから", "地球が光るから", "月の大きさが変わるから"],
              exp: "太陽光で照らされた部分の見え方が変わる。",
            },
            rng
          )
        );
      } else if (t === 1) {
        // 物質：状態変化
        out.push(
          makeMCQ(
            {
              key: `SC_state_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "chem",
              q: "水が液体から気体になる変化は？",
              correct: "蒸発（気化）",
              wrongs: ["凝固", "融解", "凝縮"],
              exp: "液体→気体は蒸発/気化。",
            },
            rng
          )
        );
      } else if (t === 2) {
        // 電気：直列・並列
        out.push(
          makeMCQ(
            {
              key: `SC_circuit_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "electric",
              q: "豆電球を並列につないだときの特徴として正しいのは？",
              correct: "一つが切れても他は点灯しやすい",
              wrongs: ["必ず同じ明るさになる", "電流が流れなくなる", "電圧が0になる"],
              exp: "並列は枝分かれ。片方が切れても別経路が残る。",
            },
            rng
          )
        );
      } else if (t === 3) {
        // 生物：食物連鎖
        out.push(
          makeMCQ(
            {
              key: `SC_foodchain_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "bio",
              q: "生態系で、植物を食べる動物は一般に何と呼ばれる？",
              correct: "一次消費者",
              wrongs: ["生産者", "分解者", "二次消費者"],
              exp: "植物（生産者）→草食（一次消費者）→肉食（二次消費者）。",
            },
            rng
          )
        );
      } else if (t === 4) {
        // 物理：力と運動
        out.push(
          makeMCQ(
            {
              key: `SC_force_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "physics",
              q: "物体に働く力がつり合っているとき、物体の運動はどうなる？",
              correct: "静止するか等速直線運動する",
              wrongs: ["必ず加速する", "必ず減速する", "必ず回転する"],
              exp: "合力が0なら運動状態は変わらない（慣性）。",
            },
            rng
          )
        );
      } else {
        // 地学：火成岩
        out.push(
          makeMCQ(
            {
              key: `SC_rock_${diff}_${level}_${i}`,
              sub: "理科",
              level,
              diff,
              pattern: "geo",
              q: "マグマが地下深くで冷えて固まった岩石は？",
              correct: "深成岩",
              wrongs: ["火山岩", "堆積岩", "変成岩"],
              exp: "地下でゆっくり冷える→深成岩。",
            },
            rng
          )
        );
      }
    }

    // 固定問題を先に入れて、残りをテンプレで埋める
    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    const want = total;

    // diffごとに固定を割り当て
    const fixedByDiff = { 基礎: [], 標準: [], 発展: [] };
    for (const q of fixed) fixedByDiff[q.diff].push(q);

    for (const diff of ["基礎", "標準", "発展"]) {
      const need = countByDiff[diff];
      const take = fixedByDiff[diff].slice(0, Math.min(need, fixedByDiff[diff].length));
      out.push(...take);

      let remain = need - take.length;
      for (let i = 0; i < remain; i++) {
        const level = diff === "基礎" ? (i % 2 === 0 ? "小" : "中") : "中";
        pushTemplate(diff, level, i + out.length);
      }
    }

    return out.slice(0, want);
  }

  function genSocial(rng, countByDiff) {
    const out = [];
    const fixed = shuffle(SOC_FIXED, rng).map((x, i) => {
      return makeMCQ(
        {
          key: `SO_fixed_${x.diff}_${x.level}_${x.pattern}_${i}`,
          sub: "社会",
          level: x.level,
          diff: x.diff,
          pattern: x.pattern,
          q: x.q,
          correct: x.a,
          wrongs: x.ds,
          exp: x.exp,
        },
        rng
      );
    });

    // テンプレ：歴史・地理・公民・経済の基礎知識
    const eras = [
      { era: "縄文", feat: "狩猟・採集、土器" },
      { era: "弥生", feat: "稲作、金属器" },
      { era: "平安", feat: "貴族文化、かな文字" },
      { era: "鎌倉", feat: "武士政権の成立" },
      { era: "江戸", feat: "幕藩体制、身分制度" },
      { era: "明治", feat: "近代化、文明開化" },
    ];

    const geos = [
      { q: "日本で冬に季節風が強く、雪が多い傾向がある側は？", a: "日本海側", ds: ["太平洋側", "内陸部", "南西諸島"], exp: "冬の季節風が日本海で水蒸気→雪。", diff:"標準", level:"中", pattern:"geo" },
      { q: "赤道付近の気候として一般に正しいのは？", a: "高温で降水量が多い", ds: ["低温で乾燥", "四季の寒暖差が大きい", "一年中雪が多い"], exp: "熱帯：高温多雨。", diff:"基礎", level:"小", pattern:"geo" },
    ];

    function pushTemplate(diff, level, i) {
      const t = i % 7;
      if (t === 0) {
        // 歴史：時代と特徴
        const e = pick(eras, rng);
        out.push(
          makeMCQ(
            {
              key: `SO_hist_${diff}_${level}_${e.era}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "history",
              q: `${e.era}時代の特徴として最も適切なのは？`,
              correct: e.feat,
              wrongs: shuffle(eras.filter(x => x.era !== e.era).map(x => x.feat), rng).slice(0, 3),
              exp: `${e.era}：${e.feat}。`,
            },
            rng
          )
        );
      } else if (t === 1) {
        // 公民：三権
        out.push(
          makeMCQ(
            {
              key: `SO_civics_${diff}_${level}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "civics",
              q: "行政権を担うのはどれ？",
              correct: "内閣",
              wrongs: ["国会", "最高裁判所", "地方議会"],
              exp: "行政＝内閣、立法＝国会、司法＝裁判所。",
            },
            rng
          )
        );
      } else if (t === 2) {
        // 地理：地図記号（簡易）
        out.push(
          makeMCQ(
            {
              key: `SO_map_${diff}_${level}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "geo",
              q: "地図記号の「交番」に最も近い施設は？",
              correct: "警察官が勤務する施設",
              wrongs: ["郵便を扱う施設", "消防活動を行う施設", "市役所の本庁舎"],
              exp: "交番＝警察官が常駐し地域を見守る。",
            },
            rng
          )
        );
      } else if (t === 3) {
        // 経済：需要と供給（超基礎）
        out.push(
          makeMCQ(
            {
              key: `SO_econ_${diff}_${level}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "economy",
              q: "需要が増え、供給が変わらないとき、一般に価格は？",
              correct: "上がりやすい",
              wrongs: ["下がりやすい", "必ず0になる", "変化しない"],
              exp: "需要↑で品薄→価格↑になりやすい。",
            },
            rng
          )
        );
      } else if (t === 4) {
        // 国際：国連
        out.push(
          makeMCQ(
            {
              key: `SO_un_${diff}_${level}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "international",
              q: "国際連合（国連）の目的として最も適切なのは？",
              correct: "国際平和と安全の維持",
              wrongs: ["国内法の制定", "各国の税率統一", "世界共通通貨の発行"],
              exp: "国連は平和維持や国際協力を目的とする。",
            },
            rng
          )
        );
      } else if (t === 5) {
        // 地理：気候（固定追加）
        const g = geos[i % geos.length];
        out.push(
          makeMCQ(
            {
              key: `SO_geo_${diff}_${level}_${i}`,
              sub: "社会",
              level: g.level,
              diff: g.diff,
              pattern: g.pattern,
              q: g.q,
              correct: g.a,
              wrongs: g.ds,
              exp: g.exp,
            },
            rng
          )
        );
      } else {
        // 公民：選挙
        out.push(
          makeMCQ(
            {
              key: `SO_vote_${diff}_${level}_${i}`,
              sub: "社会",
              level,
              diff,
              pattern: "civics",
              q: "選挙で、一人の有権者が持つ票の数は基本的に？",
              correct: "1票",
              wrongs: ["2票", "年齢に比例", "税額に比例"],
              exp: "普通選挙＝基本的に1人1票。",
            },
            rng
          )
        );
      }
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];

    const fixedByDiff = { 基礎: [], 標準: [], 発展: [] };
    for (const q of fixed) fixedByDiff[q.diff].push(q);

    for (const diff of ["基礎", "標準", "発展"]) {
      const need = countByDiff[diff];
      const take = fixedByDiff[diff].slice(0, Math.min(need, fixedByDiff[diff].length));
      out.push(...take);

      let remain = need - take.length;
      for (let i = 0; i < remain; i++) {
        const level = diff === "基礎" ? "小" : "中";
        pushTemplate(diff, level, i + out.length);
      }
    }

    return out.slice(0, total);
  }

  function genMath(rng, countByDiff) {
    const out = [];

    function numDistractors(correct, makers) {
      const w = [];
      for (const fn of makers) w.push(String(fn()));
      if (typeof correct === "number") w.push(String(correct + ri(10, 40, rng))); // 離れ値
      return w;
    }

    // ===== 基礎（小）: 計算＋割合・単位 =====
    for (let i = 0; i < countByDiff["基礎"]; i++) {
      const type = i % 3;

      if (type === 0) {
        const a = ri(12, 99, rng);
        const b = ri(2, 9, rng);
        const op = pick(["+", "-", "×"], rng);
        let correct;
        if (op === "+") correct = a + b;
        if (op === "-") correct = a - b;
        if (op === "×") correct = a * b;

        out.push(
          makeMCQ(
            {
              key: `MA_arith_basic_${op}_${a}_${b}_${i}`,
              sub: "数学",
              level: i % 2 === 0 ? "小" : "中",
              diff: "基礎",
              pattern: "arith",
              q: `${a} ${op} ${b} の答えは？`,
              correct: String(correct),
              wrongs: numDistractors(correct, [
                () => correct + 1,
                () => correct - 1,
                () => correct + b,
                () => correct - b,
              ]),
              exp: `${a} ${op} ${b} = ${correct}`,
            },
            rng
          )
        );
      } else if (type === 1) {
        const base = ri(200, 800, rng);
        const pct = pick([10, 20, 25, 30, 40, 50], rng);
        const correct = Math.round((base * pct) / 100);

        out.push(
          makeMCQ(
            {
              key: `MA_pct_basic_${base}_${pct}_${i}`,
              sub: "数学",
              level: "小",
              diff: "基礎",
              pattern: "percent",
              q: `${base} の ${pct}% はいくつ？`,
              correct: String(correct),
              wrongs: [
                String(base + pct),
                String(pct),
                String(Math.round(base / (pct / 10))),
                String(correct + ri(5, 30, rng)),
              ],
              exp: `${pct}% = ${pct}/100。${base}×${pct}/100 = ${correct}。`,
            },
            rng
          )
        );
      } else {
        const m = ri(2, 9, rng);
        const cm = m * 100;
        out.push(
          makeMCQ(
            {
              key: `MA_unit_basic_${m}_${i}`,
              sub: "数学",
              level: "小",
              diff: "基礎",
              pattern: "unit",
              q: `${m}m は何cm？`,
              correct: String(cm),
              wrongs: [String(m), String(cm / 10), String(cm * 10)],
              exp: `1m=100cm。${m}m=${m}×100=${cm}cm。`,
            },
            rng
          )
        );
      }
    }

    // ===== 標準（中）: 方程式・関数・図形・文章題・統計 =====
    for (let i = 0; i < countByDiff["標準"]; i++) {
      const type = i % 5;

      if (type === 0) {
        const x = ri(1, 15, rng);
        const m = ri(2, 9, rng);
        const k = ri(1, 25, rng);
        const rhs = m * x + k;

        out.push(
          makeMCQ(
            {
              key: `MA_eq_std_${m}_${k}_${rhs}_${i}`,
              sub: "数学",
              level: "中",
              diff: "標準",
              pattern: "equation",
              q: `方程式：${m}x + ${k} = ${rhs} の解 x は？`,
              correct: String(x),
              wrongs: [
                String((rhs + k) / m),
                String((rhs - k) * m),
                String(x + 1),
                String(x - 1),
              ],
              exp: `${m}x=${rhs}-${k}=${m * x} → x=${x}。`,
            },
            rng
          )
        );
      } else if (type === 1) {
        const a = pick([2, 3, 4, 5, -2, -3], rng);
        const x = ri(1, 6, rng);
        const y = a * x;

        out.push(
          makeMCQ(
            {
              key: `MA_func_std_${a}_${x}_${i}`,
              sub: "数学",
              level: "中",
              diff: "標準",
              pattern: "function",
              q: `y=${a}x のとき、x=${x} の y は？`,
              correct: String(y),
              wrongs: [String(a + x), String(a - x), String(-y), String(y + ri(1, 6, rng))],
              exp: `代入して y=${a}×${x}=${y}。`,
            },
            rng
          )
        );
      } else if (type === 2) {
        const b = ri(6, 14, rng);
        const h = ri(4, 12, rng);
        const correct = (b * h) / 2;

        out.push(
          makeMCQ(
            {
              key: `MA_geom_std_tri_${b}_${h}_${i}`,
              sub: "数学",
              level: "中",
              diff: "標準",
              pattern: "geometry",
              q: `底辺${b}cm、高さ${h}cm の三角形の面積は？`,
              correct: String(correct),
              wrongs: [String(b * h), String((b + h) / 2), String(b + h), String(correct + ri(1, 10, rng))],
              exp: `三角形=底辺×高さ÷2=${b}×${h}÷2=${correct}。`,
            },
            rng
          )
        );
      } else if (type === 3) {
        const v = ri(3, 12, rng);
        const t = pick([0.5, 1, 1.5, 2], rng);
        const d = v * t;

        out.push(
          makeMCQ(
            {
              key: `MA_speed_std_${v}_${t}_${i}`,
              sub: "数学",
              level: "中",
              diff: "標準",
              pattern: "word",
              q: `時速${v}kmで${t}時間進むと、道のりは何km？`,
              correct: String(d),
              wrongs: [String(v + t), String(v / t), String(v * 2), String(d + ri(1, 6, rng))],
              exp: `道のり=速さ×時間=${v}×${t}=${d}。`,
            },
            rng
          )
        );
      } else {
        const a = ri(2, 9, rng);
        const b = ri(2, 9, rng);
        const c = ri(2, 9, rng);
        const avg = (a + b + c) / 3;

        out.push(
          makeMCQ(
            {
              key: `MA_stats_std_${a}_${b}_${c}_${i}`,
              sub: "数学",
              level: "中",
              diff: "標準",
              pattern: "stats",
              q: `3つの数 ${a}, ${b}, ${c} の平均は？`,
              correct: String(avg),
              wrongs: [String(a + b + c), String((a + b) / 2), String((a + c) / 2), String(avg + 1)],
              exp: `平均=(合計)÷3=(${a}+${b}+${c})÷3=${avg}。`,
            },
            rng
          )
        );
      }
    }

    // ===== 発展（中）: 連立・二次・不等式・確率・数え上げ =====
    for (let i = 0; i < countByDiff["発展"]; i++) {
      const type = i % 5;

      if (type === 0) {
        const x = ri(1, 8, rng);
        const y = ri(1, 8, rng);
        const A = 2 * x + 3 * y;
        const B = x - y;

        out.push(
          makeMCQ(
            {
              key: `MA_system_adv_${A}_${B}_${i}`,
              sub: "数学",
              level: "中",
              diff: "発展",
              pattern: "system",
              q: `連立方程式：2x+3y=${A}, x-y=${B} の解(x,y)は？`,
              correct: `(${x},${y})`,
              wrongs: [`(${y},${x})`, `(${x + 1},${y})`, `(${x},${y + 1})`, `(${x - 1},${y - 1})`],
              exp: `x-y=${B}よりx=y+${B}。代入して x=${x}, y=${y}。`,
            },
            rng
          )
        );
      } else if (type === 1) {
        const r1 = ri(1, 6, rng);
        const r2 = ri(1, 6, rng);
        const b = -(r1 + r2);
        const c = r1 * r2;

        out.push(
          makeMCQ(
            {
              key: `MA_quad_adv_${b}_${c}_${i}`,
              sub: "数学",
              level: "中",
              diff: "発展",
              pattern: "quadratic",
              q: `方程式：x^2 ${b >= 0 ? "+" : ""}${b}x + ${c} = 0 の解として正しいものは？`,
              correct: `${r1} と ${r2}`,
              wrongs: [`${-r1} と ${-r2}`, `${r1} と ${-r2}`, `${r1 + r2} と ${c}`, `${c} と ${b}`],
              exp: `(x-${r1})(x-${r2})=0より x=${r1}, ${r2}。`,
            },
            rng
          )
        );
      } else if (type === 2) {
        const a = ri(2, 6, rng);
        const b = ri(1, 10, rng);
        const x = ri(1, 8, rng);
        const rhs = a * x + b;

        out.push(
          makeMCQ(
            {
              key: `MA_ineq_adv_${a}_${b}_${rhs}_${i}`,
              sub: "数学",
              level: "中",
              diff: "発展",
              pattern: "inequality",
              q: `不等式：${a}x + ${b} < ${rhs} を満たす整数xのうち、最大は？`,
              correct: String(x - 1),
              wrongs: [String(x), String(x - 2), String(x + 1)],
              exp: `${a}x < ${rhs}-${b}=${a * x} → x<${x}。最大の整数は${x - 1}。`,
            },
            rng
          )
        );
      } else if (type === 3) {
        const red = ri(2, 6, rng);
        const blue = ri(2, 6, rng);
        const total = red + blue;
        const pNum = red * (red - 1);
        const pDen = total * (total - 1);

        out.push(
          makeMCQ(
            {
              key: `MA_prob_adv_${red}_${blue}_${i}`,
              sub: "数学",
              level: "中",
              diff: "発展",
              pattern: "probability",
              q: `赤${red}個、青${blue}個から戻さず2回引く。2回とも赤の確率は？`,
              correct: `${pNum}/${pDen}`,
              wrongs: [
                `${red}/${total}`,
                `${red}/${total}×${red}/${total}`,
                `${red - 1}/${total - 1}`,
                `${red * (red + 1)}/${pDen}`,
              ],
              exp: `1回目:red/${total}、2回目:(red-1)/(total-1)。よって ${pNum}/${pDen}。`,
            },
            rng
          )
        );
      } else {
        const n = pick([4, 5, 6], rng);
        const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
        const correct = fact(n);

        out.push(
          makeMCQ(
            {
              key: `MA_count_adv_${n}_${i}`,
              sub: "数学",
              level: "中",
              diff: "発展",
              pattern: "counting",
              q: `${n}人を1列に並べる並べ方は何通り？`,
              correct: String(correct),
              wrongs: [String(correct / n), String(correct * n), String(n * n), String(n + n)],
              exp: `${n}! = ${correct} 通り。`,
            },
            rng
          )
        );
      }
    }

    return out;
  }

  // ===== Build for one subject =====
  function buildSubject(subject, n, rng) {
    const counts = diffCounts(n);
    if (subject === "国語") return genJapanese(rng, counts);
    if (subject === "数学") return genMath(rng, counts);
    if (subject === "英語") return genEnglish(rng, counts);
    if (subject === "理科") return genScience(rng, counts);
    if (subject === "社会") return genSocial(rng, counts);
    return [];
  }

  // ===== Public API =====
  const SchoolQuizBank = {
    // 各教科 perSubjectCount 問を生成し、5教科ぶん結合して返す
    buildAll(perSubjectCount = 500) {
      const seed = hashSeed(`bank-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const rng = mulberry32(seed);

      const subjects = ["国語", "数学", "英語", "理科", "社会"];
      let all = [];
      for (const sub of subjects) {
        const qs = buildSubject(sub, perSubjectCount, rng);
        all = all.concat(qs);
      }

      // key重複があれば除去（念のため）
      const seen = new Set();
      const uniq = [];
      for (const q of all) {
        const k = String(q.key || "");
        if (!k || seen.has(k)) continue;
        seen.add(k);
        uniq.push(q);
      }

      // 出題の偏りを減らすため、全体もシャッフルして返す
      return shuffle(uniq, rng);
    },
  };

  window.SchoolQuizBank = SchoolQuizBank;
})();
