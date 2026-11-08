import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

export async function localPostgres() {
  const root = path.resolve('.local');
  await mkdir(root, { recursive: true });
  const settingsFile = path.join(root, 'postgres.json');
  let settings;
  try { settings = JSON.parse(await readFile(settingsFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    settings = { user: 'dars_local', password: randomBytes(32).toString('hex'), port: 54329 };
    await writeFile(settingsFile, JSON.stringify(settings), { flag: 'wx', mode: 0o600 });
  }
  const directory = path.join(root, 'postgres');
  const pg = new EmbeddedPostgres({ databaseDir: directory, ...settings, persistent: true, authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let initialized = false;
  try { await access(path.join(directory, 'PG_VERSION')); initialized = true; } catch {}
  if (!initialized) await pg.initialise();
  const url = `postgresql://${settings.user}:${settings.password}@127.0.0.1:${settings.port}/dars?schema=public&connection_limit=10`;
  return { pg, url, port: settings.port, initialized };
}
