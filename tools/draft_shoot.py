#!/usr/bin/env python3
"""Turn one HD Photo Hub shoot into a draft blog post plus social posts.

    python3 tools/draft_shoot.py SITE_ID [--notes "what to change"] [--work /tmp/shoot]

This is the /add-shoots workflow (.claude/skills/add-shoots/SKILL.md) run
without a person at the keyboard. It is run by .github/workflows/shoots.yml
when someone picks a shoot on the team dashboard:

  1. downloads the shoot's photos from HD Photo Hub (tools/hdph.py)
  2. makes contact sheets (tools/shoot_sheets.py)
  3. asks Claude to shortlist photos from the sheets, look closely at the
     shortlist, then pick 5-12 and write the post and social copy, following
     the rules in CLAUDE.md
  4. exports the photos (tools/export_shoot_photos.py), adds the SHOOTS entry
     (and a TOWNS entry for a new town) to build_blog.py, rebuilds the site
  5. makes the Instagram story and Google post images and writes
     drafts/<slug>.json, which the dashboard shows for review

Needs HDPH_API_KEY and ANTHROPIC_API_KEY. Nothing is published: the workflow
commits the result to a shoot/<slug> branch for review.
"""
import argparse, base64, contextlib, csv, datetime, io, json, os, re, string, subprocess, sys, zipfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
import anthropic

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "tools"))
import hdph, shoot_sheets, export_shoot_photos
with contextlib.redirect_stdout(io.StringIO()):
    import build_blog as B

Image.MAX_IMAGE_PIXELS = None
MODEL = "claude-opus-5-5"
SHEET_ROWS = 6  # rows of thumbnails per image sent to Claude (36 photos)

def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")

def jpeg_block(im, quality=82):
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=quality)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                        "data": base64.standard_b64encode(buf.getvalue()).decode()}}

def sheet_bands(path):
    """Split a contact sheet into bands of SHEET_ROWS rows so the thumbnails stay legible."""
    sheet = Image.open(path)
    band = SHEET_ROWS * (shoot_sheets.H + 18)
    return [sheet.crop((0, y, sheet.width, min(y + band, sheet.height))) for y in range(0, sheet.height, band)]

