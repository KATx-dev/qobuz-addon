import type { Config } from '../config.js';
import type { QobuzProvider, QobuzStream, QobuzTrack, Quality } from '../types.js';
import { UpstreamError } from './http.js';

type RecordValue = Record<string, unknown>;

export class RemoteAddonProvider implements QobuzProvider {
  constructor(private readonly config: Config) {}

  async search(query: string, quality: Quality, atmos: string): Promise<QobuzTrack[]> {
    const body = await this.request('/search', { q: query, quality, atmos });
    const items = isRecord(body) && Array.isArray(body.tracks) ? body.tracks : Array.isArray(body) ? body : [];
    return items.filter(isRecord).map(toTrack).filter((track): track is QobuzTrack => track !== null);
  }

  async getStream(trackId: string, quality: Quality, atmos: string): Promise<QobuzStream | null> {
    if (!/^[A-Za-z0-9_-]+$/.test(trackId)) return null;
    const body = await this.request(`/stream/${encodeURIComponent(trackId)}`, { quality, atmos });
    if (!isRecord(body) || typeof body.url !== 'string' || !/^https:\/\//i.test(body.url)) return null;
    return {
      url: body.url, format: typeof body.format === 'string' ? body.format : undefined,
      quality: typeof body.quality === 'string' ? body.quality : quality,
      manifest: body.manifest === 'hls' || body.manifest === 'dash' ? body.manifest : 'none',
      encrypted: body.encrypted === true,
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    const base = this.config.deezerBaseUrl ?? 'https://dzr.tabs-vs-spaces.wtf';
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
      let body: unknown;
      try { body = await response.json(); } catch { throw new UpstreamError(502, 'Deezer backend returned invalid JSON'); }
      if (!response.ok) throw new UpstreamError(response.status >= 500 ? 502 : response.status, 'Deezer backend request failed');
      return body;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError(502, 'Deezer backend request failed');
    } finally { clearTimeout(timeout); }
  }
}

function toTrack(raw: RecordValue): QobuzTrack | null {
  const id = raw.id;
  const title = raw.title;
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof title !== 'string' || !title.trim()) return null;
  const artist = typeof raw.artist === 'string' ? raw.artist : isRecord(raw.artist) && typeof raw.artist.name === 'string' ? raw.artist.name : undefined;
  const album = typeof raw.album === 'string' ? raw.album : isRecord(raw.album) && typeof raw.album.title === 'string' ? raw.album.title : undefined;
  return { upstreamId: String(id), title: title.trim(), artist, album, duration: typeof raw.duration === 'number' ? raw.duration : undefined, artworkURL: typeof raw.artworkURL === 'string' ? raw.artworkURL : typeof raw.artwork === 'string' ? raw.artwork : undefined };
}

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null; }
