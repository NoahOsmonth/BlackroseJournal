import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { App } from './App';
import { AdminControlPlaneClient } from './services/adminApi';
import { createAdminAuthService } from './services/adminAuth';
import { readAdminRuntimeConfig } from './services/adminConfig';
import './styles.css';

const config = readAdminRuntimeConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const auth = createAdminAuthService(supabase);
const api = new AdminControlPlaneClient({
  baseUrl: config.gatewayUrl,
  getAccessToken: auth.getAccessToken,
});
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Admin root element is missing.');
createRoot(rootElement).render(<React.StrictMode><App auth={auth} client={api} /></React.StrictMode>);
