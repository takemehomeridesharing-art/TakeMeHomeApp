#!/usr/bin/env node
/**
 * `pnpm dev` — starts the API (:4000), the admin dashboard (:5173) and the Expo dev server.
 *
 * API and admin logs are prefixed and interleaved; Expo gets the real terminal so its QR code
 * and keyboard shortcuts work. Flags: --no-mobile, --no-admin, --web (open Expo for web).
 */
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const args = new Set(process.argv.slice(2));
const children = [];
const colors = { api: '\x1b[35m', admin: '\x1b[36m' };
const reset = '\x1b[0m';

function prefixed(name, command, cmdArgs) {
  const child = spawn(command, cmdArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: process.platform === 'win32',
  });
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', (line) => {
      process.stdout.write(`${colors[name] ?? ''}[${name}]${reset} ${line}\n`);
    });
  }
  child.on('exit', (code) => {
    process.stdout.write(`${colors[name] ?? ''}[${name}]${reset} exited with code ${code}\n`);
    if (code && code !== 0) shutdown(code);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

prefixed('api', 'pnpm', ['--filter', '@tmh/api', 'dev']);
if (!args.has('--no-admin')) prefixed('admin', 'pnpm', ['--filter', '@tmh/admin', 'dev']);

if (!args.has('--no-mobile')) {
  // Give the API a head start so the first bundle can reach it.
  setTimeout(() => {
    const expoArgs = ['--filter', '@tmh/mobile', 'start'];
    if (args.has('--web')) expoArgs.push('--', '--web');
    const mobile = spawn('pnpm', expoArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
    mobile.on('exit', (code) => shutdown(code ?? 0));
    children.push(mobile);
  }, 1500);
}
