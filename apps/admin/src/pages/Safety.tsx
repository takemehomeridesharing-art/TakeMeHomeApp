import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AdminReport, type AdminSos, type ReportReason, type ReportStatus } from '@tmh/shared';
import { useState } from 'react';
import { api, errorMessage } from '../api';
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusPill, Tabs, UserCell } from '../components';
import { formatAgo, formatDateTime } from '../format';
import { Icon } from '../icons';
import { invalidate, useAdminList } from '../queries';

const REASON_LABELS: Record<ReportReason, string> = {
  unsafe_driving: 'Unsafe driving',
  harassment: 'Harassment',
  no_show: 'No-show',
  vehicle_mismatch: "Vehicle didn't match",
  asked_for_more_money: 'Asked for more money',
  other: 'Other',
};

// ─── SOS ────────────────────────────────────────────────────────────────────────

function SosCard({ sos }: { sos: AdminSos }) {
  const qc = useQueryClient();
  const resolve = useMutation({
    mutationFn: () => api<AdminSos>(`/admin/sos/${sos.id}/resolve`, { method: 'POST' }),
    onSuccess: () => invalidate(qc, 'sos', 'stats'),
    onError: (err) => window.alert(errorMessage(err)),
  });
  const open = !sos.resolvedAt;
  const hasLocation = sos.lat !== null && sos.lng !== null;

  return (
    <article className={open ? 'sos-card sos-open' : 'sos-card'}>
      <div className="sos-card-head">
        <div className="sos-title">
          <Icon name="alert" size={18} />
          <span>SOS · trip {sos.tripCode}</span>
        </div>
        <span className="small" title={formatDateTime(sos.createdAt)}>
          {formatAgo(sos.createdAt)}
        </span>
      </div>
      <div className="sos-route strong">{sos.route}</div>
      <div className="sos-people">
        <div>
          <div className="sos-label">Raised by</div>
          <UserCell user={sos.user} />
        </div>
        <div>
          <div className="sos-label">Driver</div>
          <UserCell user={sos.driver} />
        </div>
      </div>
      <div className="sos-facts small">
        <div>
          <Icon name="pin" size={14} />{' '}
          {hasLocation ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${sos.lat}&mlon=${sos.lng}#map=17/${sos.lat}/${sos.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {sos.lat?.toFixed(5)}, {sos.lng?.toFixed(5)}
            </a>
          ) : (
            <span>No location shared</span>
          )}
        </div>
        <div>
          <Icon name="message" size={14} />{' '}
          {sos.notifiedContacts
            ? `Trusted contact notified${sos.contactPhone ? ` (${sos.contactPhone})` : ''}`
            : 'No trusted contact notified'}
        </div>
        <div>Raised {formatDateTime(sos.createdAt)}</div>
        {sos.resolvedAt ? <div>Resolved {formatDateTime(sos.resolvedAt)}</div> : null}
      </div>
      {open ? (
        <button type="button" className="btn btn-coral btn-sm" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
          {resolve.isPending ? 'Resolving…' : 'Mark resolved'}
        </button>
      ) : (
        <StatusPill status="resolved" />
      )}
    </article>
  );
}

function SosPanel() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const query = useAdminList<AdminSos>('sos', { status });

  return (
    <section className="panel panel-sos">
      <div className="panel-head">
        <h2>SOS events</h2>
        <Tabs<'open' | 'resolved'>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open', count: status === 'open' ? query.data?.length : undefined },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />
      </div>
      {query.isPending ? <LoadingRows rows={2} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.length === 0 ? (
        <div className="card">
          <EmptyState icon="shield" title={status === 'open' ? 'No open SOS events — all clear' : 'No resolved SOS events yet'} />
        </div>
      ) : null}
      {query.isSuccess && query.data.length > 0 ? (
        <div className="sos-grid">
          {query.data.map((s) => (
            <SosCard key={s.id} sos={s} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ─── reports ────────────────────────────────────────────────────────────────────

function ReportRow({ report }: { report: AdminReport }) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (status: ReportStatus) => api<AdminReport>(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => invalidate(qc, 'reports', 'stats'),
    onError: (err) => window.alert(errorMessage(err)),
  });

  return (
    <article className="card report">
      <div className="report-main">
        <div className="report-head">
          <span className="strong">{REASON_LABELS[report.reason]}</span>
          <StatusPill status={report.status} />
          {report.tripCode ? <span className="code">{report.tripCode}</span> : null}
          <span className="muted small">{formatDateTime(report.createdAt)}</span>
        </div>
        <p className="report-body">{report.body}</p>
        <div className="report-people">
          <div>
            <div className="sos-label">Reported by</div>
            <UserCell user={report.reporter} />
          </div>
          <div>
            <div className="sos-label">About</div>
            {report.reportedUser ? <UserCell user={report.reportedUser} /> : <span className="muted small">A booking (no user named)</span>}
          </div>
        </div>
      </div>
      <div className="report-actions">
        {report.status === 'open' ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={update.isPending} onClick={() => update.mutate('reviewing')}>
            Mark reviewing
          </button>
        ) : null}
        {report.status !== 'resolved' ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={update.isPending} onClick={() => update.mutate('resolved')}>
            Resolve
          </button>
        ) : null}
      </div>
    </article>
  );
}

type ReportFilter = ReportStatus | 'all';

function ReportsPanel() {
  const [status, setStatus] = useState<ReportFilter>('open');
  const query = useAdminList<AdminReport>('reports', { status: status === 'all' ? undefined : status });

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Reports</h2>
        <Tabs<ReportFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'reviewing', label: 'Reviewing' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title={status === 'all' ? 'No reports yet' : `No ${status} reports`}>
            {status === 'open' ? 'Nothing needs attention right now.' : null}
          </EmptyState>
        </div>
      ) : null}
      {query.isSuccess && query.data.length > 0 ? (
        <div className="report-list">
          {query.data.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SafetyPage() {
  return (
    <>
      <PageHeader title="Reports & SOS" subtitle="Safety first: SOS alerts raised during trips, and reports people filed." />
      <SosPanel />
      <ReportsPanel />
    </>
  );
}
