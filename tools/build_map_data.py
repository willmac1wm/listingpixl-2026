#!/usr/bin/env python3
"""Build data/service-area.geojson for the homepage Service Area map.

Source: official NJGIN (NJ Office of GIS) county boundaries, as packaged on
npm by @njam-data/new-jersey-counties:

    npm install @njam-data/new-jersey-counties
    pip install shapely zipcodes
    python3 tools/build_map_data.py node_modules/@njam-data

Keeps only the Cape May County outline (the core service area), simplified
to ~40 m so the file stays small. Job pins come from data/shoots.json, built
by build_blog.py, so new shoots need no rebuild here.
"""
import json, os, sys
from shapely.geometry import shape, mapping

src = sys.argv[1] if len(sys.argv) > 1 else "node_modules/@njam-data"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COUNTIES = {"CAPE MAY": True}

def simplify(geom, tol):
    g = shape(geom).simplify(tol, preserve_topology=True)
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 4), round(c[1], 4)]
    m = mapping(g)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"])}

feats = []
counties = json.load(open(os.path.join(src, "new-jersey-counties/data/new-jersey-counties.geojson")))
for f in counties["features"]:
    p = f["properties"]
    if p["county"] in COUNTIES:
        feats.append({"type": "Feature",
                      "properties": {"kind": "county", "name": p["county_label"], "primary": COUNTIES[p["county"]]},
                      "geometry": simplify(f["geometry"], 0.0004)})
out = os.path.join(HERE, "data", "service-area.geojson")
with open(out, "w") as fh:
    json.dump({"type": "FeatureCollection", "features": feats}, fh, separators=(",", ":"))
print(f"wrote {out}: {len(feats)} features, {os.path.getsize(out) // 1024} KB")

# ---- data/zones.json: lookup for the "Check zip / town" box -----------------
# Every ZIP (with its town) in Cape May County is "in"; Atlantic and Cumberland
# ZIPs are listed so the answer can name the county. Anything else is simply
# "outside". Needs: pip install zipcodes
import zipcodes
IN_COUNTY_PLACES = [  # municipalities + communities agents actually type
    "Cape May", "Cape May Point", "West Cape May", "Lower Township", "Villas", "North Cape May",
    "Erma", "Diamond Beach", "Town Bank", "Wildwood", "North Wildwood", "West Wildwood",
    "Wildwood Crest", "Middle Township", "Cape May Court House", "Rio Grande", "Whitesboro",
    "Burleigh", "Goshen", "Green Creek", "Del Haven", "Dennis Township", "Dennisville",
    "South Dennis", "Ocean View", "Belleplain", "Eldora", "South Seaville", "Upper Township",
    "Marmora", "Tuckahoe", "Strathmere", "Seaville", "Palermo", "Beesleys Point", "Petersburg",
    "Ocean City", "Sea Isle City", "Avalon", "Stone Harbor", "Woodbine",
]
entries = []
for z in zipcodes.filter_by(state="NJ"):
    county = (z.get("county") or "").replace(" County", "")
    if county in ("Cape May", "Atlantic", "Cumberland"):
        entries.append({"zip": z["zip_code"], "name": z["city"].title(), "county": county,
                        "lat": round(float(z["lat"]), 4), "lng": round(float(z["long"]), 4)})
known = {e["name"].lower() for e in entries}
for place in IN_COUNTY_PLACES:
    if place.lower() not in known:
        entries.append({"zip": "", "name": place, "county": "Cape May"})
zones = os.path.join(HERE, "data", "zones.json")
with open(zones, "w") as fh:
    json.dump(entries, fh, separators=(",", ":"))
print(f"wrote {zones}: {len(entries)} places, {os.path.getsize(zones) // 1024} KB")
