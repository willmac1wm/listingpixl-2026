# Listing Pixl website (listingpixl.com)

Real estate photography business in Cape May County, NJ. Static site on Vercel,
deployed automatically from `main` of github.com/willmac1wm/listingpixl-2026.
Owner: Will. He is not a developer: explain in plain words, ask before anything
goes live.

## How the site is built

Most pages are generated. Edit the generator, then rebuild; don't hand-edit the output.

| Run | Writes |
|---|---|
| `python3 build_blog.py` | `blog/*.html` (one post per shoot), `blog/index.html`, the homepage slider (between the `FEATURED:START/END` markers in `index.html`), `data/jobs.json` (map pins), `sitemap.xml` |
| `python3 tools/build_pages.py` | `areas/*` town pages, `services/*` service pages (imports SHOOTS and TOWNS from build_blog.py) |
| `python3 tools/build_gbp.py ~/Downloads/ListingPixl-Google-Business` | Google Business Profile posts: text, photos and a Monday/Thursday schedule per shoot. Delete only the numbered folders before rerunning; keep README.txt |

- Shoot data lives in `SHOOTS` in build_blog.py, newest shoot first. Town copy is in `TOWNS`.
- `api/book.js`: Ask a Question contact form, emails through Gmail (env `GMAIL_APP_PASSWORD`).
- `api/staff.js`: team dashboard at `/staff` (links to every service the business uses). Login is
  username `team` plus the `STAFF_PASSWORD` Vercel env var; with no password set it stays locked.
  To add a dashboard link, add a line to `SECTIONS` in that file.
- `tools/jobs.csv`: every property ever shot (map pins). Add new addresses there too.
- Needs Python 3 with Pillow (`pip3 install Pillow`).

## Adding new shoots

Use the `/add-shoots` command (`.claude/skills/add-shoots/SKILL.md`). It covers picking
photos, writing posts and publishing.

## Facts to get right

- Listing agents are in the HD Photo Hub folder names: Google Drive (william@exploringcapemay.com)
  > My Drive > HD Photo Hub > `[order id] <address> - <agent>`. A higher order id means a newer shoot.
- Most shoots are for Jason Ruffenach. Only write "eXp Realty" for his 2025-and-later shoots;
  leave the brokerage blank when it isn't known. Leave the agent off if only a first name is known.
- Take the shoot month from the photos' EXIF date (tools/shoot_sheets.py prints it).
- Twilight exteriors are virtual twilights. Say "virtual twilight".
- Pricing is managed in HDPhotoHub. Current packages are Essential, Standard, Marketing, Luxury and Signature; do not copy numeric prices into other pages or schemas. The homepage reads public checkout prices through `/api/prices`. Link town/service pages to current packages. No travel fee in Cape May County.
- Client photo delivery: HD Photo Hub at listingpixl.hd.pics (admin: listingpixl.hd.pics/admin).
- Phone (609) 780-7027. AI receptionist: Smith.ai. Email ListingPixl.Media@gmail.com.

## Rules

- Write only what the photos show. No invented bedroom counts, prices, sale results or features.
- Leave out photos with drawn-on lines or arrows (lot lines, "home here" markers), floor plans,
  before/after staging pairs, signs or windows showing phone numbers, and true duplicates.
- Don't rename or delete existing images: old file names (paave_01.jpg, nyave_01.jpg...) are
  linked from Facebook and search results. New images use `<address>-<town>-nj-<what>.jpg`.
- Keep Google Business post text under 1,500 characters and free of phone numbers.
- Work on a branch, push it, and give Will the Vercel preview link. Merge to `main` (which
  publishes the live site) only after he says so.

## Deploy notes

- Pushes with many photos fail over HTTPS unless you raise the buffer:
  `git -c http.postBuffer=1048576000 push`.
- A commit gets a preview build and a production build with the same SHA. To know the live
  site updated, wait for the production deployment (Vercel deployments list, target production)
  or poll the live URL, not just the commit status.
- Preview URLs sit behind Vercel's own login, so curl gets a 302 there. Check them in a browser.

