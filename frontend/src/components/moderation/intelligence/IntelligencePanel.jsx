import { PeriodBar, usePeriod } from './intelUi';
import OverviewView from './OverviewView';
import AudienceView from './AudienceView';
import ProductView from './ProductView';
import { BusinessView, FunnelsView } from './BusinessView';
import HealthView from './HealthView';
import ExplorerView from './ExplorerView';

const VIEWS = { overview: OverviewView, audience: AudienceView, product: ProductView, funnels: FunnelsView, business: BusinessView, health: HealthView, explorer: ExplorerView };

// Un solo selector de periodo para todas las vistas de Carpetazo Intelligence (se recuerda mientras dura la pestaña)
export default function IntelligencePanel({ view, go }) {
  const period = usePeriod();
  const View = VIEWS[view] || OverviewView;
  return (
    <>
      <PeriodBar period={period} />
      <View period={period} go={(target) => target && go(`intel_${target}`)} />
    </>
  );
}
