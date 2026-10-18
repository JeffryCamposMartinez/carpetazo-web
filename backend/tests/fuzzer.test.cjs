// fuzzer.test.cjs — Barrido automático: auth, propiedad, basura, serialización
// Corre dentro del runner (TEST_AUTH_STUB=1, RATE_LIMIT_MAX=grande).
// Cada sección imprime hallazgos con criticidad: [CRITICA] [ALTA] [MEDIA] [BAJA]
const { prisma, B, U, NAMES, call, ok, fixtures } = require('./fixtures.cjs');

// ─── helpers ────────────────────────────────────────────────────────────────

const HALT_ON_JUNK_INPUTS = [
  null, '', 0, false, [], {}, 'a'.repeat(5000),
  '<script>alert(1)</script>', '" OR 1=1--', '\x00\x01\x02',
  { nested: { deep: { level: 10 } } },
  Array(200).fill('x'),
];

let findings = [];
let passed = 0;

function report(level, route, method, detail) {
  findings.push({ level, route, method, detail });
  console.log(`[${level}] ${method} ${route} — ${detail}`);
}

function pass(label) {
  passed++;
  // console.log('OK   ' + label); // descomenta para ver todos los OK
}

// Devuelve true si el status es "seguro" para una ruta protegida sin token
function isAuthBlocked(status) {
  return status === 401 || status === 403;
}

// Devuelve true si el status no es 500 (aceptable para basura)
function isGraceful(status) {
  return status !== 500;
}

// ─── 1. RUTAS PROTEGIDAS SIN TOKEN ─────────────────────────────────────────
// Todas deben devolver 401 o 403, nunca 200/204 ni 500.

async function checkAuthRoutes(folderId, cardId, sellerUsername) {
  console.log('\n── 1. Rutas protegidas sin token ──');

  const routes = [
    // Perfil
    ['GET', '/users/me'],
    ['PUT', '/users/me'],
    ['DELETE', '/users/me'],
    ['GET', '/users/username/check'],
    ['POST', '/users/sync'],
    // Carpetas propias
    ['GET', '/folders/me'],
    ['GET', '/folders/me/stats'],
    ['POST', '/folders'],
    ['PUT', '/folders/' + folderId],
    ['DELETE', '/folders/' + folderId],
    ['POST', '/folders/' + folderId + '/cards'],
    ['PUT', '/folders/' + folderId + '/cards/' + cardId],
    ['DELETE', '/folders/' + folderId + '/cards/' + cardId],
    ['POST', '/folders/' + folderId + '/cards-bulk'],
    ['POST', '/folders/' + folderId + '/cards-bulk/delete'],
    ['POST', '/folders/' + folderId + '/cards-bulk/move'],
    ['PUT', '/folders/' + folderId + '/order'],
    // Órdenes
    ['POST', '/orders/create'],
    ['GET', '/orders/mine'],
    ['GET', '/orders/mine/pending'],
    // Mensajes / chat
    ['GET', '/messages/' + U.seller],
    ['POST', '/messages/' + U.seller],
    ['POST', '/messages/item/' + '0'.repeat(24) + '/reaction'],
    ['POST', '/messages/item/' + '0'.repeat(24) + '/star'],
    ['POST', '/messages/' + U.seller + '/read'],
    ['GET', '/chats'],
    ['GET', '/chats/stream'],
    ['GET', '/chats/search'],
    ['GET', '/chats/starred'],
    ['POST', '/chats/forward'],
    // Wishlist
    ['GET', '/wishlist/me'],
    ['POST', '/wishlist'],
    ['DELETE', '/wishlist/' + '0'.repeat(24)],
    ['GET', '/wishlist/matches'],
    // Billing
    ['GET', '/billing/me'],
    ['POST', '/billing/checkout'],
    ['POST', '/billing/cancel'],
    // Notificaciones
    ['GET', '/notifications/settings'],
    ['PUT', '/notifications/settings'],
    ['POST', '/notifications/push/subscribe'],
    ['POST', '/notifications/push/test'],
    ['POST', '/notifications/push/unsubscribe'],
    // Onboarding
    ['POST', '/onboarding'],
    // Reseñas propias
    ['POST', '/reviews'],
    // Feedback
    ['POST', '/feedback'],
    ['GET', '/feedback/mine'],
    // Admin (todos deben bloquear)
    ['GET', '/admin/me'],
    ['GET', '/admin/team'],
    ['GET', '/admin/team/search'],
    ['GET', '/admin/team/history'],
    ['GET', '/admin/reviews'],
    ['GET', '/admin/feedback'],
    ['GET', '/admin/ops/errors'],
    ['GET', '/admin/ops/funnel'],
    ['POST', '/admin/catalog-import/preview'],
    ['POST', '/admin/catalog-import/apply'],
    ['POST', '/admin/tcg-catalog-import/preview'],
    ['POST', '/admin/tcg-catalog-import/apply'],
    ['GET', '/admin/users/cztest_seller/plan'],
    ['POST', '/admin/users/cztest_seller/plan'],
  ];

  for (const [method, path] of routes) {
    const r = await fetch(B + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'DELETE'].includes(method) ? undefined : JSON.stringify({}),
    });
    if (isAuthBlocked(r.status)) {
      pass('auth-block ' + method + ' ' + path);
    } else if (r.status === 200 || r.status === 204 || r.status === 201) {
      report('CRITICA', path, method, 'ruta protegida accesible sin token (' + r.status + ')');
    } else if (!isGraceful(r.status)) {
      report('ALTA', path, method, '500 sin token — posible fuga de info (' + r.status + ')');
    } else {
      // 400/404/429 etc. son aceptables
      pass('auth-graceful ' + method + ' ' + path + ' → ' + r.status);
    }
  }
}

