import { useQuery } from '@tanstack/react-query';
import { type AuthResponse, type DevAccount } from '@tmh/shared';
import { type FormEvent, useState } from 'react';
import { api, errorMessage } from '../api';

const FALLBACK_ADMIN_PHONE = '+250788000001';
const DEV_OTP = '123456';

interface OtpRequestResponse {
  ok: true;
  phone: string;
  devHint?: string;
}

export function Login({ onLoggedIn }: { onLoggedIn: (auth: AuthResponse) => void }) {
  const devAccounts = useQuery({
    queryKey: ['dev', 'accounts'],
    queryFn: () => api<DevAccount[]>('/dev/accounts'),
    retry: false,
    staleTime: Infinity,
  });
  const devAdmin = devAccounts.data?.find((a) => a.role === 'admin');

  // `null` until the admin types, so the seeded admin's phone can be prefilled once it loads.
  const [typedPhone, setTypedPhone] = useState<string | null>(null);
  const phone = typedPhone ?? devAdmin?.phone ?? FALLBACK_ADMIN_PHONE;

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [sentTo, setSentTo] = useState('');
  const [devHint, setDevHint] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<OtpRequestResponse>('/auth/otp/request', { method: 'POST', body: { phone } });
      setSentTo(res.phone);
      setDevHint(res.devHint);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = await api<AuthResponse>('/auth/otp/verify', { method: 'POST', body: { phone: sentTo || phone, code } });
      if (!auth.user.isAdmin) {
        setError(`${auth.user.name || auth.user.phone} is not an admin. Only admin accounts can use this dashboard.`);
        return;
      }
      onLoggedIn(auth);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card card">
        <div className="wordmark wordmark-lg">
          <span className="wordmark-mark" aria-hidden="true" />
          <span>
            Take Me Home <span className="wordmark-admin">Admin</span>
          </span>
        </div>
        <h1 className="login-title">{step === 'phone' ? 'Sign in' : 'Enter your code'}</h1>
        <p className="muted">
          {step === 'phone'
            ? 'Admins sign in with their phone number and a one-time code, like everyone else.'
            : `We sent a 6-digit code to ${sentTo}.`}
        </p>

        {step === 'phone' ? (
          <form onSubmit={requestCode} className="form">
            <label className="field">
              <span className="field-label">Phone number</span>
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setTypedPhone(e.target.value)}
                placeholder="078 123 4567"
                required
              />
            </label>
            {devAdmin ? (
              <p className="hint">
                Dev: prefilled with the seeded admin, <strong>{devAdmin.name}</strong>.
              </p>
            ) : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="form">
            <label className="field">
              <span className="field-label">One-time code</span>
              <input
                className="input input-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                autoFocus
                required
              />
            </label>
            <p className="hint">
              {devHint ?? `Dev mode: the code is always ${DEV_OTP}.`}{' '}
              <button type="button" className="link-btn" onClick={() => setCode(DEV_OTP)}>
                Use {DEV_OTP}
              </button>
            </p>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              Use a different number
            </button>
          </form>
        )}

        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
