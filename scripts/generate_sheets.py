#!/usr/bin/env python3
"""『おむかえのお願い』16pシート画像を fal.ai (Nano Banana Pro) で生成する。

data/omukae_name_sheets.json の全ページを16p単位に分割し、各シート
(4列x4行=16ページ、右上起点・右→左)を1枚の画像として生成して
sheets/sheet_omukae_{nn}.png に保存する。
モノクロ原作のためグレースケール化して保存。
セリフは画像に焼き込まず、リーダー(index.html)側でオーバーレイ描画する。

使い方:
    FAL_KEY=xxxx python3 scripts/generate_sheets.py [--sheet N] [--model MODEL]
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = "fal-ai/nano-banana-pro"
COLS, ROWS = 4, 4  # 1シート=16ページ
# シートは縦長(4列x4行、各ページ672:1180)→ 全体比 2688:4720 ≒ 0.569。
# Nano Banana Pro のプリセット比では 9:16(0.5625) が最も近い。
ASPECT_RATIO = "9:16"
RESOLUTION = "4K"


def load(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as f:
        return json.load(f)


def expand_chars(prompt, chars, seen=None):
    """{char_id} を characters.json の anchor_prompt に展開する。
    seen を渡すと、初出のみフル展開し以降はキャラ名だけにする（プロンプト肥大対策）。"""
    def rep(m):
        c = chars.get(m.group(1))
        if not c:
            return m.group(0)
        if seen is not None:
            if m.group(1) in seen:
                return c.get("name", m.group(1))
            seen.add(m.group(1))
        return f"({c['anchor_prompt']})"
    return re.sub(r"\{(\w+)\}", rep, prompt)


def build_sheet_prompt(pages, chars, style_suffix):
    pps = COLS * ROWS
    lines = [
        f"A single contact-sheet image containing exactly {pps} manga pages arranged in a strict"
        f" uniform grid of {COLS} columns x {ROWS} rows (equal-sized cells, no gutter, no outer margin).",
        f"GRID CONSTRUCTION (critical, draw this first): divide the canvas with exactly"
        f" {COLS - 1} straight vertical divider lines into {COLS} equal columns, and exactly"
        f" {ROWS - 1} straight horizontal divider lines into {ROWS} equal rows. This yields"
        f" EXACTLY {pps} cells ({COLS} across x {ROWS} down). A sheet with only {COLS - 1}"
        f" columns ({(COLS - 1) * ROWS} cells) is WRONG and unusable. Each cell is therefore"
        " narrow and tall (aspect ratio about 0.57, like a real manga page).",
        "ABSOLUTELY NO TEXT ANYWHERE (critical): no speech bubbles, no dialogue balloons, no"
        " written words, no sound-effect lettering, no signs with readable characters, no page"
        " numbers. Dialogue is added later by software. Characters express everything through"
        " facial expressions and body language only. Leave empty space where a bubble would go.",
        "READING ORDER (Japanese manga, RIGHT-TO-LEFT — this is critical): each row holds two"
        " 2-page spreads read right to left. Top row: page 1 = TOP-RIGHT cell, page 2 = second"
        " cell from the right, page 3 = third from the right, page 4 = TOP-LEFT cell. Then move"
        " down one row and repeat from the right: row 2 = pages 5,6,7,8 (right to left), row 3 ="
        " pages 9,10,11,12, bottom row = pages 13,14,15,16. Page 1 must NEVER be at the top-left;"
        " the top-left cell is always page 4 of that row.",
        "Each cell is ONE COMPLETE vertical manga PAGE (not a single drawing): every cell"
        " contains exactly 3 manga panels stacked top to bottom with black panel borders,"
        " like a real comic page. Never draw one big illustration per cell.",
        "Do NOT write any captions, shot names, or descriptions under or inside the cells —"
        " the page content lines below are DIRECTIONS for what to draw, not text to render.",
        "Page contents (in reading order):",
    ]
    seen = set()
    for pg in pages:
        panels = " / ".join(
            f"panel {p['no']}: {expand_chars(p['prompt'], chars, seen)}" for p in pg["panels"])
        lines.append(f"- page {pg['page']}: {panels}")
    if len(pages) < pps:
        lines.append(
            f"- the remaining {pps - len(pages)} cells are SOLID BLACK fill, completely empty.")
    lines.append(
        "No text, no speech bubbles, no lettering, no page numbers anywhere in the image.")
    lines.append("Entirely monochrome black-and-white ink artwork.")
    lines.append(f"Art style: {style_suffix}")
    return "\n".join(lines)


def build_page_prompt(pg, chars, style_suffix, ref_names):
    """1ページ（縦3コマ）単独の生成プロンプト。ページ単位生成はコマ数・キャラ再現が安定する。"""
    lines = []
    if ref_names:
        lines.append(
            f"CHARACTER REFERENCE IMAGES: {len(ref_names)} attached image(s) show the EXACT"
            " official character designs. Match each character's face, hairstyle, hair color"
            " value, eyes, ears/tail and outfit EXACTLY as shown, and draw the whole page in"
            " the SAME art style as these references (chibi proportions, large head, thick"
            " clean bold outlines, simple rounded shapes), converted to monochrome manga ink.")
        for i, nm in enumerate(ref_names, 1):
            lines.append(f"- attached image {i}: official design of {nm}")
    lines += [
        "ONE single vertical Japanese manga PAGE (one page only — NOT a contact sheet,"
        " NOT a grid of pages).",
        f"The page contains EXACTLY {len(pg['panels'])} panels stacked vertically top to"
        " bottom, each framed with a black border and separated by thin white gutters.",
    ]
    pos = {1: "top", 2: "middle", 3: "bottom"}
    for p in pg["panels"]:
        lines.append(f"Panel {p['no']} ({pos.get(p['no'], p['no'])}):"
                     f" {expand_chars(p['prompt'], chars)}")
    lines += [
        "ABSOLUTELY NO TEXT: no speech bubbles, no dialogue balloons, no written words,"
        " no sound-effect lettering, no readable signs, no page numbers. Dialogue is added"
        " later by software; characters act through expression and body language only.",
        "Entirely monochrome black-and-white manga ink artwork.",
        f"Art style: {style_suffix}",
    ]
    return "\n".join(lines)


def image_data_uri(path, max_px=768):
    """参照画像を縮小してdata URIにする（editエンドポイント用）。"""
    import base64
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def fal_generate(model, prompt, key, image_urls=None,
                 aspect_ratio=ASPECT_RATIO, resolution=RESOLUTION):
    """fal.ai queue API で生成し、画像バイト列を返す。image_urls指定時はeditを使う。"""
    base = f"https://queue.fal.run/{model}/edit" if image_urls else f"https://queue.fal.run/{model}"
    payload = {
        "prompt": prompt[:30000],
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "num_images": 1,
        "output_format": "png",
    }
    if image_urls:
        payload["image_urls"] = image_urls
    body = json.dumps(payload).encode()
    req = urllib.request.Request(base, data=body, headers={
        "Authorization": f"Key {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        sub = json.load(r)
    for _ in range(200):
        time.sleep(3)
        req = urllib.request.Request(sub["status_url"], headers={"Authorization": f"Key {key}"})
        with urllib.request.urlopen(req) as r:
            st = json.load(r)
        if st["status"] == "COMPLETED":
            break
        if st["status"] in ("FAILED", "ERROR"):
            raise RuntimeError(f"fal job failed: {st}")
    else:
        raise TimeoutError("fal job did not complete in time")
    req = urllib.request.Request(sub["response_url"], headers={"Authorization": f"Key {key}"})
    with urllib.request.urlopen(req) as r:
        out = json.load(r)
    with urllib.request.urlopen(out["images"][0]["url"]) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", type=int, help="このシート番号のみ生成 (1-3)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--data", default="omukae_name_sheets.json", help="data/内のネームJSON")
    ap.add_argument("--chars", default="omukae_characters.json", help="data/内のキャラ設定JSON")
    ap.add_argument("--prefix", default="sheet_omukae", help="出力ファイル名の接頭辞")
    args = ap.parse_args()

    key = os.environ.get("FAL_KEY")
    if not key:
        sys.exit("FAL_KEY 環境変数を設定してください (https://fal.ai/dashboard/keys)")

    name_sheets = load(args.data)
    characters = load(args.chars)
    chars = characters["characters"]
    style = characters["style_suffix"]

    # ネームJSONは20p単位のグループだが、シートは16p単位で再分割する
    all_pages = [pg for sh in name_sheets["sheets"] for pg in sh["pages"]
                 if isinstance(pg["page"], int)]
    all_pages.sort(key=lambda p: p["page"])
    pps = COLS * ROWS
    chunks = [all_pages[i:i + pps] for i in range(0, len(all_pages), pps)]

    os.makedirs(os.path.join(ROOT, "sheets"), exist_ok=True)
    # セル寸法（672:1180の漫画ページ比）。ページ毎に生成して4x4に合成する。
    CELL_W, CELL_H = 768, 1350
    for n, pages in enumerate(chunks, 1):
        if args.sheet and n != args.sheet:
            continue
        print(f"[sheet {n}] per-page generation (P{pages[0]['page']}-P{pages[-1]['page']}) ...",
              flush=True)
        sheet_img = Image.new("L", (CELL_W * COLS, CELL_H * ROWS), 255)
        for k, pg in enumerate(pages):
            # このページに登場するキャラの参照画像（最大4枚）
            used = sorted({m for p in pg["panels"]
                           for m in re.findall(r"\{(\w+)\}", p["prompt"])})
            ref_paths, ref_names = [], []
            for cid in used:
                c = chars.get(cid)
                if not (c and c.get("ref")):
                    continue
                rp = os.path.join(ROOT, c["ref"])
                if os.path.exists(rp) and rp not in ref_paths and len(ref_paths) < 4:
                    ref_paths.append(rp)
                    ref_names.append(c.get("name", cid))
            image_urls = [image_data_uri(rp) for rp in ref_paths] or None
            prompt = build_page_prompt(pg, chars, style, ref_names)

            for attempt in range(3):
                try:
                    raw = fal_generate(args.model, prompt, key, image_urls,
                                       aspect_ratio="9:16", resolution="1K")
                    break
                except Exception as e:
                    print(f"[sheet {n}] page {pg['page']} attempt {attempt + 1} failed: {e}",
                          flush=True)
                    if attempt == 2:
                        raise
                    time.sleep(10)
            page_img = Image.open(io.BytesIO(raw)).convert("L").resize(
                (CELL_W, CELL_H), Image.LANCZOS)
            # 右綴じ: 各行を右端から左へ埋める（reader.htmlのlocate()と同じ写像）
            row, col = k // COLS, COLS - 1 - (k % COLS)
            sheet_img.paste(page_img, (col * CELL_W, row * CELL_H))
            print(f"[sheet {n}] page {pg['page']} done"
                  + (f" (refs: {', '.join(ref_names)})" if ref_names else ""), flush=True)
        out_path = os.path.join(ROOT, "sheets", f"{args.prefix}_{n:02d}.png")
        sheet_img.save(out_path, optimize=True)
        print(f"[sheet {n}] saved -> {out_path} ({sheet_img.size[0]}x{sheet_img.size[1]})")


if __name__ == "__main__":
    main()
