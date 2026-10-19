import type { Config } from '../config.js';
import type { QobuzProvider } from '../types.js';
import { StubQobuzProvider } from './stub.js';
import { HttpQobuzProvider } from './http.js';
import { QobuzDlProvider } from './qobuzdl.js';
import { LastBabeProvider } from './lastbabe.js';
import { createRacingProvider } from './racing.js';
import { MonochromeProvider } from './monochrome.js';
import { RemoteAddonProvider } from './remote-addon.js';
import { InstableProvider } from './instable.js';

export type IsolatedSource = 'qobuzdl' | 'lastbabe' | 'monochrome' | 'deezer' | 'eljohnzc' | 'instable';

export function createProvider(config: Config): QobuzProvider {
  if (config.provider === 'qobuzdl') return new QobuzDlProvider(config);
  if (config.provider === 'multi') {
    return createRacingProvider(
      new QobuzDlProvider(config), new LastBabeProvider(config),
      new MonochromeProvider(config), new RemoteAddonProvider(config),
      new RemoteAddonProvider(config, config.eljohnzcBaseUrl),
      new InstableProvider(config),
    );
  }
  if (config.provider === 'http') return new HttpQobuzProvider(config);
  return new StubQobuzProvider();
}

export function createSourceProvider(config: Config, source: IsolatedSource): QobuzProvider {
  if (source === 'qobuzdl') return new QobuzDlProvider({ ...config, apiBaseUrl: config.apiBaseUrl ?? 'https://qobuz-dll.foreyou.workers.dev' });
  if (source === 'monochrome') return new MonochromeProvider(config);
  if (source === 'deezer') return new RemoteAddonProvider(config);
  if (source === 'eljohnzc') return new RemoteAddonProvider(config, config.eljohnzcBaseUrl);
  if (source === 'instable') return new InstableProvider(config);
  return new LastBabeProvider(config);
}
