# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TVx is a **client-side SPA** (React 18 + TypeScript + Vite) that renders a nostalgic CRT-style IPTV viewer. It consumes an **M3U playlist** and **XMLTV EPG** produced by a [Tunarr](https://tunarr.com) backend (which fronts Plex/Jellyfin) and displays streams with a WebGL vintage-TV effect. There is no backend of its own beyond a tiny static/logging server. Single route, single page — the whole app is one view.

## Commands

```bash
npm install              # or `npm ci` (needs package-lock.json; Docker uses ci)
npm run dev              # Vite dev server on http://localhost:8080 (port set in vite.config.ts)
npm run build            # Production build -> dist/  (esbuild/SWC; does NOT run tsc, so no typecheck)
npm run build:dev        # Build in development mode
npm run lint             # ESLint (flat config in eslint.config.js) — currently clean
npm run preview          # Serve the built dist/ locally
npm test                 # Vitest unit tests (vitest run); npm run test:watch for watch mode
```

- **Tests** cover the pure helpers in [src/utils/](src/utils/) (`channelFormat`, `time`, `epg`, `search`) under `src/utils/__tests__/` — these lock the shared logic that used to be copy-pasted. There are no component/integration tests yet.
- **Typecheck is not part of the build.** Run `npx tsc --noEmit` if you need type verification. Note TS is configured loosely (`strictNullChecks: false`, `noImplicitAny: false`, unused checks off in [tsconfig.json](tsconfig.json)) — the compiler will not catch null/any issues.

### Docker (this is the real deployment target)

```bash
docker build -t tvx .
docker run -d -p 8777:80 \
  -e VITE_M3U_URL="http://<tunarr-ip>:8000/api/channels.m3u" \
  -e VITE_XMLTV_URL="http://<tunarr-ip>:8000/api/xmltv.xml" \
  tvx
# or: docker-compose up -d   (see docker-compose.yml)
docker logs -f tvx           # user interactions + server logs stream here
```

### Docs (separate Jekyll site under docs/)

```bash
cd docs && bundle install
cd docs && bundle exec jekyll serve --host 0.0.0.0 --port 4000 --baseurl /TVx
```

## Architecture (the parts that span multiple files)

### Runtime config injection — `VITE_` vars are NOT build-time

Despite the `VITE_` prefix, `VITE_M3U_URL` / `VITE_XMLTV_URL` are **runtime** values, not Vite build env. The flow:

1. [env.js.template](env.js.template) contains `window.ENV = { VITE_M3U_URL: "$VITE_M3U_URL", ... }`.
2. The Docker container's start command runs `envsubst` over it to generate `env.js`.
3. [index.html](index.html) loads `/env.js` **before** the app bundle, populating `window.ENV`.
4. [src/hooks/useSettings.ts](src/hooks/useSettings.ts) reads `window.ENV.VITE_M3U_URL` for its defaults.

Consequence: **changing the URLs requires only a container restart (+ browser hard-refresh), never a rebuild.** In `npm run dev` there is no `env.js`, so `window.ENV` is undefined and the defaults are placeholder URLs — configure real URLs through the in-app **Settings** dialog when developing.

### Production server is Node, not nginx

The production image runs a **custom zero-dependency Node HTTP server** ([server.js](server.js)), *not* nginx — `nginx.conf` is vestigial/unused (paths like `/usr/share/nginx/html` are just the static dir name). `server.js` handles: static file serving, HTTP range requests for video/HLS, rate limiting, security headers + CSP, and the `POST /log` endpoint. [Dockerfile](Dockerfile) is multi-stage: `node:22-alpine` builds, `node:20-alpine` runs `server.js`.

### Logging pipeline

[src/utils/logger.ts](src/utils/logger.ts) `logger.{log,info,warn,error}` mirrors to the browser console **and** `POST`s to `/log`. `server.js` writes those to stdout (→ `docker logs`) and to `/config/tvx.log`. User-facing interactions are logged this way throughout [Index.tsx](src/pages/Index.tsx) (e.g. `Opened: Settings`, `Selected: Channel "..."`). When adding user actions, log them with `logger.info(...)` to match the existing monitoring convention.

### Settings resolution order

[useSettings.ts](src/hooks/useSettings.ts) merges, in increasing precedence: built-in defaults (URLs from `window.ENV`) → `localStorage["tvx-ui-settings"]` → `/config/settings.json`. **URLs are deliberately excluded from localStorage** (only visual/UI prefs persist there); URLs come from env/external config. `AppSettings` (the full settings shape, including all CRT shader params) is defined in [src/types/iptv.ts](src/types/iptv.ts).

### State lives in Index.tsx (the hub — ~870 lines)

