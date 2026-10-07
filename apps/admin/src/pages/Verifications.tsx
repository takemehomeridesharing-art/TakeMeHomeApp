import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AdminVerification, type VerificationStatus, type VerificationType } from '@tmh/shared';
import { useState } from 'react';
import { api, assetUrl, errorMessage } from '../api';
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusPill, Tabs, UserCell } from '../components';
import { formatAgo, formatDateTime } from '../format';
import { Icon } from '../icons';
import { invalidate, useAdminList, useStats } from '../queries';

const TYPE_LABELS: Record<VerificationType, string> = {
  email: 'Email address',
  id: 'National ID',
  licence: 'Driving licence',
  vehicle: 'Vehicle registration',
};

function looksLikeImage(url: string): boolean {
  return /^data:image\//i.test(url) || /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

/** Thumbnail for image documents (falls back to a link if it fails to load); a plain link otherwise. */
function DocumentPreview({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (looksLikeImage(url) && !broken) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="doc-preview" title="Open document in a new tab">
        <img src={url} alt={alt} onError={() => setBroken(true)} />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="doc-link">
      <Icon name="file" size={18} /> Open document{broken ? ' (preview unavailable)' : ''}
    </a>
  );
}

function VerificationCard({ v }: { v: AdminVerification }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const review = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      api<AdminVerification>(`/admin/verifications/${v.id}/${decision}`, {
        method: 'POST',
        body: note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: () => invalidate(qc, 'verifications', 'users', 'vehicles', 'stats'),
  });
  const doc = assetUrl(v.documentUrl);

  return (
    <article className="card verif">
      <div className="verif-head">
        <span className="verif-type">{TYPE_LABELS[v.type]}</span>
        <StatusPill status={v.status} />
      </div>
      <UserCell user={v.user} sub={`Submitted ${formatAgo(v.createdAt)}`} />

      <div className="verif-body">
        {v.type === 'email' ? (
          <div className="verif-field">
            <span className="muted small">Email</span>
            <span className="strong">{v.email ?? '—'}</span>
          </div>
        ) : null}
        {v.type === 'vehicle' && v.vehicle ? (
          <div className="verif-field">
            <span className="muted small">Vehicle</span>
            <span className="strong">
              {v.vehicle.make} {v.vehicle.model} · {v.vehicle.color} · <span className="plate">{v.vehicle.plate}</span>
            </span>
            <span className="small muted">
              {v.vehicle.seats} seats{v.vehicle.isEV ? ' · EV / hybrid' : ''}
            </span>
          </div>
        ) : null}
        {doc ? (
          <DocumentPreview url={doc} alt={`${TYPE_LABELS[v.type]} submitted by ${v.user.name}`} />
        ) : v.type !== 'email' ? (
          <div className="muted small">No document attached</div>
        ) : null}
      </div>

      {v.status === 'pending' ? (
        <div className="verif-actions">
          <input
            className="input input-sm"
            placeholder="Note to the user (optional)"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="row-actions">
            <button type="button" className="btn btn-success btn-sm" disabled={review.isPending} onClick={() => review.mutate('approve')}>
              <Icon name="check" size={15} /> Approve
            </button>
            <button type="button" className="btn btn-danger-ghost btn-sm" disabled={review.isPending} onClick={() => review.mutate('reject')}>
              <Icon name="x" size={15} /> Reject
            </button>
          </div>
          {review.isError ? <div className="form-error small">{errorMessage(review.error)}</div> : null}
        </div>
      ) : (
        <div className="verif-reviewed small muted">
          {v.reviewedAt ? `Reviewed ${formatDateTime(v.reviewedAt)}` : 'Reviewed'}
          {v.note ? <div className="verif-note">“{v.note}”</div> : null}
        </div>
      )}
    </article>
  );
}

export function VerificationsPage() {
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const query = useAdminList<AdminVerification>('verifications', { status });
  const stats = useStats();

  return (
    <>
      <PageHeader title="Verifications" subtitle="Check documents people submitted, then approve or reject them." />
      <div className="toolbar">
        <Tabs<VerificationStatus>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Pending', count: stats.data?.pendingVerifications },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.length === 0 ? (
        <div className="card">
          <EmptyState icon="shield" title={status === 'pending' ? 'Nothing waiting for review' : `No ${status} verifications`}>
            {status === 'pending' ? 'New submissions will show up here automatically.' : null}
          </EmptyState>
        </div>
      ) : null}
      {query.isSuccess && query.data.length > 0 ? (
        <div className="verif-grid">
          {query.data.map((v) => (
            <VerificationCard key={v.id} v={v} />
          ))}
        </div>
      ) : null}
    </>
  );
}
