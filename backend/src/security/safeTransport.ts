import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import {
  resolveSafeHttpsEndpoint,
  type AddressLookup,
  type SafeHttpsEndpoint,
} from './safeEndpoint';

export interface SafeTransportHopRequest {
  url: string;
  hostname: string;
  port: number;
  address: string;
  family: 4 | 6;
  method: string;
  headers: Readonly<Record<string, string>>;
  body?: Uint8Array;
  timeoutMs: number;
  maxResponseBytes: number;
}

export interface SafeTransportResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Buffer;
}

export type SafeTransportHopRequester = (
  request: SafeTransportHopRequest,
) => Promise<SafeTransportResponse>;

export interface SafeTransportOptions {
  lookup?: AddressLookup;
  requestHop?: SafeTransportHopRequester;
  method?: string;
  headers?: Readonly<Record<string, string>>;
  body?: Uint8Array;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  maxCrossOriginRedirects?: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') output[key.toLowerCase()] = value;
    else if (Array.isArray(value)) output[key.toLowerCase()] = value.join(', ');
  }
  return output;
}

function requestPinnedHop(request: SafeTransportHopRequest): Promise<SafeTransportResponse> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    const nodeRequest = https.request(request.url, {
      method: request.method,
      headers: request.headers,
      signal: controller.signal,
      agent: false,
      servername: request.hostname,
      lookup: (_hostname, _options, callback) => {
        callback(null, request.address, request.family);
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.byteLength;
        if (size > request.maxResponseBytes) {
          response.destroy(new Error('Safe transport response exceeded its byte limit.'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({
        status: response.statusCode ?? 502,
        headers: normalizeHeaders(response.headers),
        body: Buffer.concat(chunks, size),
      }));
      response.on('error', reject);
    });
    nodeRequest.on('error', reject);
    nodeRequest.on('close', () => clearTimeout(timer));
    if (request.body) nodeRequest.write(request.body);
    nodeRequest.end();
  });
}

function familyOf(address: string): 4 | 6 {
  return address.includes(':') ? 6 : 4;
}

function redirectLocation(response: SafeTransportResponse): string | undefined {
  return response.headers.location;
}

function pinnedRequest(
  endpoint: SafeHttpsEndpoint,
  url: string,
  method: string,
  headers: Readonly<Record<string, string>>,
  body: Uint8Array | undefined,
  timeoutMs: number,
  maxResponseBytes: number,
): SafeTransportHopRequest {
  const address = endpoint.addresses[0];
  return {
    url,
    hostname: endpoint.hostname,
    port: endpoint.port,
    address,
    family: familyOf(address),
    method,
    headers,
    ...(body ? { body } : {}),
    timeoutMs,
    maxResponseBytes,
  };
}

export async function requestSafeHttps(
  input: string,
  options: SafeTransportOptions = {},
): Promise<SafeTransportResponse> {
  const requestHop = options.requestHop ?? requestPinnedHop;
  const maximumRedirects = Math.max(0, Math.min(options.maxRedirects ?? 2, 5));
  const maximumCrossOrigin = Math.max(0, Math.min(options.maxCrossOriginRedirects ?? 0, 1));
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 15_000, 120_000));
  const maximumBytes = Math.max(1, Math.min(options.maxResponseBytes ?? 2 * 1024 * 1024, 8 * 1024 * 1024));
  let currentUrl = new URL(input).toString();
  let method = options.method ?? 'GET';
  let body = options.body;
  let headers = { ...(options.headers ?? {}) };
  let redirects = 0;
  let crossOriginRedirects = 0;

  while (true) {
    const endpoint = await resolveSafeHttpsEndpoint(currentUrl, options.lookup);
    const response = await requestHop(pinnedRequest(
      endpoint, currentUrl, method, headers, body, timeoutMs, maximumBytes,
    ));
    const location = redirectLocation(response);
    if (!REDIRECT_STATUSES.has(response.status) || !location) return response;
    if (redirects >= maximumRedirects) throw new Error('Safe transport redirect limit exceeded.');
    const nextUrl = new URL(location, currentUrl);
    const previousOrigin = new URL(currentUrl).origin;
    if (nextUrl.origin !== previousOrigin) {
      crossOriginRedirects += 1;
      if (crossOriginRedirects > maximumCrossOrigin) {
        throw new Error('Safe transport cross-origin redirect limit exceeded.');
      }
      headers = Object.fromEntries(
        Object.entries(headers).filter(([key]) => !SENSITIVE_HEADERS.has(key.toLowerCase())),
      );
    }
    if (response.status === 303) {
      method = 'GET';
      body = undefined;
    }
    currentUrl = nextUrl.toString();
    redirects += 1;
  }
}
