import { type AdminRating } from '@tmh/shared';
import { useState } from 'react';
import { type Column, DataTable, PageHeader, SearchBox, UserCell, useDebounced } from '../components';
import { formatDateTime } from '../format';
import { useAdminList } from '../queries';

function StarRow({ stars }: { stars: number }) {
  return (
    <span className="star-row" aria-label={`${stars} of 5 stars`}>
      {'★'.repeat(stars)}
      <span className="star-off">{'★'.repeat(5 - stars)}</span>
    </span>
  );
}

export function RatingsPage() {
  const [q, setQ] = useState('');
  const query = useAdminList<AdminRating>('ratings', { q: useDebounced(q) });

  const columns: Column<AdminRating>[] = [
    { header: 'Stars', cell: (r) => <StarRow stars={r.stars} /> },
    { header: 'From', cell: (r) => <UserCell user={r.rater} /> },
    { header: 'For', cell: (r) => <UserCell user={r.ratee} /> },
    {
      header: 'Feedback',
      cell: (r) => (
        <div className="feedback">
          {r.tags.length ? (
            <div className="chips">
              {r.tags.map((t) => (
                <span key={t} className={t === 'Late pickup' ? 'tag tag-warn' : 'tag'}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {r.comment ? <div className="small">“{r.comment}”</div> : null}
          {!r.tags.length && !r.comment ? <span className="muted small">—</span> : null}
        </div>
      ),
    },
    { header: 'Trip code', cell: (r) => <span className="code">{r.tripCode}</span> },
    { header: 'Time', cell: (r) => <span className="small nowrap">{formatDateTime(r.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Ratings" subtitle="Two-way ratings left after completed trips." />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, trip code or comment" />
      </div>
      <DataTable query={query} columns={columns} emptyIcon="star" emptyTitle={q ? 'No ratings match this search' : 'No ratings yet'} />
    </>
  );
}
