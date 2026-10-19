#!/usr/bin/env python3
"""Generate the Listing Pixl blog: 10 SEO shoot posts + index.

Run from anywhere: output goes to blog/ next to this script.
"""
import os, html, json, csv

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = os.path.join(HERE, "blog")
IMAGES = os.path.join(HERE, "images")
os.makedirs(BLOG, exist_ok=True)

PHONE = "(609) 780-7027"
DOMAIN = "https://www.listingpixl.com"
PIXEL_ID = "1900535534248768"
PIXEL_SNIPPET = """  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1900535534248768');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1900535534248768&ev=PageView&noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->
"""

GA_ID = "G-5EWNW94QHH"
GA_SNIPPET = """  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-5EWNW94QHH"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-5EWNW94QHH');
  </script>
"""

EMAIL = "ListingPixl.Media@gmail.com"
FB = "https://www.facebook.com/listing.pixl.media/"

# NOTE (2026-10-16, verified via Street View): every photo once attributed to
# "301 E Pacific Ave, Villas NJ" actually shows 101 Pennsylvania Ave
# (door number "101" visible; Street View confirms 301 E Pacific is a
# different white cottage). That post was removed; its photos live here.
SHOOTS = [
    dict(slug="414-paradise-way-north-wildwood-nj", address="414 Paradise Way", town="North Wildwood", zip="08260",
         agent="Dave Emerson", brokerage="eXp Realty", date="October 2025",
         photos=[("paradiseway_01_staged.jpg", "North Wildwood NJ townhomes glowing at twilight"),
                 ("paradiseway_02_drone.jpg", "Drone aerial of a North Wildwood townhome row")],
         blurb="Twilight exteriors plus drone aerials for this North Wildwood townhome."),
    dict(slug="218-rio-grande-ave-wildwood-nj", address="218 Rio Grande Ave", town="Wildwood", zip="08260",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("riogrande_01_twilight.jpg", "Wildwood NJ beach house glowing at twilight"),
                 ("riogrande_02_drone_twilight.jpg", "Drone aerial of a Wildwood NJ street at twilight")],
         blurb="Scroll-stopping virtual twilights with drone coverage in Wildwood."),
    dict(slug="10-williams-way-ocean-view-nj", address="10 Williams Way", town="Ocean View", zip="08230",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("williamsway_01_twilight.jpg", "Two-story colonial home at twilight in Ocean View NJ"),
                 ("williamsway_02_twilight.jpg", "Front exterior of an Ocean View NJ home at dusk")],
         blurb="Virtual twilight exteriors for this Ocean View listing.",
         services_note="HDR listing photography with professional editing and color correction, delivered next-day and sized ready for the MLS, plus virtual twilight exteriors that make the listing stand out online."),
    dict(slug="124-w-new-york-ave-villas-nj", address="124 W New York Ave", town="Villas", zip="08251",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("nyave_01.jpg", "Light blue Villas NJ cottage with red shutters at twilight"),
                 ("nyave_02.jpg", "Top-down drone view of a Villas NJ property with outlined lot"),
                 ("nyave_03.jpg", "Drone aerial toward the bay over Villas NJ")],
         blurb="Full HDR coverage plus a twilight exterior in Villas."),
    dict(slug="205-st-andrews-dr-cape-may-court-house-nj", address="205 St Andrews Dr", town="Cape May Court House", zip="08210",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("standrews_01_staged_twilight.jpg", "Cape May Court House NJ townhomes at twilight"),
                 ("standrews_02_twilight.jpg", "Townhome exteriors glowing at dusk in Cape May Court House NJ"),
                 ("standrews_03_aerial.jpg", "Drone aerial of a Cape May Court House townhome community")],
         blurb="Staged twilight shots and drone aerials in Cape May Court House."),
    dict(slug="7710-atlantic-ave-wildwood-nj", address="7710 Atlantic Ave Unit 403", town="Wildwood", zip="08260",
         agent="Alexander M. Powers", brokerage="Keller Williams Jersey Shore", date="2025",
         desc="Listing Pixl photographed this Wildwood NJ condo at 7710 Atlantic Ave Unit 403. Drone aerials over the beach.",
         photos=[("atlantic_01.jpg", "Drone aerial over Wildwood NJ beach and oceanfront buildings"),
                 ("atlantic_02.jpg", "Aerial view of Wildwood beach, ocean and shoreline hotels"),
                 ("atlantic_03.jpg", "Wide drone aerial of the Wildwood NJ coastline")],
         blurb="Condo listing photography with sweeping aerials in Wildwood."),
    dict(slug="205-euclid-ave-somers-point-nj", address="205 Euclid Ave", town="Somers Point", zip="08244",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("euclid_01_aerial.jpg", "Drone aerial of a Somers Point NJ two-story home"),
                 ("euclid_02_exterior.jpg", "Two-story Somers Point NJ home with garage and lawn")],
         blurb="Exterior and aerial coverage for this Somers Point listing."),
    dict(slug="601-dove-dr-millville-nj", address="601 Dove Dr", town="Millville", zip="08332",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("dovedr_01_twilight.jpg", "Millville NJ mid-century modern home at twilight"),
                 ("dovedr_02_exterior.jpg", "Mid-century modern home exterior with big lawn in Millville NJ"),
                 ("dovedr_04_aerial_lake.jpg", "Drone aerial over treetops toward the lake in Millville NJ"),
                 ("dovedr_03_aerial_topdown.jpg", "Top-down drone view of the Millville NJ property"),
                 ("dovedr_05_aerial_wide.jpg", "Wide drone aerial over the Millville NJ treetops"),
                 ("dovedr_06_greatroom.jpg", "Bright great room with fireplace and tall windows")],
         blurb="Twilight, aerials and interiors for a Millville lakefront property."),
    dict(slug="114-catherine-ave-buena-nj", address="114 Catherine Ave", town="Buena", zip="08310",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("catherine_01_exterior.jpg", "Two-story Buena NJ home with two-car garage"),
                 ("catherine_02_aerial.jpg", "Drone aerial of a Buena NJ home and yard")],
         blurb="Exterior and drone aerial photography in Buena."),
    dict(slug="101-pennsylvania-ave-villas-nj", address="101 Pennsylvania Ave", town="Villas", zip="08251",
         agent="Jason Ruffenach", brokerage="eXp Realty", date="2025",
         photos=[("paave_01.jpg", "Beige Villas NJ bungalow with front deck, American flag and red patio umbrella"),
                 ("paave_02.jpg", "Drone aerial view of a beige bungalow with deck in Villas NJ"),
                 ("paave_03.jpg", "Dining room with wooden table, white chairs and bar cart"),
                 ("paave_04.jpg", "Side view of a beige bungalow with deck and fenced yard in Villas NJ"),
                 ("villas_02_aerial.jpg", "Drone aerial of Villas NJ neighborhood streets and homes"),
                 ("villas_03_aerial.jpg", "Aerial view over Villas NJ rooftops and tree-lined streets")],
         blurb="Drone-heavy coverage showing the lot and setting in Villas."),
]

