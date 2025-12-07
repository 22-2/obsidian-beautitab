# Bonjourr 壁紙システムまとめ

更新日: 2025-12-06

## 1. 全体像
- 壁紙設定は同期ストレージ `backgrounds` とローカルストレージ (ファイル・URL・コレクションキャッシュ) に分散管理される。
- 初期化は `backgroundsInit` (`src/scripts/features/backgrounds/index.ts`) が担当し、タイプ別に適切なキャッシュコントローラへ委譲する。
- 画像/動画は Bonjourr サービス (`https://services.bonjourr.fr/backgrounds`) から取得し、ローカルでキャッシュ・プリロードしてから DOM に適用する。
- ローカルファイル、任意 URL リスト、単色、API 画像/動画という5種類のソースをサポートする。

## 2. 設定データモデル (`src/types/sync.ts`)
- `Backgrounds` 主要フィールド:
  - `type`: `files|urls|images|videos|color`
  - `frequency`: `tabs|hour|day|period|pause` (切替周期／ポーズ)
  - `fadein`, `bright`, `blur`: フィルター/遷移設定
  - `color`: 単色時の色
  - `urls`: URL エディタの生文字列
  - `images`, `videos`: 選択中プロバイダ識別子 (例: `unsplash-images-daylight`)
  - `paused*`: ポーズ時に表示する画像/動画/URL
  - `queries`: プロバイダごとの検索語またはコレクション ID
  - `texture`: パターン種別・サイズ・不透明度・色
- ローカルストレージ (`Local`) 側に `backgroundCollections` (API 取得結果), `backgroundFiles`, `backgroundUrls` を保持。

## 3. 初期化フロー (`backgroundsInit`)
1. フィルター/テクスチャを即座に適用、`background-wrapper` にタイプ属性を付与。
2. タイプ分岐:
   - `files`: `localFilesCacheControl` でローカルファイルを選択・適用。
   - `color`: `applyBackground(color)` で単色反映。
   - その他 (`images|videos|urls`): `backgroundCacheControl` でコレクションを選択し適用。
3. クレジット表示や可視性イベントもここで初期化。

## 4. UI/設定更新フロー (`backgroundUpdate`)
- 共通フィルター: `blur/bright/fadein` は即 DOM 反映 → `filtersUpdate` で同期保存。
- タイプ変更: `isBackgroundType` で検証後に同期保存し、プロバイダ選択肢を再生成して `backgroundsInit` 再実行。
- 周期変更: `isFrequency` で検証し、`pause` の場合は現在のメディアを `paused*` に保存。
- リフレッシュ: `refresh` イベントで `localFilesCacheControl` または `backgroundCacheControl` を強制再取得。
- 単色: `color` 変更は即適用し `solidUpdate` で保存。
- URL リスト: `urlsapply` で `applyUrls` を呼び、ローカルに行単位状態を持たせる。
- ローカルファイル追加: `files` で `addLocalBackgrounds` を実行 (圧縮・キャッシュ・サムネ生成)。
- ロスレス切替: `compress` オフで RAW を使うように再読み込み。
- テクスチャ: `texture*` 系で DOM 反映と保存。
- プロバイダ/クエリ: `provider` 変更で即保存・再取得、`query` 送信で検索語/コレクション ID を保存して再フェッチ。

## 5. 画像/動画キャッシュ制御 (`backgroundCacheControl`)
- 対象: `images|videos` (色/URL/ファイルは除外)。
- コレクション選択: `findCollectionName` が昼夜 (`daylight-*`) やポーズ時のメディアから適切なコレクション名を決定。
- ローカルキャッシュ取得: `getCollection` が `backgroundCollections` から画像/動画リストを返し、型を検証。
- 更新判定: `needsChange(frequency, lastChange)` と `needNew` フラグで決定。`backgroundPreloading` ローカルストレージが `true` の場合はプリロード結果を優先適用。
- 空または期限切れ: `fetchNewBackgrounds` で Bonjourr API を呼び、`setCollection(...).fromApi` で保存。
- 適用ロジック:
  - ポーズ時は `pausedImage/pausedVideo` に記録。
  - リスト先頭を `applyBackground` で描画。次の項目を `preloadBackground`。
  - リストが尽きたらオンライン時に即座に追加フェッチ。

### `fetchNewBackgrounds`
- URL 形式: `https://services.bonjourr.fr/backgrounds/{provider}/{type}/{category}?h={height}&w={width}&query={query}`。
- 画面密度とアスペクト比から高さ/幅を計算し、レスポンスキーが `images`/`videos` で揃っていることを検証。

