import { BarList, Loaded, LineChart, Note, Section, Stat, Table, fmtNum, fmtPct, useIntel } from './intelUi';

const GAME = { pokemon: 'Pokémon', magic: 'Magic', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece', lorcana: 'Lorcana', digimon: 'Digimon', riftbound: 'Riftbound', myl: 'Mitos y Leyendas', otro: 'Otro / sin juego' };
const EVENT = { search: 'Búsquedas', card_added: 'Cartas agregadas', folder_created: 'Carpetas creadas', folder_viewed: 'Carpetas vistas', wishlist_item_added: 'Deseadas agregadas', card_viewed: 'Cartas vistas', cart_add: 'Al carrito' };
const SOCIAL = { profile_viewed: 'Perfiles vistos', store_followed: 'Tiendas seguidas', store_event_signup: 'Inscripciones a eventos', folder_shared: 'Carpetas compartidas', card_shared: 'Cartas compartidas' };
const SERIES = [['users_new', 'Usuarios nuevos'], ['folders_new_surviving', 'Carpetas nuevas'], ['cards_added_surviving', 'Cartas agregadas'], ['wishlist_items_new_surviving', 'Deseadas nuevas']];
const COLORS = ['#1e40af', '#d4a600', '#64748b', '#0f766e'];

export default function ProductView({ period }) {
  const state = useIntel('product', { from: period.range.from, to: period.range.to }, period.valid);
  return (
    <Loaded state={state}>
      {(d) => {
        const hasMeasured = SERIES.some(([k]) => (d.business[k] || []).some((p) => p.origin === 'measured'));
        const total = (k) => (d.business[k] || []).reduce((a, p) => a + p.value, 0);
        const eventTotal = (name) => d.eventsByGame.filter((e) => e.name === name);
        const scan = d.scanner;
        return (
          <>
            <Section title="Crecimiento" note="Se reconstruye con las fechas de los registros que existen hoy: las carpetas y cartas borradas no aparecen, así que los números pasados pueden quedar por debajo de lo ocurrido.">
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{SERIES.map(([k, label]) => <Stat key={k} label={label} value={fmtNum(total(k))} sub="en el periodo" />)}</div>
              <LineChart label="Crecimiento diario" series={SERIES.map(([k, label], i) => ({ name: label, color: COLORS[i], points: (d.business[k] || []).map((p) => ({ x: p.day, y: p.value })) }))} />
              {!hasMeasured && <p className="mt-2 text-xs font-semibold text-slate-500">Reconstruido desde fechas de registro. Las fotos diarias medidas empiezan con el primer trabajo nocturno.</p>}
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              {['search', 'card_added', 'folder_created', 'wishlist_item_added'].map((name) => {
                const rows = eventTotal(name).sort((a, b) => b.count - a.count).map((e) => ({ label: GAME[e.game] || e.game, value: e.count }));
                return <Section key={name} title={`${EVENT[name]} por juego`}><BarList rows={rows} empty="Sin datos medidos en este periodo." /></Section>;
              })}
            </div>
            <Section title="Búsquedas" note="Sin el texto buscado: solo juego, cantidad de resultados y si volvió vacía. Una tasa alta sin resultados indica catálogo incompleto o búsquedas difíciles.">
              <Table rowKey={(r) => r.game} empty="Sin búsquedas medidas en este periodo." rows={d.searches} columns={[
                { key: 'game', label: 'Juego', render: (r) => GAME[r.game] || r.game }, { key: 'count', label: 'Búsquedas', right: true, render: (r) => fmtNum(r.count) },
                { key: 'avgResults', label: 'Resultados (prom.)', right: true, render: (r) => fmtNum(r.avgResults) }, { key: 'emptyRate', label: 'Sin resultados', right: true, render: (r) => fmtPct(r.emptyRate, 0) }
              ]} />
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Escáner" note="Aperturas de la cámara, cartas reconocidas y fallos de cámara (permiso, sin cámara).">
                {scan.started + scan.succeeded + scan.failed === 0 ? <Note>Sin uso del escáner medido en este periodo.</Note> : (
                  <div className="grid grid-cols-3 gap-3"><Stat label="Aperturas" value={fmtNum(scan.started)} /><Stat label="Reconocidas" value={fmtNum(scan.succeeded)} sub={scan.started ? `${fmtPct(scan.succeeded / scan.started, 0)} de las aperturas` : undefined} /><Stat label="Fallos de cámara" value={fmtNum(scan.failed)} /></div>
                )}
              </Section>
              <Section title="Comunidad y tiendas"><BarList rows={d.social.map((s) => ({ label: SOCIAL[s.name] || s.name, value: s.count })).sort((a, b) => b.value - a.value)} empty="Sin actividad medida en este periodo." /></Section>
            </div>
          </>
        );
      }}
    </Loaded>
  );
}
