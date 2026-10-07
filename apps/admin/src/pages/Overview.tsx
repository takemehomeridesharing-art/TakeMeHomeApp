import { CO2_KG_PER_PASSENGER_KM, formatRwf } from '@tmh/shared';
import { type ReactNode } from 'react';
import { ErrorState, LoadingRows, PageHeader } from '../components';
import { formatNumber } from '../format';
import { Icon, type IconName } from '../icons';
import { useStats } from '../queries';

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: IconName;
  tone?: 'primary' | 'money' | 'green';
}) {
  return (
    <div className={`card stat stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub muted small">{sub}</div> : null}
    </div>
  );
}

function QueueCard({ label, count, href, calm, urgent }: { label: string; count: number; href: string; calm: string; urgent?: boolean }) {
  const hot = count > 0;
  return (
    <a href={href} className={`card queue ${hot ? (urgent ? 'queue-urgent' : 'queue-hot') : 'queue-calm'}`}>
      <div className="queue-count">{count}</div>
      <div>
        <div className="strong">{label}</div>
        <div className="small queue-sub">{hot ? 'Open the queue →' : calm}</div>
      </div>
    </a>
  );
}

export function OverviewPage() {
  const stats = useStats();

  return (
    <>
      <PageHeader title="Overview" subtitle="How Take Me Home is doing right now. Refreshes every 15 seconds." />
      {stats.isPending ? <LoadingRows rows={3} /> : null}
      {stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : null}
      {stats.data ? (
        <>
          <section className="queues">
            <QueueCard label="Open SOS events" count={stats.data.openSos} href="#/safety" calm="All clear" urgent />
            <QueueCard label="Open reports" count={stats.data.openReports} href="#/safety" calm="Nothing to review" urgent />
            <QueueCard label="Pending verifications" count={stats.data.pendingVerifications} href="#/verifications" calm="Queue is empty" />
          </section>

          <section className="stats-grid">
            <StatCard
              label="Users"
              icon="users"
              value={formatNumber(stats.data.users)}
              sub={`${formatNumber(stats.data.drivers)} drivers`}
            />
            <StatCard
              label="Trips today"
              icon="route"
              value={formatNumber(stats.data.tripsToday)}
              sub={`${formatNumber(stats.data.tripsPublished)} open for requests to join`}
            />
            <StatCard
              label="Match rate"
              icon="check"
              value={`${Math.round(stats.data.matchRate * 100)}%`}
              sub={`of answered requests to join accepted · ${formatNumber(stats.data.joinRequests)} requests in total`}
            />
            <StatCard label="Bookings" icon="ticket" value={formatNumber(stats.data.bookings)} sub="paid seats" />
            <StatCard
              label="Booking fee revenue"
              icon="wallet"
              tone="money"
              value={formatRwf(stats.data.feeRevenue)}
              sub={`${formatRwf(stats.data.costSharesPaid)} in cost shares passed to drivers`}
            />
            <StatCard
              label="CO₂ saved (est.)"
              icon="leaf"
              tone="green"
              value={`${formatNumber(stats.data.co2SavedKg, 1)} kg`}
              sub={`${formatNumber(stats.data.passengerKm, 1)} shared passenger-km × ${CO2_KG_PER_PASSENGER_KM} kg`}
            />
          </section>
        </>
      ) : null}
    </>
  );
}