// ─── 2. ACCESO CRUZADO ENTRE USUARIOS ──────────────────────────────────────
// jerry no puede leer/editar recursos de seller ni de ignacio.

async function checkCrossAccess(folderId, cardId) {
  console.log('\n── 2. Acceso cruzado entre usuarios ──');

  // Carpeta ajena (privada) — seller la pone privada para esta prueba
  const makePrivate = await call('PUT', '/folders/' + folderId, 'seller', { isPublic: false });
  if (makePrivate.status !== 200) {
    report('MEDIA', '/folders/' + folderId, 'PUT', 'no se pudo poner carpeta en privado para el test — omitido');
  } else {
    const r = await call('GET', '/folders/' + folderId, 'jerry');
    if (r.status === 200) {
      report('CRITICA', '/folders/' + folderId, 'GET', 'carpeta privada ajena devuelve 200 a usuario no autorizado');
    } else {
      pass('carpeta privada ajena bloqueada → ' + r.status);
    }
    // Restaurar pública
    await call('PUT', '/folders/' + folderId, 'seller', { isPublic: true });
  }

  // Editar carta ajena
  let r = await call('PUT', '/folders/' + folderId + '/cards/' + cardId, 'jerry', { price: 1 });
  if (r.status === 200) {
    report('CRITICA', '/folders/:id/cards/:cardId', 'PUT', 'jerry pudo editar carta de seller');
  } else {
    pass('no puede editar carta ajena → ' + r.status);
  }

  // Borrar carta ajena
  r = await call('DELETE', '/folders/' + folderId + '/cards/' + cardId, 'jerry');
  if (r.status === 200 || r.status === 204) {
    report('CRITICA', '/folders/:id/cards/:cardId', 'DELETE', 'jerry pudo borrar carta de seller');
  } else {
    pass('no puede borrar carta ajena → ' + r.status);
  }

  // Editar carpeta ajena
  r = await call('PUT', '/folders/' + folderId, 'jerry', { name: 'hackeado' });
  if (r.status === 200) {
    report('CRITICA', '/folders/:id', 'PUT', 'jerry pudo editar carpeta de seller');
  } else {
    pass('no puede editar carpeta ajena → ' + r.status);
  }

  // Borrar carpeta ajena
  r = await call('DELETE', '/folders/' + folderId, 'jerry');
  if (r.status === 200 || r.status === 204) {
    report('CRITICA', '/folders/:id', 'DELETE', 'jerry pudo borrar carpeta de seller');
  } else {
    pass('no puede borrar carpeta ajena → ' + r.status);
  }

  // Estado de orden ajena (crear orden y leerla con otro usuario)
  const order = await call('POST', '/orders/create', 'jerry', { folderId, items: [{ cardId, quantity: 1 }] });
  if (order.status === 200 || order.status === 201) {
    const orderId = order.j?.order?.id;
    if (orderId) {
      // ignacio intenta cambiar estado de esa orden
      r = await call('PUT', '/orders/mine/' + orderId + '/status', 'ignacio', { status: 'cancelled' });
      if (r.status === 200) {
        report('ALTA', '/orders/mine/:id/status', 'PUT', 'ignacio cambió estado de orden de jerry');
      } else {
        pass('no puede cambiar estado de orden ajena → ' + r.status);
      }
    }
  }

  // Mensajes de chat privados — jerry intenta leer chat entre seller e ignacio
  // (sender distinto al token)
  r = await call('GET', '/messages/' + U.ignacio, 'jerry');
  // Si jerry no tiene chat con ignacio, debería devolver lista vacía o 200 vacío, no ajeno
  if (r.status === 200 && Array.isArray(r.j?.messages) && r.j.messages.some(m => m.senderId === U.seller || m.senderId === U.ignacio)) {
    report('CRITICA', '/messages/:otherId', 'GET', 'jerry puede leer mensajes privados de otros');
  } else {
    pass('mensajes propios aislados → ' + r.status);
  }
}

