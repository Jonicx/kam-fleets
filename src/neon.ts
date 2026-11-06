import { createAuthClient } from '@neondatabase/auth';
import type { DatabaseSnapshot } from './db/store.ts';
import type { AppRole } from './db/domain.ts';
import type { AuditLog } from './types/database.ts';

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL;
if (!neonAuthUrl) {
  throw new Error('VITE_NEON_AUTH_URL is not configured.');
}
export const neonAuthClient = createAuthClient(neonAuthUrl);

const functionBaseUrl = import.meta.env.VITE_NEON_FUNCTION_HELLO_BASE_URL;

// --- Type Definitions for Team Management ---
export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role: AppRole;
  status: 'active' | 'invited' | 'suspended';
  active?: boolean;
  createdAt?: string;
  profilePictureId?: string;
}

function getFunctionUrl(path: string) {
  if (!functionBaseUrl) {
    throw new Error('VITE_NEON_FUNCTION_HELLO_BASE_URL is not configured.');
  }
  return new URL(path, `${functionBaseUrl.replace(/\/+$/, '')}/`);
}

async function getAccessToken() {
  // Better Auth uses session-based auth, try to get the session token
  const session = await neonAuthClient.getSession();
  if (session.error) throw new Error(session.error.message);
  if (!session.data?.session) throw new Error('No active session found. Please sign in again.');

  // Try to get an access token from the session
  const sessionData = session.data.session as any;
  if (sessionData.token) return sessionData.token;

  // Fallback: use session ID as the bearer token
  if (sessionData.id) return sessionData.id;

  // Last resort: try the token() method
  const tokenResult = await neonAuthClient.token();
  if (tokenResult.data?.token) return tokenResult.data.token;
  if (tokenResult.error) throw new Error(tokenResult.error.message);

  throw new Error('Could not obtain an access token from the session.');
}

async function getResponseError(response: Response) {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    return `Neon Function returned HTTP ${response.status}.`;
  }
  return `Neon Function returned HTTP ${response.status}.`;
}

export async function checkNeonHealth() {
  const response = await fetch(getFunctionUrl('health'));
  if (!response.ok) throw new Error(await getResponseError(response));
  const result: unknown = await response.json();
  if (
    typeof result !== 'object' ||
    result === null ||
    !('ok' in result) ||
    result.ok !== true
  ) {
    throw new Error('Neon Function returned an invalid health response.');
  }
}

// --- Team Management Backend Implementations ---

function assertState(body: unknown): { version: number; snapshot: DatabaseSnapshot } | null {
  if (typeof body !== 'object' || body === null || !('version' in body) || !('snapshot' in body)) {
    throw new Error('Neon Function returned an invalid state response.');
  }
  const state = body as { version: number; snapshot: DatabaseSnapshot | null };
  if (state.snapshot === null) return null;
  return { version: Number(state.version), snapshot: state.snapshot };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(getFunctionUrl(path), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const message = await getResponseError(response);
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const teamBackend = {
  async getStatus() {
    const token = await getAccessToken();
    const response = await fetch(getFunctionUrl('health'), {
      headers: { 'authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(await getResponseError(response));
    return response.json();
  },

  async loadState(sinceVersion: number = 0): Promise<{ version: number; snapshot: DatabaseSnapshot } | null> {
    return assertState(await apiRequest(`state?since=${encodeURIComponent(String(sinceVersion))}`));
  },

  async sendCommand(record: any): Promise<{ version: number; snapshot: DatabaseSnapshot }> {
    const state = assertState(await apiRequest('commands', { method: 'POST', body: JSON.stringify(record) }));
    if (!state) throw new Error('Neon Function returned an empty state after saving.');
    return state;
  }
};

export async function fetchCurrentMember(): Promise<TeamMember | null> {
  try {
    const token = await getAccessToken();
    const response = await fetch(getFunctionUrl('me'), {
      headers: { 'authorization': `Bearer ${token}` }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await getResponseError(response));

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Failed to fetch current team member:', error);
    return null;
  }
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const token = await getAccessToken();
  const response = await fetch(getFunctionUrl('team'), {
    headers: { 'authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(await getResponseError(response));

  const data = await response.json();
  return Array.isArray(data.members) ? data.members : [];
}

export async function updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<TeamMember> {
  const token = await getAccessToken();
  const response = await fetch(getFunctionUrl(`team/${id}`), {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error(await getResponseError(response));

  const data = await response.json();
  return data.member || { id, ...updates };
}

export async function updateCurrentUser(updates: { name?: string; phone?: string; profilePictureId?: string }): Promise<TeamMember> {
  const token = await getAccessToken();
  const response = await fetch(getFunctionUrl('me'), {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error(await getResponseError(response));

  const data = await response.json();
  return data.user;
}

export async function fetchOlderAuditLogs(cursor: { id: string } | null) {
  const params = new URLSearchParams();
  if (cursor) params.set('beforeId', cursor.id);
  const body: unknown = await apiRequest(`audit?${params.toString()}`);
  if (
    typeof body !== 'object' ||
    body === null ||
    !('logs' in body) ||
    !Array.isArray(body.logs) ||
    !('total' in body) ||
    typeof body.total !== 'number' ||
    !Number.isSafeInteger(body.total) ||
    body.total < 0 ||
    !('hasMore' in body) ||
    typeof body.hasMore !== 'boolean'
  ) {
    throw new Error('Neon Function returned an invalid audit history response.');
  }
  const logs = body.logs as AuditLog[];
  if (logs.some((entry) => typeof entry !== 'object' || entry === null ||
      typeof entry.id !== 'string' || typeof entry.timestamp !== 'string' || typeof entry.summary !== 'string')) {
    throw new Error('Neon Function returned an invalid audit history entry.');
  }
  return { logs, total: body.total, hasMore: body.hasMore };
}
