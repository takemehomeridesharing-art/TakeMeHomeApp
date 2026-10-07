import { keepPreviousData, type QueryClient, useQuery } from '@tanstack/react-query';
import { type AdminStats } from '@tmh/shared';
import { api } from './api';

/** Every admin list lives under `['admin', resource, params]` so one prefix invalidates it. */
export type AdminResource =
  | 'stats'
  | 'users'
  | 'vehicles'
  | 'trips'
  | 'bookings'
  | 'payments'
  | 'ratings'
  | 'verifications'
  | 'reports'
  | 'sos'
  | 'outbox';

export function useAdminList<T>(resource: Exclude<AdminResource, 'stats'>, params: { q?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['admin', resource, params],
    queryFn: () => api<T[]>(`/admin/${resource}`, { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api<AdminStats>('/admin/stats'),
    refetchInterval: 15_000,
  });
}

export function invalidate(qc: QueryClient, ...resources: AdminResource[]): void {
  for (const r of resources) void qc.invalidateQueries({ queryKey: ['admin', r] });
}

/** What to refetch when the server says a kind of admin data changed. */
export const RESOURCES_BY_KIND: Record<'sos' | 'report' | 'verification' | 'booking' | 'user', AdminResource[]> = {
  sos: ['sos', 'stats', 'outbox'],
  report: ['reports', 'stats'],
  verification: ['verifications', 'users', 'vehicles', 'stats'],
  booking: ['bookings', 'payments', 'trips', 'ratings', 'stats', 'outbox'],
  user: ['users', 'vehicles', 'trips', 'stats'],
};
