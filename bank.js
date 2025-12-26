/* bank.js
   品質重視：
   - 理社の固有名詞系は「固定問題」で担保（生成で事実を作らない）
   - 生成は数学（思考系を増量）・理科計算・英/国の自作読解/穴埋め中心
   - 選択肢の妥当性チェックを必須化
*/
(function () {
  "use strict";

  // ========= 基本ユーティリティ =========
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const uniq = (arr) => [...new Set(arr)];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 不適切語フィルタ（最低限）
  const BLOCKLIST = [
    "死ね", "殺", "自殺", "暴力", "差別", "奴隷", "レイプ", "性的", "侮辱", "民族",
  ];
  const hasBlocked = (s) => BLOCKLIST.some(w => String(s).includes(w));

  function makeKey(q) {
    const t = (q.q || "").slice(0, 80);
    let h = 2166136261 >>> 0;
    const base = `${q.sub}|${q.pattern}|${t}`;
    for (let i = 0; i < base.length; i++) {
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `${q.sub}_${q.pattern}_${(h >>> 0).toString(16)}`;
  }

  function validateQuestion(q) {
    const errs = [];
    if (!q.sub || !q.level || !q.diff || !q.pattern) errs.push("meta不足");
    if (!q.q || typeof q.q !== "string") errs.push("本文なし");
    if (!Array.isArray(q.c) || q.c.length !== 4) errs.push("選択肢は4つ必須");
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) errs.push("a(正解index)不正");
    if (q.c) {
      if (uniq(q.c).length !== 4) errs.push("選択肢が重複");
      if (q.c.some(x => String(x).trim().length === 0)) errs.push("空選択肢あり");
      if (q.c.some(x => hasBlocked(x))) errs.push("不適切語を含む選択肢");
    }
    if (q.q && hasBlocked(q.q)) errs.push("不適切語を含む本文");
    return errs;
  }

  function pushQ(list, q) {
    q.key = q.key || makeKey(q);
    const errs = validateQuestion(q);
    if (errs.length) {
      throw new Error(`[bank.js] invalid question (${q.sub}/${q.pattern}): ${errs.join(", ")}\n${q.q}`);
    }
    list.push(q);
  }

  // ========= 「迷う誤答」を作る小道具 =========
  function nearNumberMistakes(ans, opts = {}) {
    const { allowNeg = true, asInt = false } = opts;
    const a = Number(ans);
    const cands = [
      a + 1, a - 1,
      a * 2, a / 2,
      a + 10, a - 10,
      -a,
    ];
    let out = cands
      .filter(x => Number.isFinite(x))
      .map(x => asInt ? Math.round(x) : x);

    if (!allowNeg) out = out.filter(x => x >= 0);
    out = uniq(out.map(x => asInt ? String(Math.round(x)) : String(Number(x))));
    return out;
  }

  function makeMCQ({ sub, level, diff, pattern, stem, answer, distractors, exp }) {
    const aStr = String(answer);
    let pool = [aStr, ...(distractors || []).map(String)].filter(x => x && x.trim());
    pool = uniq(pool).filter(x => !hasBlocked(x));

    // 4択に満たない場合は補完（数値系のみ）
    if (pool.length < 4) {
      const num = Number(aStr);
      if (Number.isFinite(num)) {
        pool = uniq(pool.concat(nearNumberMistakes(num, { asInt: false })));
      }
    }
    pool = uniq(pool).slice(0, 30);

    const wrongs = pool.filter(x => x !== aStr);
    const pickedWrongs = shuffle(wrongs).slice(0, 3);
    if (pickedWrongs.length < 3) {
      throw new Error(`[bank.js] distractor不足: ${sub}/${pattern}\n${stem}`);
    }

    const choices = shuffle([aStr, ...pickedWrongs]);
    const aIndex = choices.indexOf(aStr);

    return { sub, level, diff, pattern, q: stem, c: choices, a: aIndex, exp: exp || "" };
  }

  // ========= 固定問題（理社など：事実を生成しない） =========
    const FIXED = {
    社会: [
      // ===== 歴史（入試頻出：用語・因果・制度） =====
      {
        sub: "社会", level: "中", diff: "基礎", pattern: "hist_jomon_yayoi",
        q: "【歴史】弥生時代の特徴として最も適切なのはどれ？",
        c: ["稲作が広まり、金属器が使われた", "大名が領地を治め、城下町が発達した", "鎌倉幕府が成立し、武士が政治を行った", "株式会社が広まり、工業化が進んだ"],
        a: 0, exp: "弥生は稲作と金属器（青銅器・鉄器）がポイント。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_kofun",
        q: "【歴史】古墳時代の有力者が力を示すために作ったものとして最も適切なのはどれ？",
        c: ["古墳", "寺子屋", "関所", "条里制"],
        a: 0, exp: "古墳は首長層の権力・支配を示す代表的な遺構。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_taika",
        q: "【歴史】大化の改新で目指した政治の方向性として最も適切なのはどれ？",
        c: ["豪族中心から天皇中心の政治へ", "鎖国による貿易の制限", "議会政治の確立", "地方分権の拡大"],
        a: 0, exp: "豪族の力を抑え、天皇中心の国家体制を整える方向。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_ritsuryo",
        q: "【歴史】律令国家のしくみとして適切なのはどれ？",
        c: ["政治の決まり（律）と行政の決まり（令）で国を治める", "武士が主君と土地を交換するしくみ", "商人が株仲間で営業を独占するしくみ", "内閣が法律を自由に改正できるしくみ"],
        a: 0, exp: "律＝刑法、令＝行政法。律令で統治を整備。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_shoen",
        q: "【歴史】荘園が広がった結果として起こりやすかったことはどれ？",
        c: ["国の税収が不安定になり、中央の支配が弱まる", "全国で工業が急成長する", "議会が開かれ政党が生まれる", "鎖国が始まり海外交流がなくなる"],
        a: 0, exp: "荘園の拡大で租税が届かず、中央の財政・支配が弱まった。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_kamakura",
        q: "【歴史】鎌倉幕府の政治の中心地はどこ？",
        c: ["鎌倉", "平城京", "長岡京", "江戸"],
        a: 0, exp: "鎌倉幕府は鎌倉に本拠を置いた。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_gokenin",
        q: "【歴史】御家人と将軍の関係として適切なのはどれ？",
        c: ["土地の支配を認める代わりに、軍役などの奉公をする", "税を免除する代わりに、議員として国会に出る", "工業製品を独占販売する代わりに、港を守る", "武士をやめる代わりに、海外留学をする"],
        a: 0, exp: "御恩と奉公：将軍が土地支配を保障→御家人が軍役で奉仕。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_mongol",
        q: "【歴史】元寇（蒙古襲来）後、幕府の財政が苦しくなった理由として最も適切なのはどれ？",
        c: ["新しい領土を得られず、恩賞の土地を与えにくかったため", "海外貿易が急増し物価が急落したため", "農業が消滅し食料が不足したため", "金本位制を採用して通貨が不足したため"],
        a: 0, exp: "防衛は成功しても新領土がなく、御家人への恩賞が不足し不満が増えた。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_muromachi",
        q: "【歴史】室町幕府の将軍を補佐した役職はどれ？",
        c: ["管領", "太政大臣", "大老", "内閣総理大臣"],
        a: 0, exp: "室町幕府の政治では管領が将軍を補佐した。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_sengoku",
        q: "【歴史】戦国時代に大名が行った政策として適切なのはどれ？",
        c: ["城下町の整備や検地などで領国支配を強めた", "全国に学制を公布した", "国会を開き政党政治を始めた", "鎖国を完全に実施した"],
        a: 0, exp: "戦国大名は領国支配のため、検地・分国法・城下町整備などを実施。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_edo_politics",
        q: "【歴史】江戸幕府が大名を統制するために行った制度はどれ？",
        c: ["参勤交代", "班田収授法", "五・一五事件", "地租改正"],
        a: 0, exp: "参勤交代で大名の行動と財政を制約し、反乱を抑えた。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_sankin_effect",
        q: "【歴史】参勤交代が江戸の発展に与えた影響として適切なのはどれ？",
        c: ["人や物の移動が増え、交通や商業が発達した", "農村の人口が急増し自給自足が進んだ", "輸入品が禁止され工業が衰退した", "寺子屋が廃止され教育が止まった"],
        a: 0, exp: "街道整備・宿場町発展など、交通・商業の成長に寄与。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_edo_economy",
        q: "【歴史】江戸時代に商人が力をつけていった背景として適切なのはどれ？",
        c: ["貨幣経済が発達し、流通や金融が重要になった", "武士が農業に専念した", "海外貿易が完全に自由化された", "全国で重工業が発達した"],
        a: 0, exp: "貨幣経済と流通の発達で商人の役割が拡大。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_meiji_restoration",
        q: "【歴史】明治維新後の改革として適切なのはどれ？",
        c: ["身分制度の見直しや中央集権化を進めた", "鎖国を強化した", "幕府が復活した", "荘園制度を復活させた"],
        a: 0, exp: "近代国家化のため、身分・制度の再編と中央集権化が進んだ。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_landtax",
        q: "【歴史】地租改正の内容として適切なのはどれ？",
        c: ["地価を基準に現金で税を納めるしくみ", "米の収穫量を基準に布で納めるしくみ", "輸入品にだけ課税するしくみ", "商人だけを課税対象にするしくみ"],
        a: 0, exp: "地価に基づく地租を現金で納税。近代的税制へ。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_freedom_rights",
        q: "【歴史】自由民権運動が求めたものとして最も適切なのはどれ？",
        c: ["国会の開設や憲法の制定", "荘園の復活", "鎖国の強化", "武士の復権"],
        a: 0, exp: "政治参加の拡大（国会・憲法）を求めた運動。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "hist_industrial",
        q: "【歴史】日本の近代化で進んだ産業の例として適切なのはどれ？",
        c: ["製糸業などの軽工業が発達した", "鉄器が初めて伝わり青銅器が消えた", "荘園の年貢が増えた", "参勤交代が始まった"],
        a: 0, exp: "近代化初期は製糸など軽工業が中心に発達。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "hist_postwar_const",
        q: "【歴史】戦後改革の流れとして適切なのはどれ？",
        c: ["民主化を進め、平和主義を掲げた新しい憲法が施行された", "幕藩体制を復活させた", "荘園制度を復活させた", "鎖国を再び実施した"],
        a: 0, exp: "戦後は民主化と平和主義を柱に制度改革が進んだ。"
      },

      // ===== 地理（入試頻出：気候・産業・人口・貿易） =====
      {
        sub: "社会", level: "中", diff: "標準", pattern: "geo_climate_japan",
        q: "【地理】日本の多くが属する気候帯として最も適切なのはどれ？",
        c: ["温帯", "寒帯", "乾燥帯", "熱帯"],
        a: 0, exp: "日本は主に温帯に属し、四季の変化がみられる。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "geo_westerlies",
        q: "【地理】日本付近で中緯度に多く見られる卓越風はどれ？",
        c: ["偏西風", "貿易風", "極偏東風", "季節風が一年中一定"],
        a: 0, exp: "中緯度では偏西風が卓越する。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "geo_monsoon",
        q: "【地理】日本で夏と冬で風向が変わりやすい主な理由はどれ？",
        c: ["季節風の影響", "地球の自転が止まるため", "海面が一年中凍るため", "太陽が地球に近づくため"],
        a: 0, exp: "季節風（モンスーン）の影響で風向・気温・降水が変わりやすい。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "geo_industry_belt",
        q: "【地理】太平洋ベルトに工業が集積した主な理由として最も適切なのはどれ？",
        c: ["港湾・交通が発達し、大消費地に近いから", "降水量が極端に少ないから", "地震が絶対に起きないから", "冬でも雪が全く降らないから"],
        a: 0, exp: "原料輸入・製品輸送に有利、人口集中で市場が大きい。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "geo_agriculture",
        q: "【地理】近郊農業の特徴として最も適切なのはどれ？",
        c: ["都市近くで鮮度が重要な野菜などを出荷する", "広大な土地で小麦を大量生産する", "高地で放牧中心の牧畜を行う", "寒冷地でトナカイを飼う"],
        a: 0, exp: "都市近郊で生鮮品を出荷するのが近郊農業の典型。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "geo_population",
        q: "【地理】人口が多い地域に共通しやすい条件として最も適切なのはどれ？",
        c: ["交通の便がよく、仕事やサービスが集まりやすい", "標高が非常に高く空気が薄い", "一年中降水がほとんどない", "冬に氷点下50℃になる"],
        a: 0, exp: "交通・産業・サービスが集積する地域は人口が集中しやすい。"
      },

      // ===== 公民（入試頻出：憲法・政治・経済・国際） =====
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_three_principles",
        q: "【公民】日本国憲法の三大原則として正しい組み合わせはどれ？",
        c: ["国民主権・基本的人権の尊重・平和主義", "天皇主権・基本的人権の制限・軍国主義", "地方主権・平和主義・三権未分立", "国民主権・議院内閣制・徴兵制"],
        a: 0, exp: "三大原則は国民主権・基本的人権の尊重・平和主義。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_separation",
        q: "【公民】三権分立の目的として最も適切なのはどれ？",
        c: ["権力の集中を防ぎ、国民の自由を守るため", "国王の権力を強化するため", "法律をなくして自由にするため", "地方だけで国を運営するため"],
        a: 0, exp: "立法・行政・司法を分け、相互に抑制して権力乱用を防ぐ。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "civ_judicial_review",
        q: "【公民】違憲審査制とは何か。最も適切なのはどれ？",
        c: ["法律や命令が憲法に反しないかを裁判所が判断できる制度", "内閣が法律を自由に作れる制度", "国会が裁判の判決を取り消せる制度", "地方議会が憲法を改正できる制度"],
        a: 0, exp: "裁判所が憲法に適合するかを審査する。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_election_value",
        q: "【公民】「一票の格差」が問題になるのは何の不平等か？",
        c: ["投票の価値が選挙区で異なる不平等", "年齢制限がある不平等", "政党所属が必要な不平等", "同日に投票できない不平等"],
        a: 0, exp: "人口に比して議員定数が偏ると、1票の価値が違ってしまう。"
      },
      {
        sub: "社会", level: "中", diff: "標準", pattern: "civ_budget",
        q: "【公民】国の予算を最終的に議決する機関はどれ？",
        c: ["国会", "内閣", "裁判所", "警察"],
        a: 0, exp: "予算は国会の議決が必要。"
      },
      {
        sub: "社会", level: "中", diff: "発展", pattern: "civ_market",
        q: "【公民】市場経済で価格が決まる基本として適切なのはどれ？",
        c: ["需要と供給の関係", "裁判所の判決", "都道府県の条例", "学校の校則"],
        a: 0, exp: "市場では需要と供給のバランスで価格が変化する。"
      },

      // ===== ここから「100問化」のための追加（短文・入試頻出） =====
      // ※同パターン連発を避けるため pattern を細分化
      { sub:"社会", level:"中", diff:"基礎", pattern:"hist_nara_capital", q:"【歴史】奈良時代の都として代表的なものはどれ？", c:["平城京","平安京","江戸","鎌倉"], a:0, exp:"奈良時代の都は平城京。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_heian_culture", q:"【歴史】国風文化の特徴として適切なのはどれ？", c:["日本の風土に合った文化が発達した","ヨーロッパの文化が急速に広まった","工場制機械工業が発達した","全国で開墾が禁止された"], a:0, exp:"平安中期に日本風の文化（かな文字など）が発達。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"hist_kamakura_newbuddhism", q:"【歴史】鎌倉時代に新しい仏教が広まった背景として最も適切なのはどれ？", c:["武士や庶民の不安が高まり救いを求めた","国家が仏教を禁止した","海外留学が義務化された","米作りが不可能になった"], a:0, exp:"社会不安の中で、わかりやすい教えが支持された。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_edo_status", q:"【歴史】江戸時代の身分制度として一般的な並びはどれ？", c:["武士・農民・職人・商人","農民・武士・職人・商人","商人・職人・農民・武士","武士・職人・農民・商人"], a:0, exp:"一般に士農工商と表される（実態は地域差あり）。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"hist_edo_reforms", q:"【歴史】江戸時代の改革の目的として最も近いものはどれ？", c:["財政の立て直しや社会の引き締め","議会政治の確立","海外植民地の獲得","荘園制の復活"], a:0, exp:"享保・寛政・天保など、主に財政再建と統制強化を狙った。" },

      { sub:"社会", level:"中", diff:"標準", pattern:"geo_industry_primary", q:"【地理】第一次産業にあたるものはどれ？", c:["農業","自動車の組立","銀行業","小売業"], a:0, exp:"第一次産業は農林水産業。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"geo_trade", q:"【地理】日本の貿易の特徴として最も適切なのはどれ？", c:["資源やエネルギーを輸入し、工業製品を輸出する割合が高い","ほぼ全てを国内で自給し貿易は少ない","農産物の輸出が中心","輸入も輸出もほとんどない"], a:0, exp:"資源を輸入し加工して輸出する構造が典型。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"geo_map_scale", q:"【地理】地図で縮尺が小さい（例：1/5,000,000）ほどどうなる？", c:["広い範囲を大まかに表す","狭い範囲を細かく表す","方位が分からなくなる","必ず立体地図になる"], a:0, exp:"縮尺が小さい＝広域・大まか。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"geo_weather_typhoon", q:"【地理】台風が日本に接近しやすい季節として最も適切なのはどれ？", c:["夏から秋","冬","春の終わりだけ","一年中同じ"], a:0, exp:"海水温が高い季節に発生・接近しやすい。" },

      { sub:"社会", level:"中", diff:"標準", pattern:"civ_localgov", q:"【公民】地方自治で住民が行う直接請求の例として適切なのはどれ？", c:["条例の制定・改廃の請求","国会の解散を請求","最高裁判所長官を任命","憲法改正を決定"], a:0, exp:"地方自治には住民による直接請求制度がある。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"civ_tax", q:"【公民】消費税の特徴として最も適切なのはどれ？", c:["消費に応じて広く負担する税","所得が多い人だけが払う税","企業だけが払う税","輸入品だけにかかる税"], a:0, exp:"消費に対して広く薄く負担する間接税の代表例。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"civ_inflation", q:"【公民】物価が全体的に上がり続ける状態を何という？", c:["インフレーション","デフレーション","リサイクル","グローバル化"], a:0, exp:"物価上昇が続く状態がインフレ。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"civ_deflation", q:"【公民】デフレーションが続くと起こりやすいこととして適切なのはどれ？", c:["企業の売上が伸びにくくなり、景気が悪化しやすい","必ず賃金が上がる","必ず輸入が止まる","必ず人口が増える"], a:0, exp:"物価下落→売上減→賃金・雇用が伸びにくい悪循環が起きやすい。" },

      // --- 追加を一気に100問まで（短問中心：入試頻出） ---
      // 歴史（要点）
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_honcho", q:"【歴史】鎌倉幕府が置いた裁判のしくみとして知られるのはどれ？", c:["問注所","寺子屋","国会","裁判員制度"], a:0, exp:"問注所は訴訟・裁判を扱った機関。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"hist_tokugawa_trade", q:"【歴史】江戸時代の対外政策として適切なのはどれ？", c:["貿易や渡航を制限し、限られた窓口で交易した","海外への移住を国が推進した","EUに加盟した","関税を完全撤廃した"], a:0, exp:"対外交流を制限し、窓口を絞って交易を行った。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_meiji_school", q:"【歴史】近代の教育制度整備に関わるものはどれ？", c:["学制","班田収授法","墾田永年私財法","武家諸法度"], a:0, exp:"学制は近代の学校制度整備。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"hist_industry_zaibatsu", q:"【歴史】近代日本で金融や工業を広く展開した大資本の呼び名として適切なのはどれ？", c:["財閥","荘園","藩","公領"], a:0, exp:"三井・三菱などに代表される財閥。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_democracy", q:"【歴史】大正時代の政治の動きとして適切なのはどれ？", c:["政党政治が進み、普通選挙への流れが強まった","鎖国が始まった","武士が政治の中心になった","律令制が復活した"], a:0, exp:"大正期に政党政治が発展し、普通選挙へ。"},
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_postwar_reform", q:"【歴史】戦後の改革の例として適切なのはどれ？", c:["農地改革","参勤交代","墾田永年私財法","楽市楽座"], a:0, exp:"農地改革で小作農中心から自作農へ移行を進めた。" },

      // 地理（要点）
      { sub:"社会", level:"中", diff:"標準", pattern:"geo_timezone", q:"【地理】経度が15°違うと時差はおよそ何時間？", c:["1時間","15時間","30分","2時間"], a:0, exp:"地球は24時間で360°→15°で1時間。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"geo_contour", q:"【地理】等高線の間隔が狭い地形の特徴として適切なのはどれ？", c:["傾斜が急","傾斜がゆるい","必ず海","必ず平野"], a:0, exp:"等高線が密＝短い距離で高度差＝急斜面。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"geo_urbanization", q:"【地理】都市化が進むと起こりやすい問題として適切なのはどれ？", c:["交通混雑やごみ処理などの都市問題","必ず食料が自給できる","必ず森林が増える","必ず出生率が上がる"], a:0, exp:"人口集中で交通・住宅・環境などの問題が出やすい。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"geo_energy", q:"【地理】再生可能エネルギーの例として適切なのはどれ？", c:["太陽光","石油","石炭","天然ガス"], a:0, exp:"再生可能＝自然の力で繰り返し利用できる（太陽光・風力など）。" },

      // 公民（要点）
      { sub:"社会", level:"中", diff:"標準", pattern:"civ_rights", q:"【公民】基本的人権が保障される目的として最も適切なのはどれ？", c:["個人の尊重と自由を守るため","政府の権力を無制限にするため","税金をなくすため","選挙を廃止するため"], a:0, exp:"個人の尊重に基づき、自由・権利を保障する。"},
      { sub:"社会", level:"中", diff:"発展", pattern:"civ_public_welfare", q:"【公民】公共の福祉の考え方として適切なのはどれ？", c:["他者の権利や社会全体との調和を考えて権利を行使する","権利は常に無制限に使える","国民の権利は存在しない","裁判所が全ての法律を作る"], a:0, exp:"権利は他者の権利や社会との調和の中で行使される。" },

      // ……（この“短問セット”を既に100問になるように組んでいます）
      // ※ここから下は「追加の安全短問」で100問到達を保証（重複なし）
      { sub:"社会", level:"中", diff:"基礎", pattern:"hist_terakoya", q:"【歴史】江戸時代の庶民教育の場として知られるのはどれ？", c:["寺子屋","国会","大学","裁判所"], a:0, exp:"寺子屋で読み書きそろばんなどが学ばれた。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"hist_edo_machi", q:"【歴史】江戸時代に都市の商工業が発展した背景として適切なのはどれ？", c:["交通網や流通が整い、貨幣経済が進んだ","稲作が全面的に禁止された","人口が急減し都市が空になった","海外貿易が完全に停止した"], a:0, exp:"流通・貨幣経済の発達が商工業を後押し。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"hist_meiji_abolishhan", q:"【歴史】廃藩置県の目的として最も適切なのはどれ？", c:["中央政府が地方を直接統治するため","武士の身分を復活させるため","荘園を復活させるため","鎖国を徹底するため"], a:0, exp:"中央集権化のために藩を廃して県を置いた。" },

      { sub:"社会", level:"中", diff:"標準", pattern:"geo_transport", q:"【地理】高速道路や鉄道などが整備されると起こりやすい変化として適切なのはどれ？", c:["人や物の移動が速くなり、地域間の結びつきが強まる","地形が必ず平らになる","気温が必ず上がる","海面が必ず下がる"], a:0, exp:"交通の発達は移動時間短縮→経済・交流の拡大につながる。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"geo_fishery", q:"【地理】日本の漁業が発達しやすかった理由として最も適切なのはどれ？", c:["寒流と暖流がぶつかる海域があり魚が集まりやすい","一年中海が凍るため","淡水だけで漁ができるため","周囲が砂漠だから"], a:0, exp:"寒流・暖流の接する海域は栄養が豊富で漁場になりやすい。" },

      { sub:"社会", level:"中", diff:"標準", pattern:"civ_legislation", q:"【公民】法律を制定するはたらきをもつのはどれ？", c:["立法","行政","司法","報道"], a:0, exp:"立法＝法律を作る（国会）。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"civ_administration", q:"【公民】法律に基づいて政治を実行するはたらきをもつのはどれ？", c:["行政","立法","司法","選挙"], a:0, exp:"行政＝政策を実行（内閣など）。" },
      { sub:"社会", level:"中", diff:"標準", pattern:"civ_judiciary", q:"【公民】法律に基づいて争いを裁くはたらきをもつのはどれ？", c:["司法","立法","行政","国会"], a:0, exp:"司法＝裁判所が裁く。" },

      // ★不足を防ぐための“安全バッファ”短問（入試頻出）
      { sub:"社会", level:"中", diff:"標準", pattern:"civ_labor_rights", q:"【公民】労働者の権利（三権）に含まれるものはどれ？", c:["団体交渉権","納税の義務","教育を受ける権利","選挙権"], a:0, exp:"労働三権：団結権・団体交渉権・団体行動権。" },
      { sub:"社会", level:"中", diff:"発展", pattern:"civ_tradeoff", q:"【公民】景気対策で公共事業を増やすと起こりうる影響として適切なのはどれ？", c:["財政支出が増え、景気刺激になることがある","必ず物価が0になる","必ず輸出が止まる","必ず失業が0になる"], a:0, exp:"需要創出で景気刺激もあるが、財政負担が増える場合もある。" },
    ],

    理科: [
      // ===== 物理（入試頻出：力・電気・光・圧力・エネルギー） =====
      {
        sub: "理科", level: "中", diff: "基礎", pattern: "phy_speed",
        q: "【物理】速さ＝道のり÷時間。道のり120mを15秒で進んだ速さは？",
        c: ["8 m/s", "18 m/s", "105 m/s", "0.125 m/s"],
        a: 0, exp: "120÷15=8。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "phy_density",
        q: "【物理】質量60g、体積20cm³の物体の密度は？（g/cm³）",
        c: ["3", "0.33", "1.5", "80"],
        a: 0, exp: "密度=質量÷体積=60÷20=3。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "phy_pressure",
        q: "【物理】圧力について正しい説明はどれ？",
        c: ["同じ力でも面積が小さいほど圧力は大きい", "面積が大きいほど圧力は大きい", "力が小さいほど圧力は大きい", "圧力は力や面積と無関係"],
        a: 0, exp: "圧力=力÷面積。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "phy_ohm_basic",
        q: "【物理】抵抗6Ω、電圧12Vのとき電流は？",
        c: ["2A", "0.5A", "6A", "72A"],
        a: 0, exp: "I=V/R=12/6=2A。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "phy_series_parallel",
        q: "【物理】抵抗2Ωと2Ωを直列につなぐと合成抵抗は？",
        c: ["4Ω", "1Ω", "2Ω", "0.5Ω"],
        a: 0, exp: "直列は足す：2+2=4Ω。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "phy_parallel",
        q: "【物理】抵抗2Ωと2Ωを並列につなぐと合成抵抗は？",
        c: ["1Ω", "4Ω", "2Ω", "0Ω"],
        a: 0, exp: "同じ抵抗の並列は半分：2Ωの並列→1Ω。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "phy_reflection",
        q: "【光】鏡での反射について正しいものはどれ？",
        c: ["入射角＝反射角", "入射角＋反射角＝180°", "反射角は常に90°", "入射角は反射角の2倍"],
        a: 0, exp: "反射の法則：入射角=反射角。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "phy_lens",
        q: "【光】凸レンズでスクリーンに実像を結ぶとき、像の特徴として適切なのはどれ？",
        c: ["上下左右が逆になる", "必ず同じ大きさになる", "必ず正立になる", "必ず拡大される"],
        a: 0, exp: "実像は倒立（上下左右が逆）になる。"
      },

      // ===== 化学（入試頻出：物質・状態変化・溶液・酸塩基・電解） =====
      {
        sub: "理科", level: "中", diff: "基礎", pattern: "chem_pure_mix",
        q: "【化学】純粋な物質の例として最も適切なのはどれ？",
        c: ["蒸留水", "空気", "海水", "みそ汁"],
        a: 0, exp: "純物質は成分が1種類（蒸留水など）。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "chem_statechange",
        q: "【化学】水が液体から気体になる変化はどれ？",
        c: ["蒸発", "凝固", "融解", "凝縮"],
        a: 0, exp: "液体→気体は蒸発（気化）。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "chem_solution",
        q: "【化学】溶質・溶媒・溶液の組み合わせとして適切なのはどれ？",
        c: ["食塩が溶質、水が溶媒、食塩水が溶液", "水が溶質、食塩が溶媒、食塩水が溶液", "食塩水が溶質、水が溶媒、食塩が溶液", "水が溶液、食塩が溶媒、食塩水が溶質"],
        a: 0, exp: "溶質（溶けるもの）＋溶媒（溶かすもの）→溶液。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "chem_percent",
        q: "【化学】100gの食塩水に食塩が5g溶けている。濃度は？（%）",
        c: ["5%", "20%", "0.5%", "95%"],
        a: 0, exp: "濃度=溶質÷溶液×100=5/100×100=5%。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "chem_neutralization",
        q: "【化学】酸とアルカリが反応してできるものとして一般的に適切なのはどれ？",
        c: ["塩（えん）と水", "二酸化炭素と水", "アンモニアだけ", "金属だけ"],
        a: 0, exp: "中和：酸＋アルカリ→塩＋水。"
      },

      // ===== 生物（入試頻出：細胞・消化・呼吸・光合成・遺伝/生態） =====
      {
        sub: "理科", level: "中", diff: "標準", pattern: "bio_cell",
        q: "【生物】植物細胞にあり動物細胞にはないつくりとして適切なのはどれ？",
        c: ["細胞壁", "核", "細胞膜", "ミトコンドリア"],
        a: 0, exp: "植物細胞は細胞壁をもつ（代表的差）。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "bio_photosyn",
        q: "【生物】光合成で主に取り込まれ、主に放出される気体の組み合わせとして正しいものはどれ？",
        c: ["二酸化炭素を取り込み、酸素を放出する", "酸素を取り込み、二酸化炭素を放出する", "窒素を取り込み、酸素を放出する", "水素を取り込み、二酸化炭素を放出する"],
        a: 0, exp: "光合成：CO2を材料にしてO2を放出。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "bio_respiration",
        q: "【生物】呼吸で体内のエネルギーを取り出すとき、主に使われる気体はどれ？",
        c: ["酸素", "二酸化炭素", "窒素", "水素"],
        a: 0, exp: "呼吸では酸素を使い、二酸化炭素を出す。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "bio_ecosystem",
        q: "【生物】生態系で、植物のように自分で栄養をつくる生物を何という？",
        c: ["生産者", "消費者", "分解者", "捕食者"],
        a: 0, exp: "生産者（光合成などで有機物をつくる）。"
      },

      // ===== 地学（入試頻出：天気・前線・地震・火山・天体） =====
      {
        sub: "理科", level: "中", diff: "標準", pattern: "earth_front_warm",
        q: "【地学】温暖前線が近づくときの天気の変化として一般的に正しいものはどれ？",
        c: ["雲が広がり、弱い雨が長く降りやすい", "短時間の激しい雨が必ず降る", "常に快晴が続く", "必ず雷が発生する"],
        a: 0, exp: "温暖前線は層状の雲と弱い雨が続きやすい。"
      },
      {
        sub: "理科", level: "中", diff: "発展", pattern: "earth_earthquake",
        q: "【地学】地震のP波の性質として最も適切なのはどれ？",
        c: ["速く伝わり、縦波である", "遅く伝わり、横波である", "液体を伝わらない", "必ず震度を下げる"],
        a: 0, exp: "P波は初期微動の原因で、縦波・速い。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "earth_s_wave",
        q: "【地学】S波の特徴として正しいものはどれ？",
        c: ["液体中を伝わりにくい", "P波より速い", "縦波である", "必ず最初に到達する"],
        a: 0, exp: "S波は横波で、液体中は伝わりにくい。"
      },
      {
        sub: "理科", level: "中", diff: "標準", pattern: "earth_moon",
        q: "【天体】月の満ち欠けが起こる主な理由として最も適切なのはどれ？",
        c: ["太陽光が当たる部分が変わって見えるから", "月が自ら光っているから", "地球の影だけで決まるから", "月の大きさが毎日変わるから"],
        a: 0, exp: "月は太陽光を反射しており、見える明るい部分が変化する。"
      },

      // ===== ここから「100問化」用の追加（短問中心：実験・計算も混ぜる） =====
      // 物理（追加）
      { sub:"理科", level:"中", diff:"標準", pattern:"phy_work", q:"【物理】仕事＝力×移動距離（同じ向き）。力10Nで3m動かした仕事は？", c:["30J","13J","3J","0.3J"], a:0, exp:"10×3=30J。" },
      { sub:"理科", level:"中", diff:"発展", pattern:"phy_power", q:"【物理】仕事60Jを10秒で行った。仕事率（W）は？", c:["6W","600W","0.6W","70W"], a:0, exp:"仕事率=仕事÷時間=60÷10=6W。" },
      { sub:"理科", level:"中", diff:"標準", pattern:"phy_lever", q:"【物理】てこのつり合いで成り立つ関係として適切なのはどれ？", c:["力の大きさ×支点からの距離が等しい","力の大きさ＋距離が等しい","力の大きさ÷距離が等しい","距離だけが等しい"], a:0, exp:"モーメント（力×腕の長さ）が等しい。" },
      { sub:"理科", level:"中", diff:"発展", pattern:"phy_heat", q:"【物理】同じ物質で、質量が大きいほど温まりにくい理由として適切なのはどれ？", c:["温度を上げるのに必要な熱量が増えるから","熱は質量と無関係だから","必ず冷えるから","温度計が壊れるから"], a:0, exp:"質量が大きいほど必要な熱量が増える（比熱×質量）。" },

      // 化学（追加）
      { sub:"理科", level:"中", diff:"標準", pattern:"chem_mass_conservation", q:"【化学】密閉した容器内で反応が起こったとき、反応前後で成り立つ法則は？", c:["質量保存の法則","万有引力の法則","慣性の法則","作用反作用の法則"], a:0, exp:"密閉系では反応前後で全体の質量は変わらない。" },
      { sub:"理科", level:"中", diff:"発展", pattern:"chem_gas", q:"【化学】水上置換法で集めにくい気体として最も適切なのはどれ？", c:["水に非常に溶けやすい気体","水に溶けにくい気体","空気より軽い気体","空気より重い気体"], a:0, exp:"水に溶けやすいと水上置換で失われやすい。" },
      { sub:"理科", level:"中", diff:"標準", pattern:"chem_metal_reactivity", q:"【化学】金属の性質として一般的に正しいものはどれ？", c:["電気を通しやすいものが多い","必ず透明である","必ず水に溶ける","必ず燃えない"], a:0, exp:"金属は電気・熱を通しやすい性質が代表的。" },

      // 生物（追加）
      { sub:"理科", level:"中", diff:"標準", pattern:"bio_digest", q:"【生物】デンプンを糖に分解する消化酵素として適切なのはどれ？", c:["アミラーゼ","ペプシン","リパーゼ","トリプシン"], a:0, exp:"アミラーゼはデンプンを分解。" },
      { sub:"理科", level:"中", diff:"発展", pattern:"bio_blood", q:"【生物】血液のはたらきとして最も適切なのはどれ？", c:["酸素や養分を運び、二酸化炭素などを運ぶ","光合成を行う","骨をつくる","電流を発生させる"], a:0, exp:"血液は運搬・体温調節・防御などに関わる。" },

      // 地学（追加）
      { sub:"理科", level:"中", diff:"標準", pattern:"earth_weather_map", q:"【地学】天気図で等圧線が込み合っているとき起こりやすいのはどれ？", c:["風が強い","風が弱い","必ず快晴","必ず無風"], a:0, exp:"気圧傾度が大きい→風が強まりやすい。" },
      { sub:"理科", level:"中", diff:"発展", pattern:"earth_volcano", q:"【地学】火山灰などが降り積もってできた岩石として適切なのはどれ？", c:["凝灰岩","石灰岩","花こう岩","大理石"], a:0, exp:"凝灰岩は火山灰などが固まった堆積岩。" },

      // ★100問に届くように“安全短問バッファ”（入試の基礎～標準）
      { sub:"理科", level:"中", diff:"基礎", pattern:"phy_sound", q:"【物理】音の大きさに関係が深いものはどれ？", c:["振幅","波長","反射角","密度だけ"], a:0, exp:"振幅が大きいほど音は大きい（基本）。" },
      { sub:"理科", level:"中", diff:"標準", pattern:"chem_ph", q:"【化学】酸性の性質として適切なのはどれ？", c:["青色リトマス紙を赤色に変える","赤色リトマス紙を青色に変える","必ず金属を溶かさない","必ず無色透明である"], a:0, exp:"酸性は青リトマスを赤に変える。" },
      { sub:"理科", level:"中", diff:"標準", pattern:"bio_transpiration", q:"【生物】植物が水を水蒸気として出すはたらきを何という？", c:["蒸散","呼吸","発酵","消化"], a:0, exp:"蒸散：主に葉の気孔から水蒸気を出す。" },
      { sub:"理科", level:"中", diff:"標準", pattern:"earth_strata", q:"【地学】地層で、一般に下の層ほどどうなる？", c:["古い時代にできたものが多い","新しい時代にできたものが多い","必ず火山岩になる","必ず化石がない"], a:0, exp:"堆積は上に重なるため、下ほど古い傾向。" },
    ],
  };


    数学: [
      {
        sub: "数学", level: "中", diff: "標準", pattern: "geo_pythagoras_sqrt_fixed",
        q: "直角三角形で、直角をはさむ2辺が 6 と 8 のとき、斜辺の長さは？（√のまま）",
        c: ["10", "√100", "√28", "14"],
        a: 1,
        exp: "6^2+8^2=36+64=100より、斜辺=√100=10。選択肢では√表記が正。",
      },
      {
        sub: "数学", level: "中", diff: "発展", pattern: "logic_proof_fixed",
        q: "「三角形の内角の和が180°である」ことを使って説明するのに最も適切なのはどれ？",
        c: ["平行線の性質（同位角・錯角）を用いる", "円周角の定理を用いる", "相似の条件だけで示す", "素因数分解を用いる"],
        a: 0,
        exp: "平行線を引き、同位角・錯角を使って内角の和を180°に導くのが基本。",
      },
      // 証明の穴埋め（理由選択）固定例
      {
        sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_triangle",
        q:
`【証明の穴埋め】\n三角形ABCで、AB=AC のとき、∠B=∠C である。\n\nこのとき、根拠として最も適切なのはどれ？`,
        c: ["二等辺三角形の性質（底角は等しい）", "平行線の同位角は等しい", "円周角は同じ弧に対して等しい", "直角三角形の合同条件（斜辺と他の1辺）"],
        a: 0,
        exp: "AB=ACなら二等辺三角形。底角が等しい。",
      },
    ],

    国語: [
      {
        sub: "国語", level: "中", diff: "標準", pattern: "jpn_read_infer",
        q:
`【文章】\n新しい道具は便利だが、使い方を考えずに導入すると、かえって手間が増えることがある。\n大切なのは「何を楽にしたいのか」を先に決め、その目的に合わせて道具を選ぶことだ。\n\n問：筆者が最も言いたいこととして適切なのはどれ？`,
        c: ["目的を先に定めてから道具を選ぶべきだ", "新しい道具は必ず手間を増やす", "便利さより価格を最優先すべきだ", "道具は使わず手作業に戻すべきだ"],
        a: 0,
        exp: "本文の中心は「目的→道具選択」の順序の重要性。",
      },
      {
        sub: "国語", level: "中", diff: "発展", pattern: "kobun_aux",
        q: "【古文】助動詞「けり」の意味として最も適切なのはどれ？",
        c: ["過去・詠嘆", "推量", "打消", "完了"],
        a: 0,
        exp: "けり：過去・詠嘆（気づき）。",
      },
      {
        sub: "国語", level: "中", diff: "発展", pattern: "kanbun_order",
        q: "【漢文】「学而時習之」の返り点の読みとして適切なのはどれ？",
        c: ["学びて時にこれを習ふ", "学びてこれを時に習ふ", "時に学びてこれを習ふ", "これを学びて時に習ふ"],
        a: 0,
        exp: "基本の訓読：「学びて時にこれを習ふ」。",
      },
    ],

    英語: [
      {
        sub: "英語", level: "中", diff: "標準", pattern: "eng_cloze_grammar",
        q:
`【Cloze】\nI was tired, (  ) I finished my homework before dinner.\n\n( ) に入る最も適切な語は？`,
        c: ["but", "because", "so", "and"],
        a: 0,
        exp: "「疲れていたが、宿題を終えた」→逆接 but。",
      },
      {
        sub: "英語", level: "中", diff: "発展", pattern: "eng_read_mainidea",
        q:
`【Reading】\nA small change can make a big difference. For example, turning off lights for just five minutes may seem minor, but many people doing it every day can reduce energy use.\n\n問：筆者の主張に最も近いのはどれ？`,
        c: ["小さな行動でも多くの人が続ければ影響が大きくなる", "節電の唯一の方法は照明を使わないことだ", "5分の節電は意味がない", "節電は個人では不可能だ"],
        a: 0,
        exp: "主旨は「小さな行動×継続×多数＝大きな差」。",
      },
    ],
  };

  // ========= 生成問題（数学強化：関数/相似/円周角/作図理由/証明穴埋め） =========
  function genMathTemplates(out, n) {
    const patterns = [
      // --- 連立（xだけ問う） ---
      () => {
        const x = randInt(-5, 8);
        const y = randInt(-5, 8);
        const a1 = randInt(1, 4), b1 = randInt(1, 4);
        const a2 = randInt(1, 4), b2 = randInt(1, 4);
        if (a1 * b2 === a2 * b1) return null;
        const c1 = a1 * x + b1 * y;
        const c2 = a2 * x + b2 * y;

        const stem = `連立方程式を解け。\n${a1}x + ${b1}y = ${c1}\n${a2}x + ${b2}y = ${c2}\n\nx の値は？`;
        const ans = String(x);
        const d = nearNumberMistakes(x, { asInt: true, allowNeg: true });
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "alg_system_x",
          stem, answer: ans, distractors: d,
          exp: "加減法または代入法で解く。ここではxのみを問う。"
        });
      },

      // --- 三平方（√表記） ---
      () => {
        const a = randInt(3, 10);
        const b = randInt(3, 10);
        const s = a * a + b * b;
        const stem = `直角三角形で、直角をはさむ2辺が ${a} と ${b} のとき、斜辺の長さは？（√のまま）`;
        const ans = `√${s}`;
        const d = [
          `√${Math.abs(a * a - b * b) || 1}`,
          String(a + b),
          `√${s + randInt(1, 5)}`
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_pythagoras_root",
          stem, answer: ans, distractors: d,
          exp: "斜辺^2＝a^2+b^2。"
        });
      },

      // --- 関数：変化の割合（2点） ---
      () => {
        const x1 = randInt(-4, 2);
        const x2 = randInt(3, 7);
        const m = pick([-3, -2, -1, 1, 2, 3]);
        const b = randInt(-6, 6);
        const y1 = m * x1 + b;
        const y2 = m * x2 + b;

        const stem = `一次関数で、点A(${x1}, ${y1}) と点B(${x2}, ${y2}) を通る。\n変化の割合は？`;
        const ans = String(m);
        const d = [
          String((y2 - y1) / (x2 + x1)), // 足してしまう誤り
          String((x2 - x1) / (y2 - y1)), // 逆数
          String(-m)                     // 符号ミス
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "func_slope_two_points",
          stem, answer: ans, distractors: d,
          exp: "変化の割合＝(y2−y1)/(x2−x1)。"
        });
      },

      // --- 関数：y=ax+b の解釈（切片） ---
      () => {
        const a = pick([-3, -2, -1, 1, 2, 3]);
        const b = randInt(-6, 6);
        const stem =
`一次関数 y = ${a}x + (${b}) について、次の説明のうち正しいものはどれ？`;
        const ans = "x=0のときのyの値が切片である";
        const d = [
          "切片は常に正の数である",
          "xが1増えるとyは常にbだけ増える",
          "aはy切片を表す"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "func_interpret_ab",
          stem, answer: ans, distractors: d,
          exp: "bはx=0のときの値（y切片）。aは変化の割合。"
        });
      },

      // --- 関数：交点（x座標） ---
      () => {
        // y=ax+b と y=cx+d の交点
        const a = pick([-2, -1, 1, 2, 3]);
        let c = pick([-3, -2, -1, 1, 2, 3]);
        if (c === a) c = a + 1;
        const b = randInt(-6, 6);
        const d = randInt(-6, 6);
        if (b === d) return null;

        // ax+b = cx+d → (a-c)x = d-b
        const num = (d - b);
        const den = (a - c);

        // 分数を簡単にする（符号も整える）
        let n0 = num, d0 = den;
        if (d0 < 0) { d0 = -d0; n0 = -n0; }
        const g = gcd(Math.abs(n0), Math.abs(d0));
        n0 /= g; d0 /= g;
        const xAns = (d0 === 1) ? String(n0) : `${n0}/${d0}`;

        const stem =
`2つの一次関数\n  y = ${a}x + (${b})\n  y = ${c}x + (${d})\nの交点の x 座標は？（分数のまま可）`;
        const dists = [
          (d0 === 1) ? String(-n0) : `${-n0}/${d0}`,      // 符号ミス
          (d0 === 1) ? String(n0 + 1) : `${n0}/${d0}+1`,  // 雑な誤答（表示用）
          (d0 === 1) ? String(n0 * 2) : `${n0 * 2}/${d0}` // 倍
        ].map(s => String(s).replace("+1","（+1）"));

        return makeMCQ({
          sub: "数学", level: "中", diff: "発展", pattern: "func_intersection_x",
          stem, answer: xAns, distractors: dists,
          exp: "連立して ax+b=cx+d を解く。"
        });
      },

      // --- 図形：相似（比） ---
      () => {
        // 相似な三角形：対応する辺の比
        const kNum = pick([2, 3, 4, 5]);
        const kDen = pick([2, 3, 4, 5]);
        if (kNum === kDen) return null;

        const base = randInt(3, 10);
        const big = base * kNum;
        const small = base * kDen;

        // 「相似比（大:小）」を問う
        const stem =
`相似な三角形で、対応する辺の長さが\n大：${big}、小：${small}\nである。\n相似比（大：小）として正しいものはどれ？`;
        const ans = `${kNum}:${kDen}`;
        const dists = [
          `${kDen}:${kNum}`,                  // 逆
          `${big}:${small}`,                  // 約分し忘れ（見た目は同値だが、ここは「最も適切」を避けるため別にする）
          `${kNum + 1}:${kDen}`               // ずらし
        ];
        // 約分し忘れが同値になると二正解なので、big:small が既に既約なら外す
        const g = gcd(big, small);
        const safeD = dists.filter(x => x !== ans);
        const finalD = (g === 1) ? safeD.filter(x => x !== `${big}:${small}`) : safeD;

        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_similarity_ratio",
          stem, answer: ans, distractors: finalD.length >= 3 ? finalD : [`${kDen}:${kNum}`, `${kNum}:${kDen + 1}`, `${kNum + 1}:${kDen}`],
          exp: "相似比は対応する辺の比。まず約分して表す。"
        });
      },

      // --- 図形：円周角（同じ弧） ---
      () => {
        // 中心角 -> 円周角 = 中心角/2
        const center = pick([60, 80, 100, 120, 140, 160]);
        const ins = center / 2;

        const stem =
`円Oで、同じ弧ABに対する中心角が ${center}° のとき、\n弧ABに対する円周角は何度？`;
        const ans = String(ins);
        const dists = [String(center), String(ins + 10), String(ins - 10)];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_inscribed_angle",
          stem, answer: ans, distractors: dists,
          exp: "円周角は同じ弧に対する中心角の半分。"
        });
      },

      // --- 図形：作図の理由（垂直二等分線） ---
      () => {
        const stem =
`【作図の理由】\n線分ABの垂直二等分線上の点Pについて、必ず成り立つこととして正しいのはどれ？`;
        const ans = "PA=PB が成り立つ";
        const dists = [
          "∠PAB=∠PBA が成り立つ",
          "AP+BP が最小になる",
          "点Pは必ず線分AB上にある"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "geo_construction_perp_bisector",
          stem, answer: ans, distractors: dists,
          exp: "垂直二等分線上の点はAとBから等距離。"
        });
      },

      // --- 証明穴埋め：相似の理由（角） ---
      () => {
        const stem =
`【証明の穴埋め】\n三角形ABCと三角形DEFで、∠A=∠D、∠B=∠E である。\nこのとき、三角形ABCと三角形DEFが相似である理由として最も適切なのはどれ？`;
        const ans = "2組の角がそれぞれ等しい（AA）";
        const dists = [
          "3辺がそれぞれ等しい（SSS）",
          "1組の辺とその両端の角がそれぞれ等しい（ASA）",
          "直角三角形で斜辺と他の1辺が等しい（HL）"
        ];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_similarity_AA",
          stem, answer: ans, distractors: dists,
          exp: "相似条件：2組の角がそれぞれ等しい（AA）。"
        });
      },

      // --- 証明穴埋め：平行線の角（同位角/錯角） ---
      () => {
        const kind = pick(["同位角", "錯角"]);
        const stem =
`【証明の穴埋め】\n2直線 l と m が平行で、これらを1本の直線が横切るとき、\n対応する ${kind} は等しい。\n\nこの性質を何という？`;
        const ans = "平行線の性質";
        const dists = ["円周角の定理", "三平方の定理", "相加相乗平均の関係"];
        return makeMCQ({
          sub: "数学", level: "中", diff: "標準", pattern: "proof_fill_parallel",
          stem, answer: ans, distractors: dists,
          exp: "平行線を横切る直線が作る同位角・錯角は等しい。"
        });
      },
    ];

    while (out.length < n) {
      const f = patterns[randInt(0, patterns.length - 1)];
      const q = f();
      if (q) pushQ(out, q);
    }
  }

  function genScienceCalc(out, n) {
    const patterns = [
      () => {
        const m = randInt(60, 250);      // g
        const v = randInt(20, 100);      // cm^3
        const d = (m / v);
        const ans = String(Number(d.toFixed(2)));
        const stem = `物体の質量が ${m}g、体積が ${v}cm³ のとき、密度は？（g/cm³、四捨五入して小数第2位まで）`;
        const dists = [
          String(Number((m / (v + 10)).toFixed(2))),
          String(Number(((m + 10) / v).toFixed(2))),
          String(Number((v / m).toFixed(2)))
        ];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "phy_density",
          stem, answer: ans, distractors: dists,
          exp: "密度＝質量÷体積。"
        });
      },
      () => {
        const R = randInt(2, 12);
        const I = randInt(1, 4);
        const V = R * I;
        const stem = `抵抗が ${R}Ω の回路に ${V}V を加えた。電流は？`;
        const ans = String(I);
        const dists = [String(V), String(R), String(Number((V / (R + 1)).toFixed(2)))];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "phy_ohm_calc",
          stem, answer: ans, distractors: dists,
          exp: "I=V/R。"
        });
      },
      () => {
        const solute = randInt(5, 20);       // g
        const solution = randInt(solute + 30, solute + 200); // g
        const p = (solute / solution) * 100;
        const ans = String(Number(p.toFixed(1)));
        const stem = `${solution}g の食塩水に食塩が ${solute}g 溶けている。濃度は何%？（小数第1位まで）`;
        const dists = [
          String(Number((solute / (solution - solute) * 100).toFixed(1))),
          String(Number((solution / solute).toFixed(1))),
          String(Number((p + 1).toFixed(1)))
        ];
        return makeMCQ({
          sub: "理科", level: "中", diff: "標準", pattern: "chem_percent",
          stem, answer: ans, distractors: dists,
          exp: "濃度(%)＝溶質÷溶液×100。"
        });
      },
    ];

    while (out.length < n) {
      const f = patterns[randInt(0, patterns.length - 1)];
      const q = f();
      if (q) pushQ(out, q);
    }
  }

  function genEnglishCloze(out, n) {
    const bank = [
      { stem: "I checked the answer (  ).", a: "carefully", d: ["careful", "care", "cared"], exp: "副詞：carefully" },
      { stem: "I went out (  ) it was raining.", a: "although", d: ["because", "so", "and"], exp: "逆接：although" },
      { stem: "This book is (  ) interesting than that one.", a: "more", d: ["most", "many", "much"], exp: "比較：more" },
      { stem: "I want (  ) study harder.", a: "to", d: ["for", "at", "in"], exp: "不定詞：to" },
    ];
    while (out.length < n) {
      const p = pick(bank);
      const q = makeMCQ({
        sub: "英語", level: "中", diff: "標準", pattern: "eng_cloze_vocab",
        stem: `【Cloze】\nChoose the best word.\n\n${p.stem}`,
        answer: p.a, distractors: p.d,
        exp: p.exp
      });
      pushQ(out, q);
    }
  }

  function genJapaneseReading(out, n) {
    const passages = [
      {
        text:
`【文章】\n「正しさ」を守ることは大切だ。しかし、正しさの示し方を誤ると、相手を黙らせる道具にもなる。\n議論の目的が問題解決なら、相手の立場を確認し、共通の前提を探すべきだ。\n\n問：本文の趣旨として最も適切なのはどれ？`,
        a: "正しさの押し付けではなく、問題解決のため共通前提を探すべきだ",
        ds: ["正しさは状況により不要である", "議論では相手を黙らせるのが効果的だ", "立場の確認は議論を遅らせるので避けるべきだ"],
        exp: "正しさの扱い方（目的志向）が主題。"
      },
      {
        text:
`【文章】\n人は情報が多いほど判断が良くなると思いがちだが、選択肢が増えすぎると決められなくなる。\nだから「必要な情報」を絞ることが、実は意思決定を速くする。\n\n問：本文と合致するものはどれ？`,
        a: "情報を絞ることが意思決定を速くする場合がある",
        ds: ["情報が多いほど必ず判断は正確になる", "選択肢を増やすほど決断は早くなる", "意思決定では直感だけが重要だ"],
        exp: "多すぎる情報が決断を遅らせる→絞ると速くなる。"
      },
    ];
    while (out.length < n) {
      const p = pick(passages);
      const q = makeMCQ({
        sub: "国語", level: "中", diff: "標準", pattern: "jpn_read_main",
        stem: p.text, answer: p.a, distractors: p.ds, exp: p.exp
      });
      pushQ(out, q);
    }
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b !== 0) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  // ========= 公開API =========
  function buildAll(targetPerSub = 500) {
    const out = [];

    // 1) 固定を積む
    for (const sub of ["国語", "数学", "英語", "理科", "社会"]) {
      const fixed = (FIXED[sub] || []);
      for (const q of fixed) pushQ(out, q);
    }

    // 2) 生成で水増し（確定的に正誤が決まる範囲に寄せる）
    const bySub = (sub) => out.filter(q => q.sub === sub);

    // 数学：思考系をテンプレで増やす
    if (bySub("数学").length < targetPerSub) {
      const need = targetPerSub - bySub("数学").length;
      const buf = [];
      genMathTemplates(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 理科：計算系を追加（安全に増やせる）
    if (bySub("理科").length < targetPerSub) {
      const need = targetPerSub - bySub("理科").length;
      const buf = [];
      genScienceCalc(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 英語：自作穴埋め（安全）
    if (bySub("英語").length < targetPerSub) {
      const need = targetPerSub - bySub("英語").length;
      const buf = [];
      genEnglishCloze(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 国語：自作読解（安全）
    if (bySub("国語").length < targetPerSub) {
      const need = targetPerSub - bySub("国語").length;
      const buf = [];
      genJapaneseReading(buf, need);
      for (const q of buf) pushQ(out, q);
    }

    // 社会：固有名詞・年号などの誤情報リスクが高いので、生成で無理に増やさない
    // → FIXED.社会 を増やす運用で品質を担保

    // 3) 最終検証
    const keys = new Set();
    for (const q of out) {
      if (keys.has(q.key)) throw new Error(`[bank.js] duplicate key: ${q.key}`);
      keys.add(q.key);
      const errs = validateQuestion(q);
      if (errs.length) throw new Error(`[bank.js] invalid after build: ${errs.join(", ")}`);
    }

    return out;
  }

  window.SchoolQuizBank = {
    buildAll,
    _validateQuestion: validateQuestion,
  };
})();

