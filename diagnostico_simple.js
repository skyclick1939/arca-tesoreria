/**
 * Script de Diagnóstico Simplificado - Error 500 en Login de Presidente
 * Sin dependencias externas, solo @supabase/supabase-js
 */

const { createClient } = require('@supabase/supabase-js');

// Credenciales de Supabase (hardcoded para diagnóstico)
const supabaseUrl = 'https://qjswicjxwsbwnxrrowsi.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc3dpY2p4d3Nid254cnJvd3NpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTc5NTI1NywiZXhwIjoyMDYxMzcxMjU3fQ.11uN6zERY7W9fywo-5Gybj4unqHWZF3GFv6VJ-0cq4Y';

// Cliente con SERVICE_ROLE (bypasea RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnosticar() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO: ERROR 500 EN LOGIN DE PRESIDENTE');
  console.log('═══════════════════════════════════════════════════════\n');

  // ============================================
  // 1. VERIFICAR USUARIOS EN auth.users
  // ============================================
  console.log('📋 1. USUARIOS EN auth.users:');
  console.log('─'.repeat(50));

  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error al obtener usuarios:', usersError.message);
    } else {
      console.log(`Total usuarios: ${users.users.length}\n`);

      users.users.forEach((user, index) => {
        console.log(`Usuario #${index + 1}: ${user.email}`);
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Email confirmado: ${user.email_confirmed_at ? 'Sí' : 'No'}`);
        console.log(`   - Creado: ${new Date(user.created_at).toLocaleString('es-MX')}`);
        console.log(`   - Metadata: ${JSON.stringify(user.user_metadata)}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error inesperado en listUsers:', error.message);
  }

  // ============================================
  // 2. VERIFICAR PERFILES EN arca_user_profiles
  // ============================================
  console.log('\n📋 2. PERFILES EN arca_user_profiles:');
  console.log('─'.repeat(50));

  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('arca_user_profiles')
      .select('*')
      .order('role', { ascending: false }); // admin primero

    if (profilesError) {
      console.error('❌ Error al obtener perfiles:', profilesError.message);
      console.error('   Detalles:', JSON.stringify(profilesError, null, 2));
    } else {
      console.log(`Total perfiles: ${profiles.length}\n`);

      profiles.forEach((profile, index) => {
        console.log(`Perfil #${index + 1}: ${profile.full_name} (${profile.role.toUpperCase()})`);
        console.log(`   - user_id: ${profile.user_id}`);
        console.log(`   - created_at: ${new Date(profile.created_at).toLocaleString('es-MX')}`);
        console.log(`   - updated_at: ${new Date(profile.updated_at).toLocaleString('es-MX')}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error inesperado en arca_user_profiles:', error.message);
  }

  // ============================================
  // 3. VERIFICAR USUARIOS SIN PERFIL (ORPHANS)
  // ============================================
  console.log('\n📋 3. USUARIOS SIN PERFIL:');
  console.log('─'.repeat(50));

  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    const { data: profiles, error: profilesError } = await supabase
      .from('arca_user_profiles')
      .select('user_id');

    if (usersError || profilesError) {
      console.error('❌ Error al verificar orphans');
    } else {
      const profileUserIds = new Set(profiles.map(p => p.user_id));
      const orphanUsers = users.users.filter(u => !profileUserIds.has(u.id));

      if (orphanUsers.length === 0) {
        console.log('✅ Todos los usuarios tienen perfil\n');
      } else {
        console.warn(`⚠️  HAY ${orphanUsers.length} USUARIO(S) SIN PERFIL:\n`);
        orphanUsers.forEach(user => {
          console.warn(`   - ${user.email} (ID: ${user.id})`);
        });
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error inesperado en verificación de orphans:', error.message);
  }

  // ============================================
  // 4. VERIFICAR PERFILES HUÉRFANOS (sin usuario)
  // ============================================
  console.log('\n📋 4. PERFILES HUÉRFANOS (sin usuario en auth.users):');
  console.log('─'.repeat(50));

  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    const { data: profiles, error: profilesError } = await supabase
      .from('arca_user_profiles')
      .select('*');

    if (usersError || profilesError) {
      console.error('❌ Error al verificar perfiles huérfanos');
    } else {
      const userIds = new Set(users.users.map(u => u.id));
      const orphanProfiles = profiles.filter(p => !userIds.has(p.user_id));

      if (orphanProfiles.length === 0) {
        console.log('✅ Todos los perfiles tienen usuario válido\n');
      } else {
        console.warn(`⚠️  HAY ${orphanProfiles.length} PERFIL(ES) HUÉRFANO(S):\n`);
        orphanProfiles.forEach(profile => {
          console.warn(`   - ${profile.full_name} (user_id: ${profile.user_id})`);
        });
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error inesperado en verificación de perfiles huérfanos:', error.message);
  }

  // ============================================
  // 5. SIMULAR AUTENTICACIÓN DE ADMIN
  // ============================================
  console.log('\n📋 5. SIMULAR AUTENTICACIÓN DE ADMIN (admin@arca.local):');
  console.log('─'.repeat(50));

  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users.users.find(u => u.email === 'admin@arca.local');

    if (!adminUser) {
      console.warn('⚠️  Usuario admin@arca.local NO EXISTE en auth.users\n');
    } else {
      console.log(`✅ Usuario existe: ${adminUser.id}`);

      // Intentar obtener perfil
      const { data: profile, error: profileError } = await supabase
        .from('arca_user_profiles')
        .select('*')
        .eq('user_id', adminUser.id)
        .single();

      if (profileError) {
        console.error(`❌ ERROR al obtener perfil: ${profileError.message}`);
        console.error(`   SQLSTATE: ${profileError.code}`);
        console.error(`   Detalles: ${JSON.stringify(profileError, null, 2)}`);
      } else if (profile) {
        console.log('✅ Perfil encontrado:');
        console.log(`   - Rol: ${profile.role}`);
        console.log(`   - Nombre: ${profile.full_name}`);
      } else {
        console.warn('⚠️  Perfil NO encontrado (tabla vacía para este user_id)');
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error inesperado en simulación admin:', error.message);
  }

  // ============================================
  // 6. SIMULAR AUTENTICACIÓN DE PRESIDENTE
  // ============================================
  console.log('\n📋 6. SIMULAR AUTENTICACIÓN DE PRESIDENTE (pres.vallarta@arca.local):');
  console.log('─'.repeat(50));

  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    const presUser = users.users.find(u => u.email === 'pres.vallarta@arca.local');

    if (!presUser) {
      console.warn('⚠️  Usuario pres.vallarta@arca.local NO EXISTE en auth.users\n');
    } else {
      console.log(`✅ Usuario existe: ${presUser.id}`);

      // Intentar obtener perfil
      const { data: profile, error: profileError } = await supabase
        .from('arca_user_profiles')
        .select('*')
        .eq('user_id', presUser.id)
        .single();

      if (profileError) {
        console.error(`❌ ERROR al obtener perfil: ${profileError.message}`);
        console.error(`   SQLSTATE: ${profileError.code}`);
        console.error(`   Detalles completos: ${JSON.stringify(profileError, null, 2)}`);
      } else if (profile) {
        console.log('✅ Perfil encontrado:');
        console.log(`   - Rol: ${profile.role}`);
        console.log(`   - Nombre: ${profile.full_name}`);
      } else {
        console.warn('⚠️  Perfil NO encontrado (tabla vacía para este user_id)');
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error inesperado en simulación presidente:', error.message);
  }

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 FIN DEL DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('PRÓXIMOS PASOS:');
  console.log('1. Revisar las secciones marcadas con ⚠️  o ❌');
  console.log('2. Comparar diferencias entre admin (funciona) y presidente (falla)');
  console.log('3. Si hay usuarios sin perfil → crear perfiles');
  console.log('4. Si hay perfiles huérfanos → eliminarlos o corregir user_id');
  console.log('5. Verificar políticas RLS si hay errores de permisos\n');
}

// Ejecutar diagnóstico
diagnosticar()
  .then(() => {
    console.log('✅ Diagnóstico completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal en diagnóstico:', error);
    process.exit(1);
  });
