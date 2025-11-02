import { createBrowserClient } from '@supabase/ssr';

// Variables de entorno - estas deben estar en .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Verifica que .env.local contenga:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=tu-url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key'
  );
}

/**
 * Cliente singleton de Supabase para el navegador
 *
 * IMPORTANTE: Usar createBrowserClient de @supabase/ssr en lugar de createClient
 * de @supabase/supabase-js para garantizar sincronización correcta de cookies
 * con el middleware de Next.js.
 *
 * createBrowserClient:
 * - Sincroniza automáticamente sesión entre localStorage y cookies
 * - Compatible con middleware de Next.js (createServerClient)
 * - Garantiza que el middleware siempre tenga acceso a la sesión actual
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
