/**
 * Verificar qué usuarios existen actualmente en auth.users
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qjswicjxwsbwnxrrowsi.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc3dpY2p4d3Nid254cnJvd3NpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTc5NTI1NywiZXhwIjoyMDYxMzcxMjU3fQ.11uN6zERY7W9fywo-5Gybj4unqHWZF3GFv6VJ-0cq4Y';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verificarUsuarios() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 VERIFICANDO USUARIOS EN auth.users');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error al listar usuarios:', error.message);
      return;
    }

    console.log(`Total de usuarios: ${users.users.length}\n`);

    users.users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Creado: ${new Date(user.created_at).toLocaleString('es-MX')}`);
      console.log(`   Email confirmado: ${user.email_confirmed_at ? 'Sí' : 'No'}`);

      if (user.email.includes('pres.')) {
        console.log(`   ⚠️  USUARIO CORROMPIDO - DEBE SER ELIMINADO`);
      }
      console.log('');
    });

    const usuariosCorruptos = users.users.filter(u => u.email.includes('pres.'));

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Total usuarios: ${users.users.length}`);
    console.log(`Usuarios corrompidos: ${usuariosCorruptos.length}`);
    console.log('');

    if (usuariosCorruptos.length > 0) {
      console.log('❌ HAY USUARIOS CORROMPIDOS QUE DEBEN SER ELIMINADOS:');
      console.log('');
      usuariosCorruptos.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id})`);
      });
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎯 PASOS SIGUIENTES:');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log('1. Ir a: https://supabase.com/dashboard/project/qjswicjxwsbwnxrrowsi/auth/users');
      console.log('');
      console.log('2. Para CADA usuario de la lista de arriba:');
      console.log('   a) Buscar el email en la tabla');
      console.log('   b) Click en el botón "..." (tres puntos) a la derecha');
      console.log('   c) Seleccionar "Delete user"');
      console.log('   d) Confirmar eliminación');
      console.log('');
      console.log('3. Después de eliminar TODOS los usuarios corrompidos:');
      console.log('   a) Click en "Add user" (botón verde arriba a la derecha)');
      console.log('   b) Email: pres.vallarta@arca.local');
      console.log('   c) Password: pres1234');
      console.log('   d) ✓ Marcar "Auto Confirm User"');
      console.log('   e) Click "Create user"');
      console.log('');
      console.log('4. Probar login en: http://localhost:3001');
      console.log('');
    } else {
      console.log('✅ NO HAY USUARIOS CORROMPIDOS');
      console.log('   El problema puede ser otro.');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

verificarUsuarios()
  .then(() => {
    console.log('✅ Verificación completada\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
