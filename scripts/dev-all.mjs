/**
 * dev-all.mjs
 * ------------------------------------------------------------------
 * Runs the Vite dev server and the local translation proxy together:
 *
 *   npm run dev:full
 *
 * Vite proxies /api/* to the proxy on port 3401, so the app behaves the
 * same locally as it does on a deployment that has an LLM key.
 * ------------------------------------------------------------------
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const children = [];

function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`  [${label}] exited with code ${code}`);
    }
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 120);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('proxy', process.execPath, [path.join(projectRoot, 'scripts/rag-server.mjs')]);
run('vite', isWindows ? 'npx' : 'npx', ['vite']);
