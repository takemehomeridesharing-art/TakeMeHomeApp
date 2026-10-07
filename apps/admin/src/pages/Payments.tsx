import { type AdminPayment, PAYMENT_STATUSES, formatRwf } from '@tmh/shared';
import { useState } from 'react';
import { type Column, DataTable, PageHeader, SearchBox, StatusPill, StatusSelect, UserCell, useDebounced } from '../components';
import { formatDateTime } from '../format';
import { useAdminList } from '../queries';

export function PaymentsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const query = useAdminList<AdminPayment>('payments', { q: useDebounced(q), status });

  const columns: Column<AdminPayment>[] = [
    {
      header: 'Reference',
      cell: (p) => (
        <div>
          <span className="code">{p.providerRef}</span>
          <div className="muted small">{p.provider}</div>
        </div>
      ),
    },
    { header: 'Trip code', cell: (p) => (p.tripCode ? <span className="code">{p.tripCode}</span> : <span className="muted">—</span>) },
    { header: 'Payer', cell: (p) => <UserCell user={p.payer} sub={p.msisdn} /> },
    { header: 'Amount', className: 'col-num', cell: (p) => <span className="money">{formatRwf(p.amount)}</span> },
    { header: 'Time', cell: (p) => <span className="small nowrap">{formatDateTime(p.createdAt)}</span> },
    {
      header: 'Status',
      cell: (p) => (
        <div>
          <StatusPill status={p.status} />
          {p.failureReason ? <div className="small coral-text">{p.failureReason}</div> : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="Mobile Money collections: the cost share plus the booking fee, per seat." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search reference, trip code or payer" />
        <StatusSelect value={status} onChange={setStatus} options={PAYMENT_STATUSES} />
      </div>
      <DataTable
        query={query}
        columns={columns}
        emptyIcon="wallet"
        emptyTitle={q || status ? 'No payments match these filters' : 'No payments yet'}
      />
    </>
  );
}
