import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const platform = process.argv[2];
if (!['ios', 'tvos'].includes(platform)) throw new Error('Use ios or tvos.');
const require = createRequire(import.meta.url);
// Expo would otherwise replace the react-native-tvos alias with upstream RN.
const result = spawnSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'ios', '--clean',
  '--no-install', '--skip-dependency-update', 'react-native,react',
], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_TV: platform === 'tvos' ? '1' : '0' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
