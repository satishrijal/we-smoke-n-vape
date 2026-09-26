# We Smoke N Vape — Website + Admin Panel

Shop website for **We Smoke N Vape**, 2950 Walnut Hill Ln Unit 110, Dallas, TX 75229.
Built from the shop's real photos (26 picked from the 300-photo PDF).

## What's inside

**Public site** (`/`)
- 21+ age gate (remembers the visitor)
- Hero with the neon sign photo, ⭐ 5.0 rating badge, "Open til 1 AM"
- Vape section (disposables / e-liquids / devices) + Glass, Hookah, CBD, Accessories
- **Gallery tab**: auto-playing slideshow + photo grid, tap for fullscreen
- Deals section (managed from admin)
- Reviews (5.0 ★, 95 Google reviews + link)
- Text-to-join loyalty signup (SMS to the shop number)
- Visit section: per-day hours, address, embedded map, call/directions buttons
- Sticky Call / Directions bar on phones

**Admin panel** (`/admin`) — password protected
- 🏷️ **Deals**: add / edit / delete, each with a photo
- 📸 **Gallery**: upload new photos, edit captions, delete
- 🕐 **Hours**: opening & closing time per day (plus "closed" toggle)
- 🏪 **Shop info**: name, phone, address, announcement bar, rating, links
- ⭐ **Reviews**: edit the review highlight cards

## Run it locally

```bash
npm install   # zero dependencies, instant
ADMIN_USER=admin ADMIN_PASS=pick-a-password npm start
# open http://localhost:3000  — admin at http://localhost:3000/admin
```

## Deploy (Render, no terminal needed)

1. Upload this folder's **contents** to a GitHub repo (github.com/new → "uploading an existing file")
   — the files must sit at the repo root, not inside a subfolder
2. Render → New + → **Web Service** → connect the repo
3. Build command: `npm install` · Start command: `npm start`
4. Environment tab → add `ADMIN_USER` and `ADMIN_PASS` (your admin login)
5. Create → wait → copy the URL. Admin lives at `your-url.onrender.com/admin`

⚠️ **Note:** deals, gallery photos and hours are stored as files on the server.
A redeploy resets them to these defaults — re-upload after deploying, or ask
for the database upgrade (Neon Postgres) and edits will survive redeploys.

## Photos

- `public/images/` — the 26 launch photos (web-optimized)
- `public/uploads/` — photos added later via the admin panel (created automatically)
- `source/` — original PDF + all 166 extracted photos (not needed for deploy)
