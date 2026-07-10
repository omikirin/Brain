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


def image_data_uri(path, max_px=768):
    """参照画像を縮小してdata URIにする（editエンドポイント用）。"""
    import base64
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def fal_generate(model, prompt, key, image_urls=None):
    """fal.ai queue API で生成し、画像バイト列を返す。image_urls指定時はeditを使う。"""
    base = f"https://queue.fal.run/{model}/edit" if image_urls else f"https://queue.fal.run/{model}"
    payload = {
        "prompt": prompt[:30000],
        "aspect_ratio": ASPECT_RATIO,
        "resolution": RESOLUTION,
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
    for n, pages in enumerate(chunks, 1):
        if args.sheet and n != args.sheet:
            continue
        prompt = build_sheet_prompt(pages, chars, style)

        # 登場キャラの参照画像（characters.jsonの"ref"）を最大4枚まで添付
        used = sorted({m for pg in pages for p in pg["panels"]
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
        image_urls = None
        if ref_paths:
            image_urls = [image_data_uri(rp) for rp in ref_paths]
            ref_lines = [
                f"CHARACTER REFERENCE IMAGES: {len(ref_paths)} attached image(s) show the EXACT official designs.",
                "ART STYLE: the entire sheet must be drawn in the SAME art style as the attached"
                " reference images — chibi proportions (large head, small body), thick clean bold"
                " outlines, simple rounded shapes. Convert that style to monochrome manga ink."]
            for i, nm in enumerate(ref_names, 1):
                ref_lines.append(f"- attached image {i}: official design of {nm} (match face, hair, ears/tail, outfit and colors exactly, but render in monochrome manga ink)")
            prompt = "\n".join(ref_lines) + "\n\n" + prompt
            print(f"[sheet {n}] ref images: {', '.join(ref_names)}", flush=True)

        print(f"[sheet {n}] generating (P{pages[0]['page']}-P{pages[-1]['page']}) ...", flush=True)
        for attempt in range(3):
            try:
                raw = fal_generate(args.model, prompt, key, image_urls)
                break
            except Exception as e:
                print(f"[sheet {n}] attempt {attempt + 1} failed: {e}", flush=True)
                if attempt == 2:
                    raise
                time.sleep(10)
        img = Image.open(io.BytesIO(raw)).convert("L")
        out_path = os.path.join(ROOT, "sheets", f"{args.prefix}_{n:02d}.png")
        img.save(out_path, optimize=True)
        print(f"[sheet {n}] saved -> {out_path} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
