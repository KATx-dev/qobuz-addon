import type { QobuzProvider, QobuzStream, QobuzTrack, Quality } from '../types.js';

interface Source { name: string; provider: QobuzProvider }

export class RacingProvider implements QobuzProvider {
  constructor(private readonly sources: Source[]) {}

  async search(query: string, quality: Quality, atmos: string): Promise<QobuzTrack[]> {
    return new Promise((resolve, reject) => {
      let pending = this.sources.length;
      let lastError: unknown;
      for (const source of this.sources) {
        source.provider.search(query, quality, atmos).then(tracks => {
          if (tracks.length > 0) {
            resolve(tracks.map(track => ({ ...track, upstreamId: `${source.name}:${track.upstreamId}` })));
            return;
          }
          pending -= 1;
          if (pending === 0) resolve([]);
        }).catch(error => {
          lastError = error;
          pending -= 1;
          if (pending === 0) reject(lastError);
        });
      }
    });
  }

  async getStream(trackId: string, quality: Quality, atmos: string): Promise<QobuzStream | null> {
    const separator = trackId.indexOf(':');
    if (separator <= 0) return null;
    const sourceName = trackId.slice(0, separator);
    const upstreamId = trackId.slice(separator + 1);
    const source = this.sources.find(candidate => candidate.name === sourceName);
    return source ? source.provider.getStream(upstreamId, quality, atmos) : null;
  }
}

export function createRacingProvider(
  qobuzdl: QobuzProvider,
  lastbabe: QobuzProvider,
  monochrome?: QobuzProvider,
  deezer?: QobuzProvider,
  eljohnzc?: QobuzProvider,
  instable?: QobuzProvider,
): QobuzProvider {
  const sources: Source[] = [
    { name: 'lastbabe', provider: lastbabe },
    { name: 'qobuzdl', provider: qobuzdl },
  ];
  if (deezer) sources.unshift({ name: 'deezer', provider: deezer });
  if (monochrome) sources.unshift({ name: 'monochrome', provider: monochrome });
  if (eljohnzc) sources.unshift({ name: 'eljohnzc', provider: eljohnzc });
  if (instable) sources.unshift({ name: 'instable', provider: instable });
  return new RacingProvider(sources);
}
