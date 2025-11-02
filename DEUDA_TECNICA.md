# DEUDA TÉCNICA - El Arca

**Fecha de Creación**: 30 de Octubre 2025
**Estado**: Documentado

---

## 🔴 CRÍTICO: Creación de Capítulo NO Atómica

### Descripción del Problema

La creación de un capítulo requiere DOS operaciones que no son atómicas:

1. **Operación 1**: Crear usuario en `auth.users` (via `/api/auth/create-president`)
2. **Operación 2**: Crear capítulo en `arca_chapters` (via `ChapterModal.tsx`)

**Riesgo**: Si la Operación 1 tiene éxito pero la Operación 2 falla (error de red, timeout, etc.), se crea un usuario "presidente" huérfano que NO está asociado a ningún capítulo.

### Ubicación del Código

**Archivo**: `components/modals/ChapterModal.tsx`
**Líneas**: 102-142 (función `createMutation`)

```typescript
// PASO 1: Crear usuario en Auth (puede tener éxito)
const authRes = await fetch('/api/auth/create-president', ...);
const { userId } = await authRes.json();

// ⚠️ SI HAY ERROR AQUÍ, usuario ya fue creado pero capítulo NO
// PASO 2: Crear capítulo en DB (puede fallar)
const { data, error } = await supabase
  .from('arca_chapters')
  .insert({...});
```

### Impacto

- **Severidad**: CRÍTICA (datos inconsistentes)
- **Probabilidad**: BAJA en MVP (1 admin, operaciones poco frecuentes)
- **Impacto Real**: Si ocurre, requiere limpieza manual de usuario huérfano

### Por Qué No Se Resolvió Ahora

La solución requiere:
1. Crear nuevo API route `/api/chapters/create-atomic` que:
   - Reciba todos los datos (capítulo + presidente)
   - Cree usuario en auth.users
   - Cree capítulo en arca_chapters
   - Maneje rollback manual si el segundo paso falla
2. Modificar `ChapterModal.tsx` para usar el nuevo endpoint
3. Testing exhaustivo del flujo completo

**Tiempo estimado**: 3-4 horas

### Mitigación Temporal

1. **Logging exhaustivo**: Ambos pasos loguean éxito/fallo
2. **Manejo de errores**: Modal muestra error claro si falla creación de capítulo
3. **Documentación**: Admin puede identificar usuarios huérfanos en Supabase Dashboard

### Solución Propuesta (Futuro)

**Opción A**: Crear API route atómico (recomendado)
```
POST /api/chapters/create-atomic
{
  "chapter": { name, regional, member_count },
  "president": { email, password, full_name }
}
```

**Opción B**: Implementar saga pattern con compensating transactions
- Si falla creación de capítulo → llamar a `/api/auth/delete-president`
- Más complejo pero más robusto

### Referencias

- Auditoría Nivel 2: Detectado por gemini-cli
- Issue: [crear issue en GitHub cuando esté disponible]

---

## ✅ RESUELTO: Race Condition en Eliminación de Capítulos

### Descripción del Problema (RESUELTO)

Había una ventana de tiempo entre verificar deudas y eliminar capítulo donde otro admin podría crear una deuda, causando que se eliminara un capítulo CON deudas activas.

### Solución Implementada

Creada función SQL `delete_chapter_safe()` (migración `010_atomic_operations.sql`) que:
- Usa `FOR UPDATE` lock para prevenir inserciones concurrentes
- Verifica y elimina en la MISMA transacción
- Garantiza atomicidad completa

**Hook actualizado**: `hooks/useChapters.ts` - función `useDeleteChapter()`

**Estado**: ✅ RESUELTO (30 Oct 2025)

---

## 🟡 MEDIO: Query a auth.users sin RLS Policy

### Descripción del Problema

El hook `useChapters()` intenta leer emails de presidentes desde `auth.users`:

```typescript
// hooks/useChapters.ts líneas 59-62
const { data: authUsers, error } = await supabase
  .from('auth.users')
  .select('id, email')
  .in('id', presidentUserIds);
```

**Problema**: Supabase NO permite leer `auth.users` sin políticas especiales. Esta query probablemente falla silenciosamente.

**Impacto**: Los capítulos se muestran SIN emails de presidentes en la UI.

### Solución Propuesta

**Opción A**: Almacenar email en `arca_user_profiles.email` (duplicación controlada)
- Más simple y predecible
- Email se copia al crear perfil

**Opción B**: Crear función SQL con `SECURITY DEFINER` que devuelva emails
- Más compleja pero evita duplicación
- Requiere manejo cuidadoso de permisos

### Estado

⏳ PENDIENTE - Funcionalidad no esencial para MVP

---

## 🟢 BAJO: Rate Limiting Ausente

### Descripción

El endpoint `/api/auth/create-president` no tiene rate limiting.

**Riesgo**: Token de admin comprometido podría crear miles de usuarios, llenando la tabla y incurriendo en costos de Supabase.

### Mitigación Actual

- Acceso limitado a admins (middleware valida rol)
- Bajo volumen esperado (MVP)

### Solución Propuesta

Implementar rate limiting con:
- **Opción A**: Vercel Edge Config + upstash/ratelimit
- **Opción B**: Middleware con Redis
- **Opción C**: Cloudflare rate limiting (si se despliega ahí)

### Estado

⏳ PENDIENTE - No prioritario para MVP

---

## Proceso de Gestión

1. **Documentar**: Agregar nuevas deudas técnicas a este archivo
2. **Priorizar**: Clasificar como Crítico/Medio/Bajo
3. **Planificar**: Estimar tiempo y asignar a sprints futuros
4. **Resolver**: Marcar como ✅ RESUELTO cuando se complete
5. **Archivar**: Mantener histórico de deudas resueltas

---

**Última actualización**: 30 de Octubre 2025
**Próxima revisión**: Al finalizar Sprint 2
