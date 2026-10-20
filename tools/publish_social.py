#!/usr/bin/env python3
"""Post approved shoots to Facebook, the Instagram feed and an Instagram story.

    python3 tools/publish_social.py [--branch main] [--only SLUG] [--dry-run]

Looks at drafts/*.json. A draft is posted once the dashboard has approved it
(status "approved") and its post_at time has passed. Each channel is posted
once and recorded under "posted", so running this again (the workflow runs it
every 15 minutes) only finishes what is left. Failures are recorded under
"errors" and retried on the next run, up to 3 times.

Instagram fetches photos from a public web address, so photos are linked from
the live site (www.listingpixl.com) for main, and from GitHub for any other
branch (the repo is public). Nothing is posted until those links work.

Env: META_TOKEN, a Meta System User token with pages_manage_posts,
pages_read_engagement, instagram_basic and instagram_content_publish.
Optional: FB_PAGE_ID, IG_USER_ID, GRAPH_VERSION. Token values are never printed.
"""
import argparse, datetime, glob, json, os, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPH = f"https://graph.facebook.com/{os.environ.get('GRAPH_VERSION', 'v23.0')}/"
FB_PAGE_ID = os.environ.get("FB_PAGE_ID", "100551446334473")
IG_USER_ID = os.environ.get("IG_USER_ID", "17841458579099573")
CHANNELS = ("facebook", "instagram", "story")
MAX_TRIES = 3

class GraphError(Exception):
    pass

def graph(path, token, data=None):
    """GET (data=None) or POST to the Graph API. Errors carry Meta's message, never the token."""
    if data is None:
        sep = "&" if "?" in path else "?"
        req = urllib.request.Request(GRAPH + path + sep + urllib.parse.urlencode({"access_token": token}))
    else:
        req = urllib.request.Request(GRAPH + path, data=urllib.parse.urlencode(dict(data, access_token=token)).encode())
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        err = json.load(e).get("error", {})
        raise GraphError(f"{path.split('?')[0]}: {err.get('message')} (code {err.get('code')}/{err.get('error_subcode')})") from None

def wait_ready(container, token):
    for _ in range(30):
        status = graph(f"{container}?fields=status_code,status", token)
        if status.get("status_code") == "FINISHED":
            return
        if status.get("status_code") in ("ERROR", "EXPIRED"):
            raise GraphError(f"Instagram could not process the media: {status.get('status')}")
        time.sleep(5)
    raise GraphError("Instagram took too long to process the media")

def post_facebook(d, url, token):
    ptoken = graph(f"{FB_PAGE_ID}?fields=access_token", token).get("access_token", token)
    ids = [graph(f"{FB_PAGE_ID}/photos", ptoken, {"url": url(p), "published": "false"})["id"] for p in d["facebook"]["photos"]]
    data = {"message": d["facebook"]["text"]}
    data.update({f"attached_media[{i}]": json.dumps({"media_fbid": x}) for i, x in enumerate(ids)})
    return graph(f"{FB_PAGE_ID}/feed", ptoken, data)["id"]

def post_instagram(d, url, token):
    photos, caption = d["instagram"]["photos"][:10], d["instagram"]["text"]
    if len(photos) == 1:
        container = graph(f"{IG_USER_ID}/media", token, {"image_url": url(photos[0]), "caption": caption})["id"]
    else:
        children = [graph(f"{IG_USER_ID}/media", token, {"image_url": url(p), "is_carousel_item": "true"})["id"] for p in photos]
        for c in children:
            wait_ready(c, token)
        container = graph(f"{IG_USER_ID}/media", token,
                          {"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption})["id"]
    wait_ready(container, token)
    return graph(f"{IG_USER_ID}/media_publish", token, {"creation_id": container})["id"]

def post_story(d, url, token):
    # Business accounts publish stories straight from the API: no reminder or tap in the app.
    container = graph(f"{IG_USER_ID}/media", token, {"media_type": "STORIES", "image_url": url(d["story"]["photo"])})["id"]
    wait_ready(container, token)
    return graph(f"{IG_USER_ID}/media_publish", token, {"creation_id": container})["id"]

POSTERS = {"facebook": post_facebook, "instagram": post_instagram, "story": post_story}

def photos_used(d):
    return set(d["facebook"]["photos"]) | set(d["instagram"]["photos"]) | {d["story"]["photo"]}

def online(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=30) as r:
            return r.status == 200 and r.headers.get("Content-Type", "").startswith("image/")
    except Exception:
        return False

def due(d, now):
    if d.get("status") != "approved" or not d.get("post_at"):
        return False
    return datetime.datetime.fromisoformat(d["post_at"].replace("Z", "+00:00")) <= now

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--branch", default="main")
    ap.add_argument("--only")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--wait", type=int, default=0, help="seconds to wait for photos to come online (a deploy in progress)")
    a = ap.parse_args()
    base = ("https://www.listingpixl.com/images/" if a.branch == "main" else
            f"https://raw.githubusercontent.com/{os.environ.get('GITHUB_REPOSITORY', 'willmac1wm/listingpixl-2026')}/{a.branch}/images/")
    url = lambda name: base + urllib.parse.quote(name)
    token = os.environ.get("META_TOKEN")
    now = datetime.datetime.now(datetime.timezone.utc)
    for path in sorted(glob.glob(os.path.join(HERE, "drafts", "*.json"))):
        d = json.load(open(path))
        if (a.only and d["slug"] != a.only) or not due(d, now):
            continue
        todo = [c for c in CHANNELS if c in d.get("channels", CHANNELS) and c not in d["posted"]
                and d.get("tries", {}).get(c, 0) < MAX_TRIES]
        if not todo:
            continue
        if not token and not a.dry_run:
            sys.exit("META_TOKEN is not set (GitHub > Settings > Secrets and variables > Actions)")
        deadline = time.time() + a.wait
        missing = [p for p in photos_used(d) if not online(url(p))]
        while missing and time.time() < deadline:
            time.sleep(30)
            missing = [p for p in missing if not online(url(p))]
        if missing:
            print(f"{d['slug']}: waiting for {len(missing)} photos to be online (first: {url(missing[0])})")
            continue
        for c in todo:
            if a.dry_run:
                print(f"{d['slug']}: would post {c}")
                continue
            try:
                d["posted"][c] = dict(id=POSTERS[c](d, url, token), at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"))
                d.get("errors", {}).pop(c, None)
                print(f"{d['slug']}: posted {c} ({d['posted'][c]['id']})")
            except GraphError as e:
                d.setdefault("tries", {})[c] = d.get("tries", {}).get(c, 0) + 1
                d.setdefault("errors", {})[c] = str(e)
                print(f"{d['slug']}: {c} failed: {e}")
        if all(c in d["posted"] for c in d.get("channels", CHANNELS)):
            d["status"] = "posted"
        json.dump(d, open(path, "w"), indent=1)

if __name__ == "__main__":
    main()
