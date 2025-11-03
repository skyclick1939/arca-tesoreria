import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API Route: PATCH /api/users/[userId]
 *
 * Actualiza datos de un usuario (rol, estado activo)
 *
 * Body:
 * - role?: 'admin' | 'president'
 * - is_active?: boolean
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
      return res.status(403).json({ error: 'Solo administradores pueden actualizar usuarios' });
    }

    // 4. Validar que el admin no se desactive a sí mismo
    if (userId === user.id && req.body.is_active === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    // 5. Validar body
    const { role, is_active } = req.body;

    if (role !== undefined && !['admin', 'president'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser "admin" o "president"' });
    }

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active debe ser un booleano' });
    }

    // 6. Construir objeto de actualización
    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      // Solo updated_at, no hay cambios reales
      return res.status(400).json({ error: 'No se proporcionaron cambios' });
    }

    // 7. Actualizar perfil
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('arca_user_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH /api/users/[userId]] Error al actualizar:', updateError);
      return res.status(500).json({ error: 'Error al actualizar usuario' });
    }

    // 8. Si se desactivó el usuario, invalidar sus sesiones
    if (is_active === false) {
      try {
        await supabaseAdmin.auth.admin.signOut(userId);
        console.log(`[PATCH /api/users/[userId]] Sesión invalidada para usuario ${userId}`);
      } catch (signOutError) {
        console.error('[PATCH /api/users/[userId]] Error al invalidar sesión:', signOutError);
        // No fallar si no se puede invalidar sesión
      }
    }

    return res.status(200).json({
      message: 'Usuario actualizado exitosamente',
      user: updatedProfile,
    });
  } catch (error) {
    console.error('[PATCH /api/users/[userId]] Error inesperado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
