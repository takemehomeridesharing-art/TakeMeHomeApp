import { type JoinRequestStatus, type ReportReason, type Weekday } from '@tmh/shared';
import { type BadgeKind, type IconName } from '@/components';

const DAY_NAMES: Record<Weekday, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
const ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** `['MO','TU','WE','TH','FR']` → `Weekdays`; otherwise `Mon, Wed, Fri`. */
export function recurringLabel(days: readonly Weekday[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;
  const sorted = [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const key = sorted.join(',');
  if (key === 'MO,TU,WE,TH,FR') return 'Every weekday';
  if (sorted.length === 7) return 'Every day';
  if (key === 'SA,SU') return 'Weekends';
  return `Every ${sorted.map((d) => DAY_NAMES[d]).join(', ')}`;
}

export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; icon: IconName }> = {
  unsafe_driving: { label: 'Unsafe driving', icon: 'speedometer-outline' },
  harassment: { label: 'Harassment', icon: 'hand-left-outline' },
  no_show: { label: 'No-show', icon: 'time-outline' },
  vehicle_mismatch: { label: "Car didn't match", icon: 'car-outline' },
  asked_for_more_money: { label: 'Asked for more money', icon: 'cash-outline' },
  other: { label: 'Something else', icon: 'ellipsis-horizontal-circle-outline' },
};

export const REQUEST_STATUS: Record<JoinRequestStatus, { label: string; badge: BadgeKind }> = {
  pending: { label: 'Waiting for driver', badge: 'warning' },
  accepted: { label: 'Accepted · pay to confirm', badge: 'primary' },
  declined: { label: 'Declined', badge: 'neutral' },
  cancelled: { label: 'Cancelled', badge: 'neutral' },
  expired: { label: 'Expired', badge: 'neutral' },
};

/** First name only — how the app addresses people ("Waiting for Claudine"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Whether a driver shows the verified tick (ID checked by the safety team). */
export function isVerifiedDriver(v: { id: string; licence: string }): boolean {
  return v.id === 'verified' || v.licence === 'verified';
}
