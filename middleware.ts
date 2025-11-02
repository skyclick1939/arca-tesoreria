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

  // 5. Obtener perfil del usuario
  const { data: profile, error: profileError } = await supabase
    .from('arca_user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  // 6. Si no existe perfil → error crítico
  if (profileError || !profile) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', 'no_profile');
    return NextResponse.redirect(redirectUrl);
  }

  const userRole = profile.role;

  // 7. Protección de rutas según rol

  // 7a. Bloquear /admin/* para presidentes
  if (pathname.startsWith('/admin') && userRole === 'president') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/presidente/dashboard';
    redirectUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(redirectUrl);
  }

  // 7b. Bloquear /presidente/* para administradores
  if (pathname.startsWith('/presidente') && userRole === 'admin') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/admin/dashboard';
    redirectUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(redirectUrl);
  }

  // 8. Redirigir desde raíz (/) al dashboard según rol
  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname =
      userRole === 'admin' ? '/admin/dashboard' : '/presidente/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // 9. Permitir acceso (sesión válida + rol correcto)
  // IMPORTANTE: Retornar response con cookies actualizadas
  return response;
}

/**
 * Configuración de matcher - Define qué rutas ejecutan el middleware
 *
 * Enfoque POSITIVO: Solo especificamos las rutas que queremos proteger.
 * TODO lo demás (/_next/*, /api/*, /login, etc.) NO ejecutará el middleware.
 *
 * Rutas protegidas:
 * - / (raíz para redirección según rol)
 * - /admin/:path* (todas las rutas admin)
 * - /presidente/:path* (todas las rutas presidente)
 */
export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/presidente/:path*',
  ],
};
