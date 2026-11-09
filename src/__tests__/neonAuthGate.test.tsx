import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProvider } from '../contexts/UserContext.tsx';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  connectRemote: vi.fn(),
  disconnectRemote: vi.fn(),
  clearLocalData: vi.fn(),
  checkNeonHealth: vi.fn(),
  fetchCurrentMember: vi.fn(),
}));

vi.mock('../db/store.ts', () => ({
  dbStore: {
    subscribe: vi.fn(() => () => {}),
    getSyncStatus: vi.fn(() => 'local'),
    getPendingChangeCount: vi.fn(() => 0),
    connectRemote: mocks.connectRemote,
    disconnectRemote: mocks.disconnectRemote,
    clearLocalData: mocks.clearLocalData,
  },
}));

vi.mock('../neon.ts', () => ({
  checkNeonHealth: mocks.checkNeonHealth,
  fetchCurrentMember: mocks.fetchCurrentMember,
  neonAuthClient: {
    getSession: mocks.getSession,
    signOut: mocks.signOut,
  },
  teamBackend: {},
}));

import { NeonAuthGate, clearCachedOfflineSession } from '../components/NeonAuthGate.tsx';

const cachedMember = {
  id: 'offline-user',
  email: 'operator@example.com',
  name: 'Offline Operator',
  role: 'Dispatcher',
  status: 'active',
  active: true,
} as const;
const memberValidationKey = `kam_fleets_member_validated_at_v1_${encodeURIComponent(cachedMember.id)}`;

describe('NeonAuthGate offline session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    mocks.getSession.mockRejectedValue(new Error('Failed to fetch'));
    mocks.connectRemote.mockResolvedValue(undefined);
    mocks.checkNeonHealth.mockResolvedValue(undefined);
    mocks.fetchCurrentMember.mockResolvedValue(cachedMember);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a cached member after reload when session lookup fails offline', async () => {
    localStorage.setItem('kam_fleets_member_v1_offline-user', JSON.stringify(cachedMember));
    localStorage.setItem(memberValidationKey, String(Date.now()));
    sessionStorage.setItem('kam_fleets_active_member_session_v1', cachedMember.id);

    render(
      <UserProvider>
        <NeonAuthGate>
          <p>Workspace restored</p>
        </NeonAuthGate>
      </UserProvider>,
    );

    expect(await screen.findByText('Workspace restored')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.connectRemote).toHaveBeenCalledWith(
        cachedMember.id,
        expect.any(Object),
        expect.objectContaining({ role: 'Dispatcher' }),
      );
    });
  });

  it('clears cached workspace data after the seven-day offline grace period', async () => {
    localStorage.setItem('kam_fleets_member_v1_offline-user', JSON.stringify(cachedMember));
    localStorage.setItem(memberValidationKey, String(Date.now() - 8 * 24 * 60 * 60 * 1000));
    sessionStorage.setItem('kam_fleets_active_member_session_v1', cachedMember.id);

    render(
      <UserProvider>
        <NeonAuthGate>
          <p>Workspace restored</p>
        </NeonAuthGate>
      </UserProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Offline access expired/i);
    expect(mocks.clearLocalData).toHaveBeenCalledWith(cachedMember.id);
  });

  it('clears the local workspace after online revalidation finds inactive membership', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    mocks.getSession.mockResolvedValue({ data: { user: { id: cachedMember.id } }, error: null });
    mocks.fetchCurrentMember
      .mockResolvedValueOnce(cachedMember)
      .mockResolvedValueOnce({ ...cachedMember, active: false });

    render(
      <UserProvider>
        <NeonAuthGate>
          <p>Workspace restored</p>
        </NeonAuthGate>
      </UserProvider>,
    );

    expect(await screen.findByText('Workspace restored')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(mocks.clearLocalData).toHaveBeenCalledWith(cachedMember.id);
  });

  it('clears the offline marker when there is no active online auth session', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    sessionStorage.setItem('kam_fleets_active_member_session_v1', cachedMember.id);
    mocks.getSession.mockResolvedValue({ data: null, error: null });

    render(
      <UserProvider>
        <NeonAuthGate>
          <p>Workspace restored</p>
        </NeonAuthGate>
      </UserProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Workspace restored')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('kam_fleets_active_member_session_v1')).toBeNull();
  });

  it('clears the offline session marker on sign-out', () => {
    sessionStorage.setItem('kam_fleets_active_member_session_v1', cachedMember.id);

    clearCachedOfflineSession();

    expect(sessionStorage.getItem('kam_fleets_active_member_session_v1')).toBeNull();
  });
});
