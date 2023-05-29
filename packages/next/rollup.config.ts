import { RollupOptions } from 'rollup';
import { buildConfig } from '../../scripts/getRollupConfig';

export const input = [
  'src/index.ts',
  'src/app-dir/server.ts',
  'src/app-dir/client.ts',
];

export default function rollup(): RollupOptions[] {
  return buildConfig({
    input,
    packageDir: __dirname,
  });
}
