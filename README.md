# CryptoNinja 同人お助けサイト

CryptoNinja NFT キャラクターの二次創作（同人）制作を助けるための静的サイトです。

## 今あるもの

- **キャラクター図鑑** (`index.html`) — 全38キャラの設定・忍術・武器・誕生日・得意ジャンル・相関関係・作画プロンプト（chibi / 通常頭身 / 現代パロ / SF / ファンタジー / 異世界）を検索・フィルタ付きで閲覧できます。プロンプトはワンクリックでコピー可能。
- **画像置き場** (`images/characters/`) — キャラごとのフォルダに画像を置くと図鑑に自動表示されます。

## 使い方

静的サイトなので、ローカルで見るには：

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

GitHub Pages を有効にすればそのまま公開できます。

## 画像の置き方

`images/characters/<番号>_<名前>/` に以下の名前で置いてください：

| ファイル名 | 用途 |
|---|---|
| `main.png` | 一覧カードのサムネイル＋詳細ギャラリー |
| `01.png` 〜 `12.png` | 詳細ページのギャラリー |

例: `images/characters/001_jin/main.png`

## データ

- `data/characters.json` — キャラクターデータ（出典: https://www.ninja-dao.com/characters）
- 注意: chibi プロンプトの視覚特徴は Jin のみ実画像参照。他キャラは設定テキストからの推定を含むため、公式ビジュアルと差異がある可能性があります。

## 今後の予定

- SVG motion system（別途追加予定）

## ライセンス・二次創作について

CryptoNinja の二次創作ガイドラインに従ってください: https://www.crypto-ninja.jp/
