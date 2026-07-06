# TVx + Tunarr on an Intel NUC (Windows) — one-box setup

Runs the pair as a single product on an **Intel NUC10i7FNB** (or similar) that must
stay on **Windows**:

- **Tunarr** runs **natively on Windows** (so it can use the NUC's Intel **Quick Sync**
  video engine for transcoding — the iGPU can't be reached from a Docker container on
  Windows).
- **TVx** (this app) runs in a **container** and is the viewer front-end.
- Optionally a **Caddy** reverse proxy fronts both under tidy hostnames.

Ready-to-edit files: [`deploy/nuc-windows/docker-compose.yml`](deploy/nuc-windows/docker-compose.yml)
and [`deploy/nuc-windows/Caddyfile`](deploy/nuc-windows/Caddyfile).

## Why this shape

The NUC10i7FNB has a Core i7-10710U (6c/12t, **15 W** mobile) plus Intel UHD graphics with
**Quick Sync (QSV)**. That 15 W CPU can only software-transcode ~1–2 concurrent 1080p
streams before it throttles; QSV offloads encoding to the iGPU and comfortably handles
several concurrent channels while the CPU stays idle. So the whole goal is: **use Quick
Sync, keep the CPU free.** On Windows, containers can't access the iGPU, which is why
Tunarr runs natively.

---

## Part 1 — Tunarr on Windows with Quick Sync

> **The one step that makes or breaks QSV:** a **native Windows** Tunarr install does
> **not** bundle FFmpeg (only the Docker image does), and it needs a **QSV-capable**
> FFmpeg build. A generic FFmpeg silently falls back to CPU. Use ErsatzTV's prebuilt
> **FFmpeg 7.1.1** (built with the hardware-accel libraries).

1. **Install Tunarr natively** and run it as a background service with **NSSM**
   (Non-Sucking Service Manager). Web UI defaults to **port 8000**; config/DB live in
   `%appdata%\tunarr`.
2. **Supply a QSV FFmpeg.** Download ErsatzTV's FFmpeg 7.1.1, then in Tunarr
   **Settings → FFmpeg** set the **FFmpeg** and **FFprobe** paths (keep both binaries in
   the same folder). ← make-or-break.
3. **Enable Quick Sync.** **Settings → Transcoding → Hardware Acceleration = `QSV`.**
   On Windows this is the only Intel option (VAAPI is Linux-only, CUDA is Nvidia,
   VideoToolbox is macOS). The device field is labeled "VAAPI Device" even for QSV —
   the default usually picks the iGPU.
4. **Update the Intel Graphics driver** and set Windows to the **High-Performance** power
   plan. Ensure the little NUC chassis has airflow.
5. **Channel stream mode = HLS** (recommended); try **HLS Direct** for already-compatible
   content to skip re-encoding.
6. **Confirm QSV is actually engaged:** during playback, Task Manager → **GPU → "Video
   Encode"** should show activity while CPU stays low. If CPU spikes and GPU Encode is
   idle, your FFmpeg lacks QSV (redo step 2) or HW-accel isn't applied (step 3).

### NUC caveat — 10-bit content
This generation of Quick Sync **cannot hardware-decode 10-bit H.264 or HEVC**. A library
heavy in 10-bit HEVC (typical 4K/HDR rips) falls back to **CPU decode** and hammers the
15 W chip. Prefer **8-bit H.264/AAC** sources where you can — that also maximizes
**direct-play** (zero transcode). If QSV misbehaves on specific files, the **Disable
Hardware Decoding / Encoding / Filters** toggles let you isolate the cause.

---

## Part 2 — Wiring TVx to Tunarr

**Critical:** TVx is a browser SPA, so the **viewing device's browser** fetches the M3U,
the XMLTV, **and** the HLS streams — all from Tunarr. Every URL must be the NUC's **LAN
address**, never `localhost`/`host.docker.internal` (those only resolve on the box). So:

- TVx `VITE_M3U_URL` / `VITE_XMLTV_URL` → `http://<nuc-lan-ip>:8000/api/...`
- **Set Tunarr's external/server URL to the NUC's LAN IP** (or proxy hostname) so the
  stream URLs it writes into the M3U resolve from other devices.

### Option A (recommended) — two ports, no proxy
Tunarr native on `:8000`, TVx container on `:8777`. Simplest and robust:

```powershell
docker run -d --name tvx -p 8777:80 `
  -e VITE_M3U_URL="http://192.168.1.65:8000/api/channels.m3u" `
  -e VITE_XMLTV_URL="http://192.168.1.65:8000/api/xmltv.xml" `
  ghcr.io/dopeytree/tvx:latest
```

Replace `192.168.1.65` with the NUC's LAN IP. Watch at `http://192.168.1.65:8777`;
Tunarr's admin stays at `:8000`.

### Option B (polished) — one hostname via Caddy
A single-*path* proxy hits the classic "subfolder problem" (apps must know their base
path). The clean way is **subdomains**, so each app owns its whole path space. Use
[`deploy/nuc-windows/docker-compose.yml`](deploy/nuc-windows/docker-compose.yml) +
[`deploy/nuc-windows/Caddyfile`](deploy/nuc-windows/Caddyfile):

```powershell
cd deploy/nuc-windows
# edit docker-compose.yml (Tunarr host) and Caddyfile (hostnames) first
docker compose up -d --build
```

Then:
1. Add DNS entries for `tv.nuc.lan` and `tunarr.nuc.lan` → the NUC's IP (router / Pi-hole
   / each device's hosts file).
2. **Set Tunarr's external URL to `http://tunarr.nuc.lan`** so its M3U stream links go
   through the proxy.
3. Watch at `http://tv.nuc.lan`.

---

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| CPU pegged, GPU Encode idle | FFmpeg build has no QSV (step 2), or HW-accel not set to QSV (step 3) |
| Channels won't load in TVx | `VITE_*` URLs use `localhost`/container host instead of the NUC's LAN IP |
| Guide loads but video won't play | Tunarr's external URL not set to a browser-reachable address |
| Stutter on 4K/HDR only | 10-bit HEVC can't hardware-decode → CPU decode; prefer 8-bit H.264 |
| URLs changed but app shows old ones | Hard-refresh the browser (Ctrl+Shift+R) |

## Sources
- Tunarr — [Transcode Configs](https://tunarr.com/configure/ffmpeg/transcode_config/),
  [FFmpeg settings](https://tunarr.com/configure/ffmpeg/),
  [Transcoding architecture](https://tunarr.com/configure/transcoding/),
  [Run (Windows / NSSM / port)](https://tunarr.com/getting-started/run/),
  [Install](https://tunarr.com/getting-started/installation/)