[src/pages/Index.tsx](src/pages/Index.tsx) owns most app state: `channels`, `epgData`, `selectedChannel`, view mode, favorites, and the initial-load notification sequence. There is no global store — React Query is wired up in [App.tsx](src/App.tsx) but barely used. New features usually mean extending Index.tsx, but stateful concerns have been pulled into hooks it composes:

- [useIdleState](src/hooks/useIdleState.ts) — idle detection, scroll tracking, sidebar/cursor auto-hide (context-dependent delays).
- [useQueuedToast](src/hooks/useQueuedToast.ts) — the notification queue (2s spacing + 5s dedup), wrapping sonner + logger.
- [useSettings](src/hooks/useSettings.ts), [useKeyboardShortcuts](src/hooks/useKeyboardShortcuts.ts).

The **three view modes** cycle on video click: Full Guide → Normal → Theater (`handleVideoPlayerClick`).

### Shared helpers (extract, don't re-inline)

Logic that reads channels/programs lives in small pure modules — reuse them instead of re-inlining regexes/date math:

- [channelFormat.ts](src/utils/channelFormat.ts) — `formatChannelName` (strips filler words) + `getChannelCategory` → drives the shared [CategoryIcon](src/components/CategoryIcon.tsx).
- [time.ts](src/utils/time.ts) — `formatTime`/`formatDuration`/`topOfHour`/`PX_PER_MINUTE`; [epg.ts](src/utils/epg.ts) — `getCurrentProgram`/`isNowPlaying`/`getVisiblePrograms`; [search.ts](src/utils/search.ts) — the "More Info" Google-search helpers.

### Full TV guide

The guide is [src/components/FullGuide/](src/components/FullGuide/): `FullGuide` (header + the focused/plain branches + interaction handlers) composes the shared `GuideChannelColumn`, `GuideProgramGrid` (24h timeline, `PX_PER_MINUTE` layout), and `ProgramPopup`. Index renders `<FullGuide/>` and passes state + setters down.

### VideoPlayer + WebGL CRT effect

[src/components/VideoPlayer.tsx](src/components/VideoPlayer.tsx): plays streams via **HLS.js** (falling back to native HLS, then `.mp4`). When `settings.vintageTV` is on, the `<video>` is hidden and each frame is drawn to a `<canvas>` through a **WebGL fragment shader** (curvature, chromatic aberration, vignette, edge blur/"vaseline", center sharpen, dithering) whose uniforms come straight from settings; the shader source lives in [crtShader.ts](src/components/crtShader.ts). A looping `/loading-VHS.mp4` covers channel-change gaps (enforced 2s minimum). A disabled Web Audio "vintage audio filter" feature leaves a few commented stubs inline — leave them unless reviving that feature.

### Parsers

- [m3uParser.ts](src/utils/m3uParser.ts): regex over `#EXTINF` lines → `Channel[]` (id from `tvg-id`, logo from `tvg-logo`, group from `group-title`).
- [xmltvParser.ts](src/utils/xmltvParser.ts): `fast-xml-parser` → `EPGData` (a `{ [channelId]: Program[] }` map). Contains custom XMLTV date/timezone parsing, `episode-num` season/episode extraction (`xmltv_ns` and `SxEx`), credits, and HTML-entity handling.

### UI components

[src/components/ui/](src/components/ui/) is **generated shadcn/ui** (Radix primitives + Tailwind, config in [components.json](components.json)) — prefer not to hand-edit these; app components live directly in `src/components/`. Only the primitives actually used are kept (the full scaffold kit was pruned); if you need another shadcn component, re-add it with `npx shadcn@latest add <name>`. Path alias `@/` → `src/`. Icons: `lucide-react`; toasts: `sonner` (the shadcn toast stack was removed).

## Product constraints (from agent.md — genuine design intent, not style preference)

- **No algorithm-driven features** — no recommendations, trending, autoplay-next, or "what to watch" logic. The point is intentional channel surfing.
- **Preserve the CRT aesthetic and keyboard navigation** — these are the product, not decoration.
- Keyboard shortcuts as actually implemented in [useKeyboardShortcuts.ts](src/hooks/useKeyboardShortcuts.ts): `.`=Settings, `F`=fullscreen, `G`=full guide, `S`=stats, `M`=mute, `Space`=play/pause, and `↑`/`↓`=channel surf (handled separately in Index.tsx). (The README's shortcut table is out of date — trust the hook.)

## Notes

- [agent.md](agent.md) is an older agent guide with useful design philosophy, but treat its specifics with care: it hardcodes a `/Users/ed/TVx` path, cites the dev port as 5173 (actual is 8080), and references a `commands-cheatsheet.json` that may not exist.
- The `package.json` `name` is still the scaffold default (`vite_react_shadcn_ts`); the project originated from a Lovable/shadcn template.
- License is **PolyForm Noncommercial 1.0.0** — noncommercial use only.
