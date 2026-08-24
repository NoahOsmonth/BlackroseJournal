import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import https from 'node:https';
import { resolveSafeHttpsEndpoint } from '../../security/safeEndpoint';

export interface SafeProviderTransportInput {
  url: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
  signal: AbortSignal;
  maxResponseBytes: number;
}

export class SafeProviderTransportError extends Error {
  constructor(public readonly reason: 'response_too_large') {
    super('Pinned provider transport failed.');
    this.name = 'SafeProviderTransportError';
  }
}

const normalizedHeaders = (headers: IncomingHttpHeaders): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') result[name] = value;
    else if (Array.isArray(value)) result[name] = value.join(', ');
  }
  return result;
};

const familyOf = (address: string): 4 | 6 => address.includes(':') ? 6 : 4;

const responseBody = (
  source: IncomingMessage,
  maximumBytes: number,
): ReadableStream<Uint8Array> => {
  let received = 0;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      source.on('data', (chunk: Buffer) => {
        received += chunk.byteLength;
        if (received > maximumBytes) {
          source.destroy(new SafeProviderTransportError('response_too_large'));
          return;
        }
        controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize ?? 1) <= 0) source.pause();
      });
      source.on('end', () => controller.close());
      source.on('error', (error) => controller.error(error));
    },
    pull() {
      source.resume();
    },
    cancel() {
      source.destroy();
    },
  });
};

export const requestSafeProviderStream = async (
  input: SafeProviderTransportInput,
): Promise<Response> => {
  const endpoint = await resolveSafeHttpsEndpoint(input.url);
  const address = endpoint.addresses[0];
  return new Promise<Response>((resolve, reject) => {
    const request = https.request(endpoint.url, {
      method: input.method,
      headers: input.headers,
      signal: input.signal,
      agent: false,
      servername: endpoint.hostname,
      lookup: (_hostname, _options, callback) => {
        callback(null, address, familyOf(address));
      },
    }, (response) => {
      const status = response.statusCode ?? 502;
      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > input.maxResponseBytes) {
        const error = new SafeProviderTransportError('response_too_large');
        response.destroy(error);
        reject(error);
        return;
      }
      resolve(new Response(responseBody(response, input.maxResponseBytes), {
        status,
        headers: normalizedHeaders(response.headers),
      }));
    });
    request.on('error', reject);
    request.write(input.body);
    request.end();
  });
};
