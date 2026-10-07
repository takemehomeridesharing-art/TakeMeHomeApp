import { useQueryClient } from '@tanstack/react-query';
import { type AdminSos, type ServerToClientEvents } from '@tmh/shared';
import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api } from './api';
import { RESOURCES_BY_KIND, invalidate } from './queries';

/**
 * Connects to the API's Socket.IO server as the signed-in admin. Every `admin:changed` event
 * invalidates the matching queries; SOS changes also check for *new* open SOS events, which are
 * returned as alerts for the coral banner.
 */
export function useRealtime(token: string) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<AdminSos[]>([]);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents> = io(API_URL, { auth: { token } });
    const knownSosIds = new Set<string>();
    let primed = false;
    let closed = false;

    async function checkForNewSos() {
      try {
        const open = await api<AdminSos[]>('/admin/sos', { query: { status: 'open' } });
        if (closed) return;
        const fresh = primed ? open.filter((s) => !knownSosIds.has(s.id)) : [];
        for (const s of open) knownSosIds.add(s.id);
        primed = true;
        if (fresh.length > 0) setAlerts((prev) => [...fresh, ...prev]);
      } catch {
        // The SOS panel shows its own error; the banner is best-effort.
      }
    }

    void checkForNewSos();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('admin:changed', (e) => {
      invalidate(qc, ...(RESOURCES_BY_KIND[e.kind] ?? ['stats']));
      if (e.kind === 'sos') void checkForNewSos();
    });

    return () => {
      closed = true;
      socket.disconnect();
    };
  }, [token, qc]);

  const dismiss = useCallback((id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id)), []);

  return { connected, alerts, dismiss };
}
