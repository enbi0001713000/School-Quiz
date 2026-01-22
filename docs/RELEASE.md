# リリース手順（GitHub Pages）

## 初回公開
1. GitHubにリポジトリ作成
2. ファイル配置（例）
   - index.html
   - styles.css
   - app.js
   - bank.js
   - manifest.json
   - sw.js
3. Settings → Pages
   - Source: Deploy from a branch
   - Branch: main / root
4. 表示される公開URLにアクセスして動作確認

## 更新手順（通常）
1. 修正したファイルをCommit & Push
2. 公開URLで Ctrl+Shift+R（強制リロード）
3. 直らない場合は、サイトデータ（キャッシュ）削除

## 更新手順（SWキャッシュが強い場合）
- sw.js の CACHE_NAME を v+1 する（例：v4 → v5）
- Commit & Push
- 公開URLで強制リロード

## トラブルシュート
- ボタンが反応しない：
  - Consoleでエラー確認
  - app.jsが読み込まれているか
- bank.jsは読めているがクイズが動かない：
  - bank.jsの問題検証エラーが出ていないか確認
- テーマや履歴が反映されない：
  - localStorageに書き込める環境か確認（シークレットモード制限など）
