import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type AddressLookup = (hostname: string) => Promise<ResolvedAddress[]>;

export interface SafeHttpsEndpoint {
  url: string;
  hostname: string;
  port: number;
  addresses: string[];
}

function unsafe(): never {
  throw new Error('Unsafe provider endpoint.');
}

function parseIpv4(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function ipv4InCidr(value: number, base: number, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function isPublicIpv4(address: string): boolean {
  const value = parseIpv4(address);
  if (value === null) return false;
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
    ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
  ];
  return !blocked.some(([base, prefix]) => ipv4InCidr(value, parseIpv4(base) as number, prefix));
}

function parseIpv6(address: string): bigint | null {
  let source = address.toLowerCase().split('%')[0];
  const embeddedIpv4 = source.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (embeddedIpv4) {
    const ipv4 = parseIpv4(embeddedIpv4);
    if (ipv4 === null) return null;
    source = source.slice(0, -embeddedIpv4.length)
      + `${((ipv4 >>> 16) & 0xffff).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  const halves = source.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.reduce((result, part) => (result << 16n) | BigInt(`0x${part}`), 0n);
}

function ipv6InCidr(value: bigint, base: bigint, prefix: number): boolean {
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (base >> shift);
}

function isPublicIpv6(address: string): boolean {
  const value = parseIpv6(address);
  if (value === null) return false;
  const mappedIpv4Prefix = parseIpv6('::ffff:0:0') as bigint;
  if (ipv6InCidr(value, mappedIpv4Prefix, 96)) {
    return isPublicIpv4([
      Number((value >> 24n) & 255n),
      Number((value >> 16n) & 255n),
      Number((value >> 8n) & 255n),
      Number(value & 255n),
    ].join('.'));
  }
  const blocked: Array<[string, number]> = [
    ['::', 96], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
    ['2001::', 32], ['2001:2::', 48], ['2001:10::', 28], ['2001:db8::', 32],
    ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ];
  return !blocked.some(([base, prefix]) => ipv6InCidr(value, parseIpv6(base) as bigint, prefix));
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

const defaultLookup: AddressLookup = async (hostname) => {
  const result = await dnsLookup(hostname, { all: true, verbatim: true });
  return result.filter((item): item is ResolvedAddress => item.family === 4 || item.family === 6);
};

export async function resolveSafeHttpsEndpoint(
  input: string,
  lookup: AddressLookup = defaultLookup,
): Promise<SafeHttpsEndpoint> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return unsafe();
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.hash
    || !url.hostname
  ) return unsafe();
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return unsafe();
  }
  const port = url.port ? Number(url.port) : 443;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return unsafe();

  let resolved: ResolvedAddress[];
  if (isIP(hostname)) {
    resolved = [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  } else {
    try {
      resolved = await lookup(hostname);
    } catch {
      return unsafe();
    }
  }
  if (
    resolved.length === 0
    || resolved.length > 16
    || resolved.some((item) => item.family !== isIP(item.address) || !isPublicAddress(item.address))
  ) return unsafe();
  const addresses = [...new Set(resolved.map((item) => item.address))];
  return {
    url: url.toString(),
    hostname,
    port,
    addresses,
  };
}
