import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import ReportsPanel from '../components/moderation/ReportsPanel';
import AuditPanel from '../components/moderation/AuditPanel';
import CasesPanel from '../components/moderation/CasesPanel';
import PeoplePanel from '../components/moderation/PeoplePanel';
import AccountDetail from '../components/moderation/AccountDetail';
import AppealsPanel from '../components/moderation/AppealsPanel';
import MetricsPanel from '../components/moderation/MetricsPanel';
import ReviewsPanel from '../components/moderation/ReviewsPanel';
import ToolsPanel from '../components/moderation/ToolsPanel';
import OperationsPanel from '../components/moderation/OperationsPanel';
import TeamPanel from '../components/moderation/TeamPanel';
import CatalogImportPanel from '../components/moderation/CatalogImportPanel';
import FeedbackPanel from '../components/moderation/FeedbackPanel';
import CatalogPhotosPanel from '../components/moderation/CatalogPhotosPanel';
import CatalogSyncPanel from '../components/moderation/CatalogSyncPanel';
import ModNav from '../components/moderation/ModNav';
import LoadingState from '../components/ui/LoadingState';
import SvgIcon from '../components/ui/SvgIcon';

// Secciones según el rol: soporte (1) lee, moderador (2) decide, administrador (3) además ve reseñas, métricas, auditoría, catálogo y herramientas
const GROUPS = [
  { id: 'queue', label: 'Cola de trabajo' },
  { id: 'people', label: 'Personas' },
  { id: 'system', label: 'Sistema' }
];
const TABS = [
  { id: 'reports', group: 'queue', label: 'Reportes', icon: 'flag', min: 1, blurb: 'Contenido reportado por la comunidad y por la detección automática, con lo más grave primero.' },
  { id: 'cases', group: 'queue', label: 'Estafas', shortLabel: 'Estafas', icon: 'security', min: 1, blurb: 'Casos abiertos contra una cuenta, con todos sus reportes reunidos.' },
  { id: 'appeals', group: 'queue', label: 'Apelaciones', icon: 'gavel', min: 1, blurb: 'Personas que piden revisar una medida o una decisión sobre su contenido.' },
  { id: 'feedback', group: 'queue', label: 'Reclamos y sugerencias', shortLabel: 'Sugerencias', icon: 'feedback', min: 1, blurb: 'Mensajes de la comunidad para mejorar el sitio o informar un problema.' },
  { id: 'photos', group: 'queue', label: 'Fotos de cartas', shortLabel: 'Fotos', icon: 'photo_library', min: 2, blurb: 'Fotos que la comunidad subió a cartas del catálogo sin imagen: si apruebas una, esa carta tendrá imagen para todos.' },
  { id: 'people', group: 'people', label: 'Personas y medidas', shortLabel: 'Personas', icon: 'groups', min: 1, blurb: 'Busca una cuenta, revisa su historial y aplica o levanta medidas.' },
  { id: 'account', group: 'people', label: 'Cuenta completa', shortLabel: 'Cuenta', icon: 'badge', min: 3, blurb: 'Todos los datos de una persona, sus planes con todas las fechas, y cambiarlos avisándole con un mensaje.' },
  { id: 'team', group: 'people', label: 'Equipo y administradores', shortLabel: 'Equipo', icon: 'admin_panel_settings', min: 3, blurb: 'Quién es del equipo y cómo dar el rol de administrador a otra persona, con doble confirmación.' },
  { id: 'reviews', group: 'people', label: 'Reseñas marcadas', shortLabel: 'Reseñas', icon: 'reviews', min: 3, blurb: 'Reseñas reportadas o sospechosas, para aprobarlas o eliminarlas.' },
  { id: 'metrics', group: 'system', label: 'Métricas', icon: 'monitoring', min: 3, blurb: 'Cómo está funcionando la moderación: volumen, tiempos y resultados.' },
  { id: 'audit', group: 'system', label: 'Auditoría', icon: 'history', min: 3, blurb: 'Todo lo que se decide queda registrado, con quién lo hizo.' },
  { id: 'catalog', group: 'system', label: 'Catálogo de cartas', shortLabel: 'Catálogo', icon: 'library_add', min: 3, blurb: 'Agrega cartas nuevas a la base cargando el archivo que genera Carpetazo Update.' },
  { id: 'sync', group: 'system', label: 'Sincronización TCG', shortLabel: 'Sincronización', icon: 'sync', min: 2, blurb: 'Lo que entró en cada corrida nocturna con TCGplayer: cartas y productos nuevos, imágenes completadas y correcciones. Solo lectura.' },
  { id: 'operations', group: 'system', label: 'Operación', icon: 'ecg_heart', min: 3, blurb: 'Estado del sitio, errores del servidor y de la web, y embudo de actividad.' },
  { id: 'tools', group: 'system', label: 'Herramientas', icon: 'build', min: 3, blurb: 'Respaldo de la base, retención de datos y prueba del envío de correos.' }
];
const ROLE_LABELS = { 1: 'Soporte (solo lectura)', 2: 'Moderador', 3: 'Administrador' };

// Los accesos de arriba llevan directo a lo que espera una decisión
const QUEUE_LINKS = [
  { tab: 'reports', label: 'Reportes', field: 'reports' },
  { tab: 'cases', label: 'Estafas', field: 'cases' },
  { tab: 'appeals', label: 'Apelaciones', field: 'appeals' },
  { tab: 'feedback', label: 'Reclamos y sugerencias', field: 'feedback' }
];

