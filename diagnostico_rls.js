/**
 * Script de Diagnóstico - El Arca
 *
 * Verifica el estado de:
 * 1. Función is_admin()
 * 2. Políticas RLS en arca_user_profiles
 * 3. Usuarios en auth.users
 * 4. Perfiles en arca_user_profiles
 * 5. Estado de RLS
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno desde .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: Archivo .env.local no encontrado');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

const env = loadEnvFile();

// Crear cliente con Service Role Key (bypasea RLS)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno faltantes');
  console.error('   Verifica que .env.local tenga:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnosticar() {
  console.log('\n🔍 DIAGNÓSTICO DE BASE DE DATOS - EL ARCA\n');
  console.log('='.repeat(60));

  // 1. Verificar función is_admin()
  console.log('\n📋 1. VERIFICANDO FUNCIÓN is_admin()...\n');

  const { data: funciones, error: errorFunciones } = await supabase.rpc('sql', {
    query: `
      SELECT
        routine_name,
        routine_type,
        security_type,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'is_admin';
    `
  }).catch(async () => {
    // Si RPC no funciona, usar query directo
    return await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type, security_type')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'is_admin');
  });

  if (errorFunciones) {
    console.log(`   ❌ Error al consultar función: ${errorFunciones.message}`);
  } else if (!funciones || funciones.length === 0) {
    console.log('   ❌ Función is_admin() NO EXISTE');
    console.log('   ⚠️  Migración 007 NO se ejecutó correctamente');
  } else {
    console.log('   ✅ Función is_admin() existe');
    console.log(`   - Tipo: ${funciones[0].routine_type}`);
    console.log(`   - Security: ${funciones[0].security_type}`);
  }

  // 2. Verificar estado de RLS en arca_user_profiles
  console.log('\n📋 2. VERIFICANDO RLS EN arca_user_profiles...\n');

  const { data: rlsStatus, error: errorRLS } = await supabase.rpc('sql', {
    query: `
      SELECT
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = 'arca_user_profiles';
    `
  }).catch(async () => {
    // Query alternativa usando pg_catalog
    return await supabase.rpc('exec_sql', {
      sql: "SELECT relname as tablename, relrowsecurity as rowsecurity FROM pg_class WHERE relname = 'arca_user_profiles'"
    });
  });

  if (errorRLS) {
    console.log(`   ⚠️  No se pudo verificar RLS: ${errorRLS.message}`);
  } else if (rlsStatus && rlsStatus.length > 0) {
    const rls = rlsStatus[0];
    if (rls.rowsecurity) {
      console.log('   ✅ RLS está HABILITADO en arca_user_profiles');
    } else {
      console.log('   ❌ RLS está DESHABILITADO en arca_user_profiles');
    }
  }

  // 3. Listar políticas RLS
  console.log('\n📋 3. VERIFICANDO POLÍTICAS RLS...\n');

  const { data: policies, error: errorPolicies } = await supabase.rpc('sql', {
    query: `
      SELECT
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'arca_user_profiles'
      ORDER BY policyname;
    `
  }).catch(() => ({ data: null, error: { message: 'No se pudo consultar políticas' } }));

  if (errorPolicies) {
    console.log(`   ⚠️  No se pudo consultar políticas: ${errorPolicies.message}`);
  } else if (!policies || policies.length === 0) {
    console.log('   ❌ NO hay políticas RLS en arca_user_profiles');
    console.log('   ⚠️  Migración 007 NO se ejecutó correctamente');
  } else {
    console.log(`   ✅ Se encontraron ${policies.length} políticas:`);
    policies.forEach((p, i) => {
      console.log(`\n   ${i + 1}. ${p.policyname}`);
      console.log(`      - Comando: ${p.cmd}`);
      console.log(`      - USING: ${p.qual || 'N/A'}`);
      console.log(`      - WITH CHECK: ${p.with_check || 'N/A'}`);
    });
  }

  // 4. Verificar usuarios en auth.users
  console.log('\n📋 4. VERIFICANDO USUARIOS EN auth.users...\n');

  const { data: users, error: errorUsers } = await supabase.auth.admin.listUsers();

  if (errorUsers) {
    console.log(`   ❌ Error al listar usuarios: ${errorUsers.message}`);
  } else if (!users || users.users.length === 0) {
    console.log('   ❌ NO hay usuarios en auth.users');
    console.log('   ⚠️  Debes crear usuarios manualmente');
  } else {
    console.log(`   ✅ Se encontraron ${users.users.length} usuario(s):`);
    users.users.forEach((u, i) => {
      console.log(`\n   ${i + 1}. ${u.email}`);
      console.log(`      - ID: ${u.id}`);
      console.log(`      - Confirmado: ${u.email_confirmed_at ? 'Sí' : 'No'}`);
      console.log(`      - Creado: ${new Date(u.created_at).toLocaleString()}`);
    });
  }

  // 5. Verificar perfiles en arca_user_profiles
  console.log('\n📋 5. VERIFICANDO PERFILES EN arca_user_profiles...\n');

  // Usar Service Role para bypassear RLS
  const { data: profiles, error: errorProfiles } = await supabase
    .from('arca_user_profiles')
    .select('user_id, role, full_name, created_at');

  if (errorProfiles) {
    console.log(`   ❌ Error al consultar perfiles: ${errorProfiles.message}`);
    console.log(`   📝 Detalles: ${JSON.stringify(errorProfiles, null, 2)}`);

    // Intentar query más específico
    console.log('\n   🔄 Intentando query directo con auth.users...');

    if (users && users.users.length > 0) {
      for (const user of users.users) {
        const { data: profile, error: profileError } = await supabase
          .from('arca_user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.log(`\n   ❌ Error para ${user.email}:`);
          console.log(`      ${profileError.message}`);
          console.log(`      Code: ${profileError.code}`);
        } else if (!profile) {
          console.log(`\n   ⚠️  ${user.email} NO tiene perfil`);
        } else {
          console.log(`\n   ✅ ${user.email}:`);
          console.log(`      - Rol: ${profile.role}`);
          console.log(`      - Nombre: ${profile.full_name}`);
        }
      }
    }
  } else if (!profiles || profiles.length === 0) {
    console.log('   ❌ NO hay perfiles en arca_user_profiles');
    console.log('   ⚠️  El trigger on_auth_user_created NO funcionó');
  } else {
    console.log(`   ✅ Se encontraron ${profiles.length} perfil(es):`);
    profiles.forEach((p, i) => {
      console.log(`\n   ${i + 1}. Rol: ${p.role}`);
      console.log(`      - Nombre: ${p.full_name}`);
      console.log(`      - User ID: ${p.user_id}`);
      console.log(`      - Creado: ${new Date(p.created_at).toLocaleString()}`);
    });
  }

  // 6. Test específico: Intentar login simulado
  console.log('\n📋 6. TEST DE AUTENTICACIÓN SIMULADA...\n');

  if (users && users.users.length > 0) {
    const testUser = users.users.find(u => u.email === 'admin@arca.local') || users.users[0];
    console.log(`   🧪 Probando con: ${testUser.email}`);

    // Crear cliente con anon key (simula usuario real)
    const supabaseAnon = createClient(
      supabaseUrl,
      supabaseAnonKey || ''
    );

    // Intentar query como usuario autenticado (pero sin login real)
    const { data: testProfile, error: testError } = await supabaseAnon
      .from('arca_user_profiles')
      .select('*')
      .eq('user_id', testUser.id)
      .maybeSingle();

    if (testError) {
      console.log(`\n   ❌ Error al consultar perfil como usuario anónimo:`);
      console.log(`      ${testError.message}`);
      console.log(`      Code: ${testError.code}`);
      console.log(`      Details: ${JSON.stringify(testError.details, null, 2)}`);
      console.log(`      Hint: ${testError.hint}`);

      if (testError.code === '42501') {
        console.log('\n   💡 DIAGNÓSTICO: Error de permisos (42501)');
        console.log('      Esto indica que RLS está bloqueando el acceso');
        console.log('      Las políticas RLS pueden estar mal configuradas');
      } else if (testError.message.includes('infinite recursion')) {
        console.log('\n   💡 DIAGNÓSTICO: Recursión infinita detectada');
        console.log('      Migración 007 NO se ejecutó o falló parcialmente');
      }
    } else {
      console.log(`   ✅ Query exitoso como usuario anónimo`);
      if (testProfile) {
        console.log(`      - Rol: ${testProfile.role}`);
      } else {
        console.log(`      - Perfil no encontrado (pero sin error)`);
      }
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMEN DE DIAGNÓSTICO:\n');

  const problemas = [];

  if (!funciones || funciones.length === 0) {
    problemas.push('❌ Función is_admin() faltante');
  }

  if (!policies || policies.length === 0) {
    problemas.push('❌ Políticas RLS faltantes');
  }

  if (!users || users.users.length === 0) {
    problemas.push('❌ No hay usuarios en auth.users');
  }

  if (errorProfiles) {
    problemas.push(`❌ Error al consultar perfiles: ${errorProfiles.message}`);
  }

  if (problemas.length > 0) {
    console.log('🔴 PROBLEMAS DETECTADOS:\n');
    problemas.forEach(p => console.log(`   ${p}`));

    console.log('\n💡 RECOMENDACIÓN:');
    console.log('   1. Ejecutar migración 007 nuevamente en Supabase SQL Editor');
    console.log('   2. Verificar que NO haya errores en la ejecución');
    console.log('   3. Volver a ejecutar este script de diagnóstico');
  } else {
    console.log('✅ No se detectaron problemas evidentes en la estructura');
    console.log('   El problema puede estar en la autenticación en tiempo real');
    console.log('   Revisa los logs del navegador durante el login');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Ejecutar diagnóstico
diagnosticar()
  .then(() => {
    console.log('✅ Diagnóstico completado\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal durante diagnóstico:');
    console.error(error);
    process.exit(1);
  });