def shoot_month(info):
    dates = sorted(x["date"][:7] for x in info if x.get("date"))
    if not dates:
        return None
    y, m = dates[len(dates) // 2].split(":")
    return datetime.date(int(y), int(m), 1).strftime("%B %Y")

def agent_and_brokerage(s, month):
    """Agent from the HD Photo Hub client. CLAUDE.md: Jason's shoots from 2025 on are eXp Realty."""
    name = (s.get("user") or {}).get("name", "").strip()
    if not name or name == "William Macomber" or " " not in name:
        return "", ""
    year = int(month[-4:]) if month else datetime.date.today().year
    return name, ("eXp Realty" if name == "Jason Ruffenach" and year >= 2025 else "")

def ask(client, messages, schema):
    with client.beta.messages.stream(
        model=MODEL, max_tokens=64000, system=SYSTEM, messages=messages,
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise SystemExit("Claude declined this request")
    if msg.stop_reason == "max_tokens":
        raise SystemExit("Claude's answer was cut off (max_tokens)")
    u = msg.usage
    print(f"  Claude: {u.input_tokens} in, {u.output_tokens} out", flush=True)
    messages.append({"role": "assistant", "content": msg.content})
    return json.loads(next(b.text for b in msg.content if b.type == "text"))

def obj(props, required=None):
    return {"type": "object", "properties": props, "required": required or list(props), "additionalProperties": False}

STR, STRS = {"type": "string"}, {"type": "array", "items": {"type": "string"}}
SHORTLIST = obj({"shortlist": {"type": "array", "items": {"type": "integer"}}, "reasons": STR})
FINAL = obj({
    "photos": {"type": "array", "items": obj({"index": {"type": "integer"}, "label": STR, "alt": STR})},
    "left_out": STR,
    "blurb": STR, "intro": STR, "highlights": STRS, "tags": STRS,
    "new_town": obj({"needed": {"type": "boolean"}, "paragraph": STR, "nearby": STRS}),
    "facebook": STR, "instagram": STR, "story_line": STR, "google": STR,
    "notes_for_review": STR,
})

def system_prompt():
    rules = open(os.path.join(HERE, "CLAUDE.md"), encoding="utf-8").read()
    return f"""You write the blog and social posts for Listing Pixl, a real estate photography business, from the photos of one shoot. Will, the owner, reviews everything before it is published.

The site's working notes follow. Apply the "Facts to get right" and "Rules" sections exactly; the build and deploy parts are handled by a script.

<claude_md>
{rules}
</claude_md>

Picking photos: 5-12 per shoot, lead photo first (the best exterior, ideally a virtual twilight), then drone, kitchen, living spaces, bedroom, bath, outdoor space. Leave out photos with drawn-on lines, arrows or markers (look closely at drone shots: lot lines and "home here" pins are easy to miss on a thumbnail), floor plans, before/after staging pairs, signs or windows that show phone numbers, and near-duplicates (the same view twice, or bracketed/edited copies). Label each picked photo with 1-3 lowercase words for its file name (front-exterior, drone-aerial, kitchen, primary-bedroom...) and an alt text that says what is in it and the town, e.g. "White kitchen with quartz island in Villas NJ".

Blog fields:
- blurb: one sentence, what the home is and what the shoot covered.
- intro: 3-4 sentences describing the property and the shots, only what the photos show.
- highlights: 4-5 short items matching the gallery.
- tags: 3 short tags for the homepage slide, like "Drone aerials", "Virtual twilight", "HDR interiors".

Social posts (plain text, no markdown, written as Listing Pixl about our own work, warm and specific, no hype words like "stunning" or "dream home"):
- facebook: 2-4 short sentences about the shoot, then the blog link on its own line, then 3-5 hashtags.
- instagram: 2-4 short sentences, "Full shoot on our website, link in bio.", then a blank line and 8-15 hashtags mixing local (#capemaycounty #villasnj ...) and trade (#realestatephotography ...). Under 2,200 characters.
- story_line: at most 40 characters for the story image under the address, e.g. "Virtual twilight + drone".
- google: under 1,400 characters, no phone numbers and no URLs (the post's button links to the blog), starts with "New shoot: <address>, <town> NJ", ends with a line inviting agents to book.

Never invent bedroom counts, prices, sale results or features the photos don't show. Never mention the agent's phone or anything personal. Put anything you were unsure about (a possible drawn-on line, a photo you couldn't place, a missing fact) in notes_for_review for Will; write "None" if there is nothing."""

SYSTEM = None

def example_entries():
    keys = ("slug", "address", "town", "date", "photos", "blurb", "intro", "highlights", "tags")
    return json.dumps([{k: s[k] for k in keys if k in s} for s in B.SHOOTS[:2]], indent=1)

def write_pick(client, s, facts, info, bands, zpath, notes):
    starred = {hdph.zip_name(m) for m in hdph.photos(s) if m.get("highlight")}
    highlights = [x["i"] for x in info if x["f"] in starred]
    content = [{"type": "text", "text": (
        f"Shoot facts:\n{json.dumps(facts, indent=1)}\n\n"
        f"The shoot has {len(info)} photos. Here are its contact sheets: each thumbnail is labelled index:file name. "
        f"Photos marked as highlights in HD Photo Hub: {highlights}.\n\n"
        "First step: shortlist 12-18 photo indexes, in the order you'd use them, that could make the final cut. "
        "Include any you need a closer look at to rule out drawn-on lines or duplicates.")}]
    if notes:
        content.append({"type": "text", "text": f"Will reviewed an earlier draft of this shoot and asked for these changes:\n<will_notes>\n{notes}\n</will_notes>"})
    for n, band in enumerate(bands, 1):
        content += [{"type": "text", "text": f"Contact sheet part {n} of {len(bands)}"}, jpeg_block(band, 78)]
    messages = [{"role": "user", "content": content}]
    first = ask(client, messages, SHORTLIST)
    shortlist = [i for i in dict.fromkeys(first["shortlist"]) if 0 <= i < len(info)][:20]

    z = zipfile.ZipFile(zpath)
    closer = [{"type": "text", "text": (
        "Here are the shortlisted photos at a larger size. Pick the final 5-12 (lead photo first) and write the posts. "
        f"For reference, the two newest posts on the site look like this:\n{example_entries()}\n\n"
        f"Towns that already have a town paragraph: {sorted(B.TOWNS)}. If {facts['town']} isn't one of them, set "
        "new_town.needed and write a unique paragraph about the town (2-3 sentences, like the others: what the area is, "
        "and what kind of photos help sell there) plus 5 nearby towns; otherwise leave paragraph empty and nearby [].")}]
    for i in shortlist:
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(info[i]["f"]))))
        im.thumbnail((1200, 1200))
        closer += [{"type": "text", "text": f"Photo {i}"}, jpeg_block(im)]
    messages.append({"role": "user", "content": closer})
    final = ask(client, messages, FINAL)
    final["photos"] = [p for p in final["photos"] if 0 <= p["index"] < len(info)]
    if not 3 <= len(final["photos"]) <= 14:
        raise SystemExit(f"Claude picked {len(final['photos'])} photos; expected 5-12")
    return final

