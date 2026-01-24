import fs from 'fs';
import path from 'path';

type ExpoConfig = {
  expo?: {
    plugins?: Array<string | [string, Record<string, unknown>]>;
  };
};

const readAppConfig = (): ExpoConfig => {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  return JSON.parse(raw) as ExpoConfig;
};

const normalizePluginName = (plugin: string | [string, Record<string, unknown>]) => {
  if (Array.isArray(plugin)) {
    return plugin[0];
  }
  return plugin;
};

describe('app.json config', () => {
  it('includes expo-dev-client plugin', () => {
    const config = readAppConfig();
    const plugins = config.expo?.plugins ?? [];
    const names = plugins.map((plugin) => normalizePluginName(plugin));
    expect(names).toContain('expo-dev-client');
  });
});
