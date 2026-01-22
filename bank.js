/* bank.js (50 questions per subject, wide difficulty, unique patterns)
   - 5教科固定問題（国語/数学/英語/理科/社会）
   - schema: sub/level/diff/patternGroup/pattern/q/c/a/exp (+ uid/key)
*/

(function () {
  "use strict";

  const SUBJECTS = ["国語", "数学", "英語", "理科", "社会"];
  const GRADES = ["小", "中"];
  const DIFFS = ["基礎", "標準", "発展"];

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
  function toKey(q, i) {
    return `${q.sub}|${q.level}|${q.diff}|${q.patternGroup || q.pattern || "p"}|${(q.q || "").slice(0, 32)}|${i}`;
  }

  function validateQuestion(q) {
    if (!q) return false;
    if (!SUBJECTS.includes(q.sub)) return false;
    if (!GRADES.includes(q.level)) return false;
    if (!DIFFS.includes(q.diff)) return false;
    if (typeof q.pattern !== "string" || !q.pattern.trim()) return false;
    if (typeof q.patternGroup !== "string" || !q.patternGroup.trim()) return false;
    if (typeof q.q !== "string" || !q.q.trim()) return false;
    if (!Array.isArray(q.c) || q.c.length !== 4) return false;
    if (!Number.isFinite(q.a) || q.a < 0 || q.a > 3) return false;
    const choices = q.c.map(x => String(x ?? "").trim());
    if (choices.some(x => !x)) return false;
    if (new Set(choices).size !== 4) return false;

    const banned = new Set(["不明", "わからない", "どれでもない", "上のいずれでもない", "該当なし"]);
    if (choices.some(x => banned.has(x))) return false;

    return true;
  }

  function shuffleChoices(choices, correctIndex) {
    const items = choices.map((text, index) => ({ text, index }));
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    const shuffledChoices = items.map(item => item.text);
    const shuffledAnswerIndex = items.findIndex(item => item.index === correctIndex);
    return { shuffledChoices, shuffledAnswerIndex };
  }

  const DATA = [
    /* ========= 国語 50 ========= */
    { sub:"国語", level:"小", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_basic", q:"次の漢字の読みは？「森」", c:["もり","しん","はやし","たけ"], a:0, exp:"森=もり。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_basic", q:"次の漢字の読みは？「昼」", c:["ひる","よる","あさ","ゆう"], a:0, exp:"昼=ひる。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_basic", q:"次の漢字の読みは？「星」", c:["ほし","ゆき","つき","ひ"], a:0, exp:"星=ほし。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"ja_word_antonym_easy", q:"「大きい」の反対の意味の言葉はどれ？", c:["小さい","広い","高い","長い"], a:0, exp:"大きい↔小さい。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"ja_word_synonym_easy", q:"「すばやい」と同じ意味に近い言葉は？", c:["はやい","おそい","とおい","ゆるい"], a:0, exp:"すばやい=はやい。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"ja_particle_basic", q:"文に入る助詞として正しいものは？「ぼく（　）ともだちが来た。」", c:["の","が","を","へ"], a:1, exp:"主語を示す助詞は「が」。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"ja_particle_basic", q:"文に入る助詞として正しいものは？「えんぴつ（　）かいた。」", c:["で","を","に","へ"], a:0, exp:"道具は「で」。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"ja_sentence_order_easy", q:"正しい語順はどれ？「(1)公園で (2)遊ぶ (3)友だちと」", c:["3-1-2","1-3-2","2-1-3","2-3-1"], a:1, exp:"公園で友だちと遊ぶ。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"reading", patternGroup:"ja_reading_simple", q:"文「雨がふって、かさをさした。」から分かることは？", c:["外は雨だった","外は雪だった","夜だった","かさが壊れた"], a:0, exp:"雨がふっている。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_mean_basic", q:"「火山」の意味に近いものは？", c:["火をふく山","水の山","木の山","氷の山"], a:0, exp:"火山=火をふく山。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_read_mid", q:"次の漢字の読みは？「温度」", c:["おんど","うんど","おんと","あたたかさ"], a:0, exp:"温度=おんど。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_read_mid", q:"次の漢字の読みは？「努力」", c:["どりょく","どろく","どりょう","つとめ"], a:0, exp:"努力=どりょく。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_idiom_kids", q:"「顔が広い」の意味に近いものは？", c:["知り合いが多い","顔が大きい","年上に見える","病気で赤い"], a:0, exp:"人脈が多い。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_word_choice_context", q:"文脈に合う言葉は？「風が（　）て、帽子が飛んだ。」", c:["強く","細く","甘く","早く"], a:0, exp:"風が強い。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"ja_adjective_use", q:"「静か」の使い方として正しい文は？", c:["教室は静かだ。","静かい教室だ。","静かくな教室だ。","教室は静かく。"], a:0, exp:"形容動詞は「静かだ」。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"reading", patternGroup:"ja_reading_mainidea", q:"文「弟は毎朝、犬にえさをあげる。」の中心は？", c:["弟が犬の世話をする","弟が学校に行く","犬がねむる","朝ごはんを食べる"], a:0, exp:"犬にえさをあげる。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_write", q:"「はしる」を漢字で書くと？", c:["走る","起る","速る","走ら"], a:0, exp:"走る。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_write", q:"「つくる」を漢字で書くと？", c:["作る","咲る","冊る","昨る"], a:0, exp:"作る。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_onoma", q:"擬音語として適切なものは？", c:["ザーザー","しずか","ゆっくり","まじめ"], a:0, exp:"雨の音=ザーザー。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"ja_verb_tense", q:"文に合う形は？「昨日、映画を（　）。」", c:["見た","見る","見ます","見よう"], a:0, exp:"過去なので「見た」。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"reading", patternGroup:"ja_reading_inference", q:"文「空が暗くなってきた。遠くでゴロゴロ聞こえる。」から考えられる天気は？", c:["雷雨になりそう","快晴","雪","台風が去った"], a:0, exp:"雷の前兆。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_prefix_suffix", q:"「水泳」の意味として正しいものは？", c:["水の中で泳ぐこと","水を飲むこと","水を運ぶこと","水をふくむこと"], a:0, exp:"水泳=水中で泳ぐ。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"ja_conjunction_basic", q:"文をつなぐ言葉として正しいものは？「雨が降った。（　）試合は中止になった。」", c:["だから","しかし","つまり","例えば"], a:0, exp:"原因→結果で「だから」。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"reading", patternGroup:"ja_reading_sequence", q:"文「歯をみがいた。顔を洗った。朝ごはんを食べた。」の順として自然なのは？", c:["顔を洗う→歯をみがく→朝ごはん","歯をみがく→顔を洗う→朝ごはん","朝ごはん→歯をみがく→顔を洗う","歯をみがく→朝ごはん→顔を洗う"], a:1, exp:"洗面→歯みがき→朝ごはんが一般的。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_read_mid", q:"次の漢字の読みは？「安全」", c:["あんぜん","あんぜい","あんせん","やすぜん"], a:0, exp:"安全=あんぜん。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_read_mid", q:"次の漢字の読みは？「植物」", c:["しょくぶつ","しょくもつ","しょくもの","しょぶつ"], a:0, exp:"植物=しょくぶつ。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_word_polite", q:"「見る」の丁寧な言い方は？", c:["ご覧になる","見える","眺める","目にする"], a:0, exp:"尊敬語でご覧になる。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_jhs", q:"次の語の読みは？「推測」", c:["すいそく","ついそく","すいさく","すいしょく"], a:0, exp:"推測=すいそく。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_jhs", q:"次の語の読みは？「発達」", c:["はったつ","はつたつ","はつだち","はったち"], a:0, exp:"発達=はったつ。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"vocab", patternGroup:"ja_word_meaning_mid", q:"「観察」の意味として適切なのは？", c:["注意して見る","勝手に想像する","急いで走る","小声で話す"], a:0, exp:"観察=よく見る。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"ja_participle", q:"文に合う語は？「努力（　）人は成長する。」", c:["する","した","するほど","している"], a:1, exp:"努力した人。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"ja_sentence_cohesion", q:"文「Aは早起きだ。（　）Bは夜更かしだ。」に合う接続語は？", c:["一方","だから","つまり","すると"], a:0, exp:"対比は「一方」。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"ja_idiom_mid", q:"「胸を借りる」の意味として適切なのは？", c:["強い人に教わって挑戦する","相手を見下す","胸の病気になる","家に泊める"], a:0, exp:"強者に稽古をつけてもらう。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"ja_word_synonym_mid", q:"「継続」の近い意味は？", c:["続けること","止めること","変えること","隠すこと"], a:0, exp:"継続=続けること。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"ja_modality", q:"文に合う助動詞は？「明日は雨が（　）かもしれない。」", c:["降る","降り","降った","降ろう"], a:0, exp:"可能性表現は終止形。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"reading", patternGroup:"ja_reading_cause", q:"文「電車が遅れたので、会議に間に合わなかった。」の原因は？", c:["電車が遅れた","会議が早く終わった","道に迷った","予定が変更された"], a:0, exp:"原因は電車の遅延。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"logic", patternGroup:"ja_logic_category", q:"次のうち「果物」に当てはまるものは？", c:["りんご","きゅうり","にんじん","だいこん"], a:0, exp:"りんごは果物。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_mean_mid", q:"「賛成」の意味として正しいものは？", c:["意見に同意する","強く反対する","迷って保留する","話をそらす"], a:0, exp:"賛成=同意。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"ja_clause_connect", q:"文をつなぐ言葉として正しいものは？「練習を重ねた。（　）本番はうまくできた。」", c:["その結果","それでも","たとえば","ところで"], a:0, exp:"原因→結果。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"reading", patternGroup:"ja_reading_summary", q:"文「節電のために、使わない部屋の電気を消した。」の要約は？", c:["節電の行動をした","新しい家電を買った","部屋を広くした","電気料金が無料"], a:0, exp:"節電のために消灯。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"ja_vocab_precise2", q:"「先見の明」の意味として最も適切なものは？", c:["将来を見通す力","目の前の事だけに集中する力","他人の意見に従う姿勢","古い慣習を守ること"], a:0, exp:"先見=将来を見通す。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"ja_vocab_precise2", q:"「均衡を保つ」の意味として最も近いものは？", c:["バランスを保つ","急激に変える","一方に偏る","勢いで進む"], a:0, exp:"均衡=バランス。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo2", q:"「臨機応変」の意味として正しいものは？", c:["状況に応じて適切に対応する","決まりを一切守らない","同じ方法だけを続ける","準備を全くしない"], a:0, exp:"臨機応変=その場に応じる。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo2", q:"「温故知新」の意味として正しいものは？", c:["古いことから新しい知識を得る","新しいことだけを学ぶ","忘れたことを思い出せない","古いものを捨てる"], a:0, exp:"過去から学ぶ。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"ja_sentence_refine", q:"次の文のより適切な表現は？「彼は努力していた、だから成果が出た。」", c:["彼は努力していたため、成果が出た。","彼は努力していた、しかし成果が出た。","彼は努力していたので、成果が出ない。","彼は努力していた、つまり成果が出ない。"], a:0, exp:"因果関係は「ため」。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"logic", patternGroup:"ja_logic_inference", q:"「すべての鳥は羽をもつ。ペンギンは鳥である。」から導ける結論は？", c:["ペンギンは羽をもつ","ペンギンは飛べる","すべての羽は鳥である","鳥はすべてペンギン"], a:0, exp:"三段論法の結論。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_read_advanced", q:"次の語の読みは？「慣習」", c:["かんしゅう","かんしゅ","かんしゅうい","ならわし"], a:0, exp:"慣習=かんしゅう。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_read_advanced", q:"次の語の読みは？「抑制」", c:["よくせい","おくせい","よっせい","よくざい"], a:0, exp:"抑制=よくせい。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_mean_advanced", q:"「慎重」の意味として正しいものは？", c:["注意深く行う","大胆に進む","急いで決める","気にせず話す"], a:0, exp:"慎重=注意深い。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"reading", patternGroup:"ja_reading_contrast", q:"文「便利だが、使いすぎると依存につながる。」の対比語はどれ？", c:["が","そして","つまり","なぜなら"], a:0, exp:"対比は「が」。" },

    /* ========= 数学 50 ========= */
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_place_value", q:"1234の千の位の数字は？", c:["1","2","3","4"], a:0, exp:"千の位は1。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_add_basic", q:"35+27= ?", c:["62","52","72","58"], a:0, exp:"35+27=62。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_sub_basic", q:"90−48= ?", c:["42","52","38","48"], a:0, exp:"90-48=42。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_mul_basic", q:"7×8= ?", c:["56","48","64","58"], a:0, exp:"7×8=56。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_div_basic", q:"63÷9= ?", c:["7","9","6","8"], a:0, exp:"63÷9=7。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"fraction", patternGroup:"math_fraction_basic", q:"1/2と同じ大きさはどれ？", c:["2/4","1/3","3/5","4/7"], a:0, exp:"1/2=2/4。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"fraction", patternGroup:"math_fraction_compare", q:"1/4と1/3ではどちらが大きい？", c:["1/3","1/4","同じ","比べられない"], a:0, exp:"分母が小さいほど大きい。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"geometry", patternGroup:"math_shape_name", q:"四角形で向かい合う辺が平行な図形は？", c:["平行四辺形","台形","ひし形","長方形"], a:0, exp:"定義として平行四辺形。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"geometry", patternGroup:"math_angle_basic", q:"直角の大きさは何度？", c:["90°","45°","180°","60°"], a:0, exp:"直角=90度。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"measurement", patternGroup:"math_unit_length", q:"1mは何cm？", c:["100cm","10cm","1000cm","1cm"], a:0, exp:"1m=100cm。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"measurement", patternGroup:"math_unit_weight", q:"1kgは何g？", c:["1000g","100g","10g","1g"], a:0, exp:"1kg=1000g。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"data", patternGroup:"math_bar_graph", q:"棒グラフで最も多い数を表す部分は？", c:["一番高い棒","一番低い棒","横軸","題名"], a:0, exp:"高さが大きいほど数が多い。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"word", patternGroup:"math_word_change", q:"りんごが5個あり、3個もらった。全部で？", c:["8個","2個","15個","5個"], a:0, exp:"5+3=8。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"fraction", patternGroup:"math_fraction_add", q:"1/3+1/6= ?", c:["1/2","2/9","1/9","2/3"], a:0, exp:"共通分母6で2/6+1/6=3/6=1/2。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"fraction", patternGroup:"math_fraction_sub", q:"3/4−1/8= ?", c:["5/8","1/2","3/8","7/8"], a:0, exp:"6/8-1/8=5/8。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"decimal", patternGroup:"math_decimal_add", q:"0.7+0.35= ?", c:["1.05","0.95","1.2","0.75"], a:0, exp:"0.7+0.35=1.05。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"decimal", patternGroup:"math_decimal_mul", q:"2.5×4= ?", c:["10","9","8","12"], a:0, exp:"2.5×4=10。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"geometry", patternGroup:"math_area_rectangle", q:"たて6cm、よこ8cmの長方形の面積は？", c:["48cm²","28cm²","14cm²","24cm²"], a:0, exp:"6×8=48。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"geometry", patternGroup:"math_perimeter", q:"一辺5cmの正方形の周りの長さは？", c:["20cm","10cm","25cm","15cm"], a:0, exp:"4×5=20。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"measurement", patternGroup:"math_time_convert", q:"2時間30分は何分？", c:["150分","120分","180分","90分"], a:0, exp:"2時間=120分、+30=150分。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"ratio", patternGroup:"math_ratio_simple", q:"比1:3は何倍の関係？", c:["3倍","2倍","1/3倍","4倍"], a:0, exp:"後は前の3倍。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"number", patternGroup:"math_odd_even", q:"次のうち偶数は？", c:["24","35","19","57"], a:0, exp:"偶数は2で割り切れる。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"data", patternGroup:"math_average_basic", q:"4,6,10の平均は？", c:["20/3","6","5","7"], a:0, exp:"(4+6+10)/3=20/3。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"word", patternGroup:"math_word_money", q:"1本120円のジュースを3本買うと？", c:["360円","240円","300円","320円"], a:0, exp:"120×3=360。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"geometry", patternGroup:"math_angle_sum_triangle", q:"三角形の内角の和は？", c:["180°","360°","90°","270°"], a:0, exp:"三角形の内角の和は180°。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"number", patternGroup:"math_rounding", q:"四捨五入して百の位にすると、346は？", c:["300","400","350","200"], a:1, exp:"十の位4なので切り捨て。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"fraction", patternGroup:"math_fraction_word", q:"ピザを8等分し、3切れ食べた。食べた割合は？", c:["3/8","5/8","3/5","1/8"], a:0, exp:"3/8。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"geometry", patternGroup:"math_volume_cuboid", q:"たて2cm、よこ3cm、高さ4cmの直方体の体積は？", c:["24cm³","9cm³","18cm³","12cm³"], a:0, exp:"2×3×4=24。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"data", patternGroup:"math_line_graph", q:"折れ線グラフで表すのに向くのは？", c:["時間による変化","割合の内訳","写真","図形の面積"], a:0, exp:"時間変化。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_integer_signed", q:"(−3)+7= ?", c:["4","−4","10","−10"], a:0, exp:"-3+7=4。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_integer_signed", q:"(−5)×(−2)= ?", c:["10","−10","7","−7"], a:0, exp:"負×負=正。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_linear_eq", q:"2x+3=11 のxは？", c:["4","7","3","5"], a:0, exp:"2x=8→x=4。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_linear_eq", q:"5x−2=18 のxは？", c:["4","3","5","2"], a:0, exp:"5x=20→x=4。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"ratio", patternGroup:"math_ratio_percent", q:"80の15%は？", c:["12","15","8","20"], a:0, exp:"0.15×80=12。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"geometry", patternGroup:"math_pythagoras_basic", q:"直角三角形で他の2辺が3cmと4cm。斜辺は？", c:["5cm","6cm","7cm","4cm"], a:0, exp:"3-4-5。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"data", patternGroup:"math_probability_basic", q:"コインを1回投げる。表が出る確率は？", c:["1/2","1/3","1/4","2/3"], a:0, exp:"表裏同様。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"geometry", patternGroup:"math_circle_circumference", q:"半径5cmの円の円周をπで表すと？", c:["10π","25π","5π","20π"], a:0, exp:"円周=2πr。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_expand_basic", q:"(x+2)(x−3)を展開すると？", c:["x^2−x−6","x^2+5x−6","x^2−5x−6","x^2−x+6"], a:0, exp:"x^2−3x+2x−6=x^2−x−6。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_factor_basic", q:"x^2+5x+6 を因数分解すると？", c:["(x+2)(x+3)","(x+1)(x+6)","(x−2)(x−3)","(x+3)(x−2)"], a:0, exp:"積6、和5。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"algebra", patternGroup:"math_simultaneous", q:"連立方程式 x+y=10, x−y=2 の解は？", c:["(6,4)","(4,6)","(8,2)","(5,5)"], a:0, exp:"加えると2x=12→x=6,y=4。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"function", patternGroup:"math_linear_function", q:"一次関数 y=−2x+5 のx=3のときのyは？", c:["−1","1","−11","11"], a:0, exp:"y=−6+5=−1。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"function", patternGroup:"math_slope_find", q:"点(2,1)と(6,9)を通る直線の傾きは？", c:["2","1/2","4","3"], a:0, exp:"(9-1)/(6-2)=8/4=2。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"geometry", patternGroup:"math_triangle_area", q:"底辺8cm、高さ5cmの三角形の面積は？", c:["20cm²","40cm²","13cm²","30cm²"], a:0, exp:"(8×5)/2=20。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"geometry", patternGroup:"math_polygon_angle", q:"正五角形の1つの内角は？", c:["108°","120°","100°","90°"], a:0, exp:"(5-2)×180/5=108。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"probability", patternGroup:"math_probability_two_dice", q:"サイコロを2個投げる。和が7になる確率は？", c:["1/6","1/12","1/9","1/8"], a:0, exp:"(1,6)など6通り/36=1/6。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"sequence", patternGroup:"math_arithmetic", q:"等差数列で初項2、公差5。第8項は？", c:["37","32","42","27"], a:0, exp:"2+7×5=37。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"sequence", patternGroup:"math_geometric", q:"等比数列で初項3、公比2。第5項は？", c:["48","24","32","96"], a:0, exp:"3×2^4=48。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"algebra", patternGroup:"math_inequality", q:"2x−1<7 を満たすxの範囲は？", c:["x<4","x>4","x<3","x>3"], a:0, exp:"2x<8→x<4。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"ratio", patternGroup:"math_ratio_map", q:"縮尺1:5000の地図で2cmは実際の長さ何m？", c:["100m","10m","50m","200m"], a:0, exp:"2cm×5000=10000cm=100m。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"probability", patternGroup:"math_probability_cards", q:"1〜5のカードを1枚引く。偶数が出る確率は？", c:["2/5","1/2","3/5","1/5"], a:0, exp:"偶数2枚/5。" },

    /* ========= 英語 50 ========= */
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_word", q:"Choose the correct word: I have a (   ). (りんご)", c:["apple","table","water","pen"], a:0, exp:"apple=りんご。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_word", q:"Choose the correct word: This is a (   ). (いぬ)", c:["dog","cat","bird","fish"], a:0, exp:"dog=いぬ。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_word", q:"Choose the correct word: I drink (   ). (みず)", c:["water","milk","juice","rice"], a:0, exp:"water=みず。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_color", q:"Choose the color: The sky is (   ).", c:["blue","red","green","black"], a:0, exp:"Sky is blue." },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_be_present", q:"Choose the correct form: I (   ) a student.", c:["am","is","are","be"], a:0, exp:"I am. " },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_be_present", q:"Choose the correct form: He (   ) my friend.", c:["is","am","are","be"], a:0, exp:"He is. " },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_plural", q:"Choose the plural: one book → two (   )", c:["books","bookes","book","bookies"], a:0, exp:"複数形はbooks。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_article", q:"Choose the article: I have (   ) pen.", c:["a","an","the","no"], a:0, exp:"penは子音音でa。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_this_that", q:"Choose the correct word: (   ) is my bag. (近くの物)", c:["This","That","These","Those"], a:0, exp:"近くはThis。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_days", q:"Which is a day of the week?", c:["Monday","Spring","Morning","School"], a:0, exp:"Monday。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_numbers", q:"Select the correct number word for 12.", c:["twelve","twenty","two","ten"], a:0, exp:"12=twelve。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_can", q:"Choose the correct word: I (   ) swim.", c:["can","can’t","cans","caning"], a:0, exp:"能力=can。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"reading", patternGroup:"eng_read_simple", q:"Read: \"Tom has a red ball.\" What color is the ball?", c:["red","blue","yellow","green"], a:0, exp:"red ball。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_present_s", q:"Choose the correct verb: She (   ) to school.", c:["goes","go","going","gone"], a:0, exp:"三単現+es。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_have_has", q:"Choose the correct verb: I (   ) a bike.", c:["have","has","having","had"], a:0, exp:"I have。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_have_has", q:"Choose the correct verb: He (   ) a bike.", c:["has","have","having","had"], a:0, exp:"He has。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_there_is", q:"Choose the correct form: There (   ) a cat in the box.", c:["is","are","be","were"], a:0, exp:"a cat=単数。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_past_simple", q:"Choose the correct past tense: I (   ) a movie yesterday.", c:["watched","watch","watches","watching"], a:0, exp:"過去形。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"eng_preposition", q:"Choose the correct preposition: The book is (   ) the desk.", c:["on","at","for","by"], a:0, exp:"on the desk。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"eng_time", q:"Choose the correct word: 7:00 is seven (   ).", c:["o'clock","minute","second","day"], a:0, exp:"o'clock。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"eng_animals", q:"Which is an animal?", c:["horse","table","book","chair"], a:0, exp:"horse。" },
    { sub:"英語", level:"小", diff:"標準", pattern:"reading", patternGroup:"eng_read_simple2", q:"Read: \"Amy likes music. She plays the piano.\" What does Amy do?", c:["She plays the piano.","She plays soccer.","She cooks dinner.","She reads comics."], a:0, exp:"She plays the piano。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_present_progressive", q:"Choose the correct form: They (   ) now.", c:["are studying","study","studied","studies"], a:0, exp:"now→進行形。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_past_be", q:"Choose the correct form: I (   ) busy yesterday.", c:["was","were","am","is"], a:0, exp:"I was。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_future_will", q:"Choose the correct form: I (   ) call you tomorrow.", c:["will","am","was","did"], a:0, exp:"未来=will。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_comparative", q:"Choose the correct word: This bag is (   ) than that one.", c:["heavier","heavy","heaviest","more heavy"], a:0, exp:"短い形容詞は-er。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_superlative", q:"Choose the correct word: She is the (   ) in the class.", c:["tallest","taller","tall","more tall"], a:0, exp:"最上級。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_countable", q:"Choose the correct word: I have (   ) water.", c:["some","many","few","a"], a:0, exp:"water=不可算でsome。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"vocab", patternGroup:"eng_opposites", q:"Choose the opposite of \"cold\".", c:["hot","cool","warm","ice"], a:0, exp:"cold↔hot。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"vocab", patternGroup:"eng_preposition_time", q:"Choose the correct preposition: We meet (   ) Friday.", c:["on","in","at","to"], a:0, exp:"曜日はon。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"reading", patternGroup:"eng_read_detail", q:"Read: \"Ken went to the library and borrowed a book.\" Where did Ken go?", c:["the library","the park","the station","the store"], a:0, exp:"library。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_question_do", q:"Choose the correct question: (   ) you like soccer?", c:["Do","Does","Did","Are"], a:0, exp:"主語you→Do。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_infinitive", q:"Choose the correct form: I want (   ) a guitar.", c:["to buy","buy","buying","bought"], a:0, exp:"want to V。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_gerund", q:"Choose the correct form: I enjoy (   ) tennis.", c:["playing","play","to play","played"], a:0, exp:"enjoy V-ing。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_passive", q:"Choose the correct passive: The window (   ) by him.", c:["was broken","broke","breaks","is breaking"], a:0, exp:"受け身はbe+p.p.。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_relative", q:"Choose the correct word: The boy (   ) is singing is my brother.", c:["who","where","when","what"], a:0, exp:"人→who。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_since_for", q:"Choose the correct word: She has lived here (   ) 2020.", c:["since","for","during","from"], a:0, exp:"since+時点。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_if", q:"Choose the correct word: If it (   ), we will stay inside.", c:["rains","rain","rained","raining"], a:0, exp:"If節は現在形。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_word_order", q:"Choose the correct order: (A) always (B) is (C) he late.", c:["B-A-C","C-B-A","A-B-C","B-C-A"], a:0, exp:"He is always late。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"eng_collocation", q:"Choose the correct collocation: make (   )", c:["a plan","a sleep","a homework","a slow"], a:0, exp:"make a plan。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"reading", patternGroup:"eng_read_summary", q:"Read: \"The town planted trees and built bike lanes.\" Best summary?", c:["It improved the environment.","It cut all trees.","It built more factories.","It stopped traffic."], a:0, exp:"環境改善。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_modal_should", q:"Choose the correct word: You (   ) see a doctor.", c:["should","mustn't","can't","may"], a:0, exp:"助言=should。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_comparison_as", q:"Choose the correct phrase: She is (   ) her sister.", c:["as kind as","kinder than","kindest","so kind"], a:0, exp:"as + 原級 + as。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_present_perfect", q:"Choose the correct form: I (   ) never been to Hokkaido.", c:["have","has","had","am"], a:0, exp:"I have never been。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_passive2", q:"Choose the correct passive: These cars (   ) in Japan.", c:["are made","make","made","are making"], a:0, exp:"be+p.p.。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_too_to", q:"Choose the correct phrase: The box is (   ) to lift.", c:["too heavy","very heavy","heavy enough","so heavy"], a:0, exp:"too ... to。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_not_as", q:"Choose the correct phrase: This exam is (   ) the last one.", c:["not as difficult as","not difficult than","as difficult not","not so difficulty"], a:0, exp:"not as ... as。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"eng_synonym", q:"Choose the closest meaning of \"begin\".", c:["start","finish","carry","push"], a:0, exp:"begin=start。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"vocab", patternGroup:"eng_phrase", q:"Choose the correct phrase: \"look for\" means", c:["search","turn","leave","grow"], a:0, exp:"look for=search。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"reading", patternGroup:"eng_read_infer", q:"Read: \"Miki set her alarm earlier and finished homework before breakfast.\" What can you infer?", c:["She planned her time well.","She skipped homework.","She was late.","She disliked breakfast."], a:0, exp:"早起きで時間管理。" },

    /* ========= 理科 50 ========= */
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_plant_parts", q:"植物の根の主な役割は？", c:["水分を吸収する","光を受ける","花を咲かせる","種を運ぶ"], a:0, exp:"根は吸水。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_plant_parts", q:"葉の主なはたらきは？", c:["光合成","呼吸の停止","水の蒸発を止める","種の形成"], a:0, exp:"葉で光合成。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"physics", patternGroup:"sci_light", q:"鏡に当たった光はどうなる？", c:["はね返る","吸収される","消える","熱だけになる"], a:0, exp:"反射。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"physics", patternGroup:"sci_magnet", q:"磁石に引き付けられるものは？", c:["鉄","木","紙","ゴム"], a:0, exp:"鉄は磁性。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"chemistry", patternGroup:"sci_states", q:"氷がとけると何になる？", c:["水","水蒸気","氷のまま","砂"], a:0, exp:"固体→液体。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"earth", patternGroup:"sci_weather", q:"雲が多いときの天気は？", c:["くもり","はれ","あめ","ゆき"], a:0, exp:"雲が多い=くもり。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"earth", patternGroup:"sci_day_night", q:"昼と夜ができる原因は？", c:["地球の自転","地球の公転","月の公転","季節の変化"], a:0, exp:"自転で昼夜。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_body_sense", q:"目のはたらきは？", c:["見る","聞く","嗅ぐ","触る"], a:0, exp:"目は視覚。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_body_sense", q:"耳のはたらきは？", c:["聞く","見る","嗅ぐ","味わう"], a:0, exp:"耳は聴覚。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"chemistry", patternGroup:"sci_solution_basic", q:"砂と水をまぜたとき、砂はどうなる？", c:["溶けずに下にたまる","全部溶ける","気体になる","色が変わる"], a:0, exp:"砂は溶けない。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"physics", patternGroup:"sci_sound", q:"音は何が振動して伝わる？", c:["空気","光","水だけ","金属だけ"], a:0, exp:"空気の振動。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"earth", patternGroup:"sci_rock", q:"火山の噴火でできる岩石は？", c:["火成岩","堆積岩","変成岩","化石"], a:0, exp:"マグマから火成岩。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_insect", q:"昆虫の足の本数は？", c:["6本","4本","8本","10本"], a:0, exp:"昆虫は6本脚。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"chemistry", patternGroup:"sci_evaporation", q:"水が水蒸気になる変化は？", c:["蒸発","凝結","凍結","燃焼"], a:0, exp:"液体→気体。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"physics", patternGroup:"sci_lever_simple", q:"てこの支点はどこ？", c:["回転の中心","力を加える点","物を置く点","棒の端"], a:0, exp:"支点=回転中心。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"biology", patternGroup:"sci_food_chain", q:"食物連鎖で最初に位置するのは？", c:["植物","草食動物","肉食動物","分解者"], a:0, exp:"植物が生産者。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"earth", patternGroup:"sci_moon_phase", q:"満月はいつ見える？", c:["月が太陽の反対側にあるとき","月が太陽と同じ方向","月が見えないとき","日中だけ"], a:0, exp:"地球をはさんで反対。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"physics", patternGroup:"sci_electric_circuit", q:"豆電球を明るくするには？", c:["電池を増やす","導線を切る","電池を外す","スイッチを開く"], a:0, exp:"電圧増で明るくなる。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"biology", patternGroup:"sci_breathing", q:"人が吸う空気に多く含まれる気体は？", c:["窒素","酸素","二酸化炭素","水素"], a:0, exp:"大部分は窒素。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"earth", patternGroup:"sci_weather_tools", q:"雨の量を測る道具は？", c:["雨量計","温度計","風速計","気圧計"], a:0, exp:"雨量計。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"physics", patternGroup:"sci_shadow", q:"影が短くなるのはいつ？", c:["昼ごろ","朝","夕方","夜"], a:0, exp:"太陽が高い昼。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"biology", patternGroup:"sci_growth", q:"植物が成長するのに必要なものとして適切なのは？", c:["日光と水","石と砂","油だけ","空気だけ"], a:0, exp:"光と水。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"chemistry", patternGroup:"sci_solubility", q:"水に溶けるものはどれ？", c:["砂糖","砂","油","木片"], a:0, exp:"砂糖は溶ける。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"physics", patternGroup:"sci_density_basic", q:"質量120g、体積40cm³の密度は？", c:["3g/cm³","2g/cm³","4g/cm³","6g/cm³"], a:0, exp:"120/40=3。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"physics", patternGroup:"sci_speed", q:"距離150mを30秒で進む速さは？", c:["5m/s","4m/s","6m/s","3m/s"], a:0, exp:"150/30=5。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"chemistry", patternGroup:"sci_atom_basic", q:"原子の中心にあるものは？", c:["原子核","電子","分子","細胞"], a:0, exp:"中心は原子核。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"chemistry", patternGroup:"sci_acid_base", q:"リトマス紙が赤になる水溶液は？", c:["酸性","中性","アルカリ性","塩基性"], a:0, exp:"酸性で赤。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"biology", patternGroup:"sci_cell", q:"細胞の設計図にあたる部分は？", c:["核","細胞膜","細胞壁","リボソーム"], a:0, exp:"核に遺伝情報。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"biology", patternGroup:"sci_human", q:"血液中の赤血球のはたらきは？", c:["酸素を運ぶ","ばい菌を食べる","血を固める","消化する"], a:0, exp:"赤血球は酸素運搬。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"earth", patternGroup:"sci_plate", q:"地震が起こりやすいのはどこ？", c:["プレートの境界","大陸の中央","砂漠","高原"], a:0, exp:"境界でずれる。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"earth", patternGroup:"sci_wind", q:"海陸風で昼間、海から陸へ吹く風を何という？", c:["海風","陸風","季節風","偏西風"], a:0, exp:"昼は海風。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"physics", patternGroup:"sci_refraction", q:"水に入れたストローが曲がって見える現象は？", c:["屈折","反射","干渉","回折"], a:0, exp:"光の屈折。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"chemistry", patternGroup:"sci_chemical_change", q:"鉄がさびる変化は？", c:["酸化","還元","中和","蒸発"], a:0, exp:"鉄の酸化。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_ohm_law", q:"電流0.5A、抵抗4Ωのとき電圧は？", c:["2V","8V","0.125V","4V"], a:0, exp:"V=IR=2。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_work", q:"力10Nで3m動かす仕事は？", c:["30J","13J","300J","3J"], a:0, exp:"10×3=30。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"chemistry", patternGroup:"sci_ion_basic", q:"塩化水素が水に溶けるとできるイオンは？", c:["H⁺とCl⁻","Na⁺とCl⁻","H⁺とOH⁻","Na⁺とOH⁻"], a:0, exp:"HCl→H⁺,Cl⁻。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"chemistry", patternGroup:"sci_gas_basic", q:"酸素が発生する反応として正しいものは？", c:["過酸化水素の分解","水の凝結","塩化ナトリウムの溶解","砂糖の融解"], a:0, exp:"H2O2分解。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"biology", patternGroup:"sci_photosynthesis", q:"光合成で必要な気体は？", c:["二酸化炭素","酸素","窒素","水素"], a:0, exp:"CO2が必要。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"biology", patternGroup:"sci_respiration", q:"呼吸で体内で使われる気体は？", c:["酸素","二酸化炭素","窒素","水素"], a:0, exp:"酸素を消費。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"earth", patternGroup:"sci_cloud_type", q:"高い空に広がる薄い雲は？", c:["巻雲","積乱雲","乱層雲","積雲"], a:0, exp:"巻雲は高い薄い雲。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"earth", patternGroup:"sci_star", q:"北の空で方角を知る目印となる星は？", c:["北極星","金星","シリウス","火星"], a:0, exp:"北極星。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_pressure", q:"面積を小さくすると圧力は？", c:["大きくなる","小さくなる","変わらない","0になる"], a:0, exp:"P=F/A。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"chemistry", patternGroup:"sci_solution_percent", q:"質量パーセント濃度5%の食塩水200gの食塩は？", c:["10g","5g","20g","2g"], a:0, exp:"0.05×200=10。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"biology", patternGroup:"sci_ecosystem", q:"分解者の例として正しいものは？", c:["菌類","草食動物","植物","肉食動物"], a:0, exp:"菌類は分解者。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"earth", patternGroup:"sci_fossil", q:"化石ができやすい環境は？", c:["堆積が速い場所","溶岩が流れる場所","砂漠の中央","高温の岩石内"], a:0, exp:"堆積で覆われると残る。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_wave", q:"音の高さが高いほどどうなる？", c:["振動数が大きい","振動数が小さい","振幅が0","速さが0"], a:0, exp:"高音=周波数大。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"chemistry", patternGroup:"sci_neutralization", q:"塩酸と水酸化ナトリウムを混ぜる反応は？", c:["中和","酸化","還元","蒸発"], a:0, exp:"酸+塩基=中和。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"biology", patternGroup:"sci_genetics", q:"優性の形質が現れるときの遺伝子の組み合わせは？", c:["優性が1つ以上","劣性だけ","優性が0","必ず2つ劣性"], a:0, exp:"優性があれば現れる。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"earth", patternGroup:"sci_tide", q:"潮の満ち引きに主に関わる天体は？", c:["月","火星","金星","太陽風"], a:0, exp:"月の引力。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_force", q:"物体に力がはたらくと起こることは？", c:["運動が変化する","必ず止まる","色が変わる","温度が0になる"], a:0, exp:"力は運動状態を変える。" },

    /* ========= 社会 50 ========= */
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_japan_pref", q:"日本の首都は？", c:["東京","大阪","名古屋","札幌"], a:0, exp:"首都は東京。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_continent", q:"アジアにある国は？", c:["日本","ブラジル","カナダ","エジプト"], a:0, exp:"日本はアジア。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_ocean", q:"日本の東に広がる海は？", c:["太平洋","大西洋","インド洋","北極海"], a:0, exp:"日本の東は太平洋。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"civics", patternGroup:"soc_symbol", q:"日本の国旗に描かれているものは？", c:["日の丸","月","星","山"], a:0, exp:"日の丸。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"history", patternGroup:"soc_history_era", q:"「昔の出来事を調べる学習」は何という？", c:["歴史","理科","算数","国語"], a:0, exp:"歴史の学習。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_map", q:"地図で方位を示す記号は？", c:["方位記号","縮尺","等高線","凡例"], a:0, exp:"方位記号で方向。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_map", q:"地図の縮尺1:10000は何を示す？", c:["地図1cmが実際100m","地図1cmが実際10m","地図1cmが実際1km","地図1cmが実際1m"], a:0, exp:"1cm→10000cm=100m。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"civics", patternGroup:"soc_public_facilities", q:"市役所の仕事として正しいものは？", c:["住民票の発行","裁判を行う","法を作る","通貨を発行"], a:0, exp:"住民サービス。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_landform", q:"川が運ぶ土砂がたまってできる地形は？", c:["三角州","火山","台地","盆地"], a:0, exp:"川の堆積=三角州。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_climate", q:"雨が多く蒸し暑い地域の気候は？", c:["温暖湿潤","乾燥","寒帯","冷帯"], a:0, exp:"日本は温暖湿潤。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"history", patternGroup:"soc_history_people", q:"江戸時代の将軍はどの武家？", c:["徳川","源氏","平氏","藤原"], a:0, exp:"徳川将軍。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"history", patternGroup:"soc_history_people", q:"聖徳太子が推進した制度は？", c:["冠位十二階","鎖国","徴兵","地租改正"], a:0, exp:"冠位十二階。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_japan_regions", q:"北海道は日本のどの地方？", c:["北海道地方","東北地方","関東地方","近畿地方"], a:0, exp:"北海道は独立した地方。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_japan_regions", q:"九州地方に含まれる県は？", c:["福岡県","新潟県","長野県","岩手県"], a:0, exp:"福岡は九州。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_transport", q:"大量輸送に向く交通手段は？", c:["船","自転車","徒歩","バイク"], a:0, exp:"船は大量輸送。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"civics", patternGroup:"soc_rules", q:"学校のきまりの目的として適切なのは？", c:["安全で学びやすい環境","成績を下げる","自由をなくす","時間を無駄にする"], a:0, exp:"秩序と安全。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"history", patternGroup:"soc_history_ancient", q:"縄文時代の主な生活は？", c:["狩りと採集","稲作中心","工業生産","貿易中心"], a:0, exp:"縄文は狩猟採集。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"history", patternGroup:"soc_history_ancient", q:"弥生時代に広まった農業は？", c:["稲作","畑作のみ","牧畜","漁業"], a:0, exp:"稲作が広がる。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_population", q:"人口が多く交通が便利な地域を何という？", c:["都市","農村","山地","無人地"], a:0, exp:"都市。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_industry", q:"米作りがさかんな産業は？", c:["農業","工業","商業","情報産業"], a:0, exp:"米作り=農業。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"civics", patternGroup:"soc_tax_basic", q:"道路や学校を支えるお金の集め方は？", c:["税金","寄付だけ","宝くじ","借金だけ"], a:0, exp:"公共サービスは税金。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_compass", q:"方位記号でNは何を表す？", c:["北","南","東","西"], a:0, exp:"N=North=北。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"history", patternGroup:"soc_history_modern", q:"明治時代に始まった新しい学校制度は？", c:["学制","五箇条の御誓文","征夷大将軍","鎖国"], a:0, exp:"学制=学校制度。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_disaster", q:"地震が起きたときの行動として正しいものは？", c:["机の下に入る","窓を開ける","火をつける","外に走る"], a:0, exp:"身を守る。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"geo", patternGroup:"soc_timezones", q:"経度15°の差は時差何時間？", c:["1時間","2時間","3時間","4時間"], a:0, exp:"15°=1時間。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"geo", patternGroup:"soc_industry_location", q:"大都市周辺に多い産業は？", c:["第三次産業","第一次産業","牧畜","林業"], a:0, exp:"サービス業など。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"geo", patternGroup:"soc_monsoon", q:"夏に太平洋高気圧の影響で日本は？", c:["高温多湿","低温乾燥","大雪","乾季"], a:0, exp:"夏は高温多湿。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"civics", patternGroup:"soc_constitution", q:"日本国憲法の三大原則に含まれるのは？", c:["基本的人権の尊重","軍事優先","治外法権","関税自主権"], a:0, exp:"三原則の一つ。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"civics", patternGroup:"soc_legislative", q:"法律を制定する機関は？", c:["国会","内閣","裁判所","警察"], a:0, exp:"立法=国会。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"civics", patternGroup:"soc_executive", q:"法律を実行する機関は？", c:["内閣","国会","裁判所","地方議会"], a:0, exp:"行政=内閣。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"civics", patternGroup:"soc_judicial", q:"法律に照らして判断する機関は？", c:["裁判所","内閣","国会","総務省"], a:0, exp:"司法=裁判所。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"history", patternGroup:"soc_history_medieval", q:"鎌倉幕府を開いた人物は？", c:["源頼朝","足利尊氏","織田信長","豊臣秀吉"], a:0, exp:"源頼朝。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"history", patternGroup:"soc_history_medieval", q:"室町時代の文化として正しいものは？", c:["金閣","埴輪","平等院","浮世絵"], a:0, exp:"金閣は室町。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"history", patternGroup:"soc_history_edo", q:"江戸時代に行われた参勤交代の目的は？", c:["大名を統制する","貿易を増やす","農民を移住させる","税を廃止する"], a:0, exp:"大名統制。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_resources", q:"石油資源が豊富な地域として正しいものは？", c:["中東","東南アジア","北欧","オセアニア"], a:0, exp:"中東が主要産地。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_trade", q:"輸出と輸入の差額を何という？", c:["貿易収支","GDP","関税","物価"], a:0, exp:"貿易収支。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_population", q:"人口が減少し続ける社会で起こりやすいことは？", c:["高齢化の進行","若年人口の増加","労働力の急増","住宅不足の悪化"], a:0, exp:"少子高齢化が進む。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_election", q:"満18歳以上が投票できる制度は？", c:["普通選挙","制限選挙","間接税","地方税"], a:0, exp:"普通選挙。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_budget", q:"国の歳入の主な財源は？", c:["税","宝くじ","寄付","罰金"], a:0, exp:"税収が中心。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_local", q:"地方公共団体の長は誰が選ぶ？", c:["住民","内閣","国会","裁判所"], a:0, exp:"住民の直接選挙。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"history", patternGroup:"soc_history_meiji", q:"明治時代に廃止された身分制度は？", c:["士農工商","藩","五人組","鎖国"], a:0, exp:"四民平等へ。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"history", patternGroup:"soc_history_modern", q:"日清戦争後に得た領土は？", c:["台湾","北海道","沖縄","樺太"], a:0, exp:"下関条約で台湾。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"history", patternGroup:"soc_history_modern", q:"第一次世界大戦中に起きた日本の好景気は？", c:["大戦景気","バブル景気","いざなぎ景気","平成景気"], a:0, exp:"大戦景気。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_agriculture", q:"日本で冷涼な地域に適した作物は？", c:["じゃがいも","さとうきび","バナナ","米（超高温）"], a:0, exp:"北海道などでじゃがいも。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_urban", q:"都市化が進むと起こりやすい問題は？", c:["交通渋滞","水田の増加","人口の均等化","農業人口の増加"], a:0, exp:"交通渋滞。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_climate", q:"日本海側の冬に雪が多い理由は？", c:["季節風が水蒸気を運ぶ","海が凍る","地形が平ら","低気圧がない"], a:0, exp:"季節風と日本海。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_human_rights", q:"人権が生まれながらに持つ権利であることを何という？", c:["自然権","私権","国家権","軍事権"], a:0, exp:"自然権思想。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_law", q:"犯罪に対する刑罰を定めた法律は？", c:["刑法","民法","商法","憲法"], a:0, exp:"刑法。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_economy", q:"景気が悪いときに政府が行うこととして適切なのは？", c:["公共事業を増やす","税率を大幅に上げる","支出をゼロにする","輸入を禁止する"], a:0, exp:"景気刺激策。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_timezones_calc", q:"日本(東経135°)が午前9時のとき、東経15°の都市の時刻は？", c:["午前1時","午前5時","午後3時","正午"], a:0, exp:"差120°=8時間。西へ8時間遅い。" },

    /* ========= 追加 国語 20 ========= */
    { sub:"国語", level:"小", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_basic2", q:"次の漢字の読みは？「海」", c:["うみ","かい","うめ","みず"], a:0, exp:"海=うみ。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"ja_word_antonym_easy2", q:"「明るい」の反対の意味の言葉はどれ？", c:["くらい","にぎやか","広い","白い"], a:0, exp:"明るい↔くらい。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"ja_particle_basic2", q:"文に入る助詞として正しいものは？「図書館（　）本を借りる。」", c:["で","を","に","へ"], a:0, exp:"場所は「で」。" },
    { sub:"国語", level:"小", diff:"基礎", pattern:"reading", patternGroup:"ja_reading_simple2", q:"文「花だんに水をやった。」から分かることは？", c:["花だんに水をまいた","花だんの花を切った","水をこぼした","花だんを動かした"], a:0, exp:"水をやった=水をまいた。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_read_mid2", q:"次の漢字の読みは？「季節」", c:["きせつ","きせい","きせち","きしつ"], a:0, exp:"季節=きせつ。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"kanji", patternGroup:"ja_kanji_write2", q:"「およぐ」を漢字で書くと？", c:["泳ぐ","永ぐ","詠ぐ","泳げ"], a:0, exp:"泳ぐ。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"vocab", patternGroup:"ja_word_synonym_easy2", q:"「静か」と同じ意味に近い言葉は？", c:["おとなしい","にぎやか","うるさい","はげしい"], a:0, exp:"静か=おとなしい。" },
    { sub:"国語", level:"小", diff:"標準", pattern:"grammar", patternGroup:"ja_conjunction_basic2", q:"文をつなぐ言葉として正しいものは？「今日は寒い。（　）コートを着た。」", c:["だから","しかし","つまり","例えば"], a:0, exp:"原因→結果で「だから」。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"vocab", patternGroup:"ja_word_meaning_mid2", q:"「協力」の意味として適切なのは？", c:["力を合わせる","意見を否定する","一人で進む","見ているだけ"], a:0, exp:"協力=力を合わせる。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"kanji", patternGroup:"ja_kanji_read_jhs2", q:"次の語の読みは？「迅速」", c:["じんそく","じんそ","しんそく","じんさく"], a:0, exp:"迅速=じんそく。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"ja_sentence_structure2", q:"文に合う語は？「勉強（　）結果、合格した。」", c:["した","する","すると","して"], a:0, exp:"勉強した結果。" },
    { sub:"国語", level:"中", diff:"基礎", pattern:"reading", patternGroup:"ja_reading_cause2", q:"文「雨が続いたため、川の水位が上がった。」の原因は？", c:["雨が続いた","川がせき止められた","雪が解けた","潮が満ちた"], a:0, exp:"原因は雨が続いたこと。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"idiom", patternGroup:"ja_idiom_mid2", q:"「頭が切れる」の意味として適切なのは？", c:["判断が速い","力が強い","背が高い","すぐ怒る"], a:0, exp:"頭の回転が速い。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"ja_word_meaning_mid3", q:"「適切」の意味として正しいものは？", c:["状況に合っている","偶然に起きる","極端に多い","意味が不明"], a:0, exp:"適切=ちょうどよい。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"ja_conjunction_mid2", q:"文をつなぐ言葉として正しいものは？「準備をした。（　）練習を始めた。」", c:["そして","だから","しかし","ところで"], a:0, exp:"順接の「そして」。" },
    { sub:"国語", level:"中", diff:"標準", pattern:"reading", patternGroup:"ja_reading_summary2", q:"文「ごみを分別して資源を再利用する。」の要約は？", c:["リサイクルに取り組む","ごみを増やす","資源を捨てる","分別をやめる"], a:0, exp:"再利用=リサイクル。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"idiom", patternGroup:"ja_yojijukugo3", q:"「本末転倒」の意味として正しいものは？", c:["手段と目的が入れ替わる","努力が報われる","急いで進む","慎重に考える"], a:0, exp:"本末転倒=目的と手段の逆転。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_read_advanced2", q:"次の語の読みは？「顕著」", c:["けんちょ","げんちょ","けんじょ","けんちゃく"], a:0, exp:"顕著=けんちょ。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"kanji", patternGroup:"ja_kanji_read_advanced3", q:"次の語の読みは？「羅列」", c:["られつ","らせつ","らねつ","られち"], a:0, exp:"羅列=られつ。" },
    { sub:"国語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"ja_sentence_refine2", q:"次の文のより適切な表現は？「急いでいた。だから忘れ物をした。」", c:["急いでいたため、忘れ物をした。","急いでいた、しかし忘れ物をした。","急いでいたので、忘れ物をしない。","急いでいた、つまり忘れ物をしない。"], a:0, exp:"因果関係は「ため」。" },

    /* ========= 追加 数学 20 ========= */
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_add_basic2", q:"450+230= ?", c:["680","670","660","720"], a:0, exp:"450+230=680。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_sub_basic2", q:"72−39= ?", c:["33","43","31","29"], a:0, exp:"72-39=33。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_mul_basic2", q:"6×9= ?", c:["54","45","63","49"], a:0, exp:"6×9=54。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"number", patternGroup:"math_div_basic2", q:"81÷9= ?", c:["9","8","7","6"], a:0, exp:"81÷9=9。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"fraction", patternGroup:"math_fraction_compare2", q:"2/5と3/7ではどちらが大きい？", c:["3/7","2/5","同じ","比べられない"], a:0, exp:"3/7≈0.43>0.4。" },
    { sub:"数学", level:"小", diff:"基礎", pattern:"geometry", patternGroup:"math_diameter", q:"円の直径は半径の何倍？", c:["2倍","3倍","1/2倍","4倍"], a:0, exp:"直径=2×半径。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"decimal", patternGroup:"math_decimal_add2", q:"3.2+1.45= ?", c:["4.65","4.75","3.65","5.15"], a:0, exp:"小数点をそろえる。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"geometry", patternGroup:"math_area_triangle2", q:"底辺10cm、高さ6cmの三角形の面積は？", c:["30cm²","60cm²","16cm²","40cm²"], a:0, exp:"(10×6)/2=30。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"word", patternGroup:"math_word_change2", q:"500円を持って120円のパンを2つ買った。残りはいくら？", c:["260円","240円","280円","200円"], a:0, exp:"500-120×2=260。" },
    { sub:"数学", level:"小", diff:"標準", pattern:"data", patternGroup:"math_average_basic2", q:"2,4,6,8の平均は？", c:["5","4","6","8"], a:0, exp:"(2+4+6+8)/4=5。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_integer_signed2", q:"(−4)−(−7)= ?", c:["3","−3","11","−11"], a:0, exp:"-4+7=3。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"algebra", patternGroup:"math_linear_eq2", q:"3x=18 のxは？", c:["6","9","3","12"], a:0, exp:"x=6。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"geometry", patternGroup:"math_circle_circumference2", q:"半径3cmの円の円周をπで表すと？", c:["6π","9π","3π","12π"], a:0, exp:"円周=2πr。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"ratio", patternGroup:"math_ratio_percent2", q:"200の25%は？", c:["50","25","75","100"], a:0, exp:"0.25×200=50。" },
    { sub:"数学", level:"中", diff:"基礎", pattern:"probability", patternGroup:"math_probability_even", q:"サイコロを1個投げる。偶数が出る確率は？", c:["1/2","1/3","2/3","1/6"], a:0, exp:"偶数3通り/6。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"function", patternGroup:"math_linear_function2", q:"一次関数 y=3x−1 のx=2のときのyは？", c:["5","4","7","1"], a:0, exp:"y=6-1=5。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"geometry", patternGroup:"math_parallelogram_area", q:"底辺7cm、高さ4cmの平行四辺形の面積は？", c:["28cm²","14cm²","22cm²","32cm²"], a:0, exp:"7×4=28。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"algebra", patternGroup:"math_factor_basic2", q:"x^2−9 を因数分解すると？", c:["(x+3)(x−3)","(x+9)(x−1)","(x−9)(x+1)","(x−3)(x−3)"], a:0, exp:"平方差の公式。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"sequence", patternGroup:"math_arithmetic2", q:"等差数列で初項5、公差3。第6項は？", c:["20","23","18","17"], a:0, exp:"5+5×3=20。" },
    { sub:"数学", level:"中", diff:"標準", pattern:"probability", patternGroup:"math_probability_balls", q:"赤5個、青3個の玉から1個取り出す。赤が出る確率は？", c:["5/8","3/8","1/2","2/5"], a:0, exp:"全8個中赤5個。" },

    /* ========= 追加 英語 20 ========= */
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_word2", q:"Choose the correct word: This is a (   ). (ほん)", c:["book","desk","milk","bike"], a:0, exp:"book=ほん。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_basic_color2", q:"Choose the color: A banana is (   ).", c:["yellow","purple","blue","gray"], a:0, exp:"Banana is yellow." },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_present_s2", q:"Choose the correct verb: She (   ) soccer on Sundays.", c:["plays","play","playing","played"], a:0, exp:"三単現は- s。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_plural_irregular", q:"Choose the plural: one child → two (   )", c:["children","childs","childes","child"], a:0, exp:"childの複数はchildren。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_preposition_place2", q:"Choose the correct preposition: I live (   ) Japan.", c:["in","on","at","by"], a:0, exp:"国名はin。" },
    { sub:"英語", level:"小", diff:"基礎", pattern:"reading", patternGroup:"eng_read_simple3", q:"Read: \"This is my sister. She is ten.\" How old is she?", c:["ten","twelve","eight","seven"], a:0, exp:"She is ten." },
    { sub:"英語", level:"小", diff:"基礎", pattern:"vocab", patternGroup:"eng_months", q:"Which is a month?", c:["January","Sunday","Lunch","River"], a:0, exp:"January is a month." },
    { sub:"英語", level:"小", diff:"基礎", pattern:"grammar", patternGroup:"eng_quantifier", q:"Choose the correct word: There are (   ) apples on the table.", c:["many","much","a","an"], a:0, exp:"applesは可算でmany。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_past_simple2", q:"Choose the correct past tense: I (   ) to the park yesterday.", c:["went","go","goes","going"], a:0, exp:"goの過去形はwent。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_comparative2", q:"Choose the correct word: This movie is (   ) than that one.", c:["more interesting","interesting","most interesting","interest"], a:0, exp:"長い形容詞はmore。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"vocab", patternGroup:"eng_opposites2", q:"Choose the opposite of \"begin\".", c:["end","start","make","open"], a:0, exp:"begin↔end。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_can_request", q:"Choose the correct word: Can I (   ) the window?", c:["open","opens","opening","opened"], a:0, exp:"canの後は原形。" },
    { sub:"英語", level:"中", diff:"基礎", pattern:"reading", patternGroup:"eng_read_detail2", q:"Read: \"Lisa is taller than Ken.\" Who is taller?", c:["Lisa","Ken","Both","Neither"], a:0, exp:"Lisa is taller." },
    { sub:"英語", level:"中", diff:"基礎", pattern:"grammar", patternGroup:"eng_negative_do", q:"Choose the correct verb: He doesn't (   ) TV.", c:["watch","watches","watching","watched"], a:0, exp:"doesn't + 動詞原形。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_first_conditional", q:"Choose the correct form: If it rains, we (   ) stay home.", c:["will","are","was","did"], a:0, exp:"条件節+will。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"grammar", patternGroup:"eng_should", q:"Choose the correct word: You should (   ) early.", c:["go","goes","going","went"], a:0, exp:"should + 動詞原形。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"vocab", patternGroup:"eng_borrow_lend", q:"Choose the correct word: Can I (   ) your pen?", c:["borrow","lend","borrowed","lended"], a:0, exp:"借りる=borrow。" },
    { sub:"英語", level:"中", diff:"標準", pattern:"reading", patternGroup:"eng_read_reason", q:"Read: \"We have a test next week, so we are studying.\" Why are they studying?", c:["They have a test next week.","They are bored.","They are traveling.","They have no homework."], a:0, exp:"理由はテスト。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_passive", q:"Choose the correct form: The cake (   ) by Tom.", c:["was eaten","ate","was eat","is eat"], a:0, exp:"受け身はbe+過去分詞。" },
    { sub:"英語", level:"中", diff:"発展", pattern:"grammar", patternGroup:"eng_present_perfect", q:"Choose the correct form: She (   ) here for five years.", c:["has lived","lived","is living","was living"], a:0, exp:"現在完了の継続。" },

    /* ========= 追加 理科 20 ========= */
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_respiration_basic", q:"動物が呼吸で取り入れる気体は？", c:["酸素","二酸化炭素","窒素","水素"], a:0, exp:"呼吸で酸素を取り入れる。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"biology", patternGroup:"sci_insect_legs", q:"昆虫の足の本数は？", c:["6本","4本","8本","10本"], a:0, exp:"昆虫は6本足。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"physics", patternGroup:"sci_conductor_basic", q:"電気をよく通すものは？", c:["銅","木","プラスチック","ガラス"], a:0, exp:"金属は電気を通す。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"physics", patternGroup:"sci_shadow", q:"影ができる理由は？", c:["光がさえぎられる","光が増える","空気が冷える","音が反射する"], a:0, exp:"光が遮られると影ができる。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"chemistry", patternGroup:"sci_soluble", q:"水に溶けやすいものは？", c:["砂糖","砂","木片","石"], a:0, exp:"砂糖は水に溶ける。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"earth", patternGroup:"sci_moon_phases", q:"月の満ち欠けが起こる主な原因は？", c:["月の公転","月の自転","太陽が動く","地球が止まる"], a:0, exp:"月が地球の周りを回るため。" },
    { sub:"理科", level:"小", diff:"基礎", pattern:"earth", patternGroup:"sci_seasons", q:"季節によって見える星座が変わる理由は？", c:["地球の公転","地球の自転","月の公転","太陽が近づく"], a:0, exp:"地球の公転で夜空の方向が変わる。" },
    { sub:"理科", level:"小", diff:"標準", pattern:"biology", patternGroup:"sci_food_chain", q:"食物連鎖で植物は何と呼ばれる？", c:["生産者","消費者","分解者","捕食者"], a:0, exp:"植物は生産者。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"biology", patternGroup:"sci_photosynthesis_gas", q:"光合成で使われる気体は？", c:["二酸化炭素","酸素","窒素","水素"], a:0, exp:"二酸化炭素を取り込む。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"physics", patternGroup:"sci_voltage_unit", q:"電圧の単位は？", c:["V","A","Ω","W"], a:0, exp:"電圧はボルト(V)。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"chemistry", patternGroup:"sci_acid_base", q:"酸性の身近な例として正しいものは？", c:["レモン汁","石けん水","アンモニア水","重曹水"], a:0, exp:"レモン汁は酸性。" },
    { sub:"理科", level:"中", diff:"基礎", pattern:"earth", patternGroup:"sci_volcano", q:"火山から噴き出す高温の溶けた物質は？", c:["マグマ","花こう岩","砂利","石灰岩"], a:0, exp:"溶岩のもと=マグマ。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"physics", patternGroup:"sci_ohm_law", q:"電圧6V、電流2Aのときの抵抗は？", c:["3Ω","12Ω","8Ω","1Ω"], a:0, exp:"R=V/I=3Ω。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"chemistry", patternGroup:"sci_boiling_point", q:"液体が沸騰し始める温度を何という？", c:["沸点","融点","露点","発火点"], a:0, exp:"沸点=沸騰温度。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"biology", patternGroup:"sci_cell_division", q:"細胞分裂の主な目的は？", c:["個体や組織を増やす","光を集める","音を伝える","呼吸を止める"], a:0, exp:"成長や修復のために増える。" },
    { sub:"理科", level:"中", diff:"標準", pattern:"earth", patternGroup:"sci_low_pressure", q:"低気圧が近づくと起こりやすい天気は？", c:["雨やくもり","快晴","乾燥","強い寒さ"], a:0, exp:"低気圧は天気が崩れやすい。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_convex_lens", q:"凸レンズがつくる実像の特徴として正しいものは？", c:["倒立してできる","正立してできる","必ず拡大する","必ず見えない"], a:0, exp:"実像は倒立。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"chemistry", patternGroup:"sci_chemical_equation", q:"H₂とO₂が反応して水ができる式として正しいものは？", c:["2H₂+O₂→2H₂O","H₂+O₂→H₂O","H₂+2O₂→H₂O₂","2H₂+2O₂→2H₂O₂"], a:0, exp:"係数をそろえる。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"physics", patternGroup:"sci_density", q:"同じ体積で質量が大きい物質ほど何が大きい？", c:["密度","電流","温度","抵抗"], a:0, exp:"密度=質量/体積。" },
    { sub:"理科", level:"中", diff:"発展", pattern:"earth", patternGroup:"sci_plate_boundary", q:"プレートの境界で起こりやすい現象は？", c:["地震や火山活動","潮の満ち引き","日食","オーロラ"], a:0, exp:"境界で地殻変動。" },

    /* ========= 追加 社会 20 ========= */
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_capital", q:"日本の首都はどこ？", c:["東京","大阪","名古屋","福岡"], a:0, exp:"首都は東京。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_river", q:"日本で最も長い川は？", c:["信濃川","利根川","木曽川","最上川"], a:0, exp:"信濃川が最長。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"history", patternGroup:"soc_history_jomon", q:"縄文時代の代表的な道具は？", c:["土器","鉄砲","銅鏡","蒸気機関"], a:0, exp:"縄文土器。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"civics", patternGroup:"soc_tax_basic", q:"税金の使い道として正しいものは？", c:["道路や学校の整備","個人の貯金","私的な買い物","遊園地の入場券"], a:0, exp:"公共サービスに使われる。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"geo", patternGroup:"soc_island_country", q:"海に囲まれた国の形を何という？", c:["島国","内陸国","半島国","大陸国"], a:0, exp:"海に囲まれた国は島国。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"history", patternGroup:"soc_history_taika", q:"大化の改新を進めた中心人物は？", c:["中大兄皇子と中臣鎌足","聖徳太子と蘇我氏","徳川家康と豊臣秀吉","源頼朝と北条氏"], a:0, exp:"中大兄皇子・中臣鎌足。" },
    { sub:"社会", level:"小", diff:"基礎", pattern:"civics", patternGroup:"soc_election_basic", q:"選挙で一人が一票を持つ考え方は？", c:["一人一票","身分制","多数決","義務教育"], a:0, exp:"一人一票の原則。" },
    { sub:"社会", level:"小", diff:"標準", pattern:"geo", patternGroup:"soc_climate_basic2", q:"赤道付近に多い気候は？", c:["熱帯","寒帯","温帯","冷帯"], a:0, exp:"赤道付近は熱帯。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"civics", patternGroup:"soc_constitution", q:"日本国憲法の三原則の一つは？", c:["国民主権","身分制度","軍事優先","王権神授"], a:0, exp:"三原則は国民主権など。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"geo", patternGroup:"soc_population_density", q:"人口密度を求める式は？", c:["人口÷面積","面積÷人口","人口×面積","面積−人口"], a:0, exp:"人口/面積。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"history", patternGroup:"soc_history_edo2", q:"江戸幕府を開いた人物は？", c:["徳川家康","織田信長","豊臣秀吉","足利義満"], a:0, exp:"徳川家康。" },
    { sub:"社会", level:"中", diff:"基礎", pattern:"history", patternGroup:"soc_history_meiji2", q:"幕府が政権を返上した出来事は？", c:["大政奉還","鎖国","応仁の乱","大化の改新"], a:0, exp:"大政奉還。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_industry", q:"京浜工業地帯が広がる地域は？", c:["東京湾沿岸","伊勢湾沿岸","瀬戸内海沿岸","北九州沿岸"], a:0, exp:"東京・横浜周辺。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"civics", patternGroup:"soc_separation_powers", q:"三権分立の三つの権力は？", c:["立法・行政・司法","教育・軍事・司法","行政・外交・警察","経済・文化・社会"], a:0, exp:"立法・行政・司法。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"history", patternGroup:"soc_history_modern2", q:"普通選挙法が制定されたのはどの時代の動き？", c:["大正デモクラシー","武家政治","鎖国政策","敗戦直後"], a:0, exp:"大正デモクラシー。" },
    { sub:"社会", level:"中", diff:"標準", pattern:"geo", patternGroup:"soc_trade_basic", q:"輸出の意味として正しいものは？", c:["外国へ売る","外国から買う","国内で売る","国内で買う"], a:0, exp:"輸出=国外へ売る。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_house_council", q:"参議院議員の任期は？", c:["6年","4年","3年","2年"], a:0, exp:"参議院は6年。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_eu", q:"EUとは何の略称？", c:["ヨーロッパ連合","東南アジア連合","北米貿易協定","世界銀行"], a:0, exp:"European Union。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"civics", patternGroup:"soc_inflation", q:"インフレーションの説明として正しいものは？", c:["物価が継続的に上がる","物価が下がり続ける","失業がゼロになる","税金がなくなる"], a:0, exp:"インフレ=物価上昇。" },
    { sub:"社会", level:"中", diff:"発展", pattern:"geo", patternGroup:"soc_timezones_basic", q:"地球はおよそ何度で1時間の時差が生じる？", c:["15度","30度","24度","10度"], a:0, exp:"360度/24時間=15度。" },
  ];

  const BANK = DATA.map((q, i) => {
    const qq = Object.assign({}, q);
    if (!qq.patternGroup) qq.patternGroup = qq.pattern || "p";
    const { shuffledChoices, shuffledAnswerIndex } = shuffleChoices(qq.c, qq.a);
    qq.c = shuffledChoices;
    qq.a = shuffledAnswerIndex;
    qq.uid = makeUid(qq);
    qq.key = toKey(qq, i);
    return qq;
  }).filter(validateQuestion);

  const stats = {};
  SUBJECTS.forEach(s => stats[s] = BANK.filter(x => x.sub === s).length);
  console.log("[BANK stats]", stats, "total:", BANK.length);

  window.BANK = BANK;
})();
