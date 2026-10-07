import { migrate } from '../bootstrap';
import { prisma } from '../db';
import { seedIfEmpty } from '../seed';

migrate();
console.log((await seedIfEmpty()) ? '🌱 Seeded.' : 'Database already has data — use `pnpm db:reset` to start over.');
await prisma.$disconnect();
