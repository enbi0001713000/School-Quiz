# アーキテクチャ / データ設計

## 全体構成（静的Web）
- index.html：画面レイアウト、ボタン・入力欄・canvas
- styles.css：UIスタイル
- bank.js：問題バンク生成（固定問題＋テンプレ生成）
- app.js：状態管理、出題、採点、分析、履歴、描画
- manifest.json / sw.js：PWA（オフライン・キャッシュ）

## 画面（UI）構造
- Unlock（合言葉入力）
- Settings（タグフィルタ）
- Quiz（問題表示・回答・タイマー）
- Result（結果、分析、レーダー、解説、履歴）

## app.js：状態（例）
- state.quiz：今回の25問
- state.answers：各問の回答・正誤・時間
- state.i：現在の問題番号
- state.qShownAt：現在問の表示開始時刻（計測用）

answers[i] 例：
- chosen：選択した選択肢index（未回答はnull）
- isCorrect：正誤（採点後に確定）
- timeMs：その問題に費やした累計時間
- visits：問題の再訪回数（前後移動など）

## bank.js：問題オブジェクト仕様
各問題は以下を満たす：
- sub：教科（国語/数学/英語/理科/社会）
- level：小/中
- diff：基礎/標準/発展
- pattern：出題タイプ識別（偏り抑制に使用）
- q：問題文
- c：選択肢4つ（重複なし）
- a：正解index（0-3）
- exp：解説
- key：一意キー（重複排除に使用）

## 出題ロジック（要点）
- 教科ごとに5問抽出
- 25問内の重複禁止：keyで除外
- 似たpattern偏り抑制：patternの出現回数をスコア化し、連発を避ける
- 難易度比率：基礎/標準/発展の比率を維持するよう候補を層化

## 履歴設計（localStorage）
- LS_UNLOCK：ロック解除状態（"1"で解除）
- LS_HISTORY：履歴配列（最大50回程度）

履歴1件（snapshot）例：
- ts：ISO日時
- total / correct / acc
- totalTime / avgTime
- sub：教科別 {acc, avgTime, total, correct}

## 可視化
- radar：教科別正答率を五角形で描画（canvas）
- historyChart：最近10回の正答率を折れ線で描画（canvas）

## 更新・キャッシュ（SW）
- SWが古いJSを配るとUI不整合が起こり得る
- 運用として、更新が反映しないときは強制リロード
- それでも残る場合は sw.js のCACHE_NAMEを更新（v+1）