// ─── 3. ESCALADA DE PRIVILEGIOS ─────────────────────────────────────────────
// Usuario normal no puede llegar a rutas de admin/staff.

async function checkPrivilegeEscalation() {
  console.log('\n── 3. Escalada de privilegios ──');

  const adminRoutes = [
    ['GET', '/admin/me'],
    ['GET', '/admin/team'],
    ['GET', '/admin/team/search?q=test'],
    ['GET', '/admin/reviews'],
    ['GET', '/admin/feedback'],
    ['GET', '/admin/ops/errors'],
    ['GET', '/admin/ops/funnel'],
    ['POST', '/admin/catalog-import/preview'],
    ['GET', '/admin/users/cztest_seller/plan'],
    ['POST', '/admin/users/cztest_seller/plan'],
    ['POST', '/admin/test-email'],
    ['POST', '/admin/terms/evidence'],
    ['DELETE', '/admin/team/' + U.seller + '/close'],
    ['POST', '/admin/team/' + U.seller + '/suspend'],
    ['PUT', '/admin/team/' + U.seller + '/role'],
  ];

  for (const [method, path] of adminRoutes) {
    const body = ['GET', 'DELETE'].includes(method) ? undefined : {};
    const r = await call(method, path, 'jerry', body);
    if (r.status === 200 || r.status === 201 || r.status === 204) {
      report('CRITICA', path, method, 'usuario normal accedió a ruta admin → ' + r.status);
    } else {
      pass('admin bloqueado para jerry → ' + path + ' ' + r.status);
    }
  }

  // Intentar darse admin vía perfil
  const r = await call('PUT', '/users/me', 'jerry', { role: 'admin' });
  if (r.status === 200 && r.j?.user?.role === 'admin') {
    report('CRITICA', '/users/me', 'PUT', 'jerry se pudo auto-asignar role=admin');
  } else {
    pass('no puede auto-asignar rol admin');
  }

  // Intentar asignar plan premium a sí mismo vía billing test-plan
  const r2 = await call('POST', '/billing/test-plan', 'jerry', { plan: 'pro' });
  // En TEST_AUTH_STUB=1 este endpoint solo existe si está habilitado; si devuelve 200 y activa premium es un riesgo
  if (r2.status === 200) {
    report('ALTA', '/billing/test-plan', 'POST', 'usuario normal activó test-plan sin restricción');
  } else {
    pass('test-plan bloqueado para jerry → ' + r2.status);
  }
}

