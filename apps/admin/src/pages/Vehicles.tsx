import { type AdminVehicle } from '@tmh/shared';
import { useState } from 'react';
import { assetUrl } from '../api';
import { Badge, type Column, DataTable, PageHeader, SearchBox, StatusPill, UserCell, useDebounced } from '../components';
import { formatDate } from '../format';
import { useAdminList } from '../queries';

export function VehiclesPage() {
  const [q, setQ] = useState('');
  const query = useAdminList<AdminVehicle>('vehicles', { q: useDebounced(q) });

  const columns: Column<AdminVehicle>[] = [
    {
      header: 'Vehicle',
      cell: (v) => {
        const photo = assetUrl(v.photos[0]);
        return (
          <div className="user-cell">
            {photo ? (
              <a href={photo} target="_blank" rel="noreferrer">
                <img className="thumb" src={photo} alt={`${v.make} ${v.model}`} />
              </a>
            ) : (
              <span className="thumb thumb-empty" />
            )}
            <div>
              <div className="strong">
                {v.make} {v.model}
              </div>
              <div className="muted small">{v.color}</div>
            </div>
          </div>
        );
      },
    },
    { header: 'Plate', cell: (v) => <span className="plate">{v.plate}</span> },
    { header: 'Seats', cell: (v) => v.seats },
    { header: 'Type', cell: (v) => (v.isEV ? <Badge kind="ev">EV / hybrid</Badge> : <span className="muted small">Fuel</span>) },
    { header: 'Owner', cell: (v) => <UserCell user={v.owner} /> },
    { header: 'Added', cell: (v) => <span className="small nowrap">{formatDate(v.createdAt)}</span> },
    {
      header: 'Status',
      cell: (v) => <StatusPill status={v.verified ? 'verified' : 'pending'} label={v.verified ? 'Verified' : 'Not verified'} />,
    },
  ];

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Cars registered by drivers. Verification happens in the Verifications queue." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search plate, make, model or owner" />
      </div>
      <DataTable
        query={query}
        columns={columns}
        emptyIcon="car"
        emptyTitle={q ? 'No vehicles match this search' : 'No vehicles registered yet'}
      />
    </>
  );
}
