import { attachDatabasePool } from '@neon/functions';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Pool, type PoolClient } from 'pg';
import { canRunCommand, isCommandName, type AppRole, type DatabaseSnapshot } from './src/db/domain.ts';
import { getDataVersion, isUuid, loadSnapshot, saveChanges, ServerDomain } from './server/teamData.ts';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
const authBaseUrl = requireEnv('NEON_AUTH_BASE_URL');
const authJwksUrl = requireEnv('NEON_AUTH_JWKS_URL');
const allowedOrigins = new Set(
  (process.env.APP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (allowedOrigins.size === 0) throw new Error('APP_ALLOWED_ORIGINS is required.');

const MAX_BODY_BYTES = 256_000;
const TEAM_LOCK_KEY = 4242;
const LOCK_BYPASS_COMMANDS = new Set(['deleteTrip', 'resetToDefault']);

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
attachDatabasePool(pool);
const jwks = createRemoteJWKSet(new URL(authJwksUrl));

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  active: boolean;
  profilePictureId?: string;
}

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

const jsonResponse = (body: unknown, status: number, headers: Headers | Record<string, string> = {}) => {
  const responseHeaders = new Headers(SECURITY_HEADERS);
  new Headers(headers).forEach((value, key) => responseHeaders.set(key, value));
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
};

function getCorsHeaders(request: Request): Headers | null {
  const origin = request.headers.get('origin');
  if (origin) {
    let localDevelopmentOrigin = false;
    try {
      const parsedOrigin = new URL(origin);
      localDevelopmentOrigin =
        parsedOrigin.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname);
    } catch {
      return null;
    }
    if (!allowedOrigins.has(origin) && !localDevelopmentOrigin) return null;
  }

  const headers = new Headers({
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  });
  if (origin) headers.set('access-control-allow-origin', origin);
  return headers;
}

async function getUserId(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: new URL(authBaseUrl).origin });
    if (typeof payload.sub === 'string' && payload.sub.length > 0) return payload.sub;
  } catch {
    // fall through
  }
  throw new HttpError(401, 'Your session has expired. Sign in again.');
}

const toAppUser = (row: Record<string, unknown>): AppUser => ({
  id: String(row.user_id),
  email: String(row.email),
  name: String(row.full_name || row.email),
  role: row.role === 'Admin' ? 'Admin' : 'Dispatcher',
  active: row.is_active === true,
  profilePictureId: row.profile_picture_id ? String(row.profile_picture_id) : undefined,
});