// ─── 4. SERIALIZACIÓN — campos sensibles en respuestas públicas ─────────────

async function checkSerialization(sellerUsername) {
  console.log('\n── 4. Serialización de datos sensibles ──');

  const sensitiveFields = ['email', 'firebaseUid', 'rut', 'bankAccount', 'role', 'planKey', 'planGrant', 'password', 'hash', 'firebaseToken'];

  // Perfil público de vendedor
  let r = await call('GET', '/users/' + sellerUsername, 'jerry');
  if (r.status === 200) {
    const body = JSON.stringify(r.j || {});
    for (const field of sensitiveFields) {
      if (body.includes('"' + field + '"')) {
        report('ALTA', '/users/:username', 'GET', 'campo sensible "' + field + '" en perfil público');
      } else {
        pass('campo sensible ausente en perfil público: ' + field);
      }
    }
  } else {
    report('MEDIA', '/users/:username', 'GET', 'perfil público devolvió ' + r.status);
  }

  // Lista de vendedores
  r = await call('GET', '/sellers', null);
  if (r.status === 200) {
    const body = JSON.stringify(r.j || {});
    for (const field of ['email', 'firebaseUid', 'rut', 'bankAccount']) {
      if (body.includes('"' + field + '"')) {
        report('ALTA', '/sellers', 'GET', 'campo sensible "' + field + '" en lista pública de vendedores');
      } else {
        pass('campo sensible ausente en /sellers: ' + field);
      }
    }
  }

  // Perfil propio: no debe filtrar contraseñas ni UID de firebase hacia el cliente
  r = await call('GET', '/users/me', 'jerry');
  if (r.status === 200) {
    const body = JSON.stringify(r.j || {});
    for (const field of ['password', 'hash']) {
      if (body.includes('"' + field + '"')) {
        report('ALTA', '/users/me', 'GET', 'campo sensible "' + field + '" en perfil propio');
      }
    }
    pass('serialización de /users/me revisada');
  }

  // Órdenes: no deben exponer firebaseUid del comprador al vendedor
  r = await call('GET', '/orders/mine', 'seller');
  if (r.status === 200) {
    const body = JSON.stringify(r.j || {});
    if (body.includes('"firebaseUid"')) {
      report('ALTA', '/orders/mine', 'GET', 'firebaseUid expuesto en órdenes del vendedor');
    } else {
      pass('firebaseUid ausente en órdenes');
    }
  }
}

// ─── 5. INYECCIÓN DE BASURA ─────────────────────────────────────────────────
// Ninguna ruta debe devolver 500 con entradas malformadas.

