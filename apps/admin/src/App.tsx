import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type AdminStats, type AuthResponse, type Me } from '@tmh/shared';
import { type ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api, errorMessage, getToken, setToken, setUnauthorizedHandler } from './api';
import { Avatar } from './components';
import { formatDateTime } from './format';
import { Icon, type IconName } from './icons';
import { BookingsPage } from './pages/Bookings';
import { Login } from './pages/Login';
import { OutboxPage } from './pages/Outbox';
import { OverviewPage } from './pages/Overview';
import { PaymentsPage } from './pages/Payments';
import { RatingsPage } from './pages/Ratings';
import { SafetyPage } from './pages/Safety';
import { TripsPage } from './pages/Trips';
import { UsersPage } from './pages/Users';
import { VehiclesPage } from './pages/Vehicles';
import { VerificationsPage } from './pages/Verifications';
import { useStats } from './queries';
import { useRealtime } from './realtime';

// ─── routing (hash based: #/users, #/trips …) ───────────────────────────────────

type SectionId =
  | 'overview'
  | 'verifications'
  | 'safety'
  | 'users'
  | 'vehicles'
  | 'trips'
  | 'bookings'
  | 'payments'
  | 'ratings'
  | 'outbox';

interface Section {
  id: SectionId;
  label: string;
  icon: IconName;
  group: 'Queues' | 'Data' | 'Dev tools' | null;
  count?: (s: AdminStats) => number;
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: 'overview', group: null },
  { id: 'verifications', label: 'Verifications', icon: 'shield', group: 'Queues', count: (s) => s.pendingVerifications },
  { id: 'safety', label: 'Reports & SOS', icon: 'alert', group: 'Queues', count: (s) => s.openReports + s.openSos },
  { id: 'users', label: 'Users', icon: 'users', group: 'Data' },
  { id: 'vehicles', label: 'Vehicles', icon: 'car', group: 'Data' },
  { id: 'trips', label: 'Trips', icon: 'route', group: 'Data' },
  { id: 'bookings', label: 'Bookings', icon: 'ticket', group: 'Data' },
  { id: 'payments', label: 'Payments', icon: 'wallet', group: 'Data' },
  { id: 'ratings', label: 'Ratings', icon: 'star', group: 'Data' },
  { id: 'outbox', label: 'Outbox', icon: 'message', group: 'Dev tools' },
];

function subscribeToHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function useSection(): SectionId {
  const hash = useSyncExternalStore(subscribeToHash, () => location.hash);
  const id = hash.replace(/^#\/?/, '');
  return SECTIONS.some((s) => s.id === id) ? (id as SectionId) : 'overview';
}

// ─── app ────────────────────────────────────────────────────────────────────────

export function App() {
  const qc = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [signOutReason, setSignOutReason] = useState<string | null>(null);

  const logout = useCallback(
    (reason?: string) => {
      setToken(null);
      setTokenState(null);
      setSignOutReason(reason ?? null);
      qc.clear();
    },
    [qc],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => logout('Your session expired. Please sign in again.'));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  function handleLoggedIn(auth: AuthResponse) {
    setToken(auth.token);
    qc.setQueryData(['me'], auth.user);
    setSignOutReason(null);
    setTokenState(auth.token);
  }

  if (!token) {
    return (
      <>
        {signOutReason ? <div className="toast toast-info">{signOutReason}</div> : null}
        <Login onLoggedIn={handleLoggedIn} />
      </>
    );
  }
  return <SignedIn token={token} onLogout={logout} />;
}

function SignedIn({ token, onLogout }: { token: string; onLogout: (reason?: string) => void }) {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), staleTime: 60_000 });
  const isNotAdmin = me.data !== undefined && !me.data.isAdmin;

  useEffect(() => {
    if (isNotAdmin) onLogout('That account is not an admin.');
  }, [isNotAdmin, onLogout]);

  if (me.isPending) return <div className="splash">Loading…</div>;
  if (me.isError) {
    return (
      <div className="splash">
        <div className="card splash-card">
          <div className="strong">Couldn't reach the API</div>
          <p className="muted small">{errorMessage(me.error)}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void me.refetch()}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLogout()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!me.data.isAdmin) return null;
  return <Shell token={token} me={me.data} onLogout={onLogout} />;
}

function Shell({ token, me, onLogout }: { token: string; me: Me; onLogout: () => void }) {
  const section = useSection();
  const stats = useStats();
  const realtime = useRealtime(token);
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;

  useEffect(() => {
    document.title = `${current.label} · Take Me Home Admin`;
  }, [current.label]);

  let groupShown: string | null = null;
  const navItems: ReactNode[] = [];
  for (const s of SECTIONS) {
    if (s.group && s.group !== groupShown) {
      groupShown = s.group;
      navItems.push(
        <div key={`g-${s.group}`} className="nav-group">
          {s.group}
        </div>,
      );
    }
    const count = s.count && stats.data ? s.count(stats.data) : 0;
    navItems.push(
      <a key={s.id} href={`#/${s.id}`} className={s.id === section ? 'nav-item nav-item-active' : 'nav-item'}>
        <Icon name={s.icon} />
        <span>{s.label}</span>
        {count > 0 ? <span className={s.id === 'safety' ? 'nav-count nav-count-coral' : 'nav-count'}>{count}</span> : null}
      </a>,
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="#/overview" className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          <span>
            Take Me Home <span className="wordmark-admin">Admin</span>
          </span>
        </a>
        <nav className="nav">{navItems}</nav>
        <div className="sidebar-foot muted small">Kigali time (UTC+2)</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className={realtime.connected ? 'live live-on' : 'live'} title={realtime.connected ? 'Realtime updates on' : 'Realtime disconnected'}>
            <span className="live-dot" />
            {realtime.connected ? 'Live' : 'Offline'}
          </div>
          <div className="topbar-user">
            <Avatar user={me} size={34} />
            <div>
              <div className="strong">{me.name}</div>
              <div className="muted small">{me.phone}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLogout()}>
              <Icon name="logout" size={16} />
              Log out
            </button>
          </div>
        </header>

        {realtime.alerts.length > 0 ? (
          <div className="sos-banners">
            {realtime.alerts.map((a) => (
              <div key={a.id} className="sos-banner" role="alert">
                <Icon name="alert" size={20} />
                <div className="sos-banner-text">
                  <strong>New SOS alert</strong> — {a.user.name} on trip {a.tripCode} ({a.route}) · {formatDateTime(a.createdAt)}
                </div>
                <a
                  href="#/safety"
                  className="btn btn-sm btn-on-coral"
                  onClick={() => realtime.dismiss(a.id)}
                >
                  View
                </a>
                <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => realtime.dismiss(a.id)}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <main className="content">
          {section === 'overview' ? <OverviewPage /> : null}
          {section === 'verifications' ? <VerificationsPage /> : null}
          {section === 'safety' ? <SafetyPage /> : null}
          {section === 'users' ? <UsersPage meId={me.id} /> : null}
          {section === 'vehicles' ? <VehiclesPage /> : null}
          {section === 'trips' ? <TripsPage /> : null}
          {section === 'bookings' ? <BookingsPage /> : null}
          {section === 'payments' ? <PaymentsPage /> : null}
          {section === 'ratings' ? <RatingsPage /> : null}
          {section === 'outbox' ? <OutboxPage /> : null}
        </main>
      </div>
    </div>
  );
}
