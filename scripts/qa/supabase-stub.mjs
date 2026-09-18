/**
 * QA service-virtualization stub for Supabase (GoTrue + REST).
 *
 * WHY: the Blackrose QA environment points at a Supabase gateway that is
 * unreachable (connection refused on :54321), which blocks every AUTH case and
 * every account-bound write path. This stub speaks enough of the real API —
 * password grant, signup, refresh, user, logout, and REST table calls — for the
 * client's own auth/session code to run for real. It is a test double for the
 * *gateway*, not for the app: no app code knows it exists.
 *
 * Run: node scripts/qa/supabase-stub.mjs [port]   (default 54321)
 * Then start Expo with EXPO_PUBLIC_SUPABASE_URL=http://localhost:<port>
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.argv[2] || process.env.STUB_PORT || 54321);

/** Seed account so AUTH-02/06 (sign in / wrong password) are repeatable. */
const SEED_EMAIL = 'qa@blackrose.test';
const SEED_PASSWORD = 'qa-password-123';

const users = new Map(); // email -> { id, email, password }
const accessTokens = new Map(); // token -> userId
const refreshTokens = new Map(); // token -> userId

function createUser(email, password) {
    const user = { id: randomUUID(), email, password };
    users.set(email.toLowerCase(), user);
    return user;
}

createUser(SEED_EMAIL, SEED_PASSWORD);
/**
 * The real dev account, pinned to the id the app already has data under.
 * Signing in as this email on the stub therefore re-opens the existing journal
 * / memory / settings dataset instead of starting from an empty account, so a
 * QA run can continue past the AUTH suite without re-seeding everything.
 */
const RESTORE_ID = '16cdd861-7cb2-4ce3-92b8-2a6d1f93a26f';
const RESTORE_EMAIL = 'sigmundsarino@gmail.com';
const RESTORE_PASSWORD = 'qa-restore-123';
users.set(RESTORE_EMAIL, { id: RESTORE_ID, email: RESTORE_EMAIL, password: RESTORE_PASSWORD });


