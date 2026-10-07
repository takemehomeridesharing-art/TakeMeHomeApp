/**
 * Socket.IO connection to the API (same origin as REST). One socket per signed-in session;
 * handlers subscribe through a local registry so they survive reconnects and token changes.
 */
import { type ServerToClientEvents } from '@tmh/shared';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

type ClientToServerEvents = Record<string, never>;
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ServerEvent = keyof ServerToClientEvents;
type AnyHandler = (...args: unknown[]) => void;

let socket: AppSocket | null = null;
let socketToken: string | null = null;
let connected = false;
const statusListeners = new Set<() => void>();
const handlers = new Map<string, Set<AnyHandler>>();

function setConnected(value: boolean) {
  connected = value;
  statusListeners.forEach((l) => l());
}

/** Opens (or re-opens with a new token) the realtime connection. Idempotent. */
export function connectSocket(token: string): void {
  if (socket && socketToken === token) return;
  disconnectSocket();
  socketToken = token;
  const s: AppSocket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 10_000 });
  s.on('connect', () => setConnected(true));
  s.on('disconnect', () => setConnected(false));
  s.onAny((event: string, ...args: unknown[]) => {
    handlers.get(event)?.forEach((h) => h(...args));
  });
  socket = s;
}

/** Closes the realtime connection (sign-out). */
export function disconnectSocket(): void {
  if (!socket) return;
  socket.offAny();
  socket.disconnect();
  socket = null;
  socketToken = null;
  setConnected(false);
}

/** The current socket, if connected/connecting. Prefer `useSocketEvent` in components. */
export function getSocket(): AppSocket | null {
  return socket;
}

/** Subscribes to a server event outside React. Returns an unsubscribe function. */
export function onSocketEvent<E extends ServerEvent>(event: E, handler: ServerToClientEvents[E]): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  const h = handler as unknown as AnyHandler;
  set.add(h);
  return () => {
    set.delete(h);
  };
}

/**
 * Runs `handler` whenever the server emits `event`. The latest handler is always used, so it
 * can close over fresh props/state without re-subscribing.
 *
 * ```ts
 * useSocketEvent('join_request:updated', (jr) => { if (jr.id === id) refetch(); });
 * ```
 */
export function useSocketEvent<E extends ServerEvent>(event: E, handler: ServerToClientEvents[E]): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const forward = ((...args: unknown[]) => (ref.current as unknown as AnyHandler)(...args)) as unknown as ServerToClientEvents[E];
    return onSocketEvent(event, forward);
  }, [event]);
}

/** Whether the realtime socket is currently connected. */
export function useSocketConnected(): boolean {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => connected,
    () => false,
  );
}
