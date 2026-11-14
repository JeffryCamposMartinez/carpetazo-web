// Eventos de tiendas: solo el dueño con plan Tienda crea y edita; inscripción única con lista de espera; cancelar libera cupo; recordatorio una sola vez.
const { prisma, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.72.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const inDays = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio']);
  const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
  const store = await id('nobuyer');
  try {
    await prisma.storeEvent.deleteMany({ where: { storeId: store } });
    const base = { title: 'Torneo de prueba', game: 'Pokémon', startsAt: inDays(5), capacity: 2, feeClp: 2000, format: 'Estándar' };
    let r;

    await plan('nobuyer', 'free');
    r = await call('POST', '/stores/me/events', 'nobuyer', base, ip());
    ok('Free no crea eventos → 403', r.status === 403 && r.j.feature === 'storeTools', JSON.stringify(r.j));
    await plan('nobuyer', 'store');
    r = await call('POST', '/stores/me/events', 'nobuyer', { ...base, startsAt: inDays(-3) }, ip());
    ok('fecha pasada → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/events', 'nobuyer', { ...base, capacity: -4 }, ip());
    ok('cupos negativos → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/events', 'nobuyer', base, ip());
    ok('plan Tienda crea el evento', r.status === 200 && r.j.event.spotsLeft === 2, JSON.stringify(r.j));
    const eventId = r.j.event.id;

    r = await call('PUT', '/stores/me/events/' + eventId, 'ignacio', { ...base, title: 'Robado' }, ip());
    ok('otra cuenta no edita el evento ajeno', r.status === 403 || r.status === 404, String(r.status));
    r = await call('POST', '/stores/events/' + eventId + '/signup', 'nobuyer', {}, ip());
    ok('el dueño no se inscribe en su evento → 400', r.status === 400, String(r.status));

    r = await call('POST', '/stores/events/' + eventId + '/signup', 'ignacio', {}, ip());
    ok('primera persona queda inscrita', r.status === 200 && r.j.event.mine === 'registered', JSON.stringify(r.j));
    r = await call('POST', '/stores/events/' + eventId + '/signup', 'ignacio', {}, ip());
    const dupes = await prisma.storeEventSignup.count({ where: { eventId } });
    ok('inscribirse dos veces no duplica', r.status === 200 && dupes === 1, String(dupes));
    r = await call('POST', '/stores/events/' + eventId + '/signup', 'seller', {}, ip());
    ok('segunda persona llena los cupos', r.status === 200 && r.j.event.mine === 'registered' && r.j.event.spotsLeft === 0, JSON.stringify(r.j.event));
    r = await call('POST', '/stores/events/' + eventId + '/signup', 'jerry', {}, ip());
    ok('tercera persona va a lista de espera', r.status === 200 && r.j.event.mine === 'waitlist', JSON.stringify(r.j.event));

    r = await call('PUT', '/stores/me/events/' + eventId, 'nobuyer', { ...base, capacity: 1 }, ip());
    ok('no se pueden dejar menos cupos que inscritos → 400', r.status === 400, String(r.status));

    r = await call('DELETE', '/stores/events/' + eventId + '/signup', 'ignacio', null, ip());
    const jerry = await id('jerry');
    const promoted = await prisma.storeEventSignup.findFirst({ where: { eventId, userId: jerry } });
    ok('al salir alguien, sube la lista de espera', r.status === 200 && promoted.status === 'registered', promoted?.status);

    r = await call('GET', '/stores/' + NAMES.nobuyer + '/events', 'jerry', null, ip());
    const pub = r.j.events?.find((e) => e.id === eventId);
    ok('lista pública con mi estado y cupos', r.status === 200 && pub?.mine === 'registered' && pub.registered === 2 && pub.waitlist === 0, JSON.stringify(pub));
    ok('lista pública sin datos internos ni inscritos', pub && !('storeId' in pub) && !('signups' in pub) && !('reminderSentAt' in pub));
    r = await call('GET', '/stores/me/events', 'nobuyer', null, ip());
    const mine = r.j.events?.find((e) => e.id === eventId);
    ok('el dueño ve quiénes se inscribieron (sin correo)', r.status === 200 && mine.signups.length === 2 && !JSON.stringify(mine.signups).includes('@'), JSON.stringify(mine?.signups));

    // Recordatorio: una sola vez
    await prisma.storeEvent.update({ where: { id: eventId }, data: { startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000) } });
    const { runEventReminders } = await import('../core/storeNotices.js');
    const first = await runEventReminders();
    const second = await runEventReminders();
    const reminded = await prisma.storeEvent.findUnique({ where: { id: eventId } });
    ok('recordatorio sale una vez por evento', first.events >= 1 && reminded.reminderSentAt && !(await prisma.storeEvent.count({ where: { id: eventId, reminderSentAt: null } })) && second.events === 0, JSON.stringify([first, second]));

    // Cancelar cierra las inscripciones
    r = await call('PUT', '/stores/me/events/' + eventId, 'nobuyer', { ...base, startsAt: reminded.startsAt.toISOString(), status: 'cancelled' }, ip());
    ok('el dueño cancela', r.status === 200 && r.j.event.status === 'cancelled', JSON.stringify(r.j));
    r = await call('POST', '/stores/events/' + eventId + '/signup', 'ale', {}, ip());
    ok('evento cancelado no acepta inscripciones', r.status === 400, String(r.status));

    // Sin plan Tienda, sus eventos dejan de mostrarse
    await plan('nobuyer', 'free');
    r = await call('GET', '/stores/' + NAMES.nobuyer + '/events', null, null, ip());
    ok('al bajar de plan los eventos se ocultan', r.status === 200 && r.j.events.length === 0, String(r.j.events?.length));
  } finally {
    await prisma.storeEvent.deleteMany({ where: { storeId: store } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
