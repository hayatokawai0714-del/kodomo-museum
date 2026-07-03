# こども美術館

子供の作品を、家族だけの小さな美術館のように閲覧できる静的WebアプリのMVPです。HTML / CSS / JavaScriptのみで構成し、Cloudflare Pagesに配置しやすい形にしています。

正式公開URL：https://kodomo-museum.pages.dev
Cloudflare Pages正式URL確認用：kodomo-museum

## 主な機能

- 作品追加、画像アップロード
- 画像の自動リサイズ・JPEG圧縮
- 作品名、作者名、年齢、制作日、コメント、子供の説明、タグの登録
- お気に入り登録
- LocalStorage保存
- ホーム画面の「今日の展示作品」
- 作品一覧、作品詳細
- 美術館風閲覧画面
- すべて、お気に入り、年齢別、タグ別、月別の簡易フィルター
- スマホ用下部ナビゲーション

## 使い方

1. `index.html` をブラウザで開きます。
2. 「追加」から作品画像と情報を登録します。
3. 「ホーム」「展示室」「一覧」から作品を閲覧します。
4. 詳細画面でお気に入り切り替えや削除ができます。

## ファイル構成

```text
kodomo-museum/
  index.html
  css/
    style.css
  js/
    main.js
  README.md
  .gitignore
```

## 保存について

このMVPはLocalStorageに作品情報と画像データを保存します。サーバーや外部APIには送信しません。

LocalStorageには容量制限があります。画像を大量に保存したり、大きな画像を登録したりすると保存できない場合があります。

初期版では、選択した画像を長辺約1200pxまで自動リサイズし、JPEG品質0.72程度で圧縮してからLocalStorageへ保存します。それでもスマホ写真を大量に保存すると容量上限に達する場合があります。

長期保存や家族共有を行う場合は、将来的に Cloudflare D1 に作品情報、Cloudflare R2 などに画像を保存する構成へ移行予定です。

## Cloudflare cloud storage groundwork

Current app behavior still uses LocalStorage. Cloudflare D1/R2 integration files are groundwork for the next migration step.

- Create a D1 database and bind it to Pages Functions as `DB`.
- Apply `schema.sql` to D1, for example with `wrangler d1 execute <database-name> --file=./schema.sql`.
- Create an R2 bucket and bind it as `ARTWORK_BUCKET`.
- Set `FAMILY_ACCESS_CODE` as a Cloudflare Pages environment variable.
- Pages Functions under `functions/api/` check `X-Family-Code` on the server before returning artwork data.
- Use `wrangler.example.toml` only as a reference file. Configure real D1/R2 bindings in Cloudflare Pages settings; do not commit real database IDs, bucket names, tokens, or secrets.
