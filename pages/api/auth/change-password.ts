import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validatePasswordStrength } from '@/lib/validation/password';

/**
 * API Route: POST /api/auth/change-password
 *
 * Permite a un usuario cambiar su PROPIA contraseña y actualizar su nombre
 *
 * 🔐 SEGURIDAD CRÍTICA:
 * - Verifica identidad pidiendo contraseña ACTUAL (previene session hijacking)
 * - Validación estricta: 8 chars + mayúscula + minúscula + especial
 * - Solo el usuario puede cambiar su propia contraseña (no admins)
 * - Audit trail completo
 *
 * Body:
 * - currentPassword: string (contraseña actual para verificar identidad)
 * - newPassword: string (nueva contraseña, debe cumplir política de fortaleza)
 * - fullName: string (opcional, actualiza nombre en perfil)
 *
 * Flujo de Seguridad:
 * 1. Verificar usuario autenticado (token)
 * 2. Verificar currentPassword con signInWithPassword() // 🚨 Anti session hijacking
 * 3. Validar newPassword (8 chars + complejidad)
 * 4. Actualizar password con admin.updateUserById()
 * 5. Actualizar perfil (fullName + password_changed_at + must_change_password=false)
 * 6. Audit log
 * 7. Retornar éxito (mantiene sesión activa)
 *
 * Requiere: Usuario autenticado (cualquier rol)
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Crear cliente de Supabase con service role (para admin.updateUserById)
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

    // 3. Validar body
    const { currentPassword, newPassword, fullName } = req.body;

    // 🔄 CAMBIO: Validación condicional - solo requerir contraseñas si se está cambiando la contraseña
    const isChangingPassword = newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0;

    if (isChangingPassword) {
      // Si el usuario quiere cambiar contraseña, DEBE proporcionar la actual
      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'currentPassword es requerido para cambiar la contraseña' });
      }

      // 4. 🚨 CRÍTICO: Verificar identidad con contraseña actual
      // Esto previene session hijacking - un atacante con cookie robada NO puede cambiar contraseña
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      // 5. Validar fortaleza de nueva contraseña
      const passwordValidation = validatePasswordStrength(newPassword);

      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'La nueva contraseña no cumple con los requisitos de seguridad',
          details: passwordValidation.errors,
        });
      }

      // 6. Verificar que la nueva contraseña sea DIFERENTE a la actual
      if (currentPassword === newPassword) {
        return res.status(400).json({
          error: 'La nueva contraseña debe ser diferente a la actual',
        });
      }

      // 7. Actualizar contraseña usando Supabase Auth API
      // ✅ FORMA CORRECTA: Usar admin.updateUserById()
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updatePasswordError) {
        console.error('[POST /api/auth/change-password] Error al cambiar contraseña:', updatePasswordError);
        return res.status(500).json({ error: 'Error al actualizar contraseña' });
      }
    }

    // 8. Actualizar perfil (fullName + password_changed_at + must_change_password)
    const profileUpdates: any = {};

    // Solo actualizar campos de contraseña si realmente se cambió
    if (isChangingPassword) {
      profileUpdates.password_changed_at = new Date().toISOString();
      profileUpdates.must_change_password = false; // Ya cambió la contraseña, desactivar flag
    }

    // Actualizar nombre si se proporcionó
    if (fullName && typeof fullName === 'string' && fullName.trim().length > 0) {
      profileUpdates.full_name = fullName.trim();
    }

    // Validar que hay algo que actualizar
    if (Object.keys(profileUpdates).length === 0) {
      return res.status(400).json({ error: 'No hay cambios para aplicar' });
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from('arca_user_profiles')
      .update(profileUpdates)
      .eq('user_id', user.id);

    if (updateProfileError) {
      console.error('[POST /api/auth/change-password] Error al actualizar perfil:', updateProfileError);
      // No retornamos error aquí - la contraseña ya se cambió, que es lo crítico
    }

    // 9. Log de auditoría
    await supabaseAdmin.from('arca_audit_logs').insert({
      table_name: isChangingPassword ? 'auth.users' : 'arca_user_profiles',
      record_id: user.id,
      action: isChangingPassword ? 'PASSWORD_SELF_CHANGE' : 'PROFILE_UPDATE',
      old_values: null,
      new_values: {
        password_changed: isChangingPassword,
        full_name_updated: !!fullName,
      },
      user_id: user.id,
    });

    const logMessage = isChangingPassword
      ? `[POST /api/auth/change-password] Contraseña cambiada exitosamente por usuario ${user.id}`
      : `[POST /api/auth/change-password] Perfil actualizado por usuario ${user.id}`;
    console.log(logMessage);

    // 10. Retornar éxito
    // Nota: NO forzamos logout - mantiene sesión activa para UX fluido
    const successMessage = isChangingPassword
      ? 'Contraseña y perfil actualizados exitosamente'
      : 'Perfil actualizado exitosamente';

    return res.status(200).json({
      message: successMessage,
      user: {
        id: user.id,
        email: user.email,
        fullName: fullName || null,
      },
    });
  } catch (error) {
    console.error('[POST /api/auth/change-password] Error inesperado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
