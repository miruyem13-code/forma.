import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function check(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await check(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
      if (result.status !== 0) process.exit(1);
    }
  }
}
for (const directory of ['src', 'prisma', 'scripts', 'tests']) await check(directory);
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'validate'], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://validate:validate@localhost:5432/validate' },
});
if (result.status !== 0) process.exit(1);
console.log('JavaScript syntax and Prisma schema validation passed.');
