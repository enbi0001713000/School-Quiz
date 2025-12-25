(() => {
  "use strict";

  // ===== RNG =====
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
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b !== 0) [a, b] = [b, a % b];
    return a || 1;
  }
  function fracStr(n, d) {
    if (d === 0) return "定義できない";
    const g = gcd(n, d);
    n /= g; d /= g;
    if (d < 0) { n *= -1; d *= -1; }
    return `${n}/${d}`;
  }
  function isAlmostInt(x){ return typeof x==="number" && isFinite(x) && Math.abs(x - Math.round(x)) < 1e-12; }
  function fmtDisp(x){
    if (typeof x === "number" && isFinite(x)) {
      if (isAlmostInt(x)) return String(Math.round(x));
      // 表示だけ小数第2位まで
      return x.toFixed(2);
    }
    return String(x);
  }

  // ===== MCQ builder =====
  function makeMCQ({ key, sub, level, diff, pattern, q, correct, wrongs, exp, correctValue }, rng) {
    const seen = new Set();
    const opts = [];

    function add(x) {
      const v = fmtDisp(x);
      if (!v) return;
      if (seen.has(v)) return;
      seen.add(v);
      opts.push(v);
    }

    add(correct);
    for (const w of wrongs || []) add(w);

    const fillers = {
      国語: ["どれも当てはまらない", "文脈によって変わる", "表現として不自然"],
      数学: ["上のどれでもない", "条件が足りない", "解が存在しない"],
      英語: ["いずれでもない", "文脈による", "語順が不適切"],
      理科: ["条件によって異なる", "他の要因が必要", "変化しない"],
      社会: ["時代が違う", "地域が違う", "用語の使い方が不適切"],
    };
    while (opts.length < 4) {
      const f = fillers[sub] || ["上のどれでもない"];
      add(f[Math.floor(rng() * f.length)]);
    }

    let options = opts.slice(0, 4);
    const corrDisp = fmtDisp(correct);
    if (!options.includes(corrDisp)) options[0] = corrDisp;

    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const a = options.indexOf(corrDisp);
    return {
      key, sub, level, diff, pattern, q,
      c: options,
      a,
      exp,
      // 内部値（数値）を保持：分析や将来拡張用（採点はインデックスで行う）
      ansValue: (typeof correctValue === "number" && isFinite(correctValue)) ? correctValue : null
    };
  }

  // ===== Difficulty distribution =====
  function diffCounts(n) {
    const b = Math.round(n * 0.2);
    const s = Math.round(n * 0.5);
    const a = Math.max(0, n - b - s);
    return { 基礎: b, 標準: s, 発展: a };
  }

  // =========================
  // 国語（簡略）
  // =========================
  const JP_VOCAB = [
    { w: "端的", m: "要点をついて簡潔なさま", ds: ["回りくどいさま", "派手で目立つさま", "時間がかかるさま"] },
    { w: "妥当", m: "適切で筋が通っていること", ds: ["無関係であること", "無理があること", "気まぐれであること"] },
    { w: "看過", m: "見過ごすこと", ds: ["厳密に検査すること", "強く非難すること", "大切に守ること"] },
    { w: "斟酌", m: "事情をくみ取ること", ds: ["一切考えないこと", "断定すること", "言い換えること"] },
    { w: "帰結", m: "結果としてそうなること", ds: ["原因", "過程", "前提"] },
    { w: "嚆矢", m: "物事の始まり", ds: ["最終段階", "例外", "途中経過"] },
  ];
  const KOBUN_AUX = [
    { aux: "けり", m: "過去・詠嘆", ds: ["推量", "完了", "打消"] },
    { aux: "き", m: "過去（直接経験）", ds: ["伝聞", "推量", "意志"] },
    { aux: "む", m: "推量・意志・勧誘", ds: ["過去", "完了", "尊敬"] },
    { aux: "けむ", m: "過去推量（〜だったのだろう）", ds: ["現在推量", "意志", "可能"] },
    { aux: "まし", m: "反実仮想", ds: ["完了", "当然", "尊敬"] },
  ];
  const KANBUN = [
    { q: "漢文で「レ点」のはたらきとして正しいのは？", a: "直前の字の後に返って読む", ds: ["その字を読まない", "必ず音読みする", "送り仮名を削る"], exp: "レ点は返り点で、戻って読む指示。" },
    { q: "漢文で「未（いまだ）〜ず」の意味は？", a: "まだ〜ない", ds: ["すでに〜した", "必ず〜する", "〜したくない"], exp: "未だ〜ず＝まだ〜ない。" },
    { q: "漢文で「則（すなわ）ち」の意味は？", a: "つまり／そこで", ds: ["しかし", "だからこそ", "たとえば"], exp: "則ち＝順接・言い換え。" },
    { q: "漢文で「於A（Aに於いて）」の意味は？", a: "Aで／Aにおいて", ds: ["Aへ", "Aから", "Aより"], exp: "於は場所・対象などを表す。" },
  ];
  function genJapanese(rng, countByDiff) {
    const out = [];
    const vocabPool = shuffle(JP_VOCAB, rng);
    const auxPool = shuffle(KOBUN_AUX, rng);
    const kanbunPool = shuffle(KANBUN, rng);
    let v = 0, a = 0, b = 0;

    function pushVocab(diff) {
      const x = vocabPool[v++ % vocabPool.length];
      out.push(makeMCQ({
        key: `JP_vocab_${diff}_${v}`, sub: "国語", level: "中", diff, pattern: "vocab",
        q: `「${x.w}」の意味として最も適切なのは？`, correct: x.m, wrongs: x.ds,
        exp: `「${x.w}」＝${x.m}。`,
      }, rng));
    }
    function pushKobun(diff) {
      const x = auxPool[a++ % auxPool.length];
      out.push(makeMCQ({
        key: `JP_kobun_${diff}_${a}`, sub: "国語", level: "中", diff, pattern: "kobun_aux",
        q: `古文の助動詞「${x.aux}」の意味として適切なのは？`, correct: x.m, wrongs: x.ds,
        exp: `「${x.aux}」＝${x.m}。`,
      }, rng));
    }
    function pushKanbun(diff) {
      const x = kanbunPool[b++ % kanbunPool.length];
      out.push(makeMCQ({
        key: `JP_kanbun_${diff}_${b}`, sub: "国語", level: "中", diff, pattern: "kanbun",
        q: x.q, correct: x.a, wrongs: x.ds, exp: x.exp,
      }, rng));
    }

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    for (const diff of ["基礎", "標準", "発展"]) {
      const need = countByDiff[diff];
      for (let i = 0; i < need; i++) {
        const t = (i + (diff === "発展" ? 2 : 0)) % 5;
        if (t <= 1) pushVocab(diff);
        else if (t === 2) pushKanbun(diff);
        else pushKobun(diff);
      }
    }
    return out.slice(0, total);
  }

  // =========================
  // 英語（難化）
  // =========================
  const EN_VOCAB = [
    { w: "suggest", m: "提案する／示唆する", ds: ["拒否する", "隠す", "破壊する"] },
    { w: "depend", m: "〜次第である", ds: ["必ず決まる", "関係ない", "増やす"] },
    { w: "manage", m: "なんとかやり遂げる", ds: ["失敗する", "止める", "拒否する"] },
    { w: "avoid", m: "避ける", ds: ["集める", "増やす", "続ける"] },
    { w: "require", m: "必要とする", ds: ["提供する", "減らす", "祝う"] },
    { w: "consider", m: "考慮する", ds: ["無視する", "壊す", "運ぶ"] },
    { w: "improve", m: "改善する", ds: ["悪化させる", "放置する", "分解する"] },
  ];
  const EN_GRAM = [
    { q: "This is the book (    ) I bought yesterday.", a: "that", ds: ["what", "who", "where"], exp: "関係代名詞：the book that ..." },
    { q: "English is (    ) in many countries.", a: "spoken", ds: ["speaks", "speaking", "spoke"], exp: "受動態：be + 過去分詞。" },
    { q: "Do you know (    ) she lives?", a: "where", ds: ["what", "why", "which"], exp: "間接疑問：Do you know where S V ...?" },
    { q: "I have never (    ) sushi.", a: "eaten", ds: ["ate", "eat", "eating"], exp: "現在完了：have eaten。" },
    { q: "He stopped (    ) because he was tired.", a: "running", ds: ["to run", "run", "ran"], exp: "stop ~ing＝やめる。" },
    { q: "If it (    ) tomorrow, we'll cancel the game.", a: "rains", ds: ["rain", "rained", "will rain"], exp: "条件節は現在形。" },
  ];
  function genEnglish(rng, countByDiff) {
    const out = [];
    const vpool = shuffle(EN_VOCAB, rng);
    let vi = 0;
    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];

    function pushV(diff) {
      const x = vpool[vi++ % vpool.length];
      out.push(makeMCQ({
        key: `EN_vocab_${diff}_${vi}`, sub:"英語", level:"中", diff, pattern:"vocab",
        q: `「${x.w}」の意味として正しいのは？`, correct:x.m, wrongs:x.ds,
        exp: `${x.w}＝${x.m}。`
      }, rng));
    }
    function pushG(diff, i) {
      const x = EN_GRAM[i % EN_GRAM.length];
      out.push(makeMCQ({
        key: `EN_gram_${diff}_${i}`, sub:"英語", level:"中", diff, pattern:"grammar",
        q: x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng));
    }

    for (const diff of ["基礎","標準","発展"]) {
      const need = countByDiff[diff];
      for (let i=0;i<need;i++){
        const t = (i + (diff==="発展"?1:0)) % 3;
        if (t===0) pushV(diff);
        else pushG(diff, i);
      }
    }
    return out.slice(0,total);
  }

  // =========================
  // 数学（√三平方追加）
  // =========================
  function genMath(rng, countByDiff) {
    const out = [];

    function numDistractors(correct, makers) {
      const w = [];
      for (const fn of makers) w.push(fn());
      if (typeof correct === "number") w.push(correct + ri(7, 35, rng));
      return w;
    }

    // 証明（省略：前版と同等に必要なら増やせます）
    const PROOF_BANK = [
      {
        q: "【証明】△ABCと△DEFで、AB=DE、BC=EF、∠B=∠E が与えられた。\nこのとき、2つの三角形が合同だと言える理由として正しいのは？",
        a: "二辺とその間の角（SAS）",
        ds: ["三辺（SSS）", "一辺とその両端の角（ASA）", "直角三角形の斜辺と他の一辺（HL）"],
        exp: "AB=DE、BC=EF、∠B=∠E は「二辺とその間の角」。"
      },
      {
        q: "【証明】∠1と∠2が対頂角である。結論として正しいのは？",
        a: "∠1=∠2",
        ds: ["∠1+∠2=180°", "∠1は必ず90°", "∠1=180°-∠2 は平行線が必要"],
        exp: "対頂角は常に等しい。"
      },
    ];
    function pushProof(diff, i) {
      const x = PROOF_BANK[i % PROOF_BANK.length];
      out.push(makeMCQ({
        key:`MA_proof_${diff}_${i}`,
        sub:"数学", level:"中", diff, pattern:"proof",
        q:x.q, correct:x.a, wrongs:x.ds, exp:x.exp
      }, rng));
    }

    // 基礎
    for (let i = 0; i < countByDiff["基礎"]; i++) {
      const t = i % 5;
      if (t === 0) {
        const a = ri(20, 120, rng), b = ri(2, 15, rng);
        const op = pick(["+", "-", "×", "÷"], rng);
        let correct;
        if (op === "+") correct = a + b;
        if (op === "-") correct = a - b;
        if (op === "×") correct = a * b;
        if (op === "÷") correct = (a - (a % b)) / b;
        out.push(makeMCQ({
          key: `MA_basic_calc_${op}_${a}_${b}_${i}`,
          sub:"数学", level:"小", diff:"基礎", pattern:"calc",
          q: `${a} ${op} ${b} の答えは？`,
          correct,
          correctValue: correct,
          wrongs: numDistractors(correct,[()=>correct+1,()=>correct-1,()=>correct+b,()=>correct-b]),
          exp: `計算して ${fmtDisp(correct)}。`
        }, rng));
      } else {
        const a1 = ri(30, 110, rng), b1 = ri(20, 100, rng);
        const correct = 180 - (a1 + b1);
        out.push(makeMCQ({
          key:`MA_basic_angle_${a1}_${b1}_${i}`,
          sub:"数学", level:"中", diff:"基礎", pattern:"angle",
          q:`三角形の内角が ${a1}° と ${b1}° のとき、残りの角は？`,
          correct,
          correctValue: correct,
          wrongs:[180-a1,180-b1,a1+b1,correct+10],
          exp:`内角和180°→180-(${a1}+${b1})=${correct}。`
        }, rng));
      }
    }

    // 標準（整数三平方＋√三平方を混在）
    for (let i = 0; i < countByDiff["標準"]; i++) {
      const t = i % 10;

      if (t === 3) {
        // 整数三平方（従来）
        const A = pick([3,5,6,8], rng);
        const B = pick([4,12,8,15], rng);
        const C = Math.sqrt(A*A + B*B);
        out.push(makeMCQ({
          key:`MA_std_pyth_int_${A}_${B}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"pythagoras",
          q:`直角三角形で、直角をはさむ2辺が ${A}, ${B} のとき斜辺は？`,
          correct: C,
          correctValue: C,
          wrongs:[A+B, Math.abs(A-B), A*A+B*B, C+1],
          exp:`c^2=a^2+b^2 → c=√(${A*A}+${B*B})=${fmtDisp(C)}。`
        }, rng));
      } else if (t === 8) {
        // √で答える三平方（追加）
        const pairs = [[1,2],[1,3],[2,3],[2,5],[3,5],[4,5],[5,6]];
        const [a,b] = pick(pairs, rng);
        const n = a*a + b*b; // ここは平方数にならないペア中心
        const correct = `√${n}`;
        const wrongs = [`√${n-1}`, `√${n+1}`, `√${n+4}`].filter(x => x !== correct);
        out.push(makeMCQ({
          key:`MA_std_pyth_sqrt_${a}_${b}_${i}`,
          sub:"数学", level:"中", diff:"標準", pattern:"pythagoras_sqrt",
          q:`直角三角形で、直角をはさむ2辺が ${a}, ${b} のとき、斜辺を√を使って表すと？`,
          correct,
          correctValue: Math.sqrt(n), // 内部値は数値
          wrongs,
          exp:`c^2=${a}^2+${b}^2=${n} → c=√${n}。`
        }, rng));
      } else if (t === 6) {
        pushProof("標準", i);
      } else {
        // 例：確率（小数が出る可能性あり→表示は2桁）
        if (t === 4) {
          const red = ri(3, 7, rng), blue = ri(3, 7, rng);
          const total = red+blue;
          const num = red*(red-1);
          const den = total*(total-1);
          out.push(makeMCQ({
            key:`MA_std_prob_${red}_${blue}_${i}`,
            sub:"数学", level:"中", diff:"標準", pattern:"probability",
            q:`赤${red}個・青${blue}個から戻さず2回。2回とも赤の確率は？`,
            correct: fracStr(num,den),
            wrongs:[fracStr(red,total),fracStr(red*red,total*total),fracStr(red-1,total-1),fracStr(num+1,den)],
            exp:`(red/total)×((red-1)/(total-1))。`
          }, rng));
        } else {
          const x = ri(1, 18, rng), m = ri(2, 9, rng), k = ri(1, 30, rng);
          const rhs = m * x + k;
          out.push(makeMCQ({
            key:`MA_std_eq_${m}_${k}_${rhs}_${i}`,
            sub:"数学", level:"中", diff:"標準", pattern:"equation",
            q:`方程式：${m}x + ${k} = ${rhs} の解 x は？`,
            correct: x,
            correctValue: x,
            wrongs:[(rhs+k)/m, (rhs-k)*m, x+1, x-1],
            exp:`${m}x=${rhs}-${k}=${m*x}→x=${x}。`
          }, rng));
        }
      }
    }

    // 発展（√三平方も少し入れる）
    for (let i = 0; i < countByDiff["発展"]; i++) {
      const t = i % 6;
      if (t <= 2) {
        pushProof("発展", i+20);
      } else if (t === 3) {
        const pairs = [[2,7],[3,7],[4,7],[5,7],[6,7]];
        const [a,b] = pick(pairs, rng);
        const n = a*a + b*b;
        out.push(makeMCQ({
          key:`MA_adv_pyth_sqrt_${a}_${b}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"pythagoras_sqrt",
          q:`直角三角形で、直角をはさむ2辺が ${a}, ${b}。斜辺を√を使って表すと？`,
          correct:`√${n}`,
          correctValue: Math.sqrt(n),
          wrongs:[`√${n-3}`,`√${n+2}`,`√${n+5}`],
          exp:`c^2=${a}^2+${b}^2=${n} → c=√${n}。`
        }, rng));
      } else {
        // 小数が出やすい文章題（表示2桁）
        const v1 = ri(3,8,rng);
        const v2 = v1 + ri(2,6,rng);
        const head = ri(1,6,rng);
        const tHr = head / (v2 - v1);
        out.push(makeMCQ({
          key:`MA_adv_chase_${v1}_${v2}_${head}_${i}`,
          sub:"数学", level:"中", diff:"発展", pattern:"word",
          q:`Aが時速${v1}kmで出発。${head}km後にBが時速${v2}kmで追う。追いつくまで何時間？`,
          correct: tHr,
          correctValue: tHr,
          wrongs:[head/v2, head/v1, (v2-v1)/head, tHr+1],
          exp:`差は${v2-v1}km/h。時間=距離/差=${head}/${v2-v1}=${fmtDisp(tHr)}。`
        }, rng));
      }
    }

    return out;
  }

  // =========================
  // 理科（固定＋テンプレ：簡略）
  // =========================
  const SCI_FIXED = [
    { diff:"発展", level:"中", pattern:"calc_power", q:"電圧9V、電流0.5Aの電力は？", a:4.5, exp:"P=VI=9×0.5=4.5W。" },
    { diff:"標準", level:"中", pattern:"calc_speed", q:"150mを25秒で走る速さは？（m/s）", a:6, exp:"速さ=150/25=6。" },
  ];
  function genScience(rng, countByDiff) {
    const out = [];
    const fixedAll = shuffle(SCI_FIXED, rng).map((x, i) =>
      makeMCQ({
        key:`SC_fixed_${x.diff}_${x.pattern}_${i}`,
        sub:"理科", level:x.level, diff:x.diff, pattern:x.pattern,
        q:x.q, correct:x.a, correctValue:x.a,
        wrongs:[x.a+1, x.a-1, x.a+2],
        exp:x.exp
      }, rng)
    );

    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    out.push(...fixedAll);

    // 足りない分は軽く埋める（本体は前回版の固定増量をベースに増やせます）
    while (out.length < total) {
      const I = ri(1, 5, rng), R = ri(2, 12, rng);
      const V = I*R;
      out.push(makeMCQ({
        key:`SC_t_ohm_${out.length}`,
        sub:"理科", level:"中", diff:"標準", pattern:"calc_ohm",
        q:`電流${I}A、抵抗${R}Ωの電圧は？`,
        correct: V, correctValue: V,
        wrongs:[I+R, I/R, V+2],
        exp:`V=IR=${I}×${R}=${V}。`
      }, rng));
    }

    return out.slice(0, total);
  }

  // =========================
  // 社会（簡略）
  // =========================
  const SOC_FIXED = [
    { diff:"標準", level:"中", pattern:"geo", q:"経度が15°東へ移動すると、時刻は一般に？", a:"1時間進む", exp:"360°/24h=15°/h。" },
    { diff:"標準", level:"中", pattern:"civics", q:"裁判所が法律等が憲法に反するか判断する権限は？", a:"違憲審査権", exp:"司法のチェック機能。" },
  ];
  function genSocial(rng, countByDiff) {
    const out = [];
    const total = countByDiff["基礎"] + countByDiff["標準"] + countByDiff["発展"];
    const fixedAll = shuffle(SOC_FIXED, rng).map((x, i) =>
      makeMCQ({
        key:`SO_fixed_${x.diff}_${x.pattern}_${i}`,
        sub:"社会", level:x.level, diff:x.diff, pattern:x.pattern,
        q:x.q, correct:x.a, wrongs:["-","-","-"], exp:x.exp
      }, rng)
    );
    out.push(...fixedAll);
    while (out.length < total) {
      out.push(makeMCQ({
        key:`SO_tpl_${out.length}`,
        sub:"社会", level:"中", diff:"標準", pattern:"history",
        q:"江戸幕府が大名を統制する制度は？",
        correct:"参勤交代",
        wrongs:["地租改正","班田収授","鎖国"],
        exp:"江戸と領地を交代で。"
      }, rng));
    }
    return out.slice(0,total);
  }

  // =========================
  // buildAll（500/教科）
  // =========================
  function buildSubject(subject, n, rng) {
    const counts = diffCounts(n);
    if (subject === "国語") return genJapanese(rng, counts);
    if (subject === "数学") return genMath(rng, counts);
    if (subject === "英語") return genEnglish(rng, counts);
    if (subject === "理科") return genScience(rng, counts);
    if (subject === "社会") return genSocial(rng, counts);
    return [];
  }

  const SchoolQuizBank = {
    buildAll(perSubjectCount = 500) {
      const seed = hashSeed(`bank-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const rng = mulberry32(seed);

      const subjects = ["国語","数学","英語","理科","社会"];
      let all = [];
      for (const sub of subjects) all = all.concat(buildSubject(sub, perSubjectCount, rng));

      const seen = new Set();
      const uniq = [];
      for (const q of all) {
        const k = String(q.key || "");
        if (!k || seen.has(k)) continue;
        seen.add(k);
        uniq.push(q);
      }
      return shuffle(uniq, rng);
    },
  };

  window.SchoolQuizBank = SchoolQuizBank;
})();
