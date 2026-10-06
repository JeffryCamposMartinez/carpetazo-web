import LoadableImage from '../../ui/LoadableImage';
// Carrito del catálogo público: cartas elegidas, total y envío del pedido.
export default function CatalogCartDrawer({
  cart, cartTotal, currentUser, formatCLP, handleMessageCheckout, handleWhatsAppCheckout,
  isProcessingCheckout, messageMode, removeFromCart, setIsCartOpen, socialEnabled
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-end" onClick={() => setIsCartOpen(false)}>
      <div className="bg-white border-l border-gray-200 w-full max-w-md h-full p-6 flex flex-col shadow-2xl animate-[slideIn_0.3s_ease_forwards]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <h2 className="font-headline-md text-2xl font-bold flex items-center gap-2 text-gray-900">
            <span translate="no" className="material-symbols-outlined">shopping_cart</span> Tu Pedido
          </h2>
          <button aria-label="Cerrar carrito" className="text-gray-500 hover:text-gray-900 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsCartOpen(false)}>
            <span translate="no" className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar pr-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
              <span translate="no" className="material-symbols-outlined text-6xl mb-2">shopping_bag</span>
              <p>Tu carrito está vacío.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                <span className="relative block h-20 w-14 shrink-0 overflow-hidden rounded-md bg-gray-200 shadow-sm"><LoadableImage src={item.imageUrl} alt={item.name} compact className="h-full w-full object-cover" /></span>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="font-bold text-sm text-gray-900 leading-tight mb-1 line-clamp-2">{item.name}</p>
                  <p className="text-gray-500 text-xs mb-1">{item.set}</p>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs font-bold text-gray-700">{item.quantity}x</span>
                    <span className="text-[#1e40af] font-bold text-sm">{formatCLP(item.price)} c/u</span>
                  </div>
                </div>
                <button className="absolute top-2 right-2 text-error/50 hover:text-error w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors" onClick={() => removeFromCart(item.id)}>
                    <span translate="no" className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-xl font-bold text-gray-900 mb-4">
            <span>Total a pagar:</span>
            <span className="text-[#1e40af] text-2xl">{formatCLP(cartTotal)}</span>
          </div>

          {!currentUser && !messageMode && (
            <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
              Estás comprando sin cuenta. Puedes pedir igual, pero <strong>no podrás calificar al vendedor</strong> después.
              <button type="button" onClick={() => window.dispatchEvent(new Event('carpetazo:open-auth'))} className="ml-1 font-extrabold underline">Iniciar sesión</button>
            </div>
          )}
          {!messageMode && (
            <button
              className="w-full text-white p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-[#25D366] hover:bg-[#128C7E] shadow-[0_4px_15px_rgba(37,211,102,0.3)]"
              disabled={cart.length === 0 || isProcessingCheckout}
              onClick={handleWhatsAppCheckout}
            >
              <span translate="no" className="material-symbols-outlined text-2xl">
                {isProcessingCheckout ? 'hourglass_empty' : 'chat'}
              </span>
              {isProcessingCheckout ? 'Procesando...' : 'Generar Pedido por WhatsApp'}
            </button>
          )}
          {(messageMode || socialEnabled('showMessageButton')) && (
            <button
              className={`w-full p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${messageMode ? 'text-white bg-[#1e40af] hover:bg-[#1d4ed8] shadow-[0_4px_15px_rgba(30,64,175,0.3)]' : 'mt-2 text-[#1e40af] bg-white ring-2 ring-[#1e40af] hover:bg-blue-50'}`}
              disabled={cart.length === 0 || isProcessingCheckout || !socialEnabled('showMessageButton')}
              onClick={handleMessageCheckout}
            >
              <span translate="no" className="material-symbols-outlined text-2xl">
                {isProcessingCheckout ? 'hourglass_empty' : 'mail'}
              </span>
              {isProcessingCheckout ? 'Procesando...' : currentUser ? 'Enviar pedido por mensaje' : 'Iniciar sesión y enviar pedido por mensaje'}
            </button>
          )}
          <p className="text-[10px] text-center text-gray-500 mt-3">
            {!messageMode
              ? socialEnabled('showMessageButton')
                ? 'WhatsApp abre un chat con el detalle de tu pedido. Por mensaje, el pedido llega al vendedor dentro de Carpetazo con un código (necesitas una cuenta). En ambos casos coordinan el pago y el envío directamente.'
                : 'Al presionar, se abrirá WhatsApp con el detalle de tu pedido para coordinar el pago y envío directamente con el vendedor.'
              : socialEnabled('showMessageButton')
                ? 'Este vendedor no usa WhatsApp. Tu pedido le llegará como mensaje de Carpetazo con el detalle y un código, y ahí coordinan el pago y el envío. Necesitas una cuenta.'
                : 'Este vendedor no recibe pedidos por WhatsApp ni por mensaje por ahora.'}
          </p>
        </div>
      </div>
    </div>
  );
}
