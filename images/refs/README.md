# Character Ref 置き場

キャラの参照画像（生成時の同一性アンカー）をここにまとめて置きます。
ファイル名の規約：

| ファイル名 | 用途 |
|---|---|
| `<番号>_<スラッグ>.png` | ベース（NFT/ちび）の参照画像。`variant=sheet` などの生成で使用 |
| `<番号>_<スラッグ>_anime.png` | アニメ版（アニメ3面図シートなど）の参照画像。`variant=anime-sheet` の生成で使用 |

例：

```
images/refs/032_seori.png        ← セオリのNFT画像
images/refs/032_seori_anime.png  ← セオリのアニメ3面図シート
```

- スラッグはキャラ名の小文字英字（`images/characters/` のフォルダ名と同じ）。
- 旧来の `images/characters/<番号>_<スラッグ>/ref.png` / `anime-ref.png` も引き続き認識されます（このフォルダが優先）。
- ここに画像を置いてコミットすれば、GitHub Actions の生成（`ref_mode=auto`/`on`）が自動で拾います。
