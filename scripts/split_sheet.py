#!/usr/bin/env python3
"""生成済みモデルシート(sheet.png)をパネル画像に切り出すスクリプト。

fal.ai(Nano Banana Pro)は指定した行数・区画数どおりに厳密には描かないため、
パネル境界は生成結果ごとに目視で座標を決める必要がある。
このスクリプトは images/characters/<no>_<slug>/sheet.png を、
下記 PANELS の座標（元画像ピクセル座標 x0,y0,x1,y1）で切り出し、
images/characters/<no>_<slug>/panels/<パネルID>.png に保存する。

使い方:
  python3 scripts/split_sheet.py 032

新しいキャラのシートを切り出す場合は、まず sheet.png を目視確認して
このスクリプト内の PANELS 座標を書き換えてから実行する。
"""
import sys
from PIL import Image

# キャラ番号ごとのパネル座標定義（元画像ピクセル座標）
PANEL_DEFS = {
    "032": {
        # v3 固定レイアウト (3392x5056) — 枠検出により較正
        "1-1": (10, 90, 1130, 845), "1-2": (1140, 90, 2260, 845), "1-3": (2270, 90, 3382, 845),
        "2-1": (10, 950, 1130, 1698), "2-2": (1140, 950, 2260, 1698), "2-3": (2270, 950, 3382, 1698),
        "3-F": (10, 1805, 1130, 2528), "3-S": (1140, 1805, 2260, 2528), "3-M": (2270, 1805, 3382, 2528),
        "4-1": (30, 2663, 848, 3110), "4-2": (878, 2663, 1696, 3110), "4-3": (1726, 2663, 2544, 3110), "4-4": (2574, 2663, 3382, 3110),
        "4-5": (30, 3140, 848, 3585), "4-6": (878, 3140, 1696, 3585), "4-7": (1726, 3140, 2544, 3585), "4-8": (2574, 3140, 3382, 3585),
        "5-1": (10, 3720, 1130, 4489), "5-2": (1140, 3720, 2260, 4489), "5-3": (2270, 3720, 3382, 4489),
        "6-32": (10, 4597, 1690, 5050), "6-48": (1700, 4597, 3382, 5050),
    },
}


def slug(name):
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower().split("(")[0].strip()).strip("-")


def main():
    if len(sys.argv) < 2:
        print("使い方: python3 scripts/split_sheet.py <キャラ番号>")
        sys.exit(1)
    no = sys.argv[1].zfill(3)
    if no not in PANEL_DEFS:
        print(f"❌ #{no} のパネル座標が未定義です。PANEL_DEFS に追加してください。")
        sys.exit(1)

    import json, os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = json.load(open(os.path.join(root, "data/characters.json")))
    c = next((x for x in data["characters"] if x["no"] == no), None)
    if not c:
        print(f"❌ キャラ #{no} が見つかりません。")
        sys.exit(1)

    char_dir = os.path.join(root, "images/characters", f"{no}_{slug(c['name'])}")
    sheet_path = os.path.join(char_dir, "sheet.png")
    if not os.path.exists(sheet_path):
        print(f"❌ {sheet_path} が見つかりません。先に生成してください。")
        sys.exit(1)

    out_dir = os.path.join(char_dir, "panels")
    os.makedirs(out_dir, exist_ok=True)
    im = Image.open(sheet_path)
    for pid, box in PANEL_DEFS[no].items():
        im.crop(box).save(os.path.join(out_dir, f"{pid}.png"))
    print(f"✅ {len(PANEL_DEFS[no])} 枚のパネルを {out_dir} に保存しました。")


if __name__ == "__main__":
    main()
