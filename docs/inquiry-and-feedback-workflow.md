# Inquiry and feedback operations

Website changes must be reviewed in a Vercel preview before publishing.

## Contact inquiries

`api/book.js` validates a question, rate limits submissions, and saves a private
copy and outbox marker before attempting Gmail. A successful email returns 200;
a safely saved inquiry whose notification is delayed returns 202. Failed backup
returns an error and the form retains the visitor's message and email fallback.

The client keeps one request ID for retries of the same message. The private
record has a conditional-write lease to prevent concurrent sends. SMTP timeouts
whose outcome is ambiguous require a staff Gmail check before another send.
A stable Message-ID aids that check; it does not promise exactly-once SMTP.

The private store is `listingpixl-inquiries-private` in Vercel. It is connected
to Production and Preview using OIDC (`BLOB_STORE_ID`); no token belongs in
browser JavaScript. Production, preview branches and local development use
separate prefixes. No inquiry is stored in the public GitHub repository.

`/staff/inquiries` uses the existing team login at `/staff/login`. Browser
sign-in creates a four-hour, encrypted iron-session cookie with Secure,
HttpOnly and SameSite=Strict attributes. A random server-only session key lives
in the private store, with a key derived from it and the current team credential;
public pre-login cookies do not expose a password-derived signing oracle.
No password is stored in page HTML or
browser storage. Login/logout forms require a same-origin request and a CSRF
token; sign-in attempts are limited through private shared storage. Password
changes invalidate existing sessions. Basic authentication remains available
for existing authenticated API clients. Use `/staff/logout` to end the browser
session. The inbox shows saved questions,
delivery status, and protected retry / already-received actions. Pending records
are shown before delivered records. The inbox and API use `no-store` and
`noindex`; private Blob objects are not publicly downloadable.

`/api/book?health=1` is a read-only check returning no visitor information. It
reports 503 when backup is unavailable, Gmail is unconfigured, or an email has
remained pending for more than two minutes. It does not send a test email or
prove current SMTP connectivity when no email has been attempted.

An optional `api/retry-inquiries.js` handler is prepared for a daily job, but is
not scheduled: Vercel denied connector permission to create its `CRON_SECRET`.
Staff can recover a pending question immediately from the protected inbox.
Uncertain SMTP outcomes require a Gmail check before any resend.
An independent hourly ChatGPT alert checks the health endpoint and production
error logs, so a Gmail outage does not also suppress the alert.

## Two-way text feedback: prepared, activation blocked

HDPhotoHub's current review email is set to 12 hours and its review text to one
day. These timers start when Delivery Only or the Marketing Kit is purchased,
according to its [review notification documentation](https://support.hdphotohub.com/hc/en-us/articles/48738460561428-Leave-a-Review-Email).
They do not prove that the delivery email has already been sent. Keep delivery
purchases and actual media notification together, especially when scheduling a
notification for later. Its text template is locked, its API has no custom
SMS send endpoint, and the available webhook events do not include incoming SMS.
Do not disable those working messages until a replacement is connected and tested.

The optional Twilio adapter at `/api/sms-reply` is disabled by default. It uses
Twilio's SDK to validate the complete signed form payload against the exact
configured webhook URL and account. It saves replies privately, deduplicates
MessageSid, honors STOP/START, and routes feedback to the recoverable inquiry inbox.
Clear positive feedback receives a thank-you; concerns and mixed feedback request
details and flag a human follow-up. All known clients retain the same honest
review opportunity. Unknown numbers receive no automated review request.

Before activation, connect an approved two-way SMS number/provider and configure
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SMS_REPLY_WEBHOOK_URL` (the exact HTTPS
webhook URL), and `SMS_FEEDBACK_ENABLED=true` on the server. Never expose tokens.
The signed endpoint must be set as the provider's incoming-message webhook.
Register only verified delivered-order clients with recorded SMS consent through
`registerContact` in `lib/sms-feedback.js`; an HDPhotoHub delivery event must be
verified from a real payload before wiring an automatic initial text. This change
does not invent a delivery event, provision a number, buy a plan, or send texts.

A real delivered HDPhotoHub order is still required to confirm the existing
scheduled text actually reaches a consenting client. Local tests use fictional
provider test numbers and do not send any customer communication.

## Public pricing

The homepage is rendered by `api/home.js` using the same validated HDPhotoHub
public catalog as `/api/prices`. All 13 prices are in the initial HTML. Each
response can be cached for five minutes; homepage rendering fetches HDPhotoHub
directly to avoid stacking that cache on another five-minute API cache.
Ordered routes serve the homepage function before the static `index.html` file.
The browser skips a redundant refresh on arrival, retains verified prices through
a brief feed outage, and replaces prices older than ten minutes with checkout links.
The public price feed is crawlable. Private and operational APIs remain blocked.
No numeric prices are manually maintained in page copy or structured data.

## Google profile references

On October 23, 2026, Google's manager showed one verified Listing Pixl profile
and one duplicate. The verified profile has CID `1932492767557170654`.
`config/business-links.json` contains its Maps link and the review URL copied
from that profile's Ask for reviews screen. The website generators and optional
SMS adapter use those shared values. Run `python3 build_blog.py --sync-google-links`
after a profile merge to rebuild references without changing photo markup.

## Live validation

An internal inquiry on October 23, 2026 at 1:49 PM Eastern was saved privately,
delivered to ListingPixl.Media@gmail.com, and verified in the business Gmail
inbox. The saved record reports `sent`, one attempt, and no delivery error.
The new sign-in-to-inbox-to-sign-out flow is covered by local integration tests
with fictional credentials and saved inquiries. The deployed signed-in
`/staff/inquiries` view still needs the existing team login; its actual private
save and business Gmail receipt were already checked independently.

## Native HDPhotoHub checkout

The applied HTML block is versioned in `integrations/hdphotohub/order-header.html`.
It is managed in HDPhotoHub Shopping Cart > Config > HTML Block; publishing the
website does not update it. Marketing is Active with no default selection. The
old meeting and extra square-footage questions are scoped to the inactive staff
land product and hidden from the order form. The native square-footage field and
conditional lockbox/other instructions remain. Signature copy now explains the
5,001–6,500 sq ft range and asks for scope confirmation above 6,500 sq ft.

The deployed sign-in page was browser-checked on October 23, 2026: it renders
the branded form, preserves the inbox destination, and rejects a fictional
incorrect password with an inline error. Session keys are saved privately.
The staff HDPhotoHub link opens the verified Studio dashboard directly; the
legacy `/admin` URL rendered a blank page. No customer notifications were sent.
