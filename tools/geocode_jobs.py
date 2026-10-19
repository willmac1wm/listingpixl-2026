"""Fill in lat/lng for tools/jobs.csv (the Service Area map pins).

    python3 tools/geocode_jobs.py

Uses the free US Census batch geocoder (no key). Only rows with an empty
lat/lng are looked up, so hand-placed pins are never overwritten. Unit
numbers are dropped before lookup -- the pin goes on the building.
"""
import csv
import io
import os
import re
import sys
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
JOBS = os.path.join(HERE, "jobs.csv")
URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"


def street(address):
    return re.sub(r"\s+(unit|apt|#)\s*\S+$", "", address, flags=re.I).strip()


def batch(rows):
    lines = io.StringIO()
    w = csv.writer(lines)
    for i, r in rows:
        w.writerow([i, street(r["address"]), r["town"], "NJ", r["zip"]])
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"benchmark\"\r\n\r\nPublic_AR_Current\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"addressFile\"; filename=\"jobs.csv\"\r\n"
        f"Content-Type: text/csv\r\n\r\n{lines.getvalue()}\r\n--{boundary}--\r\n"
    ).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        text = resp.read().decode("utf-8", "replace")
    found = {}
    for rec in csv.reader(io.StringIO(text)):
        if len(rec) >= 6 and rec[2] == "Match" and rec[5]:
            lng, lat = rec[5].split(",")
            found[int(rec[0])] = (round(float(lat), 6), round(float(lng), 6))
    return found


def main():
    with open(JOBS, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    todo = [(i, r) for i, r in enumerate(rows) if not (r["lat"] and r["lng"])]
    if not todo:
        print("All jobs already have coordinates.")
        return
    found = batch(todo)
    for i, r in todo:
        if i in found:
            r["lat"], r["lng"] = found[i]
    with open(JOBS, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    missed = [r for i, r in todo if i not in found]
    print(f"Geocoded {len(found)} of {len(todo)}.")
    for r in missed:
        print(f"  no match: {r['address']}, {r['town']} {r['zip']} -- fill lat,lng in by hand")
    sys.exit(1 if missed else 0)


if __name__ == "__main__":
    main()
