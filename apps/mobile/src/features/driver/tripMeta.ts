import { type TripStatus, type Weekday } from '@tmh/shared';
import { type BadgeKind, type IconName } from '@/components';

export const TRIP_STATUS_META: Record<TripStatus, { label: string; kind: BadgeKind; icon: IconName }> = {
  published: {
    label: 'Open for requests',
    kind: 'primary',
    icon: 'radio-outline',
  },
  full: { label: 'Full', kind: 'warning', icon: 'people' },
  in_progress: { label: 'On the road', kind: 'success', icon: 'navigate' },
  completed: { label: 'Completed', kind: 'success', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', kind: 'danger', icon: 'close-circle' },
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

/** `Mon–Fri`, `Mon, Wed, Fri`, or null for one-off trips. */
export function recurringLabel(days: readonly Weekday[] | null | undefined): string | null {
  if (!days?.length) return null;
  const set = new Set(days);
  if (set.size === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => set.has(d as Weekday))) return 'Mon–Fri';
  if (set.size === 7) return 'Every day';
  if (set.size === 2 && set.has('SA') && set.has('SU')) return 'Sat & Sun';
  return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** True while a trip can still be managed (requests, start, cancel). */
export const isActiveTrip = (status: TripStatus) => status === 'published' || status === 'full' || status === 'in_progress';

/** `Today` → `today`, `Tomorrow` → `tomorrow`, `Thu 9 Oct` → `on Thu 9 Oct` (for "2 trips {x}"). */
export function onDayPhrase(dayLabel: string): string {
  return dayLabel === 'Today' || dayLabel === 'Tomorrow' ? dayLabel.toLowerCase() : `on ${dayLabel}`;
}
