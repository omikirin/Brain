# Character Ref 置き場

キャラの参照画像（生成時の同一性アンカー）をここにまとめて置きます。

```
images/refs/
├── <番号>_<スラッグ>.png        ← ベース（NFT/ちび）の参照画像
└── anime/
    └── <番号>_<スラッグ>.png    ← アニメ版の参照画像（アニメ3面図シートなど）
```

例：

```
images/refs/032_seori.png            ← セオリのNFT画像（variant=sheet / row* で使用）
images/refs/anime/032_seori.png      ← セオリのアニメ3面図（variant=anime-sheet / anime-row* で使用）
```

- スラッグはキャラ名の小文字英字（`images/characters/` のフォルダ名と同じ）。
- 旧パス（`images/refs/<番号>_<スラッグ>_anime.png`、キャラフォルダ内 `ref.png` / `anime-ref.png`）も引き続き認識されます（このフォルダ構成が優先）。
- ここに画像を置いてコミットすれば、GitHub Actions の生成（`ref_mode=auto`/`on`）が自動で拾います。
