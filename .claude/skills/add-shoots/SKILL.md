---
name: add-shoots
description: Turn shoot zips downloaded from HD Photo Hub into blog posts, homepage slides and Google Business posts on listingpixl.com. Use when Will says he downloaded shoots or photos, or asks for blog posts for properties.
---

# Add shoots to listingpixl.com

Read CLAUDE.md first: it has the facts and rules this relies on.

## 1. Find the zips

Look in ~/Downloads for zips named like `125-E-Atlantic-Ave.zip`, newest first
(`ls -lt ~/Downloads/*.zip`). Skip any address already in `SHOOTS` in build_blog.py unless
Will asked to add photos to an existing post. Tell him which addresses you found.

## 2. Contact sheets

```bash
python3 tools/shoot_sheets.py /tmp/listingpixl-sheets ~/Downloads/<zip> [...]
```

Look at each sheet image. It prints the shoot month for each zip.

## 3. Facts per shoot

- Town and ZIP: `tools/jobs.csv` if the address is there; otherwise look it up and add a row.
- Agent: HD Photo Hub folder names (see CLAUDE.md).
- Date: month from step 2, written like "May 2026".

## 4. Pick photos

5–12 per shoot, lead photo first (best exterior, ideally a virtual twilight), then drone,
kitchen, living spaces, bedroom, bath, outdoor space. Follow the photo rules in CLAUDE.md.
Look closely at drone shots for drawn-on lines or arrows. Write a picks JSON
(format in the header of tools/export_shoot_photos.py) with a short label and an alt text
per photo that says what is in it and the town.

```bash
python3 tools/export_shoot_photos.py /tmp/listingpixl-sheets/picks.json /tmp/listingpixl-sheets
```

Copy the printed `slug=` and `photos=` lines into the new SHOOTS entries.

## 5. Write the posts

Add a dict per shoot to `SHOOTS` in build_blog.py, keeping newest first:

```python
dict(slug='...', address='...', town='...', zip='...', agent='...', brokerage='...',
     date='May 2026', photos=[...],
     blurb='One sentence: what the home is and what the shoot covered.',
     intro='3-4 sentences describing the property and the shots, only what the photos show.',
     highlights=['4-5 items matching the gallery'],
     tags=['3 short tags for the homepage slide']),
```

If a town is new, add it to `TOWNS` (a unique paragraph about the town plus 5 nearby towns).

## 6. Build and check

```bash
python3 build_blog.py && python3 tools/build_pages.py
```

Serve the folder (`python3 -m http.server`) and look at a new post, the blog index and the
homepage slider at desktop and phone width. Check every image loads.

## 7. Publish

1. New branch, commit, push (`git -c http.postBuffer=1048576000 push -u origin <branch>`).
2. Give Will the Vercel preview link and wait for his OK.
3. Merge to main, push, and confirm the new post loads on www.listingpixl.com.
4. Regenerate the Google Business folder (see CLAUDE.md) so the new shoots get posts and dates.