## 6. ローカルファイル背景 (`local.ts`)
- `localFilesCacheControl`: メタデータを `sanitizeMetadatas` で CacheStorage と整合、`frequency` に従い次の ID を選び `imageFromLocalFiles` で Blob URL を生成し `applyBackground`。
- `addLocalBackgrounds` フロー:
  1. ファイル情報からハッシュを生成して ID 付与・サムネ枠作成。
  2. 画面解像度に合わせて `compressMedia` で `full/medium/small` を生成 (GIF は非圧縮)。
  3. `saveFileToCache` で CacheStorage/IDBCache に保存し、`backgroundFiles` メタデータをローカルに保存。
  4. 最初の新規ファイルを即座に適用し、入力をリセット。
- `removeLocalBackgrounds`: 選択サムネをキャッシュから削除し、残存ファイルから再選択または背景除去。
- 補助: サムネ表示・選択、位置/サイズ調整 (`updateBackgroundPosition`), RAW 切替 (`compress` フラグ)。

## 7. 任意 URL 背景 (`urls.ts`)
- エディタ (`initUrlsEditor`): Prism ベースの URI エディタで行ごとに URL を入力・保存。
- 保存 (`applyUrls`): 行ごとに `backgroundUrls` エントリを生成し、同期設定 `backgrounds.urls` とともに保存。
- 状態チェック (`checkUrlStates`): 各 URL を `getState` で検証し、同一オリジン fetch 失敗時はプロキシ `.../proxy/` 経由で再試行。`OK/NOT_IMAGE/NOT_URL/CANT_REACH` を行に反映。
- `getUrlsAsCollection`: 成功 (`OK`) のみを抽出し、`BackgroundImage` 形式のリストに変換してローテーション元として利用。

## 8. DOM への適用 (`applyBackground` ほか)
- 画像: `createImageItem` が `div` を作成し、ロード完了でラッパを表示・クレジット更新・Safari 用テーマカラー計算。
- 動画: `createVideoItem` が `video` を差し替えつつループし、フェードアウトで旧要素を除去。
- 解像度選択: `detectBackgroundSize` は強ブラー時に `small` を選択、GIF は強制 `full`。`preloadBackground` で `small→medium→full` と段階的に読み込み (Blur 操作時は `blurResolutionControl`)。
- フィルター/テクスチャ: `applyFilters` が CSS 変数 `--blur/--brightness/--fade-in` を更新、`applyTexture` が `TEXTURE_RANGES` に基づきパターン CSS を設定。

## 9. ポーズ/クレジット・その他
- ポーズ: `frequency='pause'` で現在メディアを `paused*` に保存し、以後 `needNew` になっても保存済みを適用。
- クレジット: `updateCredits`/`toggleCredits` が表示を制御し、メディア適用時に更新。
- 可視性: `visibilitychange` でタブが非表示になれば全動画を一時停止。

## 10. 依存ファイル一覧
- コア制御: `src/scripts/features/backgrounds/index.ts`
- ローカルファイル処理: `src/scripts/features/backgrounds/local.ts`
- 任意 URL 処理: `src/scripts/features/backgrounds/urls.ts`
- 設定型: `src/types/sync.ts`
- 付随: `backgrounds/credits.ts`, `textures.ts`, `providers.ts`, `shared/time.ts` など

## 11. 実装上のポイント
- ネットワーク依存機能は `navigator.onLine` とプリロードフラグでフォールバックを持つ。
- Safari 拡張では CacheStorage が使えないため `IDBCache` にフェイルオーバー (`getCache`)。
- フェッチ時は画面解像度に応じたサイズでリクエストし、縦長/横長の極端な比率に補正を入れている。
- 画像/動画リストは常に型検証 (`areOnlyImages/areOnlyVideos`) し、不整合時は例外にする。
- URL ソースは 1 行 1 背景、保存時に `lastUsed` を付与してローテーションに利用。

## 12. Beautitab (Obsidian) の刷新ポイント
- 新規 `backgroundCache` を IndexedDB に永続化（`idb-keyval` 使用）。`unsplash:<theme>` と `custom:<url>` キーで保存し、端末再起動後も残る。
- バッチ取得を導入 (`count=5`、上限15件キープ、TTL 60分)。キャッシュが新鮮ならネットワークなしで次の背景をローテーション。
- `debugRefreshBackgroundOnOpen` を有効にしない限り、キャッシュを優先。キャッシュだけ更新した場合も即座に保存。
- 背景キャッシュの管理 UI を設定画面に追加（クリアで IndexedDB と単一 `cachedBackground` をリセット）。

以上が現行の壁紙取得・適用の全体フローです。
