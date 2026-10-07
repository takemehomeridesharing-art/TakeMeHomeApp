import { type AdminBooking, BOOKING_STATUSES, formatKm, formatRwf } from '@tmh/shared';
import { useState } from 'react';
import { type Column, DataTable, PageHeader, SearchBox, StatusPill, StatusSelect, UserCell, useDebounced } from '../components';
import { formatDateTime } from '../format';
import { useAdminList } from '../queries';

export function BookingsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const query = useAdminList<AdminBooking>('bookings', { q: useDebounced(q), status });

  const columns: Column<AdminBooking>[] = [
    { header: 'Trip code', cell: (b) => <span className="code">{b.tripCode}</span> },
    {
      header: 'Ride',
      cell: (b) => (
        <div>
          <div className="strong">{b.segment}</div>
          <div className="muted small">
            {formatKm(b.segmentKm)} of {b.route}
          </div>
        </div>
      ),
    },
    { header: 'Departure', cell: (b) => <span className="small nowrap">{formatDateTime(b.departureTime)}</span> },
    { header: 'Passenger', cell: (b) => <UserCell user={b.passenger} /> },
    { header: 'Driver', cell: (b) => <UserCell user={b.driver} /> },
    {
      header: 'Contribution',
      cell: (b) => (
        <div className="small">
          <span className="money">{formatRwf(b.contributionAmount + b.bookingFee)}</span>
          <div className="muted">
            {formatRwf(b.contributionAmount)} cost share + {formatRwf(b.bookingFee)} booking fee
          </div>
        </div>
      ),
    },
    { header: 'Payment', cell: (b) => <StatusPill status={b.paymentStatus} /> },
    { header: 'Status', cell: (b) => <StatusPill status={b.status} /> },
  ];

  return (
    <>
      <PageHeader title="Bookings" subtitle="Seats confirmed after a driver accepted a request to join and the passenger paid." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search trip code, passenger or driver" />
        <StatusSelect value={status} onChange={setStatus} options={BOOKING_STATUSES} />
      </div>
      <DataTable
        query={query}
        columns={columns}
        emptyIcon="ticket"
        emptyTitle={q || status ? 'No bookings match these filters' : 'No bookings yet'}
      />
    </>
  );
}
