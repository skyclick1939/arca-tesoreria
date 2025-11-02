# OPTIMIZACIONES SPRINT 1 - PLAN DE EJECUCIÓN

**Fecha**: 2025-10-30
**Objetivo**: Aplicar optimizaciones de performance y mantenibilidad detectadas en auditoría
**Prioridad**: MEDIA (sistema funcional, mejoras no críticas)

---

## 📋 ESTADO INICIAL (RESPALDO)

### Archivos que serán modificados:
1. `pages/api/auth/create-president.ts` (237 líneas)
2. `hooks/useChapters.ts` (296 líneas)
3. `lib/utils.ts` (NUEVO - será creado)
4. `components/modals/ChapterModal.tsx` (443 líneas)
5. `components/modals/DeleteChapterModal.tsx` (164 líneas)

### Build Status ANTES de optimizaciones:
```bash
npm run build
# Esperamos: ✓ Compiled successfully
```

---

## 🎯 OPTIMIZACIÓN 1: Eliminar setTimeout en create-president.ts

### PROBLEMA IDENTIFICADO:
- **Líneas 179-216**: Bloque de verificación de perfil con setTimeout(500ms)
- **Impacto**: +500ms de latencia en cada creación de capítulo
- **Causa**: Workaround para esperar al trigger de DB

### CÓDIGO ACTUAL (RESPALDO):
```typescript
// Líneas 179-216
// 7. Verificar que el trigger creó el perfil en arca_user_profiles
// Esperar un momento para que el trigger se ejecute
await new Promise((resolve) => setTimeout(resolve, 500));

const { data: profile, error: profileError } = await supabaseAdmin
  .from('arca_user_profiles')
  .select('user_id, role, full_name')
  .eq('user_id', authData.user.id)
  .single();

if (profileError || !profile) {
  console.warn('[create-president] Profile not found, creating manually:', {
    userId: authData.user.id,
    error: profileError,
  });

  // Crear perfil manualmente como fallback
  const { error: insertError } = await supabaseAdmin
    .from('arca_user_profiles')
    .insert({
      user_id: authData.user.id,
      role: 'president',
      full_name: fullName,
    });

  if (insertError) {
    console.error('[create-president] Error creating profile manually:', insertError);
    // No fallar el request - el perfil se puede crear después
  }
} else {
  // Si el perfil existe, actualizar el nombre completo
  await supabaseAdmin
    .from('arca_user_profiles')
    .update({ full_name: fullName })
    .eq('user_id', authData.user.id);

  console.log('[create-president] Profile verified:', profile);
}
```

### CÓDIGO NUEVO (OPTIMIZADO):
```typescript
// Líneas 179-183 (simplificado)
// 7. El trigger on_auth_user_created creará el perfil automáticamente
// No necesitamos verificar - confiamos en el trigger de DB
console.log('[create-president] User created successfully:', {
  userId: authData.user.id,
  email: authData.user.email,
});
```

### JUSTIFICACIÓN:
- El trigger `on_auth_user_created` está FUNCIONANDO correctamente (verificado en HOTFIX 2)
- El trigger tiene `SECURITY DEFINER` y permisos GRANT correctos
- Testing manual confirmó sincronización User + Profile + Chapter
- Eliminar workaround reduce latencia y complejidad

### RIESGO:
- **Bajo**: Trigger probado y funcional en producción
- **Mitigación**: Si el trigger falla, el error se detectará en logs de Supabase

---

## 🎯 OPTIMIZACIÓN 2: Refactorizar useChaptersStats

### PROBLEMA IDENTIFICADO:
- `useChaptersStats()` llama internamente a `useChapters()`, causando doble suscripción
- En `pages/admin/capitulos/index.tsx` se llaman AMBOS hooks:
  - Línea 25: `const { data: chapters = [] } = useChapters();`
  - Línea 26: `const { totalChapters, totalMembers } = useChaptersStats();`

### CÓDIGO ACTUAL (RESPALDO):
```typescript
// hooks/useChapters.ts - Líneas 98-108
export function useChaptersStats() {
  const { data: chapters = [] } = useChapters(); // ⚠️ Re-ejecuta query

  const totalChapters = chapters.length;
  const totalMembers = chapters.reduce((sum, chapter) => sum + chapter.member_count, 0);

  return {
    totalChapters,
    totalMembers,
  };
}
```

### ESTRATEGIA:
**NO modificar useChaptersStats** - mantener compatibilidad con otros componentes.
**SÍ modificar index.tsx** - calcular stats localmente usando data ya obtenida.

### CÓDIGO NUEVO (pages/admin/capitulos/index.tsx):
```typescript
// Líneas 25-31 (modificadas)
const { data: chapters = [], isLoading, error } = useChapters();
// ELIMINADO: const { totalChapters, totalMembers } = useChaptersStats();

// Calcular stats localmente (evita doble suscripción)
const totalChapters = chapters.length;
const totalMembers = chapters.reduce((sum, chapter) => sum + chapter.member_count, 0);
```

### JUSTIFICACIÓN:
- Elimina doble suscripción a React Query
- Usa data ya disponible en memoria
- Mantiene `useChaptersStats()` para otros componentes que solo necesiten stats

---

## 🎯 OPTIMIZACIÓN 3: Agregar logging a errores silenciados

### PROBLEMA IDENTIFICADO:
- `hooks/useChapters.ts` línea 66: Error al obtener emails se silencia completamente
- Dificulta debugging de problemas de RLS en producción

