# Carpetazo.cl — Reglas de trabajo

Proyecto full-stack: `frontend/` (React + Vite), `backend/`, base de datos y APIs. Prioridad: código funcional, mantenible y eficiente, con el menor gasto de contexto posible. Reducir tokens desperdiciados, nunca la calidad: no omitas análisis, pruebas ni verificaciones necesarias.

## Comunicación
- Respuestas concisas y directas, en español.
- No repetir ni parafrasear mis instrucciones.
- No explicar código obvio; explicar solo lo no evidente o cuando yo lo pida.
- No dar explicaciones extensas si el código ya lo dice.

## Contexto y lectura de archivos
- Inspeccionar solo los archivos relevantes para la tarea; usar Grep/Glob antes de leer archivos enteros.
- Leer por rangos de líneas cuando el archivo es grande (p. ej. `FolderPokemon.jsx`).
- No releer archivos que no hayan cambiado ni releer tras un Edit exitoso.
- No explorar `node_modules`, `dist` ni archivos generados.
- Antes de editar código, consultar el grafo en `graphify-out/` (`graphify explain "<nodo>"`, `graphify path "<A>" "<B>" --undirected`, `graphify query "<pregunta>"`) para ver qué archivos dependen de lo que se va a cambiar. El grafo no muestra eventos del navegador ni rutas de la API escritas como texto: confirmarlos con Grep.

## Cambios de código
- Modificar solo los archivos necesarios; no tocar archivos no relacionados.
- No hacer refactors, renombrados ni limpiezas no solicitados.
- Evitar sobreingeniería y abstracciones innecesarias; preferir lo más simple que funcione.
- Cambios pequeños, precisos y mantenibles; imitar el estilo del código existente.
- No agregar dependencias sin necesidad ni sin avisar.

## Flujo
- Antes de programar: analizar brevemente el problema y elegir el enfoque más eficiente.
- Tareas complejas (varios archivos, cambios de arquitectura, BD o APIs): planificar antes de modificar código.
- Si hay una skill relevante instalada (p. ej. debugging sistemático, frontend-design), usarla solo cuando aplique.
- Después de implementar: ejecutar solo las comprobaciones/tests necesarios para validar el cambio (p. ej. `vite build` en frontend). Si no se pudo verificar, decirlo.

## Seguridad (Fase 1) — obligatoria en todo cambio
Todo cambio, incluidas funciones nuevas y rediseños, debe cumplir estos criterios:
- **Propiedad:** toda ruta con sesión comprueba que el recurso pertenece al usuario (403/404 si no). Nunca confiar en IDs, vendedor, precios ni totales enviados por el cliente; calcularlos en el servidor.
- **Validación de entradas:** tipos, largos y rangos en el servidor (usar `isShortText`, `isValidPrice`, `isValidStock`, `isSmallObject`, `validUsername`, `isAllowedStoredImageUrl`, `checkSocialField`, `badRequest` de `backend/server.js`).
- **Serialización:** las rutas públicas devuelven solo campos permitidos (`PUBLIC_SELLER_SELECT` / `toPublicSeller`); nunca correo, RUT, banco, rol, `firebaseUid` ni dirección completa.
- **Errores:** mensajes genéricos al cliente; el detalle solo en el log.
- **Límites:** rutas que escriben o consumen recursos externos con `routeLimiter`; cuerpos acotados.
- **Operaciones compuestas** (stock, pedidos) en transacción y sin permitir procesarlas dos veces.
- **URLs/imágenes externas:** solo `https` y hosts permitidos; sin redirecciones en el proxy.
- **Verificación antes de subir:** `node --check`, `vite build`, `npm run test:contract` (local y producción) y comparación antes/después de las respuestas públicas para no romper Mitos y Leyendas. Probar con sesión los casos de rutas autenticadas (propio vs ajeno, datos inválidos).
- Si un cambio no puede cumplir algún punto, decirlo explícitamente antes de implementarlo.

## Git
- Commit/push solo cuando lo pida. Agregar únicamente los archivos de la tarea; no incluir cambios ajenos ni archivos sin seguimiento.
- El push a `main` dispara el deploy automático al VPS: confirmar antes de pushear cambios riesgosos.

## Informe final (breve)
- Cambios realizados · Archivos modificados · Validaciones ejecutadas · Pendientes/problemas.
