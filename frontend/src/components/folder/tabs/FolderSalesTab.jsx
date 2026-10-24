import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import LiquidTabs from '../../ui/LiquidTabs';
import OrdersTab from '../../orders/OrdersTab';
import InPersonSale from './InPersonSale';

export default function FolderSalesTab({
  cards, copyBuyerLink, folderId, folderOrders, handleOrderUpdated, isActive, ordersLoading, salesView, setCards, setInPersonToolbarVisible, setSalesView, showScrollTop, showToast
}) {
    const pendingCount = folderOrders.filter(o => o.status === 'pending').length;
    // Ventas presenciales de esta carpeta: se suman al historial
    const [inPersonSales, setInPersonSales] = useState([]);
    useEffect(() => {
      if (salesView !== 'historial') return;
      api.getInPersonSales(folderId).then((response) => setInPersonSales(response.sales || [])).catch(() => {});
    }, [salesView, folderId]);
    return (
      <div className="flex flex-col gap-6">
        <LiquidTabs
          ariaLabel="Ventas de esta carpeta"
          value={salesView}
          onChange={setSalesView}
          className="w-full sm:w-max rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200"
          buttonClassName="h-11 whitespace-nowrap rounded-xl px-3 text-sm font-bold sm:px-6 sm:text-base"
          indicatorClassName="rounded-xl bg-[#1e40af]"
          indicatorStyle={{ top: 6, bottom: 6 }}
          activeTextClassName="text-white"
          inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]"
          options={[
            { value: 'presencial', label: 'Presencial' },
            {
              value: 'solicitudes',
              label: (
                <span className="flex items-center justify-center gap-2">
                  Solicitudes
                  {pendingCount > 0 && (
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#ffcb05] px-1.5 font-['Space_Grotesk'] text-xs font-extrabold tabular-nums text-[#1a2b4b]">{pendingCount}</span>
                  )}
                </span>
              )
            },
            { value: 'historial', label: 'Historial' }
          ]}
        />
        {salesView === 'presencial' ? (
          <InPersonSale active={isActive} folderId={folderId} cards={cards} onToolbarVisibilityChange={setInPersonToolbarVisible} showScrollTop={showScrollTop} setCards={setCards} showToast={showToast} />
        ) : (
          <OrdersTab
            showToast={showToast}
            filter={salesView}
            orders={folderOrders}
            inPersonSales={inPersonSales}
            loading={ordersLoading}
            onOrderUpdated={handleOrderUpdated}
            onGoToFolders={copyBuyerLink}
            emptyActionLabel="Copiar enlace de esta carpeta"
          />
        )}
      </div>
    );
}
