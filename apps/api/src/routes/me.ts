import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CreateVehicleSchema,
  CreateVerificationSchema,
  MeSchema,
  PlaceSchema,
  PublicUserSchema,
  UpdateMeSchema,
  UploadResponseSchema,
  UploadSchema,
  VehicleSchema,
  VerificationRequestSchema,
} from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth';
import { prisma } from '../db';
import { env } from '../env';
import { badRequest, conflict, notFound, out, parse } from '../errors';
import { realtime } from '../realtime';
import { meInclude, toMe, toPublicUser, toVehicle, toVerificationRequest, userInclude } from '../services/serialize';

const IdParam = z.object({ id: z.string() });
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function meRoutes(app: FastifyInstance) {
  app.get('/places', async () => {
    const places = await prisma.place.findMany({ orderBy: { name: 'asc' } });
    return out(z.array(PlaceSchema), places);
  });

  app.get('/me', async (request) => {
    const me = await requireUser(request);
    return out(MeSchema, toMe(await prisma.user.findUniqueOrThrow({ where: { id: me.id }, include: meInclude })));
  });

  app.patch('/me', async (request) => {
    const me = await requireUser(request);
    const input = parse(UpdateMeSchema, request.body);
    const current = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    const user = await prisma.user.update({
      where: { id: me.id },
      data: {
        ...input,
        // Changing the email address resets its verification.
        ...(input.email !== undefined && input.email !== current.email ? { emailVerifiedAt: null } : {}),
      },
      include: meInclude,
    });
    return out(MeSchema, toMe(user));
  });

  app.get('/users/:id', async (request) => {
    await requireUser(request);
    const { id } = IdParam.parse(request.params);
    const user = await prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw notFound('That user');
    return out(PublicUserSchema, toPublicUser(user));
  });

  // Local file storage in dev; an object store is a drop-in later.
  app.post('/uploads', { bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    await requireUser(request);
    const { base64, mimeType } = parse(UploadSchema, request.body);
    const data = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (data.length === 0) throw badRequest('That file is empty.');
    if (data.length > MAX_UPLOAD_BYTES) throw badRequest('Files must be under 4 MB.');
    const name = `${randomUUID()}.${EXT[mimeType]}`;
    await fs.mkdir(env.uploadsDir, { recursive: true });
    await fs.writeFile(path.join(env.uploadsDir, name), data);
    return out(UploadResponseSchema, { url: `/uploads/${name}` });
  });

  app.get('/vehicles', async (request) => {
    const me = await requireUser(request);
    const vehicles = await prisma.vehicle.findMany({ where: { ownerId: me.id }, orderBy: { createdAt: 'asc' } });
    return out(z.array(VehicleSchema), vehicles.map(toVehicle));
  });

  app.post('/vehicles', async (request) => {
    const me = await requireUser(request);
    const input = parse(CreateVehicleSchema, request.body);
    const plate = input.plate.replace(/^(R[A-Z]{2}) ?(\d{3}) ?([A-Z])$/, '$1 $2 $3');
    if (await prisma.vehicle.findUnique({ where: { plate } })) throw conflict('A vehicle with that plate is already registered.');
    const vehicle = await prisma.vehicle.create({ data: { ...input, plate, ownerId: me.id } });
    return out(VehicleSchema, toVehicle(vehicle));
  });

  app.post('/verifications', async (request) => {
    const me = await requireUser(request);
    const input = parse(CreateVerificationSchema, request.body);
    if (input.type === 'vehicle') {
      const v = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!v || v.ownerId !== me.id) throw notFound('That vehicle');
    }
    const existing = await prisma.verificationRequest.findFirst({ where: { userId: me.id, type: input.type, status: 'pending' } });
    if (existing) throw conflict('You already have this verification waiting for review.');
    const req = await prisma.verificationRequest.create({
      data: {
        userId: me.id,
        type: input.type,
        email: input.type === 'email' ? input.email : null,
        documentUrl: input.type === 'email' ? null : input.documentUrl,
        vehicleId: input.type === 'vehicle' ? input.vehicleId : null,
      },
    });
    realtime.toAdmins('admin:changed', { kind: 'verification' });
    return out(VerificationRequestSchema, toVerificationRequest(req));
  });
}