export default function Moderation() {
  const { currentUser } = useAuth();
  const [state, setState] = useState('checking'); // checking | denied | ok
  const [tab, setTab] = useState('reports');
  const [summary, setSummary] = useState(null);
  const [level, setLevel] = useState(0);
  const [focusUsername, setFocusUsername] = useState('');
  const [focusReportId, setFocusReportId] = useState('');
  const [sanctionReportId, setSanctionReportId] = useState('');

  useEffect(() => {
    if (!currentUser) { setState('denied'); return undefined; }
    let cancelled = false;
    api.get('/admin/me')
      .then((res) => { if (!cancelled) { setLevel(res?.level || 0); setState(res?.isStaff ? 'ok' : 'denied'); } })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  // Contadores del menú: se actualizan al cambiar de sección y cada minuto
  useEffect(() => {
    if (state !== 'ok') return undefined;
    let cancelled = false;
    const load = () => api.getModerationSummary().then((res) => { if (!cancelled) setSummary(res); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [state, tab]);

  const navItems = TABS.filter((item) => level >= item.min).map((item) => ({
    ...item,
    count: item.id === 'reports' ? summary?.reports : item.id === 'cases' ? summary?.cases : item.id === 'appeals' ? summary?.appeals : item.id === 'feedback' ? summary?.feedback : item.id === 'photos' ? summary?.catalogPhotos : item.id === 'people' ? summary?.pendingBans : 0,
    alert: item.id === 'reports' && (summary?.criticalReports || 0) > 0
  }));
  const current = navItems.find((item) => item.id === tab) || navItems[0];

  const openPerson = (username, reportId) => { setFocusUsername(username); setSanctionReportId(reportId || ''); setTab('people'); };
  const openReport = (id) => { setFocusReportId(id); setTab('reports'); };

  if (state === 'checking') {
    return <LoadingState variant="page" tone="dark" label="Verificando tu acceso…" className="flex-1" />;
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="rounded-3xl border border-[#dbe3f0] bg-white p-8 shadow-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]"><SvgIcon name="lock" translate="no" aria-hidden="true" className="text-[30px]" /></span>
          <h1 className="mt-4 text-xl font-black text-[#12315f]">Acceso restringido</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Esta sección es solo para el equipo de moderación.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] transition-transform duration-150 active:scale-[0.97]">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mod-root mx-auto w-full max-w-[1320px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_70px_-35px_rgba(8,18,42,0.85)] lg:rounded-3xl">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-[#12315f] px-4 py-4 text-white sm:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#facc15] text-[#12315f]"><SvgIcon name="shield_person" translate="no" aria-hidden="true" className="text-[26px]" /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight lg:text-[1.75rem]">Moderación</h1>
              <p className="text-sm font-medium text-blue-100/90">{ROLE_LABELS[level]}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex" role="group" aria-label="Pendientes">
            {QUEUE_LINKS.map((link) => {
              const value = summary?.[link.field] || 0;
              const critical = link.tab === 'reports' && (summary?.criticalReports || 0) > 0;
              return (
                <button key={link.tab} type="button" onClick={() => setTab(link.tab)} className={`flex h-10 items-center gap-2 rounded-full pl-4 pr-2 text-sm font-bold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${value > 0 ? 'bg-white/15 [@media(hover:hover)]:hover:bg-white/25' : 'bg-white/10 text-blue-100/80 [@media(hover:hover)]:hover:bg-white/15'}`}>
                  {link.label}
                  <span className={`min-w-[1.75rem] rounded-full px-2 py-0.5 text-center text-xs font-extrabold tabular-nums ${critical ? 'bg-red-600 text-white' : value > 0 ? 'bg-[#facc15] text-[#12315f]' : 'bg-white/15 text-blue-100'}`}>{value > 99 ? '99+' : value}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="lg:flex lg:items-stretch">
          <ModNav items={navItems} groups={GROUPS} value={tab} onChange={setTab} />
          <div className="min-h-[28rem] min-w-0 flex-1 bg-[#f3f6fc] p-3 sm:p-5 lg:p-7">
            <div className="mb-4 lg:mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-[#12315f] lg:text-2xl">{current?.label}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{current?.blurb}</p>
            </div>
            <div key={tab} className="tab-panel">
              {tab === 'reports' && <ReportsPanel level={level} onOpenPerson={openPerson} initialReportId={focusReportId} onInitialUsed={() => setFocusReportId('')} />}
              {tab === 'cases' && <CasesPanel level={level} onOpenPerson={openPerson} onOpenReport={openReport} />}
              {tab === 'people' && <PeoplePanel level={level} focusUsername={focusUsername} focusReportId={sanctionReportId || undefined} onFocusUsed={() => setFocusUsername('')} onOpenAccount={(username) => { setFocusUsername(username); setTab('account'); }} />}
              {tab === 'account' && level >= 3 && <AccountDetail focusUsername={focusUsername} onFocusUsed={() => setFocusUsername('')} />}
              {tab === 'appeals' && <AppealsPanel level={level} />}
              {tab === 'feedback' && <FeedbackPanel level={level} />}
              {tab === 'photos' && level >= 2 && <CatalogPhotosPanel />}
              {tab === 'team' && level >= 3 && <TeamPanel />}
              {tab === 'reviews' && level >= 3 && <ReviewsPanel />}
              {tab === 'metrics' && level >= 3 && <MetricsPanel />}
              {tab === 'audit' && level >= 3 && <AuditPanel />}
              {tab === 'catalog' && level >= 3 && <CatalogImportPanel />}
              {tab === 'sync' && level >= 2 && <CatalogSyncPanel />}
              {tab === 'operations' && level >= 3 && <OperationsPanel />}
              {tab === 'tools' && level >= 3 && <ToolsPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
