# ⚡ INSTRUCCIONES RÁPIDAS: Ejecutar Migración 008

## 🎯 Objetivo
Solucionar el error **"Database error querying schema"** que impide el login.

## ⏱️ Tiempo estimado
2 minutos

---

## 📋 PASOS (SOLO 3)

### 1. Abrir Supabase SQL Editor (30 segundos)

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto **El Arca**
3. Clic en **SQL Editor** (menú lateral izquierdo)

---

### 2. Ejecutar Migración 008 (1 minuto)

1. Abre el archivo: `database/migrations/008_fix_rls_policies.sql`
2. Selecciona **TODO** el contenido (Ctrl+A)
3. Copia (Ctrl+C)
4. Pégalo en el SQL Editor de Supabase (Ctrl+V)
5. Clic en **RUN** (botón verde, esquina inferior derecha)

---

### 3. Verificar Salida (30 segundos)

Deberías ver esto al final:

```
✅ ===============================================
✅ MIGRACIÓN 008 EJECUTADA EXITOSAMENTE
✅ ===============================================

Estado de la base de datos:
   - RLS habilitado: true
   - Políticas activas: 3 (esperadas: 3)
   - Función is_admin(): Existe
   - Perfiles totales: X
   - Admins: X

🔑 Credenciales de prueba:
   - Admin: admin@arca.local / admin123
   - Presidente: pres.vallarta@arca.local / pres1234

🧪 Próximo paso: Probar login en http://localhost:3000
```

Si ves **✅ MIGRACIÓN 008 EJECUTADA EXITOSAMENTE** → **¡LISTO!**

---

## 🧪 PROBAR QUE FUNCIONA

### Opción 1: Script de Diagnóstico (Recomendado)

En tu terminal:

```bash
cd C:\Users\USUARIO\Downloads\desarrollos externos\arca-app
node diagnostico_simple.js
```

**Resultado esperado**:

```
📋 4. TEST CON LOGIN REAL (admin@arca.local)...

   ✅ Login exitoso
   ✅ Perfil obtenido exitosamente:
      - Rol: admin
```

### Opción 2: Probar en la aplicación

1. Asegúrate de que el servidor esté corriendo:
   ```bash
   npm run dev
   ```

2. Abre http://localhost:3000

3. Ingresa:
   - Email: `admin@arca.local`
   - Password: `admin123`

4. **Resultado esperado**: Redirige a `/admin/dashboard` ✅

---

## 🐛 Troubleshooting

### Error: "relation already exists" o "policy already exists"

**Solución**: La migración 008 es **idempotente**. Puedes ejecutarla múltiples veces sin problema. Usa `DROP POLICY IF EXISTS`.

---

### El login sigue fallando después de la migración

**Diagnóstico**:

1. Ejecuta el script de diagnóstico:
   ```bash
   node diagnostico_simple.js
   ```

2. Busca la sección **📋 4. TEST CON LOGIN REAL**

3. Si ves **❌ Error al obtener perfil**:
   - Verifica que la salida de la migración 008 haya mostrado **✅ MIGRACIÓN 008 EJECUTADA EXITOSAMENTE**
   - Verifica que diga **Políticas activas: 3**

4. Si el problema persiste, contacta al arquitecto con la salida completa del script de diagnóstico.

---

### No veo ninguna salida al ejecutar la migración

**Causa**: Los mensajes `RAISE NOTICE` a veces no se muestran en el SQL Editor.

**Solución**:

Ejecuta esto para verificar manualmente:

```sql
-- Verificar políticas
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'arca_user_profiles'
ORDER BY policyname;
```

**Resultado esperado**: 3 políticas

```
policyname                 | cmd
---------------------------|------
Admins manage profiles     | ALL
Admins view all profiles   | SELECT
Users view own profile     | SELECT
```

---

## ✅ Checklist de Validación

- [ ] ✅ Migración 008 ejecutada sin errores
- [ ] ✅ Salida muestra "MIGRACIÓN 008 EJECUTADA EXITOSAMENTE"
- [ ] ✅ Script de diagnóstico muestra "Perfil obtenido exitosamente"
- [ ] ✅ Login en aplicación redirige correctamente
- [ ] ✅ No hay errores en la consola del navegador

---

**Si todos los pasos anteriores están ✅ → El sistema está OPERATIVO** 🎉

---

**Fecha**: 23 de Octubre de 2025
**Autor**: Claude Code (Ingeniero Líder de IA)
