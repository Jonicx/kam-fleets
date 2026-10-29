import React, { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { dbStore } from '../db/store.ts';
import { checkNeonHealth, fetchCurrentMember, neonAuthClient, teamBackend, type TeamMember } from '../neon.ts';
import { useUser } from "../contexts/UserContext";
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Wifi, WifiOff } from 'lucide-react';

interface NeonAuthGateProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  onOpenProfile?: () => void;
}

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm';

const SYNC_LABELS = {
  local: { text: 'Local only', className: 'bg-slate-100 text-slate-600' },
  synced: { text: 'Saved to Neon', className: 'bg-emerald-50 text-emerald-700' },
  syncing: { text: 'Saving...', className: 'bg-amber-50 text-amber-700' },
  offline: { text: 'Offline - retrying', className: 'bg-rose-50 text-rose-700' },
} as const;

const useSyncState = () =>
  useSyncExternalStore(
    (callback) => dbStore.subscribe(callback),
    () => `${dbStore.getSyncStatus()}|${dbStore.getPendingChangeCount()}`,
  );

const memberCacheKey = (userId: string) => `kam_fleets_member_v1_${encodeURIComponent(userId)}`;
const legacyMemberCacheKey = (userId: string) => `jcq_fleet_member_v1_${encodeURIComponent(userId)}`;

const readCachedMember = (userId: string): TeamMember | null => {
  try {
    const stored = localStorage.getItem(memberCacheKey(userId)) ??
      localStorage.getItem(legacyMemberCacheKey(userId));
    if (!stored) return null;

    const member: unknown = JSON.parse(stored);
    if (
      typeof member !== 'object' ||
      member === null ||
      !('id' in member) ||
      member.id !== userId ||
      !('email' in member) ||
      typeof member.email !== 'string' ||
      !('role' in member) ||
      (member.role !== 'Admin' && member.role !== 'Dispatcher') ||
      !('active' in member) ||
      member.active !== true
    ) {
      return null;
    }

    return member as TeamMember;
  } catch (cacheError) {
    console.warn('Failed to restore the cached workspace profile:', cacheError);
    return null;
  }
};

const cacheMember = (member: TeamMember) => {
  try {
    localStorage.setItem(memberCacheKey(member.id), JSON.stringify(member));
  } catch (cacheError) {
    console.warn('Failed to cache the workspace profile for offline use:', cacheError);
  }
};

