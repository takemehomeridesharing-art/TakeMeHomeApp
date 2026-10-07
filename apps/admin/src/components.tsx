import { type UseQueryResult } from '@tanstack/react-query';
import { type PublicUser, type VerificationChips } from '@tmh/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { assetUrl, errorMessage } from './api';
import { humanize, initials } from './format';
import { Icon, type IconName } from './icons';

// ─── pills & chips ──────────────────────────────────────────────────────────────

export type Tone = 'success' | 'tint' | 'accent' | 'coral' | 'neutral';

const STATUS_TONES: Record<string, Tone> = {
  // good / done
  active: 'success',
  confirmed: 'success',
  approved: 'success',
  completed: 'success',
  accepted: 'success',
  verified: 'success',
  resolved: 'success',
  // waiting on someone
  published: 'tint',
  pending: 'tint',
  full: 'tint',
  in_progress: 'tint',
  // money moving / being looked at
  initiated: 'accent',
  reviewing: 'accent',
  // needs attention
  suspended: 'coral',
  failed: 'coral',
  open: 'coral',
  rejected: 'coral',
  no_show: 'coral',
  // closed, nothing to do
  cancelled: 'neutral',
  refunded: 'neutral',
  declined: 'neutral',
  expired: 'neutral',
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <Pill tone={STATUS_TONES[status] ?? 'neutral'}>{label ?? humanize(status)}</Pill>;
}

export function Badge({ kind, children }: { kind: 'women' | 'ev' | 'plain'; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

const CHIP_LABELS: Record<keyof VerificationChips, string> = {
  phone: 'Phone',
  email: 'Email',
  id: 'ID',
  licence: 'Licence',
  vehicle: 'Vehicle',
};

/** One small chip per verification: filled when verified, outlined when pending, faint when missing. */
export function VerificationChipList({ chips }: { chips: VerificationChips }) {
  return (
    <div className="chips">
      {(Object.keys(CHIP_LABELS) as (keyof VerificationChips)[]).map((key) => {
        const state = chips[key];
        return (
          <span key={key} className={`chip chip-${state}`} title={`${CHIP_LABELS[key]}: ${state === 'none' ? 'not submitted' : state}`}>
            {state === 'verified' ? <Icon name="check" size={11} /> : null}
            {CHIP_LABELS[key]}
          </span>
        );
      })}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (count === 0) return <span className="muted">No ratings</span>;
  return (
    <span className="stars">
      <span className="star-glyph">★</span> {value.toFixed(1)}
      {count !== undefined ? <span className="muted"> ({count})</span> : null}
    </span>
  );
}

export function Avatar({ user, size = 32 }: { user: Pick<PublicUser, 'name' | 'photoUrl'>; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  const src = assetUrl(user.photoUrl);
  if (src && !broken) {
    return <img className="avatar" style={style} src={src} alt="" onError={() => setBroken(true)} />;
  }
  return (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(user.name)}
    </span>
  );
}

/** Avatar + name + an optional second line (phone, role…). */
export function UserCell({ user, sub }: { user: Pick<PublicUser, 'name' | 'photoUrl'>; sub?: ReactNode }) {
  return (
    <div className="user-cell">
      <Avatar user={user} />
      <div className="user-cell-text">
        <div className="strong">{user.name}</div>
        {sub ? <div className="muted small">{sub}</div> : null}
      </div>
    </div>
  );
}

// ─── page chrome ────────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-header-actions">{children}</div> : null}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function StatusSelect({
  value,
  onChange,
  options,
  allLabel = 'All statuses',
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  allLabel?: string;
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by status">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {humanize(o)}
        </option>
      ))}
    </select>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'tab tab-active' : 'tab'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? <span className="tab-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ─── loading / error / empty ────────────────────────────────────────────────────

export function EmptyState({ icon = 'inbox', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="strong">{title}</div>
      {children ? <div className="muted small">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <div className="strong">Couldn't load this</div>
        <div className="small">{errorMessage(error)}</div>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-rows" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** A plain table bound to a list query, with loading, error and empty states. */
export function DataTable<T extends { id: string }>({
  query,
  columns,
  emptyTitle,
  emptyHint,
  emptyIcon,
  rows,
}: {
  query: UseQueryResult<T[]>;
  /** Client-side filtered rows to show instead of `query.data`. */
  rows?: T[];
  columns: Column<T>[];
  emptyTitle: string;
  emptyHint?: ReactNode;
  emptyIcon?: IconName;
}) {
  const data = rows ?? query.data ?? [];
  let body: ReactNode;
  if (query.isPending) body = <LoadingRows />;
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  else if (data.length === 0)
    body = (
      <EmptyState title={emptyTitle} icon={emptyIcon}>
        {emptyHint}
      </EmptyState>
    );
  else
    body = (
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={c.className}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.header} className={c.className}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="card table-card">
      {body}
      {query.isSuccess && data.length > 0 ? (
        <div className="table-foot muted small">
          {data.length} {data.length === 1 ? 'row' : 'rows'}
          {query.isFetching ? ' · refreshing…' : ''}
        </div>
      ) : null}
    </div>
  );
}

// ─── hooks ──────────────────────────────────────────────────────────────────────

/** The value, but only after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
