#!/usr/bin/env python3
"""Export every blog shoot as a ready-to-post Google Business Profile update.

    python3 tools/build_gbp.py ~/Downloads/ListingPixl-Google-Business

For each shoot in build_blog.SHOOTS it writes a folder with:
  post.txt          post text (under 1,500 characters, no phone number --
                    Google rejects posts that contain one)
  <slug>-post.jpg    1200x900 (4:3) image for the post
  photo-1..5.jpg    1200x900 photos for the profile's Photos section
and an index CSV (gbp-posts.csv) with the text, link and photo paths for
every post, newest shoot first.
"""
import csv, os, sys, io, contextlib, datetime
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
with contextlib.redirect_stdout(io.StringIO()):
    import build_blog as B  # regenerates the blog as a side effect; output is identical

OUT = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/ListingPixl-Google-Business")
# Suggested schedule: Mondays and Thursdays at 10 AM, starting with the next
# Monday or Thursday after today (pass a start date as argv[2], YYYY-MM-DD).
def schedule(n, start=None):
    d = start or datetime.date.today() + datetime.timedelta(days=1)
    out = []
    while len(out) < n:
        if d.weekday() in (0, 3):
            out.append(d)
        d += datetime.timedelta(days=1)
    return out

UTM = "utm_source=google&utm_medium=organic&utm_campaign=gbp_post"
SKIP = ("floor-plan", "floorplan", "before-staging")

def is_recent(date, months=6):
    """True when a 'Month YYYY' shoot date is within the last few months."""
    try:
        d = datetime.datetime.strptime(date, "%B %Y").date()
    except ValueError:
        return False
    return (datetime.date.today() - d).days <= months * 31

def post_text(s):
    lead = "New shoot" if is_recent(s["date"]) else "From our portfolio"
    lines = [f"{lead}: {s['address']}, {s['town']} NJ", "", s["blurb"]]
    if s.get("highlights"):
        lines += ["", "What we photographed:"] + [f"- {h}" for h in s["highlights"][:5]]
    lines += ["", f"Listing Pixl shoots HDR photos, drone aerials, virtual twilights, floor plans and virtual staging "
                  f"for agents in {s['town']} and across Cape May County and South Jersey. Packages from $295.",
              "", "Tap Learn more to see the full shoot and book yours."]
    text = "\n".join(lines)
    if len(text) > 1500:
        raise SystemExit(f"{s['slug']}: post is {len(text)} characters, Google allows 1,500")
    return text

def crop_4x3(src, dst, caption):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im = ImageOps.fit(im, (1200, 900), Image.LANCZOS, centering=(0.5, 0.5))
    ex = Image.Exif()
    ex[270] = caption  # ImageDescription
    ex[315] = "Listing Pixl"  # Artist
    ex[33432] = "Copyright Listing Pixl. listingpixl.com"
    im.save(dst, quality=85, optimize=True, progressive=True, exif=ex.tobytes())

os.makedirs(OUT, exist_ok=True)
start = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else None
dates = schedule(len(B.SHOOTS), start)
rows = []
for n, s in enumerate(B.SHOOTS, 1):
    folder = os.path.join(OUT, f"{n:02d}-{s['slug']}")
    os.makedirs(folder, exist_ok=True)
    text = post_text(s)
    url = f"{B.DOMAIN}/blog/{s['slug']}.html?{UTM}"
    with open(os.path.join(folder, "post.txt"), "w", encoding="utf-8") as fh:
        fh.write(text + "\n\n---\nButton: Learn more\nLink: " + url
                 + "\nPost on: " + dates[n - 1].strftime("%A, %B %-d, %Y") + " at 10 AM\n")
    photos = [(p, a) for p, a in s["photos"] if not any(k in p for k in SKIP)][:5]
    files = []
    for i, (p, alt) in enumerate(photos, 1):
        name = f"{s['slug']}-{i}.jpg"
        crop_4x3(os.path.join(B.IMAGES, p), os.path.join(folder, name), f"{alt} - {s['address']}, {s['town']}, NJ")
        files.append((name, alt))
    if files:
        crop_4x3(os.path.join(B.IMAGES, photos[0][0]), os.path.join(folder, f"{s['slug']}-post.jpg"),
                 f"{photos[0][1]} - {s['address']}, {s['town']}, NJ")
    with open(os.path.join(folder, "photo-captions.txt"), "w", encoding="utf-8") as fh:
        fh.writelines(f"{f}: {a} - {s['address']}, {s['town']} NJ\n" for f, a in files)
    rows.append({"order": n, "post_on": dates[n - 1].strftime("%a %b %-d, %Y") + " 10:00 AM", "address": s["address"], "town": s["town"], "shot": s["date"],
                 "post_text": text, "button": "Learn more", "link": url,
                 "post_photo": os.path.join(os.path.basename(folder), f"{s['slug']}-post.jpg"),
                 "profile_photos": "; ".join(os.path.join(os.path.basename(folder), f) for f, _ in files),
                 "characters": len(text)})

with open(os.path.join(OUT, "gbp-posts.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
with open(os.path.join(OUT, "SCHEDULE.txt"), "w", encoding="utf-8") as fh:
    fh.write("Posting schedule: Mondays and Thursdays at 10 AM\n\n")
    fh.writelines(f"{r['post_on']:<28} folder {r['order']:02d}  {r['address']}, {r['town']}\n" for r in rows)
print(f"Wrote {len(rows)} Google Business posts to {OUT}")
