# Helpers para Testing Automatizado - El Arca

## Contexto

El testing automatizado con Chrome DevTools MCP tiene limitaciones al interactuar con ciertos componentes nativos del navegador, especialmente el `<input type="date">` que renderiza un widget de calendario nativo.

## Problema Identificado

**Bug #1 (Original)**: El widget nativo de calendario no es accesible via automatización porque:
- Los botones del calendario son renderizados por el navegador, no por el DOM
- Chrome DevTools MCP no puede hacer clic en elementos del shadow DOM del widget nativo
- Los spinbuttons de día/mes/año tampoco son accesibles de manera confiable

## Solución Implementada

### Fix en el Código (commit: 2025-11-01)
```typescript
// pages/admin/solicitudes/crear.tsx línea 495-504

<input
  id="dueDate"
  type="date"
  data-testid="due-date-input"  // ✅ Agregado para testing
  value={formData.dueDate}
  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
  min={new Date().toISOString().split('T')[0]}
  className={`input w-full ${errors.dueDate ? 'border-danger' : ''}`}
  required  // ✅ Agregado HTML5 validation
/>
```

**Cambios aplicados:**
1. ✅ `data-testid="due-date-input"` - Identificador único para testing
2. ✅ `required` - Validación HTML5 nativa

### Helper para Testing Automatizado

Cuando uses Chrome DevTools MCP, usa el siguiente script JavaScript para establecer la fecha:

```javascript
// Helper: Establecer fecha en formulario de crear solicitud
// Uso: Ejecutar con evaluate_script de Chrome DevTools MCP

function setDueDateInRequestForm(dateString) {
  // dateString formato: "YYYY-MM-DD" (ej: "2025-12-31")

  const input = document.querySelector('#dueDate');

  if (!input) {
    return {
      success: false,
      error: 'Input #dueDate not found'
    };
  }

  // Establecer el valor directamente
  input.value = dateString;

  // Disparar evento 'change' para que React detecte el cambio
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);

  // Disparar también 'input' event (algunos handlers lo requieren)
  const inputEvent = new Event('input', { bubbles: true });
  input.dispatchEvent(inputEvent);

  // Verificar que se estableció correctamente
  return {
    success: true,
    value: input.value,
    formattedDate: new Date(dateString + 'T00:00:00').toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}

// Ejemplo de uso:
// setDueDateInRequestForm('2025-12-31');
```

### Uso con Chrome DevTools MCP

```typescript
// Ejemplo de invocación desde Claude Code

await mcp__chrome-devtools__evaluate_script({
  function: `
    function setDueDateInRequestForm(dateString) {
      const input = document.querySelector('#dueDate');
      if (!input) return { success: false, error: 'Input not found' };

      input.value = dateString;
      const event = new Event('change', { bubbles: true });
      input.dispatchEvent(event);

      return { success: true, value: input.value };
    }

    // Establecer fecha: 31 de diciembre de 2025
    return setDueDateInRequestForm('2025-12-31');
  `
});
```

## Testing Manual

El `<input type="date">` funciona **perfectamente en testing manual**:

1. Usuario hace clic en el campo
2. Navegador abre el widget de calendario nativo
3. Usuario selecciona la fecha
4. Valor se establece correctamente en el formulario

**No hay bug en funcionalidad**, solo limitación en automatización.

## Casos de Testing Automatizado

### Test 1: Establecer fecha válida futura
```javascript
const result = await evaluateScript(`
  return setDueDateInRequestForm('2025-12-31');
`);

// Expected: { success: true, value: '2025-12-31' }
```

### Test 2: Establecer fecha pasada (debe fallar validación)
```javascript
const result = await evaluateScript(`
  return setDueDateInRequestForm('2024-01-01');
`);

// Expected: Validación client-side mostrará error
// "La fecha debe ser hoy o en el futuro"
```

### Test 3: Verificar atributo 'min' (validación HTML5)
```javascript
const result = await evaluateScript(`
  const input = document.querySelector('#dueDate');
  return {
    minDate: input.getAttribute('min'),
    today: new Date().toISOString().split('T')[0],
    matches: input.getAttribute('min') === new Date().toISOString().split('T')[0]
  };
`);

// Expected: { minDate: "2025-11-01", today: "2025-11-01", matches: true }
```

## Alternativas Consideradas (No Implementadas)

### Opción 1: Componente de terceros (react-day-picker)
**Pros:**
- Mayor control sobre el DOM
- Más accesible para automatización

**Contras:**
- Dependencia adicional (bundle size +15KB)
- Mayor complejidad de código
- Experiencia de usuario inconsistente con widgets nativos

**Veredicto:** ❌ No implementado - `<input type="date">` nativo es suficiente

### Opción 2: Inputs separados (día/mes/año)
**Pros:**
- 100% accesible para automatización
- Sin dependencias

**Contras:**
- Mala UX (3 campos en lugar de 1)
- Más validación client-side requerida
- No aprovecha widget nativo del navegador

**Veredicto:** ❌ No implementado - `<input type="date">` nativo es mejor UX

### Opción 3: Mejorar accesibilidad de Radix UI
**Nota:** El código **NO usa Radix UI** - usa `<input type="date">` nativo

## Conclusión

**Estado:** ✅ **RESUELTO**

- ✅ Mejoras de accesibilidad implementadas (`data-testid`, `required`)
- ✅ Helper de JavaScript documentado para testing automatizado
- ✅ Funcionalidad manual sin cambios (funciona perfectamente)
- ✅ Build exitoso sin errores

**Impacto del Fix:**
- Testing manual: Sin cambios (ya funcionaba)
- Testing automatizado: Ahora posible via JavaScript helper
- Accesibilidad: Mejorada con atributos HTML5
- Bundle size: Sin cambios (0 dependencias agregadas)

## Referencias

- **Bug Report Completo:** `REPORTE_TESTING_T3.9.md`
- **Plan de Tareas:** `PLAN_TAREAS.md` (T3.9)
- **Código Fuente:** `pages/admin/solicitudes/crear.tsx:495-504`