/** Returns the team member for a verified Neon Auth user, registering new sign-ups as pending dispatchers. */
async function resolveUser(userId: string): Promise<AppUser> {
  const existing = await pool.query('SELECT user_id, email, full_name, role, is_active, profile_picture_id FROM app_users WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return toAppUser(existing.rows[0]);

  const authUser = await pool.query('SELECT email, name FROM neon_auth."user" WHERE id::text = $1', [userId]);
  if (!authUser.rows[0]) throw new HttpError(401, 'Unknown account.');

  // Check if email already exists (user might have been deleted from auth but email remains)
  const emailExisting = await pool.query('SELECT user_id, email, full_name, role, is_active, profile_picture_id FROM app_users WHERE email = $1', [authUser.rows[0].email]);
  if (emailExisting.rows[0]) {
    // Update the existing record with the new user_id
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE app_users SET user_id = $1 WHERE email = $2', [userId, authUser.rows[0].email]);
      await client.query('COMMIT');
      return toAppUser({ ...emailExisting.rows[0], user_id: userId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Assign a random profile picture
  const randomProfilePic = `avatar-${Math.floor(Math.random() * 12) + 1}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [TEAM_LOCK_KEY + 1]);
    const hasAdmin = await client.query(`SELECT 1 FROM app_users WHERE role = 'Admin' AND is_active LIMIT 1`);
    const firstAdmin = hasAdmin.rowCount === 0;
    const inserted = await client.query(
      `INSERT INTO app_users (user_id, email, full_name, role, is_active, profile_picture_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
       RETURNING user_id, email, full_name, role, is_active, profile_picture_id`,
      [userId, authUser.rows[0].email, authUser.rows[0].name || '', firstAdmin ? 'Admin' : 'Dispatcher', true, randomProfilePic],
    );
    await client.query('COMMIT');
    return toAppUser(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function requireActive(user: AppUser) {
  if (!user.active) throw new HttpError(403, 'Your account is waiting for an administrator to approve access.');
}

function requireAdmin(user: AppUser) {
  requireActive(user);
  if (user.role !== 'Admin') throw new HttpError(403, 'Only administrators can do this.');
}

const visibleSnapshot = (snapshot: DatabaseSnapshot, role: AppRole): DatabaseSnapshot =>
  role === 'Admin' ? snapshot : { ...snapshot, invoices: [], payments: [], auditLogs: [] };

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large.');
  try {
    const body: unknown = JSON.parse(bodyText);
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Request body must be a JSON object.');
}

async function withTeamLock<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [TEAM_LOCK_KEY]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getState(user: AppUser, since: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const version = await getDataVersion(client);
    if (since > 0 && version === since) {
      await client.query('COMMIT');
      return { version, snapshot: null };
    }
    const snapshot = await loadSnapshot(client);
    await client.query('COMMIT');
    return { version, snapshot: visibleSnapshot(snapshot, user.role) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runCommand(user: AppUser, body: Record<string, unknown>) {
  requireActive(user);
  const { command, args, ids } = body;
  if (!isCommandName(command)) throw new HttpError(400, 'Unknown command.');
  if (!canRunCommand(user.role, command)) throw new HttpError(403, 'Your role does not allow this change.');
  if (!Array.isArray(args) || args.length > 4) throw new HttpError(400, 'Command arguments are invalid.');
  const suggestedIds = Array.isArray(ids) ? ids.filter(isUuid).slice(0, 200) : [];

  return withTeamLock(async (client) => {
    if (LOCK_BYPASS_COMMANDS.has(command)) await client.query(`SET LOCAL app.bypass_locks = 'on'`);
    const before = await loadSnapshot(client);
    const domain = new ServerDomain(before, user.name, suggestedIds);
    try {
      domain.executeCommand(command, args);
    } catch (error) {
      throw new HttpError(422, error instanceof Error ? error.message : 'The change was rejected.');
    }
    const version = await saveChanges(client, before, domain.getSnapshot(), user.id, user.name);
    const snapshot = await loadSnapshot(client);
    return { version, snapshot: visibleSnapshot(snapshot, user.role) };
  });
}

async function listTeam() {
  const { rows } = await pool.query(
    'SELECT user_id, email, full_name, role, is_active, created_at FROM app_users ORDER BY is_active, created_at',
  );
  return rows.map((row: Record<string, unknown>) => ({ ...toAppUser(row), created_at: (row.created_at as Date).toISOString() }));
}

async function updateTeamMember(admin: AppUser, memberId: string, body: Record<string, unknown>) {
  if (memberId === admin.id) throw new HttpError(400, 'You cannot change your own role or access.');
  const role = body.role;
  const active = body.active;
  if (role !== undefined && role !== 'Admin' && role !== 'Dispatcher') throw new HttpError(400, 'Role must be Admin or Dispatcher.');
  if (active !== undefined && typeof active !== 'boolean') throw new HttpError(400, 'Access must be true or false.');
  return withTeamLock(async (client) => {
    const current = await client.query('SELECT user_id, email, full_name, role, is_active FROM app_users WHERE user_id = $1 FOR UPDATE', [memberId]);
    if (!current.rows[0]) throw new HttpError(404, 'Team member not found.');
    const before = toAppUser(current.rows[0]);
    const updated = await client.query(
      `UPDATE app_users SET role = COALESCE($2::app_role_enum, role), is_active = COALESCE($3, is_active)
       WHERE user_id = $1 RETURNING user_id, email, full_name, role, is_active`,
      [memberId, role ?? null, active ?? null],
    );
    const after = toAppUser(updated.rows[0]);
    const changes = [
      before.role !== after.role ? `role ${before.role} -> ${after.role}` : '',
      before.active !== after.active ? (after.active ? 'approved access' : 'revoked access') : '',
    ].filter(Boolean);
    if (changes.length > 0) {
      await client.query(
        `INSERT INTO audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, summary, details)
         VALUES ($1, $2, 'updated team member', 'team member', $3, $4, $5::jsonb)`,
        [admin.id, admin.name, memberId, `Updated ${after.email}: ${changes.join(', ')}.`, JSON.stringify({ before, after })],
      );
      await client.query('UPDATE app_meta SET data_version = data_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id');
    }
    return after;
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);
    if (!corsHeaders) return jsonResponse({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const route = `${request.method} ${path.replace(/^.*?\/(health|me|state|commands|team)(\/|$)/, '/$1$2')}`;

    try {
      if (request.method === 'GET' && (path === '/' || path.endsWith('/health'))) {
        await pool.query('SELECT 1');
        return jsonResponse({ ok: true, services: ['postgres', 'functions'] }, 200, corsHeaders);
      }

      const knownRoute = /^(GET \/me|PATCH \/me|GET \/state|POST \/commands|GET \/team|PATCH \/team\/[^/]+)$/.test(route);
      if (!knownRoute) return jsonResponse({ error: 'Not found.' }, 404, corsHeaders);

      const user = await resolveUser(await getUserId(request));

      if (route === 'GET /me') return jsonResponse({ user }, 200, corsHeaders);

      if (route === 'PATCH /me') {
        const body = await readJson(request);
        const updates: { full_name?: string; phone_number?: string; profile_picture_id?: string } = {};
        if (typeof body.name === 'string' && body.name) updates.full_name = body.name;
        if (typeof body.phone === 'string' && body.phone) updates.phone_number = body.phone;
        if (typeof body.profilePictureId === 'string' && body.profilePictureId) updates.profile_picture_id = body.profilePictureId;

        const updated = await pool.query(
          `UPDATE app_users
           SET full_name = COALESCE($2, full_name),
               phone_number = COALESCE($3, phone_number),
               profile_picture_id = COALESCE($4, profile_picture_id)
           WHERE user_id = $1
           RETURNING user_id, email, full_name, role, is_active, profile_picture_id`,
          [user.id, updates.full_name, updates.phone_number, updates.profile_picture_id]
        );
        return jsonResponse({ user: toAppUser(updated.rows[0]) }, 200, corsHeaders);
      }

      if (route === 'GET /state') {
        requireActive(user);
        const since = Number(url.searchParams.get('since') || 0);
        return jsonResponse(await getState(user, Number.isSafeInteger(since) ? since : 0), 200, corsHeaders);
      }

      if (route === 'POST /commands') {
        return jsonResponse(await runCommand(user, await readJson(request)), 200, corsHeaders);
      }

      if (route === 'GET /team') {
        requireAdmin(user);
        return jsonResponse({ members: await listTeam() }, 200, corsHeaders);
      }

      requireAdmin(user);
      const memberId = decodeURIComponent(path.split('/').pop() || '');
      return jsonResponse({ member: await updateTeamMember(user, memberId, await readJson(request)) }, 200, corsHeaders);
    } catch (error) {
      if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status, corsHeaders);
      const pgError = error as { code?: string; message?: string };
      if (pgError.code && /^(23|P0001)/.test(pgError.code)) {
        return jsonResponse({ error: `The database rejected this change: ${pgError.message}` }, 409, corsHeaders);
      }
      console.error('Fleet API request failed.', error);
      return jsonResponse({ error: 'The server could not complete the request.' }, 500, corsHeaders);
    }
  },
};
