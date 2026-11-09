import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  token: vi.fn(),
}));

vi.mock('@neondatabase/auth', () => ({
  createAuthClient: () => authMocks,
}));

import { fetchCurrentMember } from '../neon.ts';

describe('Neon API authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({
      data: { session: { id: 'opaque-session-id', token: '' } },
      error: null,
    });
    authMocks.token.mockResolvedValue({ data: { token: 'signed-jwt' }, error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'member-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the token endpoint instead of sending a session ID as bearer token', async () => {
    await fetchCurrentMember();

    expect(authMocks.token).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      { headers: { authorization: 'Bearer signed-jwt' } },
    );
  });

  it('does not send a request when Neon Auth cannot provide a JWT', async () => {
    authMocks.token.mockResolvedValue({ data: null, error: null });

    await expect(fetchCurrentMember()).rejects.toThrow('Could not obtain an access token');
    expect(fetch).not.toHaveBeenCalled();
  });
});
