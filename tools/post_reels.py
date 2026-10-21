#!/usr/bin/env python3
"""Post the next Instagram reel from tools/reels_queue.json (one per run).

    python3 tools/post_reels.py [--dry-run]

The videos are assets of the GitHub release named in RELEASE. A reel counts as
posted when its caption's opening already appears on one of the account's
recent posts, so running this again never posts twice and a skipped hour just
moves the queue along. The workflow .github/workflows/reels.yml runs it hourly;
remove that workflow once the queue is done.

After posting, adds the queue item's "comment" as the first comment.

Env: META_TOKEN (same token as tools/publish_social.py). Token values are never printed.
"""
import argparse, json, os, sys, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from publish_social import GRAPH, IG_USER_ID, GraphError, graph

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE = "https://github.com/willmac1wm/listingpixl-2026/releases/download/reels-v2/"

def key(caption):
    return " ".join(caption.split())[:80]

def posted_keys(token):
    out, path = set(), f"{IG_USER_ID}/media?fields=caption&limit=100"
    for _ in range(3):
        page = graph(path, token)
        out |= {key(m.get("caption") or "") for m in page.get("data", [])}
        nxt = page.get("paging", {}).get("cursors", {}).get("after")
        if not nxt or not page.get("paging", {}).get("next"):
            break
        path = f"{IG_USER_ID}/media?fields=caption&limit=100&after={nxt}"
    return out

def wait_video(container, token):
    for _ in range(60):
        status = graph(f"{container}?fields=status_code,status", token)
        if status.get("status_code") == "FINISHED":
            return
        if status.get("status_code") in ("ERROR", "EXPIRED"):
            raise GraphError(f"Instagram could not process the video: {status.get('status')}")
        time.sleep(10)
    raise GraphError("Instagram took too long to process the video")

def post_reel(item, token):
    with urllib.request.urlopen(RELEASE + item["video"], timeout=300) as r:
        video = r.read()
    # Resumable upload sends the file itself, so Instagram never has to fetch it from GitHub
    container = graph(f"{IG_USER_ID}/media", token, {"media_type": "REELS", "upload_type": "resumable",
                                                    "caption": item["caption"], "share_to_feed": "true",
                                                    "thumb_offset": "900"})["id"]
    version = GRAPH.rstrip("/").rsplit("/", 1)[-1]
    req = urllib.request.Request(f"https://rupload.facebook.com/ig-api-upload/{version}/{container}", data=video,
                                 headers={"Authorization": f"OAuth {token}", "offset": "0", "file_size": str(len(video))})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            json.load(r)
    except urllib.error.HTTPError as e:
        raise GraphError(f"video upload failed: HTTP {e.code} {e.read()[:300]!r}") from None
    wait_video(container, token)
    return graph(f"{IG_USER_ID}/media_publish", token, {"creation_id": container})["id"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    token = os.environ.get("META_TOKEN")
    if not token:
        sys.exit("META_TOKEN is not set")
    queue = json.load(open(os.path.join(HERE, "tools", "reels_queue.json")))
    done = posted_keys(token)
    left = [q for q in queue if key(q["caption"]) not in done]
    print(f"{len(queue) - len(left)} of {len(queue)} reels already posted")
    if not left:
        print("Queue finished. Remove .github/workflows/reels.yml.")
        return
    item = left[0]
    if args.dry_run:
        print("Next:", item["video"])
        return
    media_id = post_reel(item, token)
    print(f"Posted {item['video']} as Instagram media {media_id}; {len(left) - 1} left")
    if item.get("comment"):
        # The first comment needs instagram_manage_comments; a missing permission doesn't undo the post.
        # (Pinning it can only be done in the Instagram app.)
        try:
            graph(f"{media_id}/comments", token, {"message": item["comment"]})
            print("First comment added")
        except GraphError as e:
            print(f"::warning::First comment not added: {e}")

if __name__ == "__main__":
    main()
