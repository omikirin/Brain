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
        "1-1": (0, 0, 1237, 1108),
        "1-2": (1237, 0, 2474, 1108),
        "1-3": (2474, 0, 3712, 1108),
        "2-1": (0, 1108, 1237, 2270),
        "2-2": (1237, 1108, 2474, 2270),
        "2-3": (2474, 1108, 3712, 2270),
        "3-F": (0, 2270, 1300, 3215),
        "3-S": (1300, 2270, 2510, 3215),
        "3-M": (2510, 2270, 3712, 3215),
        "4-Base": (0, 3215, 911, 3900),
        "4-Fantasy": (911, 3215, 1841, 3900),
        "4-SciFi": (1841, 3215, 2732, 3900),
        "4-Modern": (2732, 3215, 3712, 3900),
        "5-32": (0, 3900, 1856, 4608),
        "5-48": (1856, 3900, 3712, 4608),
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
