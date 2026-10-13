import type { Config } from '../config.js';
import type { QobuzProvider, QobuzStream, QobuzTrack, Quality } from '../types.js';
import { UpstreamError } from './http.js';

export class LastBabeProvider implements QobuzProvider {
  constructor(private readonly config: Config) {}

  async search(query: string, _quality: Quality, _atmos: string): Promise<QobuzTrack[]> {
    const body = await this.request('/search', { q: query });
    const tracks = isRecord(body) && Array.isArray(body.tracks) ? body.tracks : [];
    return tracks.filter(isRecord).map(toTrack).filter((track): track is QobuzTrack => track !== null);
  }

  async getStream(trackId: string, quality: Quality, _atmos: string): Promise<QobuzStream | null> {
    const body = await this.request(`/stream/${encodeURIComponent(trackId)}`, { quality });
    if (!isRecord(body) || typeof body.url !== 'string' || !/^https:\/\//i.test(body.url)) return null;
    return {
      url: body.url,
      format: stringValue(body.format),
      quality: stringValue(body.quality) ?? quality,
      codec: stringValue(body.codec),
      container: stringValue(body.container),
      manifest: body.manifest === 'hls' || body.manifest === 'dash' ? body.manifest : 'none',
      encrypted: body.encrypted === true,
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    const base = this.config.lastBabeBaseUrl;
    if (!base) throw new UpstreamError(502, 'LastBabe backend is not configured');
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.upstreamRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
      try {
        const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
        let body: unknown;
        try { body = await response.json(); } catch { throw new UpstreamError(502, 'LastBabe returned invalid JSON'); }
        if (!response.ok) {
          const error = new UpstreamError(retryable(response.status) ? 502 : response.status === 404 ? 404 : 400, 'LastBabe backend request failed');
          if (!retryable(response.status) || attempt >= this.config.upstreamRetries) throw error;
          lastError = error;
        } else return body;
      } catch (error) {
        if (error instanceof UpstreamError) {
          if (error.status !== 502 || attempt >= this.config.upstreamRetries) throw error;
        } else lastError = error;
      } finally { clearTimeout(timeout); }
      await delay(200 * 2 ** attempt);
    }
    throw lastError instanceof UpstreamError ? lastError : new UpstreamError(502, 'LastBabe backend request failed');
  }
}

function toTrack(raw: Record<string, unknown>): QobuzTrack | null {
  const id = raw.trackId ?? raw.id;
  const title = raw.title;
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof title !== 'string' || !title.trim()) return null;
  return {
    upstreamId: String(id),
    title: title.trim(),
    artist: typeof raw.artist === 'string' ? raw.artist : Array.isArray(raw.artists) ? raw.artists.filter((x): x is string => typeof x === 'string').join(', ') : undefined,
    album: typeof raw.album === 'string' ? raw.album : undefined,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    artworkURL: typeof raw.artwork === 'string' ? raw.artwork : typeof raw.artworkURL === 'string' ? raw.artworkURL : undefined,
    format: typeof raw.format === 'string' ? raw.format : undefined,
    audioQuality: typeof raw.audioQuality === 'string' ? raw.audioQuality : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function retryable(status: number): boolean { return status === 408 || status === 425 || status === 429 || status >= 500; }
function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