function publicUser(user, anonymous = false) {
    return {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: anonymous ? null : user.email,
        is_anonymous: anonymous,
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: { provider: anonymous ? 'anonymous' : 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

/**
 * supabase-js decodes the access token locally (setSession / getSession reject
 * a non-JWT with `Invalid JWT structure`), so the stub must mint JWT-shaped
 * tokens. The signature is never verified client-side — GoTrue verifies it
 * server-side — so a fixed placeholder suffix is enough.
 */
function base64url(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function mintAccessToken(user, expiresAtSeconds) {
    const header = base64url({ alg: 'HS256', typ: 'JWT' });
    const payload = base64url({
        sub: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        iat: Math.floor(Date.now() / 1000),
        exp: expiresAtSeconds,
    });
    // auth-js validates every segment against BASE64URL_REGEX, which only
    // accepts lengths that are 0/2/3 mod 4 — a plain placeholder string can
    // be rejected as 'JWT not in base64url format'.
    const signature = Buffer.from('qa-stub-signature').toString('base64url');
    return `${header}.${payload}.${signature}`;
}

function issueSession(user, anonymous = false) {
    const now = Math.floor(Date.now() / 1000);
    const access = mintAccessToken(user, now + 3600);
    // Deterministic (not random): a random token lives only in this process'
    // memory, so restarting the stub invalidated the client's stored token,
    // the refresh 400'd, the app cleared the active account mid-operation and
    // the demo seed aborted half-written. Restart-safe tokens keep a QA run
    // alive across stub restarts.
    const refresh = `stub-refresh-${user.id}`;
    accessTokens.set(access, user.id);
    refreshTokens.set(refresh, user.id);
    return {
        access_token: access,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: refresh,
        user: publicUser(user, anonymous),
    };
}

/** Read `sub` straight out of the JWT so tokens survive a stub restart. */
function userIdFromAccessToken(token) {
    const parts = String(token).split('.');
    if (parts.length !== 3) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return payload && typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
        return null;
    }
}

function userFromAuth(req) {
    const header = String(req.headers.authorization || '');
    const token = header.replace(/^Bearer\s+/i, '').trim();
    const userId = accessTokens.get(token) ?? userIdFromAccessToken(token);
    if (!userId) return null;
    return Array.from(users.values()).find((u) => u.id === userId) ?? null;
}

function send(res, status, body, extraHeaders = {}) {
    const payload = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
        'Access-Control-Expose-Headers': '*',
        'Content-Type': 'application/json',
        ...extraHeaders,
    });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch {
                resolve({});
            }
        });
    });
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;
    const log = (note) => console.log(`${req.method} ${path}${url.search} -> ${note}`);

    if (req.method === 'OPTIONS') {
        log('204 preflight');
        return send(res, 204, undefined);
    }

    const body = req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT'
        ? await readBody(req)
        : {};

    // ---- GoTrue ----
    if (path === '/auth/v1/health') {
        log('200 health');
        return send(res, 200, { name: 'qa-stub', version: '1.0.0', description: 'QA stub' });
    }
    if (path === '/auth/v1/settings') {
        log('200 settings');
        return send(res, 200, {
            external: {}, disable_signup: false, mailer_autoconfirm: true,
            phone_autoconfirm: true, sms_provider: '',
        });
    }
    if (path === '/auth/v1/signup') {
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!email) {
            const anonymous = { id: randomUUID(), email: `anon-${randomUUID()}`, password: '' };
            users.set(anonymous.email, anonymous);
            log('200 anonymous session');
            return send(res, 200, issueSession(anonymous, true));
        }
        if (users.has(email.toLowerCase())) {
            log('400 user already registered');
            return send(res, 400, {
                code: 'user_already_exists',
                error: 'user_already_exists',
                error_description: 'User already registered',
                msg: 'User already registered',
            });
        }
        const user = createUser(email, password);
        log(`200 signup (${user.id})`);
        return send(res, 200, issueSession(user));
    }
    if (path === '/auth/v1/token') {
        const grant = url.searchParams.get('grant_type');
        if (grant === 'refresh_token') {
            const rawRefresh = String(body.refresh_token || '');
            const userId = refreshTokens.get(rawRefresh)
                || (rawRefresh.startsWith('stub-refresh-') ? rawRefresh.slice('stub-refresh-'.length) : null);
            const user = userId && Array.from(users.values()).find((u) => u.id === userId);
            if (!user) {
                log('400 invalid refresh token');
                return send(res, 400, {
                    code: 'refresh_token_not_found',
                    error: 'invalid_grant',
                    error_description: 'Invalid Refresh Token: Refresh Token Not Found',
                    msg: 'Invalid Refresh Token: Refresh Token Not Found',
                });
            }
            log('200 refreshed');
            return send(res, 200, issueSession(user));
        }
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const user = users.get(email);
        if (!user || user.password !== password) {
            log('400 invalid credentials');
            return send(res, 400, {
                code: 'invalid_credentials',
                error: 'invalid_grant',
                error_description: 'Invalid login credentials',
                msg: 'Invalid login credentials',
            });
        }
        log(`200 password grant (${user.id})`);
        return send(res, 200, issueSession(user));
    }
    if (path === '/auth/v1/user' && req.method === 'PUT') {
        const user = userFromAuth(req);
        if (!user) {
            log('401 no session (PUT)');
            return send(res, 401, {
                code: 'no_authorization',
                error: 'no_authorization',
                error_description: 'Missing or invalid session',
                msg: 'Missing or invalid session',
            });
        }
        if (typeof body.password === 'string' && body.password) {
            user.password = body.password;
        }
        if (body.data && typeof body.data === 'object') {
            Object.assign(user, { metadata: body.data });
        }
        log('200 user updated');
        return send(res, 200, publicUser(user));
    }
    if (path === '/auth/v1/user') {
        const user = userFromAuth(req);
        if (!user) {
            log('401 no session');
            return send(res, 401, {
                code: 'no_authorization',
                error: 'no_authorization',
                error_description: 'Missing or invalid session',
                msg: 'Missing or invalid session',
            });
        }
        log('200 user');
        return send(res, 200, publicUser(user));
    }
    if (path === '/auth/v1/logout') {
        const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        accessTokens.delete(header);
        log('204 logout');
        return send(res, 204, undefined);
    }
    if (path.startsWith('/auth/v1/recover') || path.startsWith('/auth/v1/otp') || path.startsWith('/auth/v1/verify')) {
        log('200 no-op');
        return send(res, 200, {});
    }

    // ---- REST (empty cloud: the app must tolerate zero remote rows) ----
    if (path.startsWith('/rest/v1/')) {
        if (req.method === 'GET' || req.method === 'HEAD') {
            log('200 [] rows');
            return send(res, 200, [], { 'Content-Range': '0-0/0' });
        }
        if (req.method === 'POST') {
            log('201 created');
            return send(res, 201, []);
        }
        log('204 mutated');
        return send(res, 204, undefined);
    }

    if (path.startsWith('/storage/v1/')) {
        log('200 storage stub');
        return send(res, 200, []);
    }

    log('404 unknown');
    return send(res, 404, { message: 'Not found in QA stub' });
});

server.listen(PORT, () => {
    console.log(`QA Supabase stub listening on http://localhost:${PORT}`);
    console.log(`Seed user: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
    console.log(`Data-restoring account: ${RESTORE_EMAIL} / ${RESTORE_PASSWORD}`);
});
