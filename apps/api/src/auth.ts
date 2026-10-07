import type { Gender } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { prisma } from './db';
import { forbidden, unauthorized } from './errors';

export interface AuthUser {
  id: string;
  isAdmin: boolean;
  gender: Gender | null;
  name: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Authenticates the request and loads the caller. Suspended accounts can still read, but every
 * write endpoint answers 403 ACCOUNT_SUSPENDED — enforced here, so no route can forget it.
 */
export async function requireUser(request: FastifyRequest): Promise<AuthUser> {
  let sub: string;
  try {
    ({ sub } = await request.jwtVerify<{ sub: string }>());
  } catch {
    throw unauthorized();
  }
  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, isAdmin: true, gender: true, name: true, status: true },
  });
  if (!user) throw unauthorized();
  if (user.status === 'suspended' && !READ_METHODS.has(request.method)) {
    throw forbidden(
      'Your account is suspended, so you can’t request, publish or pay right now. Contact support@takemehome.rw.',
      'ACCOUNT_SUSPENDED',
    );
  }
  return { id: user.id, isAdmin: user.isAdmin, gender: user.gender, name: user.name };
}

export async function requireAdmin(request: FastifyRequest): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!user.isAdmin) throw forbidden('Admins only.');
  return user;
}
