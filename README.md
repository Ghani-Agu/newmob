# newmob

A simple, white storefront. No build step, no dependencies: just Node.

- **Hero slider or video.** Pick one in the admin (`/admin`). The slider fades between slides and supports swipe. The video autoplays muted, on a loop.
- **Products sit on the page.** Product tiles use the same background as the site (`--bg` in `public/styles.css`). Images are drawn with `mix-blend-mode: multiply`, so photos with an off-white background blend into the page. Images are framed tightly so the product fills the tile, zoom slightly on hover, and zoom in further in the quick view (click or hover).
- **Short titles.** One word or one product name per heading.

## Run

```bash
ADMIN_PASSWORD=change-me npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin
```

If `ADMIN_PASSWORD` is not set, the password is `admin`.

## Admin

- **Hero:** switch between **Slider** and **Video**.
  - Slider: add, remove or reorder slides. Each slide has an image, a title, a line under the title, and a button.
  - Video: upload an `.mp4` (best support, including iPhone) or `.webm`. Add a poster image, a title, and a text color (dark for light videos, light for dark ones).
- **Products:** image, name, category, price and tag (`New`, `Sale`…). The categories become the filters and the menu.
- **General:** store name, currency symbol.

Click **Save** to publish. Changes go live on the next page load.

## Product photos: best results

- Use PNGs with a transparent background, or JPGs on a plain white background.
- Crop close to the product. The tile adds only a little padding.
- Square images (e.g. 1200×1200) fill the tiles best.

## Files

```
server.js          static files + JSON API (store data, uploads)
data/store.json    hero settings and products (edited from /admin)
public/            site (index.html, app.js, styles.css) and admin (admin.*)
public/img/        demo product images
public/video/      demo hero video + poster
public/uploads/    files uploaded from the admin (not committed)
```

## Deploying

The data lives in `data/store.json` and uploads go to `public/uploads/`. Keep both on persistent storage, such as a VPS or a host with a persistent disk. Set `ADMIN_PASSWORD` and serve over HTTPS.