def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def exif(caption):
    ex = Image.Exif()
    ex[270], ex[315], ex[33432] = caption, "Listing Pixl", "Copyright Listing Pixl. listingpixl.com"
    return ex.tobytes()

def story_image(lead, out, address, town, line):
    """1080x1920 Instagram story: lead photo over a blurred copy of itself, address and a short line."""
    im = Image.open(lead).convert("RGB")
    bg = ImageOps.fit(im, (1080, 1920)).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", bg.size, "black"), 0.45)
    fg = ImageOps.contain(im, (1080, 1300))
    bg.paste(fg, (0, (1920 - fg.height) // 2))
    d = ImageDraw.Draw(bg)
    logo = Image.open(os.path.join(B.IMAGES, "logo-horizontal-312.jpg")).convert("RGB")
    logo = ImageOps.contain(logo, (420, 180))
    bg.paste(logo, ((1080 - logo.width) // 2, 220))  # below Instagram's profile bar
    top, bottom = (1920 - fg.height) // 2, (1920 + fg.height) // 2
    d.text((540, top - 60), "NEW SHOOT", font=font(64), fill="white", anchor="ms")
    d.text((540, bottom + 100), address, font=font(60), fill="white", anchor="ms")
    d.text((540, bottom + 175), f"{town}, NJ", font=font(48), fill="white", anchor="ms")
    if line:
        d.text((540, bottom + 250), line[:40], font=font(40), fill="#f2c4d8", anchor="ms")
    bg.save(out, quality=88, optimize=True, progressive=True, exif=exif(f"New shoot: {address}, {town}, NJ"))

def google_image(lead, out, caption):
    im = ImageOps.fit(Image.open(lead).convert("RGB"), (1200, 900), Image.LANCZOS)
    im.save(out, quality=85, optimize=True, progressive=True, exif=exif(caption))

def insert_shoot(entry, town=None):
    """Add the new SHOOTS entry (newest first) and, for a new town, its TOWNS entry, to build_blog.py."""
    path = os.path.join(HERE, "build_blog.py")
    src = open(path, encoding="utf-8").read()
    src = re.sub(rf"\n    dict\(slug='{re.escape(entry['slug'])}',.*?\n    dict\(", "\n    dict(", src, count=1, flags=re.S)  # redo replaces
    lines = [f"    dict(slug={entry['slug']!r},"]
    for k in ("address", "town", "zip", "agent", "brokerage", "date"):
        lines.append(f"         {k}={entry[k]!r},")
    lines.append("         photos=[" + ",\n".join(repr(tuple(p)) for p in entry["photos"]) + "],")
    for k in ("blurb", "intro", "highlights", "tags"):
        lines.append(f"         {k}={entry[k]!r},")
    lines[-1] = lines[-1][:-1] + "),"
    src = src.replace("SHOOTS = [\n", "SHOOTS = [\n" + "\n".join(lines) + "\n", 1)
    if town:
        name, paragraph, nearby = town
        src = src.replace("TOWNS = {", f"TOWNS = {{{name!r}: ({paragraph!r},\n           {nearby!r}),\n ", 1)
    open(path, "w", encoding="utf-8").write(src)

def add_job(address, town, zip_code):
    path = os.path.join(HERE, "tools", "jobs.csv")
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
    if any(r["address"].lower() == address.lower() and r["town"].lower() == town.lower() for r in rows):
        return
    # Same convention as the existing rows: a pin in the right town (approx=1) until
    # someone runs tools/geocode_jobs.py; no pin yet for a town we have never shot in.
    near = next((r for r in rows if r["town"].lower() == town.lower() and r["lat"]), None)
    row = dict(address=address, town=town, zip=zip_code, shoots=1)
    if near:
        row.update(lat=near["lat"], lng=near["lng"], approx=1)
    with open(path, "a", newline="", encoding="utf-8") as fh:
        csv.DictWriter(fh, fieldnames=list(rows[0])).writerow(row)

def main():
    global SYSTEM
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sid")
    ap.add_argument("--notes", default="")
    ap.add_argument("--work", default="/tmp/listingpixl-shoot")
    a = ap.parse_args()
    SYSTEM = system_prompt()
    os.makedirs(a.work, exist_ok=True)

    s = hdph.site(a.sid)
    address, town = string.capwords(s["address"].strip()), string.capwords((s.get("city") or "").strip())
    if not town:
        raise SystemExit("This shoot has no town in HD Photo Hub; add it there first")
    key = slugify(address)
    zpath = os.path.join(a.work, key + ".zip")
    if not os.path.exists(zpath):
        hdph.download(s, zpath)
    sheets = os.path.join(a.work, "sheets")
    shoot_sheets.main(sheets, [zpath])
    info = json.load(open(os.path.join(sheets, "meta.json")))[key]
    month = shoot_month(info) or hdph.created(s).strftime("%B %Y")  # the photo CDN strips EXIF dates
    agent, brokerage = agent_and_brokerage(s, month)
    jobs = {(r["address"].lower(), r["town"].lower()): r for r in csv.DictReader(open(os.path.join(HERE, "tools", "jobs.csv")))}
    zip_code = (jobs.get((address.lower(), town.lower())) or {}).get("zip") or s.get("zip") or ""
    slug = slugify(f"{address} {town} nj")
    facts = dict(address=address, town=town, zip=zip_code, agent=agent, brokerage=brokerage, date=month,
                 blog_link=f"{B.DOMAIN}/blog/{slug}.html")

    client = anthropic.Anthropic()
    final = write_pick(client, s, facts, info, sheet_bands(os.path.join(sheets, key + ".jpg")), zpath, a.notes)

    picks = os.path.join(a.work, "picks.json")
    json.dump({key: dict(address=address, town=town,
                         photos=[[p["index"], p["label"], p["alt"]] for p in final["photos"]])}, open(picks, "w"))
    photos = export_shoot_photos.main(picks, sheets, a.work)[key]["photos"]
    entry = dict(slug=slug, photos=photos, **{k: facts[k] for k in ("address", "town", "zip", "agent", "brokerage", "date")},
                 **{k: final[k] for k in ("blurb", "intro", "highlights", "tags")})
    nt = final["new_town"]
    insert_shoot(entry, (town, nt["paragraph"], nt["nearby"][:5]) if nt["needed"] and town not in B.TOWNS else None)
    add_job(address, town, zip_code)
    subprocess.run([sys.executable, "build_blog.py"], cwd=HERE, check=True)
    subprocess.run([sys.executable, "tools/build_pages.py"], cwd=HERE, check=True)

    lead = os.path.join(B.IMAGES, photos[0][0])
    story_image(lead, os.path.join(B.IMAGES, f"{slug}-story.jpg"), address, town, final["story_line"])
    google_image(lead, os.path.join(B.IMAGES, f"{slug}-google.jpg"), f"{photos[0][1]} - {address}, {town}, NJ")
    files = [p[0] for p in photos]
    draft = dict(
        sid=s["sid"], slug=slug, base=os.environ.get("SHOOT_BASE", "main"), address=address, town=town, shot=month, agent=agent,
        drafted=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        status="draft", notes=a.notes, notes_for_review=final["notes_for_review"], left_out=final["left_out"],
        blog=f"/blog/{slug}.html", photos=[list(p) for p in photos],
        facebook=dict(text=final["facebook"], photos=files[:10]),
        instagram=dict(text=final["instagram"], photos=files[:10]),
        story=dict(photo=f"{slug}-story.jpg"),
        google=dict(text=final["google"], photo=f"{slug}-google.jpg", link=f"{B.DOMAIN}/blog/{slug}.html"),
        post_at=None, posted={},
    )
    os.makedirs(os.path.join(HERE, "drafts"), exist_ok=True)
    json.dump(draft, open(os.path.join(HERE, "drafts", slug + ".json"), "w"), indent=1)
    print(f"Draft ready: drafts/{slug}.json ({len(photos)} photos)")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.write(f"slug={slug}\n")

if __name__ == "__main__":
    main()
