/* Mint local service-role JWT with node crypto (HS256) and create QA user. */
const crypto = require('crypto');

const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = b64u(JSON.stringify({ role: 'service_role', iss: 'supabase-demo', iat: now, exp: now + 3600 }));
const sig = b64u(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
const token = `${header}.${payload}.${sig}`;

(async () => {
  const res = await fetch('http://127.0.0.1:54321/auth/v1/admin/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.QA_EMAIL, password: process.env.QA_PASS, email_confirm: true }),
  });
  console.log(res.status, (await res.text()).slice(0, 300));
})();
