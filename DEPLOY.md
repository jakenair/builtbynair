# Built by Nair — deployment

Static site. No build step, no dependencies. Everything is in `index.html`.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole site. Inline CSS and JS; fonts from Google Fonts. |
| `404.html` | Not-found page, styled to match. GitHub Pages serves this automatically. |
| `favicon.svg` | NV monogram. |
| `CNAME` | Your custom domain, one line, no protocol. **Must be edited.** |
| `robots.txt` | Allows everything, points at the sitemap. **Edit the domain.** |
| `sitemap.xml` | One URL. **Edit the domain.** |

## Before you deploy — find and replace

`REPLACE-DOMAIN` was replaced with `builtbynair.com` in CNAME, index.html, robots.txt and sitemap.xml.
(e.g. `builtbynair.com`, no `https://`, no trailing slash):

- `CNAME` — the whole file is just the domain
- `index.html` — canonical link, `og:url`, and the commented-out `og:image`
- `robots.txt` — sitemap line
- `sitemap.xml` — `<loc>` line

```bash
grep -rl 'REPLACE-DOMAIN' . | xargs sed -i '' 's/REPLACE-DOMAIN/builtbynair.com/g'   # macOS
```

## Deploy to GitHub Pages

1. Create a new **public** repository (private repos need a paid plan for Pages).
   Name it anything — `builtbynair` is fine.
2. Push these files to the root of the `main` branch.
3. Repo **Settings → Pages**: set Source to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. In the same screen, enter your domain under **Custom domain** and save.
5. Wait for the DNS check to pass, then tick **Enforce HTTPS**.
   That checkbox can take up to 24 hours to become available — this is normal, not a misconfiguration.

## DNS records at your registrar

**Apex domain** (`builtbynair.com`) — four A records, all with host `@`:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

And four AAAA records, also host `@`, for IPv6:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

**www subdomain** — one CNAME record:

```
Host:  www
Value: jakenair.github.io
```

Note the value is your GitHub Pages default domain — **not** the repository name, and with no
path after it.

DNS changes usually resolve within an hour but can take up to 48. Until then GitHub's domain
check will fail; that is expected and not something to fix.

## After it's live — check these

- [ ] `https://` works and the padlock is clean (certificate issued)
- [ ] `www.` redirects to the apex, or the other way round — either is fine, pick one
- [ ] The site loads at phone width with no horizontal scrolling
- [ ] The inquiry form opens a prefilled email to `jakenair23@gmail.com`
- [ ] Both light and dark system themes look right
- [ ] Share the URL in a message to yourself and confirm the link preview is correct

## Still to do

- **Portrait photo.** `index.html` has a placeholder block in the About section marked
  `<div class="ph">`. Replace that whole `<figure>` content with
  `<img src="/jake.jpg" alt="Jake Nair">` and drop the file in beside `index.html`.
  Crop it to 4:5 and export it under about 300 KB.
- **Share image.** A 1200×630 PNG at `/og.png`, then uncomment the `og:image` meta tag.
  Without it, links shared anywhere will show no preview card.
- **Real contact form.** The form currently opens the visitor's email client. To make it a
  true background submission, point it at a Cloud Function that sends through Resend.
  See the separate instructions for that.
