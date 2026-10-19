// Textos de ayuda de cada sección (botón «?» junto al título). Cada tema: qué es, pasos y un consejo opcional.
export const HELP_TOPICS = {
  cartas: {
    title: 'Cartas en venta',
    intro: 'Aquí ves las cartas con stock de todas las carpetas públicas y comparas quién las vende más barato.',
    steps: [
      'Busca por nombre o por código de la carta (con o sin «/»). Si te equivocas al escribir, te sugerimos el nombre correcto.',
      'Filtra por juego en el panel, por comuna, y ordena por más recientes, más vendidos, última edición o precio.',
      'Toca una carta para ver todas las ofertas de esa misma carta y quién la vende.',
      'El corazón la guarda en tu lista de deseos; te avisamos cuando aparezca o baje de precio.'
    ],
    tip: 'Si nadie la vende todavía, abajo aparecen fichas del catálogo: son solo informativas, no son ofertas de venta.'
  },
  carpetas: {
    title: 'Carpetas',
    intro: 'Catálogos públicos de jugadores y tiendas.',
    steps: [
      'Abre una carpeta para ver sus cartas, precios y stock.',
      'Filtra por juego, busca por nombre de carpeta o vendedor, y ordena por visitas o nombre.',
      'Desde la carpeta puedes armar un pedido y el vendedor lo confirma contigo.'
    ]
  },
  vendedores: {
    title: 'Vendedores',
    intro: 'Personas y tiendas que tienen carpetas públicas.',
    steps: [
      'Busca por nombre o usuario, y filtra por comuna.',
      'Toca un vendedor para ver su perfil, sus carpetas y sus reseñas.',
      'La insignia azul indica una cuenta verificada y PRO o Tienda indican su plan.'
    ]
  },
  misCarpetas: {
    title: 'Mis carpetas',
    intro: 'Tus catálogos para vender: cada carpeta agrupa las cartas de un juego.',
    steps: [
      'Crea una carpeta con «Nueva carpeta» y elige su juego y color.',
      'Ábrela para agregar cartas, ajustar stock y precios, o registrar ventas.',
      'Si la dejas pública, cualquiera puede verla; copia su enlace para compartirla.',
      'Cuántas carpetas y cartas puedes tener depende de tu plan (menú «Mi plan»).'
    ]
  },
  deseadas: {
    title: 'Mi lista de deseos',
    intro: 'Las cartas que buscas, para que los vendedores sepan qué te interesa.',
    steps: [
      'Busca una carta y agrégala a tu lista.',
      'Activa los avisos para enterarte por correo o en el dispositivo cuando aparezca o baje de precio.',
      'Puedes exportar la lista en PDF para compartirla.'
    ]
  },
  solicitudes: {
    title: 'Solicitudes de compra',
    intro: 'Pedidos que te hacen los compradores desde tus carpetas públicas.',
    steps: [
      'Revisa el pedido y, si puedes venderlo, toca «Confirmar venta»: el stock se descuenta solo.',
      'Si no puedes, recházalo.',
      'Coordina la entrega y el pago con el comprador por mensajes.'
    ],
    tip: 'Los pedidos pendientes reservan stock un tiempo corto, así no se vende dos veces la misma carta.'
  },
  historial: {
    title: 'Historial de ventas',
    intro: 'Todo lo que has vendido y los pedidos rechazados.',
    steps: [
      'Cambia el período (30 días, 3 meses, 12 meses o todo) y filtra por carpeta o estado.',
      'El gráfico de ingresos se puede ver por día, semana o mes.',
      'Las ventas presenciales también aparecen aquí con la etiqueta «Presencial».',
      'Con «Exportar CSV» descargas el detalle en una planilla.'
    ]
  },
  folderAdd: {
    title: 'Agregar cartas',
    intro: 'Busca la carta en el catálogo y súmala a esta carpeta.',
    steps: [
      'Escribe el nombre o el código de la carta (aceptamos errores pequeños) y filtra por edición si quieres.',
      'Toca la carta y revisa el panel de la derecha.',
      '«Usar» pone el precio de referencia del mercado; puedes cambiarlo.',
      'Indica el stock y el idioma, y agrégala a la carpeta.'
    ]
  },
  folderCatalog: {
    title: 'Carpeta (inventario)',
    intro: 'Las cartas que ya tienes en esta carpeta.',
    steps: [
      'Cambia stock, precio e idioma de cada carta; se guardan solos.',
      'Ordena con «Mi orden», más vendidos, última edición, nombre o precio.',
      'Arrastra las cartas para ordenarlas a tu gusto y guarda el orden.',
      '«Vista comprador» muestra cómo la ve quien compra; «Copiar enlace» te da el enlace para compartirla.'
    ]
  },
  folderPresencial: {
    title: 'Venta presencial',
    intro: 'Para anotar lo que vendiste en persona (feria, torneo, junta) y descontarlo del stock.',
    steps: [
      'Toca las cartas que vendiste: cada toque suma una copia. Con − y + ajustas la cantidad.',
      'Si la vendiste a otro precio, escríbelo debajo de la carta.',
      'Abajo ves cuántas cartas y el total de la venta.',
      'Toca «Vender» y confirma: el stock baja y la venta queda en tu historial como «Presencial».'
    ],
    tip: 'No es un pedido y no cambia los precios de mercado. Una vez registrada, el stock se corrige a mano si te equivocaste.'
  },
  folderSolicitudes: {
    title: 'Solicitudes de esta carpeta',
    intro: 'Pedidos de compradores para esta carpeta.',
    steps: ['Confirma la venta para descontar el stock, o recházala.', 'Coordina con el comprador por mensajes.']
  },
  folderHistorial: {
    title: 'Historial de esta carpeta',
    intro: 'Ventas y pedidos rechazados de esta carpeta, incluidas las ventas presenciales.',
    steps: ['Cambia el período y el estado, y abre una fila para ver las cartas.', 'Exporta el detalle con «Exportar CSV».']
  }
};
