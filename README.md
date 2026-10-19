# Qobuz BitChord Addon

A TypeScript/Node.js, playback-only BitChord addon exposing `/manifest.json`, `/search`, and `/stream/:id`.

## Upstream providers

The default `multi` provider races all configured compatible backends and uses the first one that returns usable search results:

- Monochrome: `https://tracks.monochrome.st/search/tracks` and `/track/:id` for full FLAC playback
- Qobuz-DL: `https://qobuz-dll.foreyou.workers.dev/api/get-music` and `/api/download-music`
- Deezer fallback: `https://dzr.tabs-vs-spaces.wtf/search` and `/stream/:id`
- LastBabe: a fresh 48-hour source minted from `https://lastbabe.velixir.run`
- Eljohnzc: a lossless source exposed under the isolated `/e` route

The Qobuz-DL routes are:

- `/api/get-music?q=...&offset=0` for catalogue search
- `/api/download-music?track_id=...&quality=...` for a playable URL

The provider only consumes the public JSON response, never handles Qobuz credentials, and does not expose upstream headers or URLs except for the validated playback URL returned to BitChord. It does not guess routes, scrape private APIs, extract tokens, bypass authentication, or download media.

The default `QOBUZ_PROVIDER=multi` races all five backends. Each returned track ID is signed and includes its source, so an ID is never accidentally sent to the wrong provider. If one backend is unavailable, another can still serve results. `QOBUZ_PROVIDER=qobuzdl` and `QOBUZ_PROVIDER=stub` remain available for focused testing.

## Contract

- `GET /manifest.json`: stable id `com.bitchord.qobuz`, `resources: ["search", "stream"]`, `allowDownloads: 0`.
- `GET /search?q=...&quality=...&atmos=auto`: returns `{ tracks: [] }` or normalized tracks with opaque IDs.
- `GET /stream/:id?quality=...&atmos=auto`: returns a directly playable HTTPS rendition, or 404 when unavailable.
- The same contract is also available under isolated source prefixes `/a`, `/b`, `/c`, `/d`, and `/e`, each with its own manifest, search, and stream routes.
- `/a` is Qobuz-DL, `/b` is LastBabe, `/c` is Monochrome lossless, `/d` is the Deezer fallback, and `/e` is Eljohnzc lossless.
- Lossless, codec, manifest, bitrate, sample rate, bit depth, and Dolby fields are only returned when the provider supplies them. Encrypted streams and malformed URLs are refused.

## Local development

```bash
cp .env.example .env
npm install
npm run build
npm test
npm run dev
curl http://localhost:3000/manifest.json
curl 'http://localhost:3000/search?q=kind+of+blue&quality=LOSSLESS&atmos=auto'
curl -i 'http://localhost:3000/stream/qobuz_invalid000?quality=LOSSLESS&atmos=auto'
```

Node.js 20+ is required. Environment variables are read directly by the process; use a secret manager in production rather than committing `.env`.

## Provider configuration

The default configuration is:

```dotenv
QOBUZ_PROVIDER=multi
QOBUZ_UPSTREAM_BASE_URL=https://qobuz-dll.foreyou.workers.dev
LASTBABE_BASE_URL=https://lastbabe.velixir.run
MONOCHROME_BASE_URL=https://tracks.monochrome.st
DEEZER_BASE_URL=https://dzr.tabs-vs-spaces.wtf
ELJOHNZC_BASE_URL=https://eljohnzc-addon.de.deplexo.com/4433c7caff7fd070309e
```

The base URL is configurable if the public service changes hostnames or you operate an authorized compatible deployment.

For a different documented JSON provider, the generic adapter remains available:

```dotenv
QOBUZ_PROVIDER=http
QOBUZ_API_BASE_URL=https://authorized.example
QOBUZ_SEARCH_PATH=/documented/search
QOBUZ_STREAM_PATH=/documented/stream/{id}
QOBUZ_API_TOKEN=             # optional; never log it
```

The documented provider must return search JSON as either `{ "tracks": [...] }` or an array, with each usable track containing `upstreamId` and `title`. Stream JSON must contain an HTTPS `url`; set `manifest` to `none`, `hls`, or `dash` when applicable and set `encrypted: true` for protected media (it will be refused). The adapter sends `q`, `quality`, and `atmos`, applies timeouts, handles 404/429/5xx, and validates JSON shape. It does not expose the authorization header to BitChord clients.

The server uses signed stateless `qobuz_*` IDs containing an encoded source/upstream ID; `/stream` never treats the public ID as a URL. This works across serverless instances and does not expose upstream URLs or credentials.

## Production deployment

Run behind an HTTPS reverse proxy or a managed HTTPS host:

```bash
npm ci
npm run build
NODE_ENV=production HOST=127.0.0.1 PORT=3000 npm start
```

Terminate TLS at Caddy/Nginx/a managed platform and proxy to the Node process. Set a health check to `GET /manifest.json`. Ensure the proxy preserves query strings and does not log authorization headers or signed media URLs.

## Add to BitChord

After deploying, copy the HTTPS root URL (for example `https://addon.example.com`) into **BitChord → Settings → Sources → Add an addon**. BitChord will request `${ROOT_URL}/manifest.json`. The addon is streaming-only because `allowDownloads` is `0`.

## Example responses

Manifest:

```json
{"id":"com.bitchord.qobuz","name":"Qobuz","version":"1.0.0","resources":["search","stream"],"allowDownloads":0}
```

Safe default search:

```json
{"tracks":[]}
```

Not available:

```http
HTTP/1.1 404 Not Found
{"error":"track not available"}
```

A successful stream response is intentionally not fabricated; it is returned only after a configured provider supplies a validated authorized HTTPS rendition.
