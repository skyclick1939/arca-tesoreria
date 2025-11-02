# ⚡ EJECUTAR AHORA: Solución al Error de Login

## 🎯 Problema Identificado

**La tabla `arca_user_profiles` está VACÍA** ← Este es el problema

Por eso:
- ❌ admin@arca.local → "Tu cuenta no tiene un perfil asignado"
- ❌ pres.vallarta@arca.local → "Database error querying schema"

---

## ✅ Solución (5 minutos)

### PASO 1: Ejecutar Migración 008 (2 minutos)

1. Abre: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Clic en **SQL Editor** (menú lateral)
4. Copia TODO el contenido de: `008_fix_rls_policies.sql`
5. Pega en SQL Editor
6. Clic en **RUN** (botón verde)

**Verifica que veas**:
```
✅ MIGRACIÓN 008 EJECUTADA EXITOSAMENTE
```

---

### PASO 2: Ejecutar Migración 009 (2 minutos)

1. En el mismo SQL Editor
2. Copia TODO el contenido de: `009_create_missing_profiles.sql`
3. Pega en SQL Editor
4. Clic en **RUN**

**Verifica que veas**:
```
✅ MIGRACIÓN 009 EJECUTADA EXITOSAMENTE

   ✅ Perfil creado para: admin@arca.local (rol: admin)
   ✅ Perfil creado para: pres.vallarta@arca.local (rol: president)
   ...

Estado de la base de datos:
   - Usuarios en auth.users: 6
   - Perfiles en arca_user_profiles: 6  ← ESTO ES LO IMPORTANTE
```

---

### PASO 3: Probar Login (1 minuto)

1. Abre: http://localhost:3000
2. Ingresa:
   - Email: `admin@arca.local`
   - Password: `admin123`
3. Haz clic en **Iniciar Sesión**

**Resultado esperado**: ✅ Redirige a `/admin/dashboard`

Si ves el dashboard de admin → **¡FUNCIONÓ!** 🎉

---

## 🐛 Si Algo Falla

### Opción 1: Script de Diagnóstico

En tu terminal:

```bash
cd C:\Users\USUARIO\Downloads\desarrollos externos\arca-app
node diagnostico_simple.js
```

Busca la sección **📋 4. TEST CON LOGIN REAL**

**Debe decir**:
```
✅ Login exitoso
✅ Perfil obtenido exitosamente:
   - Rol: admin
```

---

### Opción 2: Verificar Manualmente en Supabase

1. Ve a Supabase Dashboard
2. Clic en **Table Editor** (menú lateral)
3. Selecciona tabla: `arca_user_profiles`

**Debe tener 6 registros**:
- 1 con `role = 'admin'`
- 5 con `role = 'president'`

Si la tabla está vacía → La migración 009 NO se ejecutó correctamente.

---

## 📞 Checklist de Validación

- [ ] ✅ Migración 008 ejecutada (mensaje de éxito)
- [ ] ✅ Migración 009 ejecutada (mensaje de éxito)
- [ ] ✅ Tabla `arca_user_profiles` tiene 6 registros
- [ ] ✅ Login con admin@arca.local funciona
- [ ] ✅ Redirige a `/admin/dashboard`
- [ ] ✅ No hay errores en consola del navegador

---

**Si todos los pasos están ✅ → El sistema está OPERATIVO** 🎉

---

**Tiempo total**: ~5 minutos
**Dificultad**: Baja (solo copiar/pegar)
**Resultado**: Sistema de login completamente funcional