async function checkJunkInputs(folderId, cardId) {
  console.log('\n── 5. Entradas basura (no debe haber 500) ──');

  const junkTests = [
    // Crear carpeta con datos inválidos
    ['POST', '/folders', 'jerry', { name: null }],
    ['POST', '/folders', 'jerry', { name: 'a'.repeat(5000), tcg: 'Pokemon', color: 'blue' }],
    ['POST', '/folders', 'jerry', { name: 'test', tcg: '<script>', color: 'blue' }],
    ['POST', '/folders', 'jerry', { name: 'test', tcg: null, color: null }],
    // Editar perfil con datos inválidos
    ['PUT', '/users/me', 'jerry', { username: '<script>alert(1)</script>' }],
    ['PUT', '/users/me', 'jerry', { username: 'a'.repeat(5000) }],
    ['PUT', '/users/me', 'jerry', { bio: 'a'.repeat(50000) }],
    ['PUT', '/users/me', 'jerry', { photoURL: 'javascript:alert(1)' }],
    ['PUT', '/users/me', 'jerry', { photoURL: 'data:text/html,<h1>xss</h1>' }],
    // Crear orden con datos raros
    ['POST', '/orders/create', 'jerry', { folderId: 'no-existe', items: [] }],
    ['POST', '/orders/create', 'jerry', { folderId, items: [{ cardId: 'no-existe', quantity: 99999 }] }],
    ['POST', '/orders/create', 'jerry', { folderId, items: null }],
    ['POST', '/orders/create', 'jerry', null],
    // Wishlist basura
    ['POST', '/wishlist', 'jerry', { tcgId: null, tcg: 'Pokemon' }],
    ['POST', '/wishlist', 'jerry', { tcgId: 'a'.repeat(1000), tcg: 'Pokemon' }],
    // Mensajes basura
    ['POST', '/messages/' + U.seller, 'jerry', { text: 'a'.repeat(100000) }],
    ['POST', '/messages/' + U.seller, 'jerry', { text: null }],
    ['POST', '/messages/' + U.seller, 'jerry', { items: null }],
    // Búsqueda
    ['GET', '/cards/search?q=' + encodeURIComponent('a'.repeat(1000)), null],
    ['GET', '/sellers?page=-1&limit=99999', null],
    ['GET', '/tcg/categories?category=' + encodeURIComponent('<script>'), null],
    // Parámetros de ruta raros
    ['GET', '/users/username/available?username=', null],
    ['GET', '/users/username/available?username=' + encodeURIComponent('<>/"\''), null],
    ['GET', '/og/card/../../.env', null],
  ];

  let errors500 = 0;
  for (const [method, path, who, body] of junkTests) {
    const headers = { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}) };
    const r = await fetch(B + path, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    }).catch(() => ({ status: 0 }));
    if (r.status === 500) {
      errors500++;
      report('ALTA', path, method, 'devuelve 500 con entrada basura');
    } else {
      pass('basura manejada → ' + method + ' ' + path + ' ' + r.status);
    }
  }
  if (errors500 === 0) console.log('   Todos los inputs basura manejados sin 500.');
}

// ─── 6. PARÁMETROS DE PRECIO Y STOCK ───────────────────────────────────────
// El servidor no debe usar precio/stock enviados por el cliente sin validar.

async function checkPriceManipulation(folderId) {
  console.log('\n── 6. Manipulación de precios y stock ──');

  // Crear carta con precio negativo
  let r = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-fuzz1', name: 'fuzz precio', price: -9999, stock: 1, data: { catalogOrder: 0 } });
  if (r.status === 200 && r.j?.card?.price < 0) {
    report('ALTA', '/folders/:id/cards', 'POST', 'precio negativo aceptado: ' + r.j.card.price);
  } else {
    pass('precio negativo rechazado → ' + r.status);
  }

  // Crear carta con stock masivo
  r = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-fuzz2', name: 'fuzz stock', price: 100, stock: 999999999, data: { catalogOrder: 0 } });
  if (r.status === 200 && r.j?.card?.stock > 10000) {
    report('MEDIA', '/folders/:id/cards', 'POST', 'stock masivo aceptado: ' + r.j.card.stock);
  } else {
    pass('stock masivo rechazado → ' + r.status);
  }

  // Crear carta con precio 0
  r = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-fuzz3', name: 'fuzz cero', price: 0, stock: 1, data: { catalogOrder: 0 } });
  if (r.status === 200 && r.j?.card?.price === 0) {
    report('BAJA', '/folders/:id/cards', 'POST', 'precio 0 aceptado — revisar si es intencional');
  } else {
    pass('precio 0 manejado → ' + r.status);
  }

  // Precio como string
  r = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-fuzz4', name: 'fuzz str', price: '999999999999', stock: 1, data: { catalogOrder: 0 } });
  if (r.status === 200 && r.j?.card?.price > 9999999) {
    report('MEDIA', '/folders/:id/cards', 'POST', 'precio como string enorme aceptado: ' + r.j.card.price);
  } else {
    pass('precio string manejado → ' + r.status);
  }
}

