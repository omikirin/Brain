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
        # v3b 固定レイアウト (3392x5056) — 頭身修正版で再較正
        "1-1": (10, 115, 1130, 835), "1-2": (1140, 115, 2260, 835), "1-3": (2270, 115, 3382, 835),
        "2-1": (10, 880, 1130, 1845), "2-2": (1140, 880, 2260, 1845), "2-3": (2270, 880, 3382, 1845),
        "3-F": (10, 1890, 1130, 2750), "3-S": (1140, 1890, 2260, 2750), "3-M": (2270, 1890, 3382, 2750),
        "4-1": (85, 2858, 855, 3284), "4-2": (903, 2858, 1672, 3284), "4-3": (1721, 2858, 2489, 3284), "4-4": (2537, 2858, 3307, 3284),
        "4-5": (85, 3332, 855, 3758), "4-6": (903, 3332, 1672, 3758), "4-7": (1721, 3332, 2489, 3758), "4-8": (2537, 3332, 3307, 3758),
        "5-1": (10, 3870, 1130, 4480), "5-2": (1140, 3870, 2260, 4480), "5-3": (2270, 3870, 3382, 4480),
        "6-32": (10, 4520, 1690, 5050), "6-48": (1700, 4520, 3382, 5050),
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