export const NeonAuthGate: React.FC<NeonAuthGateProps> = ({ children, onSignOut, onOpenProfile }) => {
  const { setUserInfo } = useUser();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [pendingMember, setPendingMember] = useState<TeamMember | null>(null);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncState = useSyncState();
  const [syncStatus, pendingCount] = syncState.split('|') as [keyof typeof SYNC_LABELS, string];
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  const activateCachedMember = async (userId: string) => {
    const cachedMember = readCachedMember(userId);
    if (!cachedMember) {
      setError('Your saved workspace profile is unavailable offline. Reconnect to restore your account.');
      return false;
    }

    await dbStore.connectRemote(cachedMember.id, teamBackend, {
      role: cachedMember.role,
      actorName: cachedMember.name || cachedMember.email,
      onError: (saveMessage) => setRemoteError(saveMessage),
    });
    setPendingMember(null);
    setMember(cachedMember);
    setUserInfo({
      userName: cachedMember.name || cachedMember.email,
      userEmail: cachedMember.email,
      userRole: cachedMember.role,
      profilePictureId: cachedMember.profilePictureId,
    });
    return true;
  };

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activateUser = async () => {
    setIsLoading(true);
    setError('');
    try {
      const sessionResult = await neonAuthClient.getSession();
      const sessionUser = sessionResult.data?.user;

      if (!navigator.onLine) {
        if (sessionUser) {
          await activateCachedMember(sessionUser.id);
          return;
        }
        setError('You are offline and there is no saved workspace session available.');
        return;
      }

      await checkNeonHealth();
      const current = await fetchCurrentMember();

      // Null-safety Check: Halts processing safely if workspace membership info record is completely missing
      if (!current) {
        throw new Error('Your user profile account record could not be loaded from the team roster table.');
      }

      if (!current.active) {
        setPendingMember(current);
        return;
      }
      cacheMember(current);
      await dbStore.connectRemote(current.id, teamBackend, {
        role: current.role,
        actorName: current.name || current.email,
        onError: (saveMessage) => setRemoteError(saveMessage),
      });
      setPendingMember(null);
      setMember(current);
      setUserInfo({
        userName: current.name || current.email,
        userEmail: current.email,
        userRole: current.role,
        profilePictureId: current.profilePictureId,
      });
    } catch (activationError) {
      // Handle offline/network errors gracefully
      if (activationError instanceof Error && /fetch|network|ERR_INTERNET_DISCONNECTED|failed to fetch|Service Unavailable/i.test(activationError.message)) {
        const sessionResult = await neonAuthClient.getSession();
        const sessionUser = sessionResult.data?.user;
        if (sessionUser) {
          if (await activateCachedMember(sessionUser.id)) return;
        } else {
          setError('Unable to connect. Please check your internet connection and try again.');
        }
      } else {
        setError(activationError instanceof Error ? activationError.message : 'Could not connect to Neon.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    neonAuthClient.getSession()
      .then(async ({ data, error: sessionError }) => {
        if (sessionError) throw new Error(sessionError.message);
        if (cancelled) return;
        if (data?.user) await activateUser();
        else setIsLoading(false);
      })
      .catch((sessionError: unknown) => {
        if (!cancelled) {
          setError(sessionError instanceof Error ? sessionError.message : 'Could not restore the Neon Auth session.');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
      dbStore.disconnectRemote();
    };
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'forgot') {
        const result = await neonAuthClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' });
        if (result.error) throw new Error(result.error.message);
        setMode('reset');
        setMessage('If that email has an account, a reset code is on its way. Enter it below with your new password.');
        return;
      }
      if (mode === 'reset') {
        const result = await neonAuthClient.emailOtp.resetPassword({ email, otp: otp.trim(), password });
        if (result.error) throw new Error(result.error.message);
        setMode('sign-in');
        setPassword('');
        setOtp('');
        setMessage('Password updated. Sign in with your new password.');
        return;
      }
      if (mode === 'sign-up') {
        const result = await neonAuthClient.signUp.email({ email, password, name: name.trim() });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await neonAuthClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      }

      const result = await neonAuthClient.getSession();
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.user) {
        setMessage('Account created. Verify your email if prompted, then sign in.');
        setMode('sign-in');
        return;
      }
      await activateUser();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = useCallback(async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await neonAuthClient.signOut();
      if (result.error) throw new Error(result.error.message);
      dbStore.disconnectRemote();
      setMember(null);
      setPendingMember(null);
      setRemoteError('');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p role="status" className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          In a min Twizzy...
        </p>
      </main>
    );
  }

  if (pendingMember) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">KAM Fleets</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Waiting for approval</h1>
          <p className="mt-2 text-sm text-slate-600">
            <strong className="text-slate-900">{pendingMember.email}</strong> is signed in, but an administrator needs to approve
            this account before it can see the team's fleet data.
          </p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void activateUser()}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Check again
            </button>
            <button
              type="button"
              onClick={signOut}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!member) {
    const titles: Record<AuthMode, string> = {
      'sign-in': 'Sign in to your workspace',
      'sign-up': 'Create your workspace account',
      forgot: 'Reset your password',
      reset: 'Choose a new password',
    };
    const submitLabels: Record<AuthMode, string> = {
      'sign-in': 'Sign in',
      'sign-up': 'Create account',
      forgot: 'Send reset code',
      reset: 'Update password',
    };
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">KAM Fleets</p>
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-rose-600" />
                )}
                <span className="text-[10px] font-semibold text-slate-600">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{titles[mode]}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {mode === 'sign-up'
                ? 'New accounts can see team data once an administrator approves them.'
                : 'Your team shares one fleet workspace, secured with Neon Auth and saved to Neon Postgres.'}
            </p>
            {!isOnline && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800">
                  You're offline. Some features may not be available until you reconnect.
                </p>
              </div>
            )}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'sign-up' && (
              <label className="block text-xs font-semibold text-slate-700">
                Name
                <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-700">
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            {mode === 'reset' && (
              <label className="block text-xs font-semibold text-slate-700">
                Reset code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"

                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className={inputClass}
                />
              </label>
            )}
            {mode !== 'forgot' && (
              <label className="block text-xs font-semibold text-slate-700">
                {mode === 'reset' ? 'New password' : 'Password'}
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </label>
            )}
            {mode === 'sign-in' && (
              <div className="-mt-2 text-right">
                <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-amber-700 hover:text-amber-900">
                  Forgot password?
                </button>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</p>}
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={promptInstall}
                className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-amber-400 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Install App
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Please wait...' : submitLabels[mode]}
            </button>
          </form>
          <button
            type="button"
            onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-4 w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {mode === 'sign-in' ? 'New to KAM Fleets? Create an account' : 'Back to sign in'}
          </button>
        </section>
      </main>
    );
  }

  const sync = SYNC_LABELS[syncStatus] ?? SYNC_LABELS.local;
  const pending = Number(pendingCount);

  return (
    <>
      {(!isOnline || syncStatus === 'offline' || pending > 0) && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-xs font-semibold ${sync.className}`}
        >
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>
            {!isOnline || syncStatus === 'offline'
              ? 'Offline mode: showing saved fleet data.'
              : sync.text}
          </span>
          {pending > 0 && (
            <span>
              {pending} unsynced {pending === 1 ? 'change is' : 'changes are'} saved on this device and will sync when Neon is reachable.
            </span>
          )}
        </div>
      )}
      {remoteError && (
        <div role="alert" className="flex items-center justify-center gap-3 bg-rose-100 px-4 py-2 text-center text-xs font-semibold text-rose-800">
          <span>{remoteError}</span>
          <button type="button" onClick={() => setRemoteError('')} className="rounded px-1.5 font-bold hover:bg-rose-200" aria-label="Dismiss">
            x
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="bg-rose-100 px-4 py-2 text-center text-xs font-semibold text-rose-800">
          {error}
        </p>
      )}
      {children}
    </>
  );
};
