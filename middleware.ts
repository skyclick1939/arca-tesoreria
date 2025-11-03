import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware de Protección de Rutas - El Arca
 *
 * PATRÓN CORRECTO para Pages Router + Supabase:
 * 1. Validar usuario con getUser() (SEGURO - valida contra servidor)
 * 2. Solo DESPUÉS de validar, verificar permisos de acceso
 * 3. Usar el response modificado con cookies en TODOS los returns
 *
 * SEGURIDAD:
 * - getUser() valida el token contra el servidor Supabase (SEGURO)
 * - getSession() solo lee cookies sin validar (INSEGURO - vulnerable a falsificación)
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Crear UN ÚNICO response que será MODIFICADO (no reemplazado)
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Crear cliente de Supabase que MODIFICA el response externo
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // CORRECTO: Modificar el response externo (no crear uno nuevo)
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // CORRECTO: Modificar el response externo (no crear uno nuevo)
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // 3. SEGURIDAD: Validar usuario contra servidor Supabase
  // getUser() valida en servidor (SEGURO) vs getSession() solo lee cookies (INSEGURO)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Si no hay usuario válido → redirigir a /login
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 5. Usuario autenticado → permitir acceso
  // NOTA CRÍTICA: La protección por rol ahora es client-side via useAuth() hooks
  // Cada dashboard verifica el rol usando AuthProvider que hace su propio fetch
  // Esto elimina la query bloqueante que causaba 3+ min de delay (ver ARQUITECTURA_SIMPLIFICADA.md)

  // SEGURIDAD: Las RLS policies en Supabase garantizan que:
  // - Presidentes solo ven datos de su capítulo
  // - Admins ven todos los datos
  // Por lo tanto, no necesitamos verificar rol en middleware

  return response;
}

/**
 * Configuración de matcher - Define qué rutas ejecutan el middleware
 *
 * Enfoque POSITIVO: Solo especificamos las rutas que queremos proteger.
 * TODO lo demás (/_next/*, /api/*, /login, etc.) NO ejecutará el middleware.
 *
 * Rutas protegidas:
 * - /admin/:path* (todas las rutas admin)
 * - /presidente/:path* (todas las rutas presidente)
 *
 * NOTA: Raíz (/) ya NO está protegida por middleware
 * La redirección se maneja client-side en pages/index.tsx usando useAuth()
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/presidente/:path*',
  ],
};
