import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AdminUser } from '@tmh/shared';
import { useState } from 'react';
import { api, errorMessage } from '../api';
import {
  type Column,
  DataTable,
  PageHeader,
  SearchBox,
  Stars,
  StatusPill,
  StatusSelect,
  UserCell,
  VerificationChipList,
  useDebounced,
} from '../components';
import { formatDate, humanize, plural } from '../format';
import { invalidate, useAdminList } from '../queries';

const USER_STATUSES = ['active', 'suspended'] as const;

export function UsersPage({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const query = useAdminList<AdminUser>('users', { q: useDebounced(q), status });

  const setSuspended = useMutation({
    mutationFn: ({ user, suspend }: { user: AdminUser; suspend: boolean }) =>
      api<AdminUser>(`/admin/users/${user.id}/${suspend ? 'suspend' : 'unsuspend'}`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, 'users', 'stats'),
    onError: (err) => window.alert(errorMessage(err)),
  });

  function toggle(user: AdminUser) {
    const suspend = user.status !== 'suspended';
    const question = suspend
      ? `Suspend ${user.name}? They won't be able to publish trips, request to join, pay or chat until unsuspended.`
      : `Unsuspend ${user.name}? They'll get full access again.`;
    if (window.confirm(question)) setSuspended.mutate({ user, suspend });
  }

  const columns: Column<AdminUser>[] = [
    {
      header: 'User',
      cell: (u) => (
        <UserCell
          user={u}
          sub={
            <>
              {u.phone}
              {u.email ? ` · ${u.email}` : ''}
            </>
          }
        />
      ),
    },
    {
      header: 'Profile',
      cell: (u) => (
        <div className="small">
          {u.isAdmin ? <span className="badge badge-plain">Admin</span> : null} {u.gender ? humanize(u.gender) : '—'}
          {u.homeArea ? <div className="muted">{u.homeArea}</div> : null}
        </div>
      ),
    },
    { header: 'Verification', cell: (u) => <VerificationChipList chips={u.verification} /> },
    { header: 'Rating', cell: (u) => <Stars value={u.ratingAvg} count={u.ratingCount} /> },
    {
      header: 'Activity',
      cell: (u) => (
        <div className="small">
          {plural(u.tripCount, 'trip')} · {plural(u.bookingCount, 'booking')}
          <div className="muted">
            {u.vehicleCount} {u.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
          </div>
        </div>
      ),
    },
    { header: 'Joined', cell: (u) => <span className="small nowrap">{formatDate(u.createdAt)}</span> },
    { header: 'Status', cell: (u) => <StatusPill status={u.status} /> },
    {
      header: 'Actions',
      className: 'col-actions',
      cell: (u) =>
        u.id === meId ? (
          <span className="muted small">You</span>
        ) : (
          <button
            type="button"
            className={u.status === 'suspended' ? 'btn btn-ghost btn-sm' : 'btn btn-danger-ghost btn-sm'}
            disabled={setSuspended.isPending && setSuspended.variables?.user.id === u.id}
            onClick={() => toggle(u)}
          >
            {u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
          </button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with an account — passengers, drivers and admins." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, phone or email" />
        <StatusSelect value={status} onChange={setStatus} options={USER_STATUSES} />
      </div>
      <DataTable
        query={query}
        columns={columns}
        emptyIcon="users"
        emptyTitle={q || status ? 'No users match these filters' : 'No users yet'}
        emptyHint={q || status ? 'Try a different search or status.' : undefined}
      />
    </>
  );
}
