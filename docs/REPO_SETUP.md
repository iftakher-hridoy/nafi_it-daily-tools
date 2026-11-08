# GitHub repository setup — make the repo page look good

This file is only a guide. Do these steps on GitHub after uploading the zip.

## 1. About (top-right of the repo page, click the gear icon)

- **Description:**
  `VMS – Daily Work Tools: one dashboard for duty hours, shift rosters, salary, OCR, QR, PDF, video and internet tools. Free, open source, single-file, hosted on GitHub Pages.`
- **Topics (click Add topics):**
  `duty-calculator, shift-schedule, salary-calculator, ocr, qr-code, pdf-tools, video-converter, speed-test, github-pages, bangladesh, open-source, html-css-javascript`

Tick **Releases**, **Packages** and **Deployments** if GitHub offers them — they make the right sidebar look complete.

## 2. Screenshots

The README already shows `docs/screenshots/dashboard-preview.png`.

To replace it with a real screenshot from your live site:

1. Open your live site, take a screenshot (desktop, 1280×800 is ideal).
2. Save it as `docs/screenshots/dashboard.png` (and optionally `dashboard-mobile.png` at 390px wide).
3. In `README.md`, change the image line to point at your new file.
4. Commit and push — GitHub will show the new image on the repo page.

## 3. Social preview (optional, makes links look good when shared)

Repo → **Settings → General → Social preview** → Upload an image, 1280×640px.
Use `docs/screenshots/dashboard-preview.png` (or your real screenshot).

## 4. First release (optional)

Repo → **Releases → Draft a new release** → Tag: `v1.0.0`, Title: `VMS Daily Work Tools v1.0.0`,
Description: `First public release — duty calculator, shift roster, salary, OCR, QR, PDF, video and internet tools in one dashboard.`
Then publish. This gives the project a version history.