// ─── 7. RUTAS DE SOLO LECTURA PÚBLICA ──────────────────────────────────────
// No deben fallar con 500 ni exponer datos del sistema.

async function checkPublicRoutes(sellerUsername) {
  console.log('\n── 7. Rutas públicas sin auth ──');

  const publicRoutes = [
    '/sellers',
    '/sellers?page=1&limit=10',
    '/users/' + sellerUsername,
    '/users/' + sellerUsername + '/reviews',
    '/tcg/categories',
    '/tcg/blocks',
    '/tcg/cards',
    '/tcg/sets',
    '/tcg/search?q=pikachu&categoryId=1',
    '/tcg/search-index?q=pikachu&page=1',
    '/cards/search?q=pikachu',
    '/cards/recent',
    '/home/featured',
    '/legal/versions',
    '/plans',
    '/usd-clp',
    '/seo/sitemap.xml',
    '/api/users/username/available?username=libre12345xyz',
  ];

  for (const path of publicRoutes) {
    const fullPath = path.startsWith('/api/') ? path.replace('/api', '') : path;
    const r = await fetch(B + fullPath).catch(() => ({ status: 0 }));
    if (r.status === 500) {
      report('ALTA', fullPath, 'GET', 'ruta pública devuelve 500');
    } else if (r.status === 0) {
      report('MEDIA', fullPath, 'GET', 'conexión rechazada');
    } else {
      pass('pública ok → ' + fullPath + ' ' + r.status);
    }
  }
}

// ─── 8. PROTECCIÓN CSRF / CONTENT-TYPE ─────────────────────────────────────

async function checkCsrf(folderId) {
  console.log('\n── 8. Content-Type y CSRF ──');

  // Enviar body como text/plain a una ruta que espera JSON
  const r = await fetch(B + '/folders', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-' + U.jerry, 'Content-Type': 'text/plain' },
    body: '{"name":"test","tcg":"Pokemon","color":"blue","isPublic":false}',
  });
  if (r.status === 200 || r.status === 201) {
    report('MEDIA', '/folders', 'POST', 'acepta Content-Type: text/plain como JSON (sin CSRF protection)');
  } else {
    pass('Content-Type text/plain rechazado → ' + r.status);
  }

  // Sin Content-Type en POST con body
  const r2 = await fetch(B + '/folders', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-' + U.jerry },
    body: JSON.stringify({ name: 'test', tcg: 'Pokemon', color: 'blue' }),
  });
  // 400 es aceptable, 200 también (express acepta), solo verificar que no hay 500
  if (r2.status === 500) {
    report('ALTA', '/folders', 'POST', '500 sin Content-Type header');
  } else {
    pass('sin Content-Type manejado → ' + r2.status);
  }
}

// ─── 9. RUTAS DE ADMINISTRACIÓN CON MODERADOR (nivel 2) ─────────────────────
// Moderador no debe poder llegar a rutas de nivel 3 (admin).

