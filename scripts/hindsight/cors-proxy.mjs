#!/usr/bin/env node
/**
 * Minimal CORS shim for Hindsight's API, which ships with no CORS support
 * (no middleware, no env var — verified in hindsight-api-slim source).
 * Native React Native has no CORS, so the phone talks to the container
 * directly; browsers (Expo web) need this reverse proxy in front to add
 * Access-Control-Allow-* and answer OPTIONS preflights.
 *
 * Run as a container on the same host as Hindsight (network host mode so
 * 127.0.0.1:8888 resolves to the published Hindsight port):
 *   docker run -d --name hindsight-cors --restart unless-stopped \
 *     --network host -v /opt/hindsight-cors/proxy.mjs:/app/proxy.mjs:ro \
 *     node:22-alpine node /app/proxy.mjs
 */
import http from 'node:http';

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = Number(process.env.HINDSIGHT_TARGET_PORT ?? 8888);
const LISTEN_PORT = Number(process.env.HINDSIGHT_CORS_PORT ?? 8890);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  const proxy = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode, {
        ...upstream.headers,
        ...CORS_HEADERS,
      });
      upstream.pipe(res);
    }
  );
  proxy.on('error', (error) => {
    res.writeHead(502, {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    });
    res.end(JSON.stringify({ detail: `cors-proxy upstream error: ${error.message}` }));
  });
  req.pipe(proxy);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`hindsight cors proxy :${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});