# Service Area map pins (data/jobs.json): one pin per property in
# tools/jobs.csv, the full job list from HD Photo Hub. Rows marked approx=1
# sit in the right town but not on the house; tools/geocode_jobs.py swaps in
# exact spots (and fills new rows) once the Census geocoder is reachable. A job with a blog post gets its
# photo and a link in the pin's popup.
def _addr_key(address, town):
    return "".join(ch for ch in f"{address}{town}".lower() if ch.isalnum())

def jobs_json():
    posts = {_addr_key(s["address"], s["town"]): s for s in SHOOTS}
    jobs = []
    with open(os.path.join(HERE, "tools", "jobs.csv"), newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not (row["lat"] and row["lng"]):
                print(f"build_blog.py: no map pin for {row['address']}, {row['town']} -- run tools/geocode_jobs.py")
                continue
            job = {"address": row["address"], "town": row["town"],
                   "lat": float(row["lat"]), "lng": float(row["lng"])}
            if int(row["shoots"] or 1) > 1:
                job["shoots"] = int(row["shoots"])
            post = posts.get(_addr_key(row["address"], row["town"]))
            if post:
                job["url"] = f"blog/{post['slug']}.html"
                job["thumb"] = f"images/{post['photos'][0][0][:-4]}-480.jpg"
            jobs.append(job)
    return {"jobs": jobs, "count": len(jobs)}

DEFAULT_SERVICES_NOTE = ("HDR listing photography with professional editing and color correction, "
                         "delivered next-day and sized ready for the MLS. Drone aerial photography showed "
                         "the lot, the setting, and the surrounding {town} neighborhood \u2014 the views "
                         "that make South Jersey listings stand out online.")

def a_an(word):
    return "an" if word[:1].lower() in "aeiou" else "a"

NAV = """  <header class="site-header">
    <nav class="nav" aria-label="Main navigation">
      <a class="brand" href="../index.html" aria-label="Listing Pixl home"><img src="../images/logo-horizontal-156.jpg" srcset="../images/logo-horizontal-156.jpg 1x, ../images/logo-horizontal-312.jpg 2x" alt="Listing Pixl" class="brand-logo" width="156" height="66"></a>
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false">&#9776;</button>
      <ul class="nav-links">
        <li><a href="../index.html#services">Services</a></li>
        <li><a href="../index.html#packages">Packages</a></li>
        <li><a href="../index.html#portfolio">Portfolio</a></li>
        <li><a href="../index.html#areas">Service Area</a></li>
        <li><a href="index.html">Blog</a></li>
        <li><a href="https://listingpixl.hd.pics/" target="_blank" rel="noopener">Client Login</a></li>
        <li><a href="../index.html#contact" class="nav-cta btn-pink">Lock In Your Shoot</a></li>
      </ul>
    </nav>
  </header>"""

FOOTER = f"""  <nav class="mobile-cta" aria-label="Quick contact">
    <a href="tel:+16097807027">Call</a>
    <a href="sms:+16097807027">Text</a>
    <a href="../index.html#contact" class="is-pink">Book a shoot</a>
  </nav>

  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-contact">Call or text <a href="tel:+16097807027">{PHONE}</a> &middot; <a href="mailto:{EMAIL}">{EMAIL}</a></p>
      <p>Real estate photography across Cape May County &amp; South Jersey</p>
      <p>&copy; 2026 Listing Pixl. All rights reserved.</p>
      <p><a href="../privacy.html">Privacy Policy</a> &middot; <a href="{FB}" target="_blank" rel="noopener">Find us on Facebook</a></p>
    </div>
  </footer>

  <script src="../site.js" defer></script>"""

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print("WARNING: Pillow not installed — image sizes and resized copies will be skipped. pip install Pillow")

def img_size(fname):
    if not HAS_PILLOW:
        return ""
    try:
        w, h = Image.open(os.path.join(IMAGES, fname)).size
        return f' width="{w}" height="{h}"'
    except Exception:
        return ""

def srcset(fname, prefix="../images/"):
    """srcset attribute for 480/800/1200 copies when they exist."""
    import os
    base, ext = os.path.splitext(fname)
    parts = []
    for w in (480, 800, 1200):
        f = f"{base}-{w}{ext}"
        if os.path.exists(os.path.join(IMAGES, f)):
            parts.append(f"{prefix}{f} {w}w")
    if not parts:
        return ""
    parts.append(f"{prefix}{fname} 1600w")
    return ' srcset="' + ", ".join(parts) + '" sizes="(max-width: 720px) 100vw, 720px"'

def post_page(s):
    title = f"{s['address']}, {s['town']} NJ Real Estate Photos | Listing Pixl"
    if len(title) > 62:  # Google truncates around 60 characters; drop the brand suffix on long addresses
        title = f"{s['address']}, {s['town']} NJ Real Estate Photos"
    desc = s.get("desc") or (f"Listing Pixl photographed this {s['town']}, NJ listing at {s['address']} "
            f"for {s['agent']} ({s['brokerage']}). HDR photos, drone aerials and twilights.")
    services = s.get("services_note") or DEFAULT_SERVICES_NOTE.format(town=html.escape(s['town']))
    def _img(i, p, a):
        first = (i == 0)
        load = 'loading="eager" fetchpriority="high"' if first else 'loading="lazy"'
        return (f'        <figure class="blog-photo">\n'
                f'          <a class="blog-photo-link" href="../images/{p}">'
                f'<img src="../images/{p}"{srcset(p)} alt="{html.escape(a)}" '
                f'{load}{img_size(p)}></a>\n'
                f'        </figure>')
    imgs = "\n".join(_img(i, p, a) for i, (p, a) in enumerate(s["photos"]))
    areas = ["Wildwood", "Ocean City", "Stone Harbor", "Avalon", "Sea Isle City"]
    area_list = ", ".join([a for a in areas if a != s['town']])
    cta = (f"Selling in {html.escape(s['town'])} or anywhere in Cape May County? Listing Pixl shoots across "
           f"{html.escape(s['town'])}, {area_list}, and surrounding South Jersey towns. Packages from $295. "
           f'Call or text <a href="tel:+16097807027">{PHONE}</a> or <a href="../index.html#contact">lock in your shoot online</a>.')
    schema = {"@context": "https://schema.org", "@type": "BlogPosting",
              "headline": f"Real Estate Photography in {s['town']}, NJ: {s['address']}",
              "image": [f"{DOMAIN}/images/{p}" for p, _ in s["photos"]],
              "author": {"@type": "Organization", "name": "Listing Pixl", "telephone": PHONE},
              "publisher": {"@type": "Organization", "name": "Listing Pixl",
                            "logo": {"@type": "ImageObject", "url": f"{DOMAIN}/listing-pixl-logo-official.png"}},
              "mainEntityOfPage": f"{DOMAIN}/blog/{s['slug']}.html",
              "about": f"Real estate photography in {s['town']}, New Jersey"}
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add('js')</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta property="og:type" content="article">
  <link rel="canonical" href="{DOMAIN}/blog/{s['slug']}.html">
  <meta property="og:url" content="{DOMAIN}/blog/{s['slug']}.html">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="{DOMAIN}/images/{s['photos'][0][0]}">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="stylesheet" href="../styles.css">
  <script type="application/ld+json">
  {json.dumps(schema, indent=2)}
  </script>
{PIXEL_SNIPPET}
{GA_SNIPPET}
</head>
<body>
{NAV}

  <main>
    <article class="section">
      <div class="wrap narrow">
        <p class="blog-crumb"><a href="index.html">&larr; All shoots</a></p>
        <h1>Real Estate Photography in {html.escape(s['town'])}, NJ: {html.escape(s['address'])}</h1>
        <p class="blog-meta">Shot {html.escape(s['date'])} &middot; Listing agent: {html.escape(s['agent'])}, {html.escape(s['brokerage'])}</p>

        <h2>About this {html.escape(s['town'])} listing shoot</h2>
        <p>Listing Pixl provided professional real estate photography for this {html.escape(s['town'])}, New Jersey property at {html.escape(s['address'])} {html.escape(s['zip'])}. {html.escape(s['blurb'])} The shoot was booked by {html.escape(s['agent'])} of {html.escape(s['brokerage'])} to give the listing scroll-stopping photos for the MLS, Zillow, and social media.</p>

        <div class="blog-gallery">
{imgs}
        </div>

        <h2>Real estate photography services delivered</h2>
        <p>This {html.escape(s['town'])} NJ shoot included {services}</p>

        <h2>Lock In {a_an(s['town'])} {html.escape(s['town'])}, NJ Real Estate Photographer</h2>
        <p>{cta}</p>
        <p class="post-cta"><a class="btn btn-pink" href="../index.html#contact">Lock In Your Shoot</a> <a class="btn btn-outline" href="index.html">See more shoots</a></p>
      </div>
    </article>
  </main>

{FOOTER}
</body>
</html>
"""

def index_page():
    cards = "\n".join(
        f"""        <article class="blog-card">
          <a href="{s['slug']}.html">
            <img src="../images/{s['photos'][0][0]}"{srcset(s['photos'][0][0])} alt="{html.escape(s['photos'][0][1])}" loading="lazy"{img_size(s['photos'][0][0])}>
            <h2>{html.escape(s['address'])} &mdash; {html.escape(s['town'])}, NJ</h2>
          </a>
          <p>{html.escape(s['blurb'])}</p>
          <p class="blog-meta">{html.escape(s['date'])} &middot; {html.escape(s['agent'])}</p>
        </article>""" for s in SHOOTS)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add('js')</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recent Shoots | Listing Pixl South Jersey Real Estate Photography</title>
  <meta name="description" content="Recent real estate photography shoots by Listing Pixl across Cape May County & South Jersey NJ.">
  <meta property="og:type" content="website">
  <link rel="canonical" href="{DOMAIN}/blog/">
  <meta property="og:url" content="{DOMAIN}/blog/">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="{DOMAIN}/images/riogrande_01_twilight.jpg">
  <meta property="og:title" content="Recent Shoots | Listing Pixl">
  <meta property="og:description" content="Recent listing shoots across Cape May County & South Jersey NJ.">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="stylesheet" href="../styles.css">
{PIXEL_SNIPPET}
{GA_SNIPPET}
</head>
<body>
{NAV}

  <main>
    <section class="section">
      <div class="wrap">
        <h1>Recent Shoots: Real Estate Photography Across South Jersey</h1>
        <p class="section-lede">Every listing we shoot in Cape May County and South Jersey NJ &mdash; HDR photography, drone aerials, and virtual twilights for local listing agents.</p>
        <div class="blog-grid">
{cards}
        </div>
        <div class="work-cta">
          <p>Want your listing to look like this?</p>
          <a href="../index.html#contact" class="btn btn-pink">Lock In Your Shoot</a>
        </div>
      </div>
    </section>
  </main>

{FOOTER}
</body>
</html>
"""

for s in SHOOTS:
    open(os.path.join(BLOG, s["slug"] + ".html"), "w", encoding="utf-8").write(post_page(s))
open(os.path.join(BLOG, "index.html"), "w", encoding="utf-8").write(index_page())
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
with open(os.path.join(HERE, "data", "jobs.json"), "w", encoding="utf-8") as fh:
    json.dump(jobs_json(), fh, indent=1)
urls = ["/", "/blog/", "/privacy.html"] + [f"/blog/{s['slug']}.html" for s in SHOOTS]
with open(os.path.join(HERE, "sitemap.xml"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    fh.writelines(f"  <url>\n    <loc>{DOMAIN}{u}</loc>\n  </url>\n" for u in urls)
    fh.write("</urlset>\n")
# remove the deleted post if it exists
stale = os.path.join(BLOG, "301-e-pacific-ave-villas-nj.html")
if os.path.exists(stale):
    os.remove(stale)
    print("removed stale 301-e-pacific-ave post")
print(f"Wrote {len(SHOOTS)} posts + index to {BLOG}")
