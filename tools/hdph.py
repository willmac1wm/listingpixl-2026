#!/usr/bin/env python3
"""HD Photo Hub API: list shoots and download a shoot's photos.

    python3 tools/hdph.py                    # newest 15 shoots: site id, date, photos, address
    python3 tools/hdph.py SITE_ID OUT.zip     # download that shoot's photos into a zip

Needs HDPH_API_KEY (HD Photo Hub > Business > Webhooks & API). The zip works
with tools/shoot_sheets.py and tools/export_shoot_photos.py like a zip
downloaded by hand.
"""
import concurrent.futures, datetime, json, os, re, shutil, sys, tempfile, urllib.request, zipfile

API = "https://listingpixl.hd.pics/api/v1/"

def get(path):
    req = urllib.request.Request(API + path, headers={"api_key": os.environ["HDPH_API_KEY"], "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def created(site):
    return datetime.datetime.strptime(site["created"], "%m/%d/%Y %I:%M:%S %p")

def sites():
    return sorted(get("sites"), key=created, reverse=True)

def site(sid):
    found = [s for s in sites() if str(s["sid"]) == str(sid)]
    if not found:
        raise SystemExit(f"No HD Photo Hub site {sid}")
    return found[0]

def photos(s):
    """Visible stills, in the order set in HD Photo Hub."""
    return sorted((m for m in s["media"] if m.get("type") == "still" and not m.get("hidden")),
                  key=lambda m: m.get("order") or 0)

def zip_name(m):
    return f"{m.get('order') or 0:03d}-{re.sub(r'[^A-Za-z0-9_.-]+', '_', m['name'])}.{m.get('extension') or 'jpg'}"

def download(s, out_zip):
    media = photos(s)
    tmp = tempfile.mkdtemp()
    def fetch(m):
        name = zip_name(m)
        path = os.path.join(tmp, name)
        # The photo CDN turns away Python's default user agent
        req = urllib.request.Request(m["url"], headers={"User-Agent": "ListingPixl-site-builder/1.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as fh:
            shutil.copyfileobj(r, fh)
        return name, path
    with concurrent.futures.ThreadPoolExecutor(8) as pool, zipfile.ZipFile(out_zip, "w", zipfile.ZIP_STORED) as z:
        for name, path in pool.map(fetch, media):
            z.write(path, name)
            os.remove(path)
    print(f"{s['address']}, {s['city']}: {len(media)} photos -> {out_zip}", flush=True)

if __name__ == "__main__":
    if len(sys.argv) == 3:
        download(site(sys.argv[1]), sys.argv[2])
    elif len(sys.argv) == 1:
        for s in sites()[:15]:
            print(s["sid"], created(s).date(), f"{len(photos(s)):>3} photos", s["address"], s.get("city", ""), "|", s["user"].get("name"))
    else:
        sys.exit(__doc__)
