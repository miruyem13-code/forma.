import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function start(file, cwd) {
  const child = spawn(process.execPath, [file], { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Frontend: http://127.0.0.1:5173 | API: http://127.0.0.1:5001/api/v1');
console.log('PostgreSQL must be running; the backend uses its existing .env configuration.');
start('src/server.js', path.join(root, 'integrations/dars-backend/backend'));
start(path.join(root, 'node_modules/vite/bin/vite.js'), root);
