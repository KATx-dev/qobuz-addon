export interface Config {
  host: string;
  port: number;
  requestTimeoutMs: number;
  upstreamRetries: number;
  cacheTtlMs: number;
  idSecret: string;
  provider: 'stub' | 'http' | 'qobuzdl' | 'multi';
  apiBaseUrl?: string;
  searchPath?: string;
  streamPath?: string;
  apiToken?: string;
  lastBabeBaseUrl?: string;
  monochromeBaseUrl?: string;
  deezerBaseUrl?: string;
  eljohnzcBaseUrl?: string;
  instableBaseUrl?: string;
}

const positiveInt = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

export function loadConfig(): Config {
  const provider = (process.env.QOBUZ_PROVIDER ?? 'multi').toLowerCase();
  if (provider !== 'stub' && provider !== 'http' && provider !== 'qobuzdl' && provider !== 'multi') throw new Error('QOBUZ_PROVIDER must be stub, http, qobuzdl, or multi');
  const apiBaseUrl = process.env.QOBUZ_API_BASE_URL ?? process.env.QOBUZ_UPSTREAM_BASE_URL ?? 'https://qobuz-dll.foreyou.workers.dev';
  if (provider === 'http' && (!apiBaseUrl || !/^https:\/\//i.test(apiBaseUrl))) {
    throw new Error('QOBUZ_API_BASE_URL must be an HTTPS URL when QOBUZ_PROVIDER=http');
  }
  return {
    host: process.env.HOST ?? '0.0.0.0',
    port: positiveInt('PORT', Number(process.env.SERVER_PORT) || 3000),
    requestTimeoutMs: positiveInt('REQUEST_TIMEOUT_MS', 6000),
    upstreamRetries: positiveInt('UPSTREAM_RETRIES', 1),
    cacheTtlMs: positiveInt('CACHE_TTL_SECONDS', 300) * 1000,
    idSecret: process.env.QOBUZ_ID_SECRET ?? 'qobuz-bitchord-id-secret-v1',
    provider,
    apiBaseUrl,
    searchPath: process.env.QOBUZ_SEARCH_PATH,
    streamPath: process.env.QOBUZ_STREAM_PATH,
    apiToken: process.env.QOBUZ_API_TOKEN,
    lastBabeBaseUrl: process.env.LASTBABE_BASE_URL ?? 'https://lastbabe.velixir.run',
    monochromeBaseUrl: process.env.MONOCHROME_BASE_URL ?? 'https://tracks.monochrome.st',
    deezerBaseUrl: process.env.DEEZER_BASE_URL ?? 'https://dzr.tabs-vs-spaces.wtf',
    eljohnzcBaseUrl: process.env.ELJOHNZC_BASE_URL ?? 'https://eljohnzc-addon.de.deplexo.com/4433c7caff7fd070309e',
    instableBaseUrl: process.env.INSTABLE_BASE_URL ?? 'https://instable.arcod.xyz',
  };
}
