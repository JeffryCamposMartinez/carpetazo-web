// Chat estilo WhatsApp: páginas, entregado/leído, responder, reaccionar, destacar, corregir, reenviar, ajustes por chat, búsqueda,
// fotos, cartas adjuntas, presencia, privacidad y eventos en tiempo real. Todo entre cuentas de prueba.
const { prisma, B, U, NAMES, call, ok, fixtures, acceptTerms } = require('./fixtures.cjs');

const text = (value) => JSON.stringify({ v: 1, text: value, imageUrl: null, imageBase64: null });
const send = (who, to, value, extra = {}) => call('POST', '/messages/' + NAMES[to], who, { content: typeof value === 'string' && value.startsWith('{') ? value : text(value), ...extra });
const convo = async (who, other, query = '') => (await call('GET', '/messages/' + NAMES[other] + query, who)).j;
const idOf = async (name) => (await prisma.user.findUnique({ where: { firebaseUid: U[name] }, select: { id: true } })).id;

(async () => {
  try {
    const fx = fixtures();
    const jerry = await idOf('jerry');
    const seller = await idOf('seller');
    const ale = await idOf('ale');
    const ignacio = await idOf('ignacio');
    // Dos cuentas nuevas sin historial: una conversa con el vendedor y la otra con nadie
    for (const name of ['chat1', 'chat2']) { await call('POST', '/users/sync', name, { displayName: 'Prueba ' + name, username: 'cztest_' + name }); if (name === 'chat1') await acceptTerms(name); NAMES[name] = 'cztest_' + name; }
    const chat1 = await idOf('chat1');
    const chat2 = await idOf('chat2');

    // ---- Páginas
    const base = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await prisma.message.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ senderId: i % 2 ? jerry : seller, receiverId: i % 2 ? seller : jerry, content: text('relleno ' + i), isRead: true, createdAt: new Date(base + i * 60000) })) });
    let r = await convo('seller', 'jerry');
    ok('la conversación trae solo los últimos 50 y avisa que hay más', r.success && r.messages.length === 50 && r.hasMore === true, String(r.messages?.length));
    ok('van en orden cronológico', r.messages.every((m, i, a) => i === 0 || new Date(a[i - 1].createdAt) <= new Date(m.createdAt)));
    const firstId = r.messages[0].id;
    const total = await prisma.message.count({ where: { OR: [{ senderId: jerry, receiverId: seller }, { senderId: seller, receiverId: jerry }] } });
    r = await convo('seller', 'jerry', '?before=' + firstId + '&limit=100');
    ok('"antes de" trae los anteriores sin repetir', r.messages.length === total - 50 && !r.messages.some((m) => m.id === firstId) && r.hasMore === false, String(r.messages?.length));
    ok('"antes de" con un id inventado → 400', (await call('GET', '/messages/' + NAMES.jerry + '?before=00000000-0000-4000-8000-000000000000', 'seller')).status === 400);
    ok('el mensaje de referencia de otra conversación → 400', (await call('GET', '/messages/' + NAMES.ale + '?before=' + firstId, 'seller')).status === 400);

    // ---- Entregado y leído
    let sent = (await send('jerry', 'seller', 'hola, ¿sigue disponible?')).j.message;
    ok('al enviar: sin entregar ni leer todavía', sent.deliveredAt === null && sent.isRead === false && sent.readAt === null, JSON.stringify(sent));
    await call('GET', '/chats', 'seller'); // la app del vendedor se abre
    let mine = (await convo('jerry', 'seller')).messages.find((m) => m.id === sent.id);
    ok('cuando la app de quien recibe lo descarga queda entregado', mine.deliveredAt && !mine.isRead);
    r = await call('POST', '/messages/' + NAMES.jerry + '/read', 'seller');
    ok('marcar toda la conversación como leída → cuenta lo leído', r.status === 200 && r.j.read >= 1, JSON.stringify(r.j));
    mine = (await convo('jerry', 'seller')).messages.find((m) => m.id === sent.id);
    ok('quien envió ve leído con su hora', mine.isRead === true && mine.readAt);
    ok('la lista del vendedor queda sin no leídos de esa persona', (await call('GET', '/chats', 'seller')).j.chats.find((c) => c.partner.username === NAMES.jerry).unreadCount === 0);
    const keep = (await send('jerry', 'seller', 'sigue sin leer')).j.message;
    await call('POST', '/messages/' + NAMES.jerry + '/read', 'ale');
    ok('un tercero no puede marcar como leída la conversación de otros', (await convo('jerry', 'seller')).messages.find((m) => m.id === keep.id).isRead === false);
    await call('POST', '/messages/' + NAMES.jerry + '/read', 'seller');

    // Confirmaciones de lectura apagadas: nadie ve el leído entre esas dos personas
    r = await call('PUT', '/chats/privacy', 'seller', { showReadReceipts: false });
    ok('apagar las confirmaciones de lectura → 200', r.status === 200 && r.j.privacy.showReadReceipts === false);
    sent = (await send('jerry', 'seller', 'segundo mensaje')).j.message;
    await call('POST', '/messages/' + NAMES.jerry + '/read', 'seller');
    mine = (await convo('jerry', 'seller')).messages.find((m) => m.id === sent.id);
    ok('con las confirmaciones apagadas quien envió no ve leído', mine.isRead === false && mine.readAt === null);
    await call('PUT', '/chats/privacy', 'seller', { showReadReceipts: true });
    ok('privacidad: datos inválidos → 400', (await call('PUT', '/chats/privacy', 'seller', { showLastSeen: 'si' })).status === 400);

    // ---- Responder
    const base1 = (await send('seller', 'jerry', 'Sí, sigue disponible')).j.message;
    r = await send('jerry', 'seller', 'Perfecto, la quiero', { replyToId: base1.id });
    ok('responder a un mensaje → 200 con la cita', r.status === 200 && r.j.message.replyTo?.id === base1.id && r.j.message.replyTo.text === 'Sí, sigue disponible', JSON.stringify(r.j.message?.replyTo));
    const foreign = (await send('ale', 'ignacio', 'mensaje de otra conversación')).j.message;
    ok('responder a un mensaje de otra conversación → 400', (await send('jerry', 'seller', 'x', { replyToId: foreign.id })).status === 400);
    ok('responder con un id inválido → 400', (await send('jerry', 'seller', 'x', { replyToId: 'no-es-id' })).status === 400);
    ok('la cita aparece también al leer la conversación', (await convo('seller', 'jerry')).messages.find((m) => m.id === r.j.message.id).replyTo?.text === 'Sí, sigue disponible');

    // ---- Reacciones
    const target = r.j.message;
    ok('reaccionar con un emoji → 200', (await call('PUT', '/messages/item/' + base1.id + '/reaction', 'jerry', { emoji: '👍' })).status === 200);
    await call('PUT', '/messages/item/' + base1.id + '/reaction', 'seller', { emoji: '❤️' });
    let reacted = (await convo('jerry', 'seller')).messages.find((m) => m.id === base1.id);
    ok('las reacciones se cuentan y marcan la propia', reacted.reactions.length === 2 && reacted.reactions.find((x) => x.emoji === '👍').mine === true && reacted.reactions.find((x) => x.emoji === '❤️').mine === false);
    await call('PUT', '/messages/item/' + base1.id + '/reaction', 'jerry', { emoji: '😂' });
    reacted = (await convo('jerry', 'seller')).messages.find((m) => m.id === base1.id);
    ok('una persona tiene una sola reacción (cambiar reemplaza)', reacted.reactions.filter((x) => x.mine).length === 1 && reacted.reactions.find((x) => x.mine).emoji === '😂');
    for (const bad of ['hola', '<script>', '👍👍👍👍👍👍👍👍👍', '', 5]) {
      ok('reacción inválida ' + JSON.stringify(bad) + ' → 400', (await call('PUT', '/messages/item/' + base1.id + '/reaction', 'jerry', { emoji: bad })).status === 400);
    }
    ok('un tercero no puede reaccionar → 404', (await call('PUT', '/messages/item/' + base1.id + '/reaction', 'ale', { emoji: '👍' })).status === 404);
    await call('PUT', '/messages/item/' + base1.id + '/reaction', 'jerry', { emoji: null });
    reacted = (await convo('jerry', 'seller')).messages.find((m) => m.id === base1.id);
    ok('quitar la reacción', reacted.reactions.length === 1 && reacted.reactions[0].emoji === '❤️');

    // ---- Destacados
    ok('destacar un mensaje → 200', (await call('PUT', '/messages/item/' + base1.id + '/star', 'jerry', { starred: true })).status === 200);
    ok('solo lo ve quien lo destacó', (await convo('jerry', 'seller')).messages.find((m) => m.id === base1.id).starred === true && (await convo('seller', 'jerry')).messages.find((m) => m.id === base1.id).starred === false);
    r = await call('GET', '/chats/starred', 'jerry');
    ok('lista de destacados con la persona', r.status === 200 && r.j.messages.length === 1 && r.j.messages[0].partner.username === NAMES.seller);
    ok('los destacados de otra persona no se ven', (await call('GET', '/chats/starred', 'seller')).j.messages.length === 0);
    ok('destacar con un dato inválido → 400', (await call('PUT', '/messages/item/' + base1.id + '/star', 'jerry', { starred: 'si' })).status === 400);
    await call('PUT', '/messages/item/' + base1.id + '/star', 'jerry', { starred: false });
    ok('quitar el destacado', (await call('GET', '/chats/starred', 'jerry')).j.messages.length === 0);

    // ---- Corregir
    r = await call('PUT', '/messages/item/' + target.id, 'jerry', { text: 'Perfecto, la quiero hoy' });
    ok('corregir un mensaje propio → 200 y queda marcado como editado', r.status === 200 && r.j.message.editedAt && decodeText(r.j.message.content) === 'Perfecto, la quiero hoy', JSON.stringify(r.j));
    ok('corregir el mensaje de otra persona → 403', (await call('PUT', '/messages/item/' + base1.id, 'jerry', { text: 'hackeado' })).status === 403);
    ok('un tercero no puede corregir → 404', (await call('PUT', '/messages/item/' + target.id, 'ale', { text: 'x' })).status === 404);
    ok('dejar el texto vacío → 400', (await call('PUT', '/messages/item/' + target.id, 'jerry', { text: '   ' })).status === 400);
    ok('texto demasiado largo → 400', (await call('PUT', '/messages/item/' + target.id, 'jerry', { text: 'a'.repeat(4001) })).status === 400);
    await prisma.message.update({ where: { id: target.id }, data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } });
    r = await call('PUT', '/messages/item/' + target.id, 'jerry', { text: 'tarde' });
    ok('pasados 15 minutos no se puede corregir → 409', r.status === 409 && r.j.code === 'edit_window');

    // ---- Reenviar
    r = await call('POST', '/chats/forward', 'jerry', { messageId: base1.id, to: [chat2] });
    ok('reenviar a quien no tiene conversación contigo → no se envía', r.status === 200 && r.j.results[0].ok === false);
    await send('jerry', 'ale', 'hola ale');
    r = await call('POST', '/chats/forward', 'jerry', { messageId: base1.id, to: [ale] });
    const fwd = (await convo('ale', 'jerry')).messages.find((m) => m.forwarded);
    ok('reenviar a una conversación existente → llega marcado como reenviado', r.j.results[0].ok === true && fwd && decodeText(fwd.content) === 'Sí, sigue disponible');
    ok('reenviar más de 5 → 400', (await call('POST', '/chats/forward', 'jerry', { messageId: base1.id, to: Array(6).fill(ale) })).status === 400);
    ok('reenviar un mensaje ajeno → 404', (await call('POST', '/chats/forward', 'jerry', { messageId: foreign.id, to: [ale] })).status === 404);

    // ---- Ajustes por chat
    const chatList = async (who, q = '') => (await call('GET', '/chats' + q, who)).j;
    for (const name of ['jerry', 'ale', 'ignacio']) await send(name, 'seller', 'hola vendedor ' + name);
    for (const name of ['jerry', 'ale', 'ignacio']) ok('fijar ' + name + ' → 200', (await call('PUT', '/chats/' + NAMES[name] + '/settings', 'seller', { pinned: true })).status === 200);
    await send('chat1', 'seller', 'hola');
    r = await call('PUT', '/chats/' + NAMES.chat1 + '/settings', 'seller', { pinned: true });
    ok('fijar una cuarta conversación → 409', r.status === 409, r.status + ' ' + JSON.stringify(r.j));
    let list = await chatList('seller');
    ok('las fijadas van primero', list.chats.slice(0, 3).every((c) => c.pinned) && !list.chats[3].pinned);
    r = await call('PUT', '/chats/' + NAMES.jerry + '/settings', 'seller', { archived: true });
    list = await chatList('seller');
    ok('archivar saca el chat de la lista y le quita lo fijado', !list.chats.some((c) => c.partner.username === NAMES.jerry) && list.archivedCount === 1);
    ok('las archivadas se ven aparte', (await chatList('seller', '?archived=1')).chats.some((c) => c.partner.username === NAMES.jerry && c.archived && !c.pinned));
    await send('jerry', 'seller', 'sigues ahí?');
    ok('un mensaje nuevo desarchiva la conversación', (await chatList('seller')).chats.some((c) => c.partner.username === NAMES.jerry));
    await call('PUT', '/chats/' + NAMES.ale + '/settings', 'seller', { muted: 'always' });
    list = await chatList('seller');
    const aleChat = list.chats.find((c) => c.partner.username === NAMES.ale);
    ok('silenciar: queda marcado y no suma a la burbuja de no leídos', aleChat.muted === true && list.totalUnread === list.chats.filter((c) => !c.muted).reduce((s, c) => s + c.unreadCount, 0) && aleChat.unreadCount > 0);
    await call('PUT', '/chats/' + NAMES.ale + '/settings', 'seller', { muted: null });
    ok('quitar el silencio', (await chatList('seller')).chats.find((c) => c.partner.username === NAMES.ale).muted === false);
    await call('PUT', '/chats/' + NAMES.ignacio + '/settings', 'seller', { markedUnread: true });
    ok('marcar como no leída', (await chatList('seller')).chats.find((c) => c.partner.username === NAMES.ignacio).markedUnread === true);
    await call('POST', '/messages/' + NAMES.ignacio + '/read', 'seller');
    ok('al abrirla deja de estar marcada', (await chatList('seller')).chats.find((c) => c.partner.username === NAMES.ignacio).markedUnread === false);
    ok('ajustes de un chat que no existe → 404', (await call('PUT', '/chats/' + NAMES.admin + '/settings', 'seller', { pinned: true })).status === 404);
    ok('ajustes con datos inválidos → 400', (await call('PUT', '/chats/' + NAMES.ale + '/settings', 'seller', { muted: 'siempre' })).status === 400);
    ok('cada persona tiene sus propios ajustes', (await chatList('ale')).chats.find((c) => c.partner.username === NAMES.seller).pinned === false);

    // ---- Búsqueda
    const needle = 'zxqunico' + Date.now().toString(36);
    await send('jerry', 'seller', 'busca esto: ' + needle + ' por favor');
    r = await call('GET', '/chats/search?q=' + needle, 'seller');
    ok('buscar encuentra el mensaje con su contexto', r.status === 200 && r.j.messages.length === 1 && r.j.messages[0].snippet.includes(needle) && r.j.messages[0].partner.username === NAMES.jerry, JSON.stringify(r.j));
    ok('buscar dentro de una conversación', (await call('GET', '/chats/search?q=' + needle + '&partner=' + NAMES.jerry, 'seller')).j.messages.length === 1);
    ok('otra persona no encuentra mensajes ajenos', (await call('GET', '/chats/search?q=' + needle, 'ale')).j.messages.length === 0);
    ok('buscar por nombre de una persona con quien conversas', (await call('GET', '/chats/search?q=jerry', 'seller')).j.people.some((p) => p.username === NAMES.jerry));
    ok('buscar con menos de 2 letras → 400', (await call('GET', '/chats/search?q=a', 'seller')).status === 400);
    ok('buscar "v" o "text" no encuentra el formato interno', (await call('GET', '/chats/search?q=imageUrl', 'seller')).j.messages.length === 0);

    // ---- Fotos
    const photo = JSON.stringify({ v: 1, text: 'mira', imageUrl: 'https://pub-cztest.r2.dev/cztest/chat/foto.webp', imageBase64: null });
    r = await send('jerry', 'seller', photo);
    ok('enviar una foto de un host permitido → 200', r.status === 200, String(r.status));
    r = await call('GET', '/chats/' + NAMES.jerry + '/media', 'seller');
    ok('fotos compartidas de la conversación', r.status === 200 && r.j.media.length === 1 && r.j.media[0].imageUrl.endsWith('foto.webp'));
    ok('las fotos de otra conversación no se ven', (await call('GET', '/chats/' + NAMES.jerry + '/media', 'ale')).j.media.length === 0);

    // ---- Mensajes de voz
    const uploadAudio = async (who, bytes, type = 'audio/webm') => {
      const form = new FormData();
      form.append('audio', new Blob([bytes], { type }), 'voz.webm');
      const response = await fetch(B + '/users/upload-audio', { method: 'POST', headers: who ? { Authorization: 'Bearer test-' + U[who] } : {}, body: form });
      return { status: response.status, j: await response.json().catch(() => ({})) };
    };
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 7)]);
    r = await uploadAudio('jerry', webm);
    ok('subir un audio webm → 200 con la dirección en la carpeta de voz', r.status === 200 && /\/voice\/[0-9a-f]{32}\.webm$/.test(r.j.url || ''), JSON.stringify(r));
    const voiceUrl = r.j.url;
    ok('subir audio sin sesión → 401', (await uploadAudio(null, webm)).status === 401);
    ok('subir algo que no es audio (tipo) → 400', (await uploadAudio('jerry', webm, 'text/html')).status === 400);
    ok('subir bytes que no son audio aunque diga serlo → 400', (await uploadAudio('jerry', Buffer.alloc(3000, 65))).status === 400);
    ok('subir un audio demasiado pesado → 400', (await uploadAudio('jerry', Buffer.concat([webm, Buffer.alloc(3.5 * 1024 * 1024)]))).status === 400);
    ok('subir ogg y m4a', (await uploadAudio('jerry', Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)]), 'audio/ogg')).j.url?.endsWith('.ogg') && (await uploadAudio('jerry', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(100)]), 'audio/mp4')).j.url?.endsWith('.m4a'));
    const voice = (audio) => JSON.stringify({ v: 1, text: '', imageUrl: null, imageBase64: null, audio });
    r = await send('jerry', 'seller', voice({ url: voiceUrl, seconds: 12, wave: [10, 40, 80, 20] }));
    ok('enviar un mensaje de voz → 200', r.status === 200 && JSON.parse(r.j.message.content).audio.seconds === 12, JSON.stringify(r.j));
    const voiceId = r.j.message.id;
    for (const [label, audio] of [
      ['de otro servidor', { url: 'https://evil.example/voice/' + 'a'.repeat(32) + '.webm', seconds: 5 }],
      ['fuera de la carpeta de voz', { url: voiceUrl.replace('/voice/', '/chat/'), seconds: 5 }],
      ['sin duración', { url: voiceUrl }],
      ['de 0 segundos', { url: voiceUrl, seconds: 0 }],
      ['de más de 3 minutos', { url: voiceUrl, seconds: 181 }],
      ['con una curva inválida', { url: voiceUrl, seconds: 5, wave: ['a'] }],
      ['con una curva demasiado larga', { url: voiceUrl, seconds: 5, wave: Array(65).fill(1) }]
    ]) ok('mensaje de voz ' + label + ' → 400', (await send('jerry', 'seller', voice(audio))).status === 400);
    r = await send('seller', 'jerry', 'te escucho', { replyToId: voiceId });
    ok('responder a un mensaje de voz muestra que es audio', r.status === 200 && r.j.message.replyTo.kind === 'audio', JSON.stringify(r.j.message?.replyTo));
    ok('un mensaje de voz no se puede corregir → 400', (await call('PUT', '/messages/item/' + voiceId, 'jerry', { text: 'nuevo texto' })).status === 400);

    // ---- Carta adjunta
    const cardMsg = (id) => JSON.stringify({ v: 1, text: 'esta', imageUrl: null, imageBase64: null, card: { id } });
    r = await send('jerry', 'seller', cardMsg(fx.cardId));
    ok('adjuntar una carta pública → 200 con sus datos', r.status === 200 && r.j.message.attachment?.id === fx.cardId && r.j.message.attachment.price === 1000 && !JSON.stringify(r.j.message.attachment).includes('userId'), JSON.stringify(r.j));
    ok('adjuntar una carta inventada → 400', (await send('jerry', 'seller', cardMsg('00000000-0000-4000-8000-000000000000'))).status === 400);
    ok('adjuntar con un id que no es uuid → 400', (await send('jerry', 'seller', cardMsg('abc'))).status === 400);
    const privateFolder = (await call('POST', '/folders', 'seller', { name: 'TEST chat privada', tcg: 'Pokemon', color: 'blue', isPublic: false }, '10.88.0.7')).j.folder; // otra conexión: el tope de carpetas nuevas por conexión se agota hacia el final de la suite
    const hidden = await prisma.card.create({ data: { tcgId: 'tst-chat-priv', name: 'Carta privada', price: 500, stock: 1, folderId: privateFolder.id } });
    ok('adjuntar una carta de una carpeta privada → 400', (await send('jerry', 'seller', cardMsg(hidden.id))).status === 400);
    await prisma.folder.update({ where: { id: privateFolder.id }, data: { isPublic: true } });
    const later = (await send('jerry', 'seller', cardMsg(hidden.id))).j.message;
    await prisma.folder.update({ where: { id: privateFolder.id }, data: { isPublic: false } });
    ok('si la carta deja de ser pública, el adjunto aparece como no disponible', (await convo('seller', 'jerry')).messages.find((m) => m.id === later.id).attachment.unavailable === true);
    r = await send('seller', 'jerry', cardMsg(hidden.id));
    ok('su dueño sí puede mandar una carta de una carpeta no pública (marcada como privada, sin dueño)', r.status === 200 && r.j.message.attachment?.private === true && !JSON.stringify(r.j.message.attachment).includes('ownerId'), JSON.stringify(r.j));
    ok('quien la recibe la ve igual', (await convo('jerry', 'seller')).messages.find((m) => m.id === r.j.message.id)?.attachment?.private === true);
    r = await call('GET', '/cards/mine?scope=private', 'seller');
    ok('mis cartas no públicas la incluyen y entregan los juegos', r.status === 200 && r.j.cards.some((c) => c.id === hidden.id) && r.j.tcgs.includes('Pokemon'), JSON.stringify(r.j).slice(0, 300));
    ok('mis cartas públicas no traen las de carpetas no públicas', !(await call('GET', '/cards/mine?scope=public', 'seller')).j.cards.some((c) => c.id === hidden.id));
    ok('el filtro por juego deja fuera otros juegos', (await call('GET', '/cards/mine?scope=private&tcg=Magic', 'seller')).j.cards.length === 0);
    ok('las cartas de otra persona no aparecen en mis cartas', !(await call('GET', '/cards/mine?scope=private', 'jerry')).j.cards.some((c) => c.id === hidden.id));
    ok('mis cartas sin sesión → 401', (await call('GET', '/cards/mine?scope=private', null)).status === 401);
    ok('mis cartas con filtro inválido → 400', (await call('GET', '/cards/mine?q=' + 'a'.repeat(100), 'seller')).status === 400);
    ok('un mensaje vacío sin foto ni carta → 400', (await send('jerry', 'seller', text('   '))).status === 400);

    // ---- Presencia y privacidad
    r = await convo('jerry', 'seller');
    ok('la conversación entrega la presencia de la otra persona', r.otherUser.presence && typeof r.otherUser.presence.online === 'boolean', JSON.stringify(r.otherUser));
    await call('PUT', '/chats/privacy', 'seller', { showLastSeen: false });
    ok('quien oculta su última conexión no la muestra', (await convo('jerry', 'seller')).otherUser.presence === null);
    ok('y tampoco ve la de los demás', (await convo('seller', 'jerry')).otherUser.presence === null);
    await call('PUT', '/chats/privacy', 'seller', { showLastSeen: true });
    ok('el chat no revela correo, teléfono ni uid', !/email|"phone"|firebaseUid|"rut"|bankDetails/i.test(JSON.stringify(await convo('jerry', 'seller'))));

    // ---- Cuenta eliminada: no se le puede escribir
    await prisma.user.update({ where: { id: chat2 }, data: { role: 'deleted' } });
    r = await send('jerry', 'chat2', 'hola');
    ok('escribirle a una cuenta eliminada → 403', r.status === 403 && r.j.code === 'deleted', JSON.stringify(r.j));
    await prisma.user.update({ where: { id: chat2 }, data: { role: 'user' } });

    // ---- Bloqueo
    await prisma.userBlock.create({ data: { blockerId: seller, blockedId: ignacio } });
    ok('no se puede reaccionar con una persona bloqueada → 403', (await call('PUT', '/messages/item/' + (await convo('seller', 'ignacio')).messages.slice(-1)[0].id + '/reaction', 'seller', { emoji: '👍' })).status === 403);
    ok('ni reenviar a una persona bloqueada', (await call('POST', '/chats/forward', 'jerry', { messageId: base1.id, to: [ignacio] })).j.results[0].ok === false);
    await prisma.userBlock.deleteMany({ where: { blockerId: seller, blockedId: ignacio } });

    // ---- Tiempo real (SSE)
    ok('la conexión en tiempo real exige sesión → 401', (await fetch(B + '/chats/stream')).status === 401);
    const controller = new AbortController();
    const stream = await fetch(B + '/chats/stream', { headers: { Authorization: 'Bearer test-' + U.seller, Accept: 'text/event-stream' }, signal: controller.signal });
    ok('la conexión abre como flujo de eventos', stream.status === 200 && /text\/event-stream/.test(stream.headers.get('content-type')));
    const reader = stream.body.getReader();
    let seen = '';
    const readUntil = async (pattern, ms) => {
      const end = Date.now() + ms;
      while (!pattern.test(seen) && Date.now() < end) {
        const chunk = await Promise.race([reader.read(), new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), Math.max(50, end - Date.now())))]);
        if (chunk.timeout || chunk.done) break;
        seen += Buffer.from(chunk.value).toString('utf8');
      }
      return pattern.test(seen);
    };
    ok('avisa que está lista', await readUntil(/event: ready/, 3000), seen);
    await send('jerry', 'seller', 'mensaje en vivo');
    ok('un mensaje nuevo llega como evento con quién lo envió', await readUntil(new RegExp('event: message\\ndata: \\{"partnerId":"' + jerry + '"\\}'), 3000), seen);
    r = await send('jerry', 'seller', 'otro en vivo');
    ok('con la persona conectada el mensaje ya sale entregado', r.j.message.deliveredAt !== null, JSON.stringify(r.j.message));
    await call('POST', '/messages/' + NAMES.seller + '/typing', 'jerry', { isTyping: true });
    ok('"escribiendo…" llega como evento', await readUntil(/event: typing\ndata: \{"partnerId":"[^"]+","isTyping":true\}/, 3000), seen);
    controller.abort();
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST chat' } } }).catch(() => {});
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.$disconnect();
  }
})();

function decodeText(content) {
  try { return JSON.parse(content).text; } catch (_error) { return content; }
}
