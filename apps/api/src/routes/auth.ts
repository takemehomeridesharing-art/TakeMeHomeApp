import { createHash, randomInt } from 'node:crypto';
import {
  AuthResponseSchema,
  DevAccountSchema,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifySchema,
} from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../env';
import { AppError, out, parse } from '../errors';
import { providers } from '../providers';
import { DEV_ACCOUNTS } from '../seed';
import { meInclude, toMe } from '../services/serialize';

const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const hash = (phone: string, code: string) => createHash('sha256').update(`${phone}:${code}`).digest('hex');

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/otp/request', async (request) => {
    const { phone } = parse(OtpRequestSchema, request.body);
    const code = env.useMockProviders ? env.devOtpCode : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await prisma.otpChallenge.create({ data: { phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    await providers().sms.send(phone, `Your Take Me Home code is ${code}. It expires in 10 minutes.`);
    return out(OtpRequestResponseSchema, {
      ok: true,
      phone,
      ...(env.useMockProviders ? { devHint: `Dev mode: the code is always ${env.devOtpCode}` } : {}),
    });
  });

  app.post('/auth/otp/verify', async (request) => {
    const { phone, code } = parse(OtpVerifySchema, request.body);
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.attempts >= MAX_ATTEMPTS) {
      throw new AppError(401, 'INVALID_OTP', 'That code has expired. Request a new one.');
    }
    if (challenge.codeHash !== hash(phone, code)) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new AppError(401, 'INVALID_OTP', 'That code is not right. Check the SMS and try again.');
    }
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });

    const existing = await prisma.user.findUnique({ where: { phone } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date() },
          include: meInclude,
        })
      : await prisma.user.create({ data: { phone, phoneVerifiedAt: new Date() }, include: meInclude });
    const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' });
    return out(AuthResponseSchema, { token, user: toMe(user), isNew: !existing });
  });

  if (!env.isProd) {
    app.get('/dev/accounts', async () => out(z.array(DevAccountSchema), DEV_ACCOUNTS));
  }
}
