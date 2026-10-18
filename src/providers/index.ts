import type { Config } from '../config.js';
import type { QobuzProvider } from '../types.js';
import { StubQobuzProvider } from './stub.js';
import { HttpQobuzProvider } from './http.js';
import { QobuzDlProvider } from './qobuzdl.js';
import { LastBabeProvider } from './lastbabe.js';
import { createRacingProvider } from './racing.js';
import { OptionalJsonProvider } from './optional.js';
import { MonochromeProvider } from './monochrome.js';
import { RemoteAddonProvider } from './remote-addon.js';

export type IsolatedSource = 'qobuzdl' | 'optional' | 'lastbabe' | 'monochrome' | 'deezer';

export function createProvider(config: Config): QobuzProvider {
  if (config.provider === 'qobuzdl') return new QobuzDlProvider(config);
  if (config.provider === 'multi') {
    const optional = config.optionalBaseUrl ? new OptionalJsonProvider(config) : undefined;
    return createRacingProvider(
      new QobuzDlProvider(config), new LastBabeProvider(config), optional,
      new MonochromeProvider(config), new RemoteAddonProvider(config),
    );
  }
  if (config.provider === 'http') return new HttpQobuzProvider(config);
  return new StubQobuzProvider();
}

export function createSourceProvider(config: Config, source: IsolatedSource): QobuzProvider {
  if (source === 'qobuzdl') return new QobuzDlProvider({ ...config, apiBaseUrl: config.apiBaseUrl ?? 'https://qobuz-dll.foreyou.workers.dev' });
  if (source === 'optional') return new OptionalJsonProvider({ ...config, optionalBaseUrl: config.optionalBaseUrl ?? 'https://arcod.xyz' });
  if (source === 'monochrome') return new MonochromeProvider(config);
  if (source === 'deezer') return new RemoteAddonProvider(config);
  return new LastBabeProvider(config);
}