async function checkModeratorScope() {
  console.log('\n── 9. Scope del moderador (nivel 2 no llega a nivel 3) ──');

  const level3Routes = [
    ['POST', '/admin/catalog-import/apply'],
    ['POST', '/admin/tcg-catalog-import/apply'],
    ['PUT', '/admin/team/' + U.seller + '/role'],
    ['DELETE', '/admin/team/' + U.seller + '/close'],
    ['POST', '/admin/test-email'],
    ['GET', '/admin/users/cztest_seller/plan'],
    ['POST', '/admin/users/cztest_seller/plan'],
  ];

  // jerry es nivel 0; ale es nivel 0 también. No tenemos moderador en fixtures
  // Sin embargo comprobamos que level 0 queda bloqueado (ya cubierto arriba)
  // y que los endpoints de admin requieren nivel >= 3 específicamente
  for (const [method, path] of level3Routes) {
    const body = ['GET', 'DELETE'].includes(method) ? undefined : {};
    const r = await call(method, path, 'jerry', body);
    if (r.status === 200 || r.status === 201 || r.status === 204) {
      report('CRITICA', path, method, 'nivel 0 accedió a ruta de nivel 3');
    } else {
      pass('nivel 3 bloqueado para nivel 0 → ' + path + ' ' + r.status);
    }
  }
}

// ─── 10. INYECCIÓN EN PARÁMETROS DE BÚSQUEDA ───────────────────────────────

async function checkSearchInjection() {
  console.log('\n── 10. Inyección en parámetros de búsqueda ──');

  const injections = [
    "' OR '1'='1",
    '" OR "1"="1',
    '${process.env.DATABASE_URL}',
    '{{7*7}}',
    'UNION SELECT * FROM users',
    '; DROP TABLE users --',
    '../../../etc/passwd',
    '%00%0d%0a',
  ];

  for (const q of injections) {
    const encoded = encodeURIComponent(q);
    const r = await fetch(B + '/cards/search?q=' + encoded).catch(() => ({ status: 0 }));
    if (r.status === 500) {
      report('ALTA', '/cards/search', 'GET', '500 con input de inyección: ' + q.substring(0, 30));
    } else {
      pass('inyección manejada: ' + q.substring(0, 20) + ' → ' + r.status);
    }

    const r2 = await fetch(B + '/sellers?q=' + encoded).catch(() => ({ status: 0 }));
    if (r2.status === 500) {
      report('ALTA', '/sellers', 'GET', '500 con input de inyección: ' + q.substring(0, 30));
    } else {
      pass('inyección /sellers manejada → ' + r2.status);
    }
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    const { folderId, cardId, sellerUsername } = fixtures();
    if (!folderId || !cardId) {
      console.error('FUZZER: fixtures no disponibles — corriendo dentro del runner?');
      process.exit(1);
    }

    await checkAuthRoutes(folderId, cardId, sellerUsername);
    await checkCrossAccess(folderId, cardId);
    await checkPrivilegeEscalation();
    await checkSerialization(sellerUsername);
    await checkJunkInputs(folderId, cardId);
    await checkPriceManipulation(folderId);
    await checkPublicRoutes(sellerUsername);
    await checkCsrf(folderId);
    await checkModeratorScope();
    await checkSearchInjection();

    // ─── Resumen ────────────────────────────────────────────────────────
    console.log('\n══ RESUMEN FUZZER ══════════════════════════════════════');
    console.log('Pasaron:   ' + passed);
    console.log('Hallazgos: ' + findings.length);
    if (findings.length > 0) {
      const byLevel = { CRITICA: [], ALTA: [], MEDIA: [], BAJA: [] };
      for (const f of findings) (byLevel[f.level] || byLevel.BAJA).push(f);
      for (const [lvl, list] of Object.entries(byLevel)) {
        if (list.length) {
          console.log('\n[' + lvl + '] — ' + list.length + ' hallazgo(s)');
          list.forEach((f) => console.log('  ' + f.method + ' ' + f.route + ': ' + f.detail));
        }
      }
      // Marcar fallo si hay CRITICA o ALTA
      if (byLevel.CRITICA.length || byLevel.ALTA.length) process.exitCode = 1;
    } else {
      console.log('\n✓ Sin hallazgos de seguridad.');
    }
  } catch (err) {
    console.error('FUZZER ERROR:', err.message);
    process.exitCode = 1;
  }
})();
