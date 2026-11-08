import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { createRepositories } from '../src/repositories/index.js';
import { register } from '../src/validators/index.js';
import { hashPassword } from '../src/utils/crypto.js';
import { assert } from '../src/utils/errors.js';

const db = createDatabase(readConfig().DATABASE_URL);
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
const readline = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
try {
  assert(process.stdin.isTTY, 400, 'TTY_REQUIRED', 'Run this command in an interactive terminal. Credentials are never accepted as command-line arguments.');
  const fullName = await readline.question('Administrator full name: ');
  const email = await readline.question('Administrator email: ');
  process.stdout.write('Password (hidden; minimum 12 characters, uppercase/lowercase/number): ');
  muted = true;
  const password = await readline.question('');
  muted = false;
  process.stdout.write('\nConfirm password: ');
  muted = true;
  const confirmation = await readline.question('');
  muted = false;
  process.stdout.write('\n');
  assert(password === confirmation, 400, 'PASSWORD_MISMATCH', 'Passwords do not match');
  const data = register.parse({ fullName, email, password });
  const passwordHash = await hashPassword(data.password);
  const r = createRepositories(db);
  const admin = await r.transaction(async tx => {
    await tx.lock('admin-membership');
    assert(await tx.user.count({ role: 'ADMIN' }) === 0, 409, 'ADMIN_EXISTS', 'An administrator already exists; use the authenticated admin role API');
    assert(!await tx.user.byEmail(data.email), 409, 'EMAIL_EXISTS', 'Email already exists; choose a new operator account');
    return tx.user.create({ fullName: data.fullName, email: data.email, passwordHash, role: 'ADMIN' });
  });
  console.log(`Administrator created: ${admin.id}`);
} catch (error) {
  console.error(error.issues ? 'Invalid input. Check email and password requirements.' : error.status ? error.message : 'Administrator creation failed. Check database configuration and migrations.');
  process.exitCode = 1;
} finally { muted = false; readline.close(); await db.$disconnect(); }