### CÓDIGO ACTUAL (RESPALDO):
```typescript
// Líneas 59-71
const { data: authUsers, error: authError } = await supabase
  .from('auth.users')
  .select('id, email')
  .in('id', presidentUserIds);

// Si falla la query a auth.users (puede pasar si RLS no lo permite),
// continuamos sin los emails
const emailMap = new Map<string, string>();
if (!authError && authUsers) {
  authUsers.forEach(user => {
    emailMap.set(user.id, user.email || '');
  });
}
```

### CÓDIGO NUEVO (OPTIMIZADO):
```typescript
// Líneas 59-75
const { data: authUsers, error: authError } = await supabase
  .from('auth.users')
  .select('id, email')
  .in('id', presidentUserIds);

const emailMap = new Map<string, string>();
if (authError) {
  // Loguear advertencia para debugging (no es error crítico)
  console.warn('[useChapters] Could not fetch president emails:', {
    error: authError.message,
    code: authError.code,
    presidentCount: presidentUserIds.length,
  });
} else if (authUsers) {
  authUsers.forEach(user => {
    emailMap.set(user.id, user.email || '');
  });
}
```

### MISMO CAMBIO EN useChapter (líneas 143-152):
```typescript
// Agregar logging si falla query individual de email
const { data: authUser, error: emailError } = await supabase
  .from('auth.users')
  .select('email')
  .eq('id', data.president.user_id)
  .single();

if (emailError) {
  console.warn('[useChapter] Could not fetch president email:', {
    error: emailError.message,
    userId: data.president.user_id,
  });
}
```

---

## 🎯 OPTIMIZACIÓN 4: Crear utility getErrorMessage

### PROBLEMA IDENTIFICADO:
- Patrón de conversión de error duplicado en 2 archivos:
  - `components/modals/ChapterModal.tsx` (líneas 242-245)
  - `components/modals/DeleteChapterModal.tsx` (líneas 43-48)

### CÓDIGO ACTUAL (RESPALDO - ChapterModal.tsx):
```typescript
let errorMessage: string | null = null;
if (submitError) {
  errorMessage = submitError instanceof Error ? submitError.message : String(submitError);
}
```

### CÓDIGO NUEVO - Crear lib/utils.ts:
```typescript
/**
 * Utility Functions
 *
 * Funciones auxiliares reutilizables en toda la aplicación.
 */

/**
 * Convierte un error de tipo unknown a string legible
 *
 * @param error - Error de cualquier tipo (Error, string, unknown)
 * @returns Mensaje de error como string, o null si no hay error
 *
 * @example
 * const errorMsg = getErrorMessage(mutation.error);
 * if (errorMsg) {
 *   console.error('Error:', errorMsg);
 * }
 */
export function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}
```

### CÓDIGO NUEVO - ChapterModal.tsx (líneas 242-244):
```typescript
// Import al inicio del archivo
import { getErrorMessage } from '@/lib/utils';

// En el componente (líneas 242-244 simplificadas)
const isLoading = createMutation.isLoading || editMutation.isLoading;
const submitError = createMutation.error || editMutation.error;
const errorMessage = getErrorMessage(submitError);
```

### CÓDIGO NUEVO - DeleteChapterModal.tsx (líneas 43-45):
```typescript
// Import al inicio del archivo
import { getErrorMessage } from '@/lib/utils';

// En el componente (líneas 43-45 simplificadas)
const errorMessage = getErrorMessage(deleteMutation.error);
```

---

## 🧪 PLAN DE VALIDACIÓN

### Paso 1: Build Validation
```bash
npm run build
# Esperamos: ✓ Compiled successfully
# Si falla: ROLLBACK inmediato
```

### Paso 2: Type Check
```bash
npm run lint
# Esperamos: Sin errores TypeScript
```

### Paso 3: Testing Manual (Chrome DevTools MCP)
1. **Crear Capítulo**: Verificar que sigue funcionando sin setTimeout
2. **Ver Estadísticas**: Confirmar que stats se calculan correctamente
3. **Revisar Console Logs**: Verificar que warnings aparecen cuando fallan queries

---

## 🔄 PLAN DE ROLLBACK (Si algo falla)

### Si falla OPTIMIZACIÓN 1 (create-president.ts):
```bash
# Restaurar desde este documento - líneas 179-216
# Ejecutar: git checkout pages/api/auth/create-president.ts (si está en git)
```

### Si falla OPTIMIZACIÓN 2 (useChaptersStats):
```bash
# Restaurar import de useChaptersStats en index.tsx
# Eliminar cálculo local de stats
```

### Si falla OPTIMIZACIÓN 3 (logging):
```bash
# Remover console.warn agregados
# Restaurar lógica original sin logging
```

### Si falla OPTIMIZACIÓN 4 (utils):
```bash
# Eliminar lib/utils.ts
# Restaurar código inline en ambos modales
```

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Antes | Después (Esperado) | Resultado Real |
|---------|-------|-------------------|----------------|
| Latencia create-president | ~700ms | ~200ms | TBD |
| Suscripciones React Query | 2 | 1 | TBD |
| Líneas de código duplicado | 12 | 0 | TBD |
| Errores silenciados | 2 | 0 | TBD |

---

## 🚀 ORDEN DE EJECUCIÓN

1. ✅ Documentar este plan (HECHO)
2. 🔄 Optimización 1: create-president.ts
3. 🔄 Optimización 4: Crear lib/utils.ts PRIMERO (dependencia de 2 y 3)
4. 🔄 Optimización 2: index.tsx + modales con utils
5. 🔄 Optimización 3: useChapters.ts logging
6. 🔄 Build validation
7. 🔄 Testing manual
8. 🔄 Actualizar PLAN_TAREAS.md

---

**ESTADO ACTUAL**: 📝 Plan documentado, listo para ejecutar
**PRÓXIMO PASO**: Optimización 1 - Eliminar setTimeout
