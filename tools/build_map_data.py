#!/usr/bin/env python3
"""Build data/service-area.geojson for the homepage Service Area map.

Source: official NJGIN (NJ Office of GIS) county boundaries, as packaged on
npm by @njam-data/new-jersey-counties:

    npm install @njam-data/new-jersey-counties
    pip install shapely
    python3 tools/build_map_data.py node_modules/@njam-data

Keeps only the Cape May County outline (the core service area), simplified
to ~40 m so the file stays small. Job pins come from data/jobs.json, built
by build_blog.py from tools/jobs.csv, so new jobs need no rebuild here.
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
