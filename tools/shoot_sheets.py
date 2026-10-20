#!/usr/bin/env python3
"""Make a numbered contact sheet for each shoot zip, so photos can be picked by eye.

    python3 tools/shoot_sheets.py OUT_DIR ~/Downloads/125-E-Atlantic-Ave.zip [more zips...]

For every zip it writes OUT_DIR/<zip name>.jpg (thumbnails, each labelled
"index:file name") and adds the zip to OUT_DIR/meta.json: one entry per photo
with its index, path inside the zip, pixel size, EXIF shoot date and GPS.
The index is what tools/export_shoot_photos.py uses to pick photos.
"""
import io, json, os, sys, zipfile
from PIL import Image, ImageDraw, ImageOps

Image.MAX_IMAGE_PIXELS = None
W, H, COLS = 300, 200, 6

def gps(ex):
    g = ex.get_ifd(0x8825)
    if not (g and 2 in g and 4 in g):
        return None
    deg = lambda v: float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
    return (round(deg(g[2]) * (-1 if g.get(1) == "S" else 1), 5),
            round(deg(g[4]) * (-1 if g.get(3) == "W" else 1), 5))

def main(out, zips):
    os.makedirs(out, exist_ok=True)
    meta_path = os.path.join(out, "meta.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for zpath in zips:
        name = os.path.basename(zpath)[:-4]
        z = zipfile.ZipFile(os.path.expanduser(zpath))
        files = sorted(n for n in z.namelist() if n.lower().endswith((".jpg", ".jpeg", ".png")))
        sheet = Image.new("RGB", (COLS * W, max(1, (len(files) + COLS - 1) // COLS) * (H + 18)), "white")
        draw = ImageDraw.Draw(sheet)
        info = []
        for i, f in enumerate(files):
            try:
                im = Image.open(io.BytesIO(z.read(f)))
                ex = im.getexif()
                date = ex.get_ifd(0x8769).get(36867) or ex.get(306)
                entry = dict(i=i, f=f, size=im.size, date=date, gps=gps(ex))
                im.draft("RGB", (W * 2, H * 2))
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((W, H))
                x, y = (i % COLS) * W, (i // COLS) * (H + 18)
                sheet.paste(im, (x, y))
                draw.text((x + 3, y + H + 3), f"{i}:{os.path.basename(f)[:34]}", fill="black")
            except Exception as e:
                entry = dict(i=i, f=f, err=str(e))
            info.append(entry)
        sheet.save(os.path.join(out, name + ".jpg"), quality=78)
        meta[name] = info
        json.dump(meta, open(meta_path, "w"))
        dates = sorted({(x.get("date") or "")[:7] for x in info if x.get("date")})
        print(f"{name}: {len(files)} photos, shot {', '.join(dates) or 'date unknown'}", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
