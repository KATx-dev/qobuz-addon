import type { Config } from '../config.js';
import type { QobuzProvider, QobuzStream, QobuzTrack, Quality } from '../types.js';
import { UpstreamError } from './http.js';

type RecordValue = Record<string, unknown>;

export class OptionalJsonProvider implements QobuzProvider {
  constructor(private readonly config: Config) {}

  async search(query: string, _quality: Quality, _atmos: string): Promise<QobuzTrack[]> {
    const body = await this.request('/api/search', { q: query });
    const data = isRecord(body) && isRecord(body.data) ? body.data : undefined;
    const items = data && isRecord(data.tracks) && Array.isArray(data.tracks.items) ? data.tracks.items : [];
    return items.filter(isRecord).map(toTrack).filter((track): track is QobuzTrack => track !== null);
  }

  async getStream(trackId: string, quality: Quality, _atmos: string): Promise<QobuzStream | null> {
    const body = await this.request(`/api/player/stream/${encodeURIComponent(trackId)}`, { quality: qualityId(quality) });
    if (!isRecord(body) || typeof body.url !== 'string' || !/^https:\/\//i.test(body.url)) return null;
    return {
      url: body.url,
      format: mimeFormat(body.mimeType),
      quality: typeof body.quality === 'number' ? String(body.quality) : quality,
      manifest: 'none',
      encrypted: false,
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    if (!this.config.optionalBaseUrl) throw new UpstreamError(502, 'optional backend is not configured');
    const url = new URL(path, this.config.optionalBaseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.upstreamRetries; attempt += 1) {
      const controller = new AbortController();
      // This backend commonly needs several seconds to resolve Qobuz metadata
      // and stream tokens; keep the faster global timeout for other providers.
      const timeout = setTimeout(() => controller.abort(), Math.max(this.config.requestTimeoutMs, 15000));
      try {
        const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
        let body: unknown;
        try { body = await response.json(); } catch { throw new UpstreamError(502, 'optional backend returned invalid JSON'); }
        if (!response.ok) {
          const error = new UpstreamError(retryable(response.status) ? 502 : response.status === 404 ? 404 : 400, 'optional backend request failed');
          if (!retryable(response.status) || attempt >= this.config.upstreamRetries) throw error;
          lastError = error;
        } else if (isRecord(body) && body.success === false) {
          throw new UpstreamError(502, 'optional backend request failed');
        } else return body;
      } catch (error) {
        if (error instanceof UpstreamError) {
          if (error.status !== 502 || attempt >= this.config.upstreamRetries) throw error;
          lastError = error;
        } else lastError = error;
      } finally { clearTimeout(timeout); }
      await delay(200 * 2 ** attempt);
    }
    throw lastError instanceof UpstreamError ? lastError : new UpstreamError(502, 'optional backend request failed');
  }
}

function toTrack(raw: RecordValue): QobuzTrack | null {
  const id = raw.id;
  const title = raw.title;
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof title !== 'string' || !title.trim()) return null;
  const performer = isRecord(raw.performer) ? raw.performer : undefined;
  const album = isRecord(raw.album) ? raw.album : undefined;
  const image = album && isRecord(album.image) ? album.image : undefined;
  return {
    upstreamId: String(id),
    title: title.trim(),
    artist: performer && typeof performer.name === 'string' ? performer.name : undefined,
    album: album && typeof album.title === 'string' ? album.title : undefined,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    artworkURL: image && typeof image.large === 'string' ? image.large : undefined,
    format: typeof raw.maximum_bit_depth === 'number' ? 'flac' : undefined,
    audioQuality: typeof raw.maximum_bit_depth === 'number' ? 'LOSSLESS' : undefined,
  };
}

function qualityId(quality: Quality): string { return quality === 'LOSSLESS' ? '27' : '5'; }
function mimeFormat(value: unknown): string | undefined { return typeof value === 'string' ? value.split('/').pop() : undefined; }
function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null; }
function retryable(status: number): boolean { return status === 408 || status === 425 || status === 429 || status >= 500; }
function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
