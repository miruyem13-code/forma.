// Compatibility entrypoint. Prefer npm start, which loads backend/.env from its workspace.
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('./backend/', import.meta.url)));
await import('./backend/src/server.js');
