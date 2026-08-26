export interface AdminRuntimeConfig {
  gatewayUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

declare global {
  interface Window {
    __BLACKROSE_ADMIN_CONFIG__?: Partial<AdminRuntimeConfig>;
  }
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`Missing admin configuration: ${name}`);
  return value.trim();
}

export function readAdminRuntimeConfig(): AdminRuntimeConfig {
  const runtime = typeof window === 'undefined' ? {} : window.__BLACKROSE_ADMIN_CONFIG__ ?? {};
  return {
    gatewayUrl: required(
      runtime.gatewayUrl ?? process.env.EXPO_PUBLIC_AGENT_BASE_URL,
      'gatewayUrl',
    ).replace(/\/+$/, ''),
    supabaseUrl: required(
      runtime.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
      'supabaseUrl',
    ),
    supabaseAnonKey: required(
      runtime.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      'supabaseAnonKey',
    ),
  };
}
