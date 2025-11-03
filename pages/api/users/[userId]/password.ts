import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: PATCH /api/users/[userId]/password
 *
 * Cambia la contraseña de un usuario de forma SEGURA
 *
 * ⚠️ LECCIÓN CRÍTICA (Migración 007):
 * NUNCA modificar directamente auth.users.encrypted_password
 * SIEMPRE usar Supabase Auth API: admin.updateUserById()
 *
 * Body:
 * - password: string (nueva contraseña, mínimo 6 caracteres)
 *
 * Requiere: Usuario autenticado con rol admin
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;

  // Solo PATCH permitido
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  try {
    // 1. Crear cliente de Supabase con service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. Obtener usuario actual desde header de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // 3. Verificar que el usuario es admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('arca_user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar contraseñas' });
    }

    // 4. Validar que el admin no cambie su propia contraseña aquí
    // (debe usar flujo de cambio de contraseña personal)
    if (userId === user.id) {
      return res.status(400).json({
        error: 'No puedes cambiar tu propia contraseña aquí. Usa el flujo de cambio de contraseña personal.'
      });
    }

    // 5. Validar body
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password es requerido' });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // 6. Cambiar contraseña usando Supabase Auth API
    // ✅ FORMA CORRECTA: Usar admin.updateUserById()
    // ❌ NUNCA HACER: UPDATE auth.users SET encrypted_password = ...
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updateError) {
      console.error('[PATCH /api/users/[userId]/password] Error al cambiar contraseña:', updateError);
      return res.status(500).json({ error: 'Error al cambiar contraseña' });
    }

    // 7. Log de auditoría (opcional pero recomendado)
    await supabaseAdmin.from('arca_audit_logs').insert({
      table_name: 'auth.users',
      record_id: userId,
      action: 'PASSWORD_RESET',
      old_values: null,
      new_values: { changed_by_admin: true },
      user_id: user.id, // Admin que hizo el cambio
    });

    console.log(`[PATCH /api/users/[userId]/password] Contraseña cambiada para usuario ${userId} por admin ${user.id}`);

    return res.status(200).json({
      message: 'Contraseña actualizada exitosamente',
      user: {
        id: updatedUser.user?.id,
        email: updatedUser.user?.email,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/users/[userId]/password] Error inesperado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
