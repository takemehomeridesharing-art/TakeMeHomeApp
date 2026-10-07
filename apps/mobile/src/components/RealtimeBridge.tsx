import { type Href, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { appendMessage, qk, type PaymentWithBooking } from '@/lib/queries';
import { connectSocket, disconnectSocket, useSocketEvent } from '@/lib/socket';
import { useSession } from '@/stores/session';
import { toast } from './Toast';

/**
 * Keeps the realtime socket connected while signed in and turns server events into cache
 * invalidations (plus an in-app banner for notifications). Mount once in the root layout.
 */
export function RealtimeBridge() {
  const token = useSession((s) => s.token);
  const client = useQueryClient();

  useEffect(() => {
    if (token) connectSocket(token);
    else disconnectSocket();
  }, [token]);

  useEffect(() => () => disconnectSocket(), []);

  const invalidate = (...keys: (readonly unknown[])[]) => keys.forEach((queryKey) => void client.invalidateQueries({ queryKey }));

  useSocketEvent('join_request:updated', (jr) => {
    invalidate(qk.requests.all, qk.trips.detail(jr.tripId), qk.driver.all);
  });

  useSocketEvent('trip:updated', ({ tripId }) => {
    invalidate(qk.trips.detail(tripId), qk.trips.all, qk.bookings.all, qk.driver.all, qk.requests.all, qk.history);
  });

  useSocketEvent('payment:updated', (payment: PaymentWithBooking) => {
    client.setQueryData(qk.payments.detail(payment.id), payment);
    invalidate(qk.requests.all, qk.bookings.all, qk.driver.all);
  });

  useSocketEvent('chat:message', (message) => {
    if (client.getQueryData(qk.messages(message.bookingId))) appendMessage(client, message);
    else invalidate(qk.messages(message.bookingId));
  });

  useSocketEvent('notification', (n) => {
    invalidate(qk.notifications);
    toast.show({
      title: n.title,
      message: n.body,
      tone: 'info',
      onPress: n.href ? () => router.push(n.href as Href) : undefined,
    });
  });

  return null;
}
