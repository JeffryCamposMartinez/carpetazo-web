import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';

export default function OrdersTab({ currentUser, showToast, filter = 'solicitudes', orders = [] }) {
  const updateOrderStatus = async (order, newStatus) => {
    try {
      // 1. Actualizar estado de la orden
      await updateDoc(doc(db, 'orders', order.id), { status: newStatus });
      
      // 2. Si se completa, restar el stock real
      if (newStatus === 'completed') {
        if (!order.folderId) {
          console.warn("La orden no tiene folderId, no se puede descontar stock.");
        } else {
          for (const item of order.items) {
            const cardRef = doc(db, 'folders', order.folderId, 'cards', item.id);
            const cardSnap = await getDoc(cardRef);
            if (cardSnap.exists()) {
              const currentStock = parseInt(cardSnap.data().stock) || 0;
              const purchasedQty = parseInt(item.quantity) || 0;
              const newStock = Math.max(0, currentStock - purchasedQty);
              await updateDoc(cardRef, { stock: newStock });
            }
          }
        }
      }

      // No es necesario actualizar el estado local (setOrders) porque onSnapshot en Dashboard 
      // actualizará la lista de pedidos en tiempo real.
      showToast(`Pedido marcado como ${newStatus === 'completed' ? 'Completado' : 'Cancelado'} y stock actualizado.`);
    } catch (error) {
      console.error("Error actualizando orden:", error);
      showToast("Hubo un error al actualizar la orden.");
    }
  };

  const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Fecha desconocida';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('es-CL', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'solicitudes') {
      return order.status === 'pending';
    }
    if (filter === 'historial') {
      return order.status === 'completed';
    }
    return true;
  });

  if (filteredOrders.length === 0) {
    return (
      <div className="py-20 text-center text-gray-500 flex flex-col items-center">
        <span translate="no" className="material-symbols-outlined text-6xl mb-4 opacity-30">
          {filter === 'historial' ? 'history' : 'receipt_long'}
        </span>
        <h3 className="text-xl font-bold mb-2 text-gray-900">
          {filter === 'historial' ? 'Tu historial está vacío' : 'No tienes solicitudes pendientes'}
        </h3>
        <p>
          {filter === 'historial' 
            ? 'Aún no tienes ventas concretadas.' 
            : 'Cuando un cliente genere un pedido nuevo, aparecerá aquí.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {filter === 'historial' ? (
        <div className="animate-[fadeIn_0.4s_ease-out]">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-5 text-xs font-bold text-gray-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-600 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-600 uppercase tracking-wider">Carpeta</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <span translate="no" className="material-symbols-outlined text-[16px] opacity-50">calendar_today</span>
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-bold text-gray-900 text-base">{order.buyerName || 'Cliente Anónimo'}</p>
                        <p className="text-xs text-gray-500 mt-1">{order.items?.length || 0} cartas en el pedido</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-medium">
                          {order.folderName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-lg text-primary">
                        {formatCLP(order.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {order.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold px-3 py-1.5 rounded-full">
                            <span translate="no" className="material-symbols-outlined text-[14px]">check_circle</span> Completado
                          </span>
                        )}
                        {order.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 bg-error/10 text-error border border-error/20 text-xs font-bold px-3 py-1.5 rounded-full">
                            <span translate="no" className="material-symbols-outlined text-[14px]">cancel</span> Cancelado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile List View */}
          <div className="md:hidden flex flex-col gap-4">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-200 pb-3">
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg leading-tight">{order.buyerName || 'Cliente Anónimo'}</h4>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                      <span translate="no" className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono font-extrabold text-lg text-primary">{formatCLP(order.total)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-500 flex flex-col items-start gap-1">
                    <span className="bg-blue-50 text-[#1e40af] border border-[#1e40af]/20 px-2 py-0.5 rounded-full">
                      {order.folderName}
                    </span>
                    <span className="ml-1 opacity-80">{order.items?.length || 0} cartas</span>
                  </div>
                  
                  <div>
                    {order.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold px-2 py-1 rounded-full">
                        <span translate="no" className="material-symbols-outlined text-[14px]">check_circle</span> Completado
                      </span>
                    )}
                    {order.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1 bg-error/10 text-error border border-error/20 text-xs font-bold px-2 py-1 rounded-full">
                        <span translate="no" className="material-symbols-outlined text-[14px]">cancel</span> Cancelado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-[fadeIn_0.4s_ease-out]">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-3xl p-6 flex flex-col shadow-sm">
              <div className="flex justify-between items-start mb-4 border-b border-gray-200 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-gray-900">{order.buyerName || 'Cliente Anónimo'}</h3>
                    {order.status === 'pending' && <span className="bg-blue-50 text-[#1e40af] text-xs font-bold px-2 py-0.5 rounded-full border border-[#1e40af]/20">Pendiente</span>}
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <span translate="no" className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {formatDate(order.createdAt)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Carpeta: {order.folderName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-xl font-extrabold text-[#1e40af]">{formatCLP(order.total)}</p>
                </div>
              </div>

              <div className="flex-1 mb-6">
                <h4 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Cartas ({order.items?.length || 0})</h4>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded-lg text-sm">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-bold text-gray-900">{item.quantity}x</span>
                        <span className="truncate text-gray-600">{item.name}</span>
                      </div>
                      <span className="text-gray-900 font-mono font-medium">{formatCLP(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {order.status === 'pending' && (
                <div className="flex gap-3 mt-auto pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => updateOrderStatus(order, 'cancelled')}
                    className="flex-1 py-2.5 rounded-xl text-error bg-error/10 hover:bg-error/20 font-bold transition-colors flex justify-center items-center gap-2"
                  >
                    <span translate="no" className="material-symbols-outlined text-sm">close</span> Cancelar
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order, 'completed')}
                    className="flex-[2] py-2.5 rounded-xl text-white bg-green-600 hover:bg-green-500 font-bold transition-colors flex justify-center items-center gap-2 shadow-lg shadow-green-900/20"
                    title="Marca como pagado y resta el stock de las cartas"
                  >
                    <span translate="no" className="material-symbols-outlined text-sm">check</span> Completar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
