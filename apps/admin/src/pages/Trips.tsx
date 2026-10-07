import { type AdminTrip, TRIP_STATUSES, formatKm, formatRwf } from '@tmh/shared';
import { useState } from 'react';
import { Badge, type Column, DataTable, PageHeader, SearchBox, StatusPill, StatusSelect, UserCell, useDebounced } from '../components';
import { formatDateTime, plural } from '../format';
import { useAdminList } from '../queries';

export function routeLabel(stops: AdminTrip['stops']): string {
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  const first = sorted[0]?.place.name ?? '?';
  const last = sorted[sorted.length - 1]?.place.name ?? '?';
  return `${first} → ${last}`;
}

function repeatLabel(days: string[]): string {
  const key = days.join(' ');
  if (key === 'MO TU WE TH FR') return 'weekdays';
  if (key === 'MO TU WE TH FR SA SU') return 'daily';
  return days.join(' ');
}

export function TripsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const query = useAdminList<AdminTrip>('trips', { q: useDebounced(q), status });

  const columns: Column<AdminTrip>[] = [
    {
      header: 'Route',
      cell: (t) => {
        const via = [...t.stops]
          .sort((a, b) => a.order - b.order)
          .slice(1, -1)
          .map((s) => s.place.name);
        return (
          <div>
            <div className="strong">{routeLabel(t.stops)}</div>
            <div className="muted small" title={via.length ? `Via ${via.join(', ')}` : undefined}>
              {t.stops.length} stops · {formatKm(t.totalKm)}
              {via.length ? ` · via ${via.slice(0, 2).join(', ')}${via.length > 2 ? '…' : ''}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Departure',
      cell: (t) => (
        <div className="small">
          <div className="strong nowrap">{formatDateTime(t.departureTime)}</div>
          {t.recurringDays?.length ? <div className="muted">Repeats {repeatLabel(t.recurringDays)}</div> : null}
        </div>
      ),
    },
    {
      header: 'Driver',
      cell: (t) => (
        <UserCell
          user={t.driver}
          sub={
            <>
              {t.vehicle.make} {t.vehicle.model} · <span className="nowrap">{t.vehicle.plate}</span>
            </>
          }
        />
      ),
    },
    {
      header: 'Seats',
      cell: (t) => (
        <div className="small">
          <span className="strong">{t.seatsLeft}</span> of {t.seatsOffered} free
          <div className="muted">
            {plural(t.requestCount, 'request')} · {t.bookingCount} booked
          </div>
        </div>
      ),
    },
    {
      header: 'Full-route contribution',
      cell: (t) => (
        <div className="small">
          <span className="money">{formatRwf(t.fullRouteContribution.total)}</span>
          <div className="muted">
            {formatRwf(t.fullRouteContribution.costShare)} cost share + {formatRwf(t.fullRouteContribution.bookingFee)} booking fee
          </div>
        </div>
      ),
    },
    {
      header: 'Badges',
      cell: (t) => (
        <div className="chips">
          {t.womenOnly ? <Badge kind="women">Women only</Badge> : null}
          {t.isEV ? <Badge kind="ev">EV</Badge> : null}
          {!t.womenOnly && !t.isEV ? <span className="muted small">—</span> : null}
        </div>
      ),
    },
    { header: 'Status', cell: (t) => <StatusPill status={t.status} /> },
  ];

  return (
    <>
      <PageHeader title="Trips" subtitle="Every published trip, newest departures first. Times are Kigali time." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search place, driver or plate" />
        <StatusSelect value={status} onChange={setStatus} options={TRIP_STATUSES} />
      </div>
      <DataTable
        query={query}
        columns={columns}
        emptyIcon="route"
        emptyTitle={q || status ? 'No trips match these filters' : 'No trips published yet'}
      />
    </>
  );
}
