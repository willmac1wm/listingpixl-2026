#!/usr/bin/env python3
"""Export picked photos from shoot zips into images/, ready for the blog.

    python3 tools/export_shoot_photos.py PICKS.json SHEETS_DIR [--zips ~/Downloads]

PICKS.json maps each zip name (without .zip) to the shoot and its photos,
using the indexes printed on the contact sheets from tools/shoot_sheets.py:

    {"125-E-Atlantic-Ave": {
        "address": "125 E Atlantic Ave", "town": "Villas",
        "photos": [[0, "front-exterior", "Cream shore cottage with picket fence in Villas NJ"],
                   [24, "great-room", "Open great room with exposed wood beams"]]}}

The first photo is the post's lead (homepage slide, social preview, Google
Business post), so make it the strongest exterior.

For each photo it writes images/<address>-<town>-nj-<label>.jpg at 1600 px
wide plus -1200/-800/-480 copies, with a caption, "Listing Pixl" as artist and
a copyright line in the metadata. It skips true duplicates: files that are
byte-for-byte the same, or photos that look the same as one already exported
for that shoot (re-saves, the same shot edited twice).

It prints the SHOOTS photo list to paste into build_blog.py.
"""
import io, json, os, re, sys, zipfile
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(HERE, "images")
SIZES = ((1600, ""), (1200, "-1200"), (800, "-800"), (480, "-480"))

def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")

def dhash(im):
    g = im.convert("L").resize((17, 16), Image.LANCZOS)
    p = list(g.getdata())
    return sum(1 << i for i in range(256) if p[(i // 16) * 17 + i % 16] > p[(i // 16) * 17 + i % 16 + 1])

def existing_hashes(slug):
    """Hashes of photos already in images/ for this shoot, so re-runs don't add copies."""
    out = []
    for f in os.listdir(IMAGES):
        if f.startswith(slug + "-") and not re.search(r"-(1200|800|480)\.jpg$", f):
            out.append((f, dhash(Image.open(os.path.join(IMAGES, f)))))
    return out

def main(picks_path, sheets_dir, zips_dir):
    picks = json.load(open(picks_path))
    meta = json.load(open(os.path.join(sheets_dir, "meta.json")))
    exported = {}
    for key, shoot in picks.items():
        address, town = shoot["address"], shoot["town"]
        slug = slugify(f"{address} {town} nj")
        z = zipfile.ZipFile(os.path.join(os.path.expanduser(zips_dir), key + ".zip"))
        seen, exact = {}, 0
        for zi in z.infolist():
            if zi.filename.lower().endswith((".jpg", ".jpeg", ".png")):
                k = (zi.CRC, zi.file_size)
                exact += k in seen
                seen.setdefault(k, zi.filename)
        hashes, photos, skipped = existing_hashes(slug), [], []
        for idx, label, alt in shoot["photos"]:
            name = f"{slug}-{slugify(label)}"
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(meta[key][idx]["f"])))).convert("RGB")
            h = dhash(im)
            dup = next((f for f, oh in hashes if bin(h ^ oh).count("1") <= 4 and f != name + ".jpg"), None)
            if dup:
                skipped.append(f"{label} (same as {dup})")
                continue
            hashes.append((name + ".jpg", h))
            ex = Image.Exif()
            ex[270] = f"{alt} - {address}, {town}, NJ"
            ex[315] = "Listing Pixl"
            ex[33432] = "Copyright Listing Pixl. listingpixl.com"
            for w, suffix in SIZES:
                if suffix and w > im.width:
                    continue  # never upscale the smaller copies
                c = im.copy()
                c.thumbnail((w, w * 3), Image.LANCZOS)
                c.save(os.path.join(IMAGES, f"{name}{suffix}.jpg"), quality=80, optimize=True,
                       progressive=True, exif=ex.tobytes())
            photos.append((f"{name}.jpg", alt))
        print(f"\n# {address}, {town}: {len(photos)} exported, {exact} exact duplicate files in the zip,"
              f" {len(skipped)} near-duplicates skipped {skipped if skipped else ''}")
        print(f"slug='{slug}',")
        print("photos=[" + ",\n        ".join(repr(p) for p in photos) + "],")
        exported[key] = dict(slug=slug, photos=photos, skipped=skipped)
    return exported

if __name__ == "__main__":
    args = sys.argv[1:]
    zips = os.path.expanduser("~/Downloads")
    if "--zips" in args:
        i = args.index("--zips")
        zips = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], zips)
