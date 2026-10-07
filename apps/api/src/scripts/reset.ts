import { migrate } from '../bootstrap';
import { prisma } from '../db';
import { seed, wipe } from '../seed';

migrate();
await wipe();
await seed();
console.log('🌱 Database reset and re-seeded (trips are relative to today).');
await prisma.$disconnect();
