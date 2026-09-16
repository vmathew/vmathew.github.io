# bitsnbeyond counter

A Cloudflare Worker that stores view and like counts for the blog. No cookies,
no raw IP addresses, no third-party service.

## Deploy

```sh
cd counter-worker
npm install -g wrangler          # once
wrangler login                   # once

wrangler kv namespace create COUNTS
# paste the printed id into wrangler.toml

wrangler deploy                  # creates the Worker and uploads the code

wrangler secret put SALT
# paste any long random string, e.g. from: openssl rand -hex 32
# secrets apply immediately — no redeploy needed
```

Deploy before setting the secret. Running `wrangler secret put` first works, but
it has to create an empty placeholder Worker to attach the secret to, which
prompts "There doesn't seem to be a Worker called …". Answering yes is harmless
— the next `wrangler deploy` replaces the placeholder and the secret survives.

## If deploy fails

**"You need to register a workers.dev subdomain"** — first-time accounts must
claim one in the Cloudflare dashboard under Workers & Pages → choose a subdomain.
Nothing is wrong with the config; the account just has no hostname yet.

**"You need to verify your email address to use Workers"** — an account-level
gate, nothing to do with this config. Cloudflare will have sent a verification
mail at signup; if it is gone, resend it from dash.cloudflare.com → My Profile,
click the link, then re-run `wrangler deploy`. The upload and KV binding shown
just above the error are already correct at that point.

**Authentication / account errors** — `wrangler logout` then `wrangler login`, and
if the account has multiple Cloudflare accounts, set `account_id` in
`wrangler.toml`.

**KV binding errors** — check the `id` under `[[kv_namespaces]]` matches what
`wrangler kv namespace list` reports for `COUNTS`.

Until the Worker is live and `counter_api` is set in `_config.yml`, the site
renders no feedback bar, so a failed deploy leaves the blog untouched.

`wrangler deploy` prints a URL like `https://bitsnbeyond-counter.<you>.workers.dev`.
Put it in `_config.yml`:

```yaml
counter_api: "https://bitsnbeyond-counter.<you>.workers.dev"
```

Until that key is set, the feedback bar renders nothing — the site is unaffected.

## Endpoints

| Method | Path          | Does                                     |
|--------|---------------|------------------------------------------|
| POST   | `/hit/<slug>` | Records a view, returns the counts        |
| POST   | `/like/<slug>`| Records a like, returns the counts        |

Both return `{ "views": n, "likes": n, "liked": bool }`.

## How de-duplication works

The visitor key is a salted SHA-256 of `IP + SALT + slug`, truncated. The raw IP
is never written to storage, and because the slug is part of the hash the same
reader cannot be tracked from one post to another.

- **Views** de-duplicate for 12 hours, so a refresh does not inflate the count.
- **Likes** are one per visitor, kept indefinitely.

## Limits worth knowing

Workers KV on the free plan allows roughly **1,000 writes per day**. A first-time
view costs two writes (the de-dupe marker and the counter), so the free plan
comfortably covers a few hundred unique views a day. Reads are far more generous.

KV also has no atomic increment, so two writes in the same instant can lose one.
At blog traffic that is noise. If the numbers ever need to be exact, move the two
counters to a Durable Object — the endpoints and the front end stay the same.

## Checking a count by hand

```sh
curl -X POST https://bitsnbeyond-counter.<you>.workers.dev/hit/some-post-slug
```
