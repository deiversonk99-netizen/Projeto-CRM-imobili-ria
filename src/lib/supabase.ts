import { createClient } from '@supabase/supabase-js';

// A URL e a publishable key identificam o projeto, mas não concedem acesso aos
// dados sem uma sessão válida e sem passar pelas políticas RLS do banco.
const supabaseUrl = String(
  import.meta.env.VITE_SUPABASE_URL || 'https://ybnsrzyelyzbrgqithkh.supabase.co',
).trim();
const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_NcZhbSgmRLg0x_WPklbFkg_w2xYq1A-',
).trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl) || !supabasePublishableKey) {
  throw new Error('Configuração pública do Supabase inválida.');
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort('SUPABASE_TIMEOUT'), 45_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeoutController.signal.aborted) throw new Error('SUPABASE_TIMEOUT');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: '@img-crm:supabase-auth',
  },
  global: {
    headers: { 'X-Client-Info': 'img-imoveis-crm-web' },
    fetch: fetchWithTimeout,
  },
});

export const SUPABASE_URL = supabaseUrl;
