# Seasonal decoration

The Team Dashboard (`/staff`, Holiday decoration) has a master switch. Default is
off. When on, the homepage loads an isolated decorative layer that selects a
holiday using America/New_York dates. Off removes the layer without changing the
page content, photos, layout, prices or links. A visible page checks the switch
every 30 seconds and when brought to the foreground. Storage/network failures
turn decoration off. Hidden tabs refresh when shown again.

State is saved in the existing private Blob store at `settings/seasonal.json`.
The existing production/preview namespace separation applies. Preview settings
never control production. GET `/api/seasonal` exposes only the display boolean;
POST requires the existing team authentication, JSON, X-Staff header and exact
same HTTPS origin. No extra account, password or deployment is needed to toggle.

`/holiday-preview` renders the current `index.html` with current HDPhotoHub prices;
it is not a stale copied homepage. Its local controls do not save the master
switch. Examples: `?theme=halloween`, `?theme=winter`, or
`?date=2026-11-26` for the automatic calendar. The demo is noindex and omits the
homepage's marketing analytics.

Calendar windows:

| Holiday | Window |
| --- | --- |
| Halloween | October 20–31 |
| Thanksgiving | Monday–Sunday of the fourth Thursday in November |
| Winter holidays | December 1–26 |
| New Year | December 27–January 3 |
| Valentine's Day | February 10–14 |
| Independence Day | July 1–4 |

All other dates are undecorated. The calendar checks for a date change on pages
left open. Reduced-motion preferences disable animation; there are no sounds or
flashing effects. Decorations ignore pointer events, fit the viewport gutters,
and hide corner ornaments when room is tight. Shadow DOM contains the styles;
ResizeObserver and DOM-change observations adapt the frame to page edits.

`index.html` stays unchanged. `api/home.js` adds the lightweight master-switch
loader when serving the page. To extend to generated service/blog pages later,
add the loader to their generators after review rather than hand-editing output.
Current scope is the public homepage only; HDPhotoHub checkout is separate.

Release this through a preview branch and owner approval, as in CLAUDE.md.
