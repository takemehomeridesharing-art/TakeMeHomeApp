import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { API_ROOT } from './env';

/** Applies committed Prisma migrations (creates the SQLite file on first run). */
export function migrate() {
  const bin = path.join(API_ROOT, 'node_modules', '.bin', 'prisma');
  const fallback = path.join(API_ROOT, '..', '..', 'node_modules', '.bin', 'prisma');
  const prismaBin = [bin, fallback].find((p) => {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
  execFileSync(prismaBin ?? 'prisma', ['migrate', 'deploy'], { cwd: API_ROOT, stdio: 'inherit', env: process.env });
}
