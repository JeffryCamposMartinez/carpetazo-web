const decodeMessagePreview = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      if (parsed.imageUrl || parsed.imageBase64) return '📷 Imagen';
      return parsed.text || 'Mensaje nuevo';
    }
  } catch {
    // Mensajes antiguos en texto plano.
  }
  return content || 'Mensaje nuevo';
};

// Campana de notificaciones: pedidos, cartas deseadas en venta, reseñas pendientes y mensajes nuevos.
export default function NotificationBellPanel({
  chatKey, formatOrderTotal, getChatPartner, isNotificationOpen, navigate, notificationChats,
  openNotificationChat, openNotifications, openPendingOrders, openSnapshot, openWishlist, orderAge,
  pendingOrders, reviewPrompts, setIsNotificationOpen, setReviewTarget, totalNotifications, wishMatches
}) {
  return (
    <div className="notification-dropdown relative">
      <button
        type="button"
        onClick={openNotifications}
        aria-label={totalNotifications > 0 ? `${totalNotifications} notificaciones sin atender` : 'Ver notificaciones'}
        aria-haspopup="dialog"
        aria-expanded={isNotificationOpen}
        className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
      >
        <svg viewBox="0 0 50 30" className="h-6 w-8 overflow-visible" aria-hidden="true">
          <g className="origin-[50%_2px] transition-transform duration-500 group-hover:animate-[bellRing_2.3s_ease-in-out]">
            <path className="transition-transform duration-500 group-hover:animate-[bellBall_2.3s_ease-in-out]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" d="M28.7,25 c0,1.9-1.7,3.5-3.7,3.5s-3.7-1.6-3.7-3.5s1.7-3.5,3.7-3.5S28.7,23,28.7,25z" />
            <path fill="#FFFFFF" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" d="M35.9,21.8c-1.2-0.7-4.1-3-3.4-8.7c0.1-1,0.1-2.1,0-3.1h0c-0.3-4.1-3.9-7.2-8.1-6.9c-3.7,0.3-6.6,3.2-6.9,6.9h0 c-0.1,1-0.1,2.1,0,3.1c0.6,5.7-2.2,8-3.4,8.7c-0.4,0.2-0.6,0.6-0.6,1v1.8c0,0.2,0.2,0.4,0.4,0.4h22.2c0.2,0,0.4-0.2,0.4-0.4v-1.8 C36.5,22.4,36.3,22,35.9,21.8L35.9,21.8z" />
          </g>
        </svg>
        {totalNotifications > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef233c] px-1 text-[11px] font-black leading-none text-white shadow-md ring-2 ring-[#11274a]">
            {totalNotifications > 99 ? '99+' : totalNotifications}
          </span>
        )}
      </button>

      {isNotificationOpen && (
        <div role="dialog" aria-label="Notificaciones" className="menu-pop [--menu-origin:top_right] absolute right-0 top-full z-50 mt-2 w-[min(310px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-[#facc15]/40 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/5">
          <div className="bg-gradient-to-r from-[#0f2b57] to-[#1e40af] px-4 py-3 text-white">
            <p className="text-sm font-black">Notificaciones</p>
            <p className="text-xs text-blue-100">Solicitudes de compra y mensajes</p>
          </div>

          {pendingOrders.count > 0 && (
            <div className="border-b border-slate-100 py-2">
              <p className="px-4 pb-1 pt-1 text-xs font-black text-slate-500">
                {pendingOrders.count === 1 ? '1 solicitud de compra por atender' : `${pendingOrders.count} solicitudes de compra por atender`}
              </p>
              {pendingOrders.orders.map(order => (
                <button
                  key={order.id}
                  type="button"
                  onClick={openPendingOrders}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50 ${openSnapshot && new Date(order.createdAt) > new Date(openSnapshot.ordersSince || 0) ? 'bg-blue-50/70' : ''}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15]/25 text-[#12315f] ring-2 ring-[#facc15]/50">
                    <span translate="no" className="material-symbols-outlined text-[22px]">shopping_bag</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-black">
                      Pedido {order.code} · {order.folderName}
                      {openSnapshot && new Date(order.createdAt) > new Date(openSnapshot.ordersSince || 0) && <span className="rounded-full bg-[#ef233c] px-1.5 py-px text-[10px] font-black text-white">Nuevo</span>}
                    </span>
                    <span className="block truncate text-xs font-semibold text-slate-500">
                      {order.cards} {order.cards === 1 ? 'carta' : 'cartas'} · {formatOrderTotal(order.total)} · {orderAge(order.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
              {pendingOrders.count > pendingOrders.orders.length && (
                <p className="px-4 pt-1 text-xs font-semibold text-slate-500">y {pendingOrders.count - pendingOrders.orders.length} más</p>
              )}
            </div>
          )}

          {wishMatches.items > 0 && (
            <div className="border-b border-slate-100 py-2">
              <button type="button" onClick={openWishlist} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-50">
                <span translate="no" className="material-symbols-outlined text-[22px] text-rose-500">favorite</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-800">{wishMatches.items === 1 ? '1 carta de tu lista está disponible' : `${wishMatches.items} cartas de tu lista están disponibles`}</span>
                  <span className="block text-xs font-semibold text-slate-500">Ver quién las vende</span>
                </span>
              </button>
            </div>
          )}

          {reviewPrompts.items.length > 0 && (
            <div className="border-b border-slate-100 py-2">
              <p className="px-4 pb-1 pt-1 text-xs font-black text-slate-500">
                {reviewPrompts.items.length === 1 ? '1 compra por calificar' : `${reviewPrompts.items.length} compras por calificar`}
              </p>
              {reviewPrompts.items.slice(0, 3).map((item) => (
                <button key={item.orderId} type="button" onClick={() => { setIsNotificationOpen(false); setReviewTarget(item); }} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-50">
                  <span translate="no" className="material-symbols-outlined text-[22px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-800">Califica a {item.seller?.name || item.seller?.username || 'tu vendedor'}</span>
                    <span className="block truncate text-xs font-semibold text-slate-500">Pedido {item.code} · {item.folderName}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {notificationChats.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {notificationChats.map(chat => {
                const partner = getChatPartner(chat);
                const unreadCount = Number(chat.unreadCount || 0);
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openNotificationChat(chat)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${openSnapshot?.chatIds.has(chatKey(chat)) ? 'bg-blue-50/70' : ''}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-black text-blue-700 ring-2 ring-[#facc15]/40">
                      {partner.photoURL ? <img src={partner.photoURL} alt="" className="h-full w-full object-cover" /> : (partner.name || partner.username || 'U').charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">{partner.name || partner.username || 'Usuario'}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{decodeMessagePreview(chat.lastMessage || chat.content || '')}</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : pendingOrders.count === 0 && wishMatches.items === 0 && reviewPrompts.items.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-black text-slate-800">Sin notificaciones nuevas</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Las solicitudes de compra y los mensajes aparecerán aquí.</p>
            </div>
          ) : null}

          <div className="flex border-t border-slate-100">
            {pendingOrders.count > 0 && (
              <button type="button" onClick={openPendingOrders} className="flex-1 px-4 py-3 text-sm font-black text-[#1e40af] transition hover:bg-slate-50">
                Ver solicitudes
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen(false);
                navigate('/mensajes');
              }}
              className="flex-1 px-4 py-3 text-sm font-black text-[#1e40af] transition hover:bg-slate-50"
            >
              Ver mensajes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
