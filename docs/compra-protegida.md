# Compra protegida en Carpetazo: opciones y recomendación

## Punto de partida (lo que hay hoy)
- El comprador arma un pedido y se coordina con el vendedor por WhatsApp o mensaje; el pago es por transferencia fuera de la plataforma. Mercado Pago solo cobra los planes de los vendedores.
- Ya existen: pedidos con código y estados, reseñas, verificación de identidad, ventas en persona, moderación y reportes, datos bancarios opcionales del vendedor.
- Lo que falta es lo que da confianza al comprador desconocido: saber que, si no llega la carta, recupera su dinero.

## Opciones

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **0. Reforzar la confianza sin mover dinero** | Estados del pedido más claros, comprobante de transferencia, «recibí la carta», reseñas solo de pedidos completados, insignias por ventas cumplidas, reclamos | Sin riesgo legal ni de caja; se hace rápido; sirve a todos los vendedores | No devuelve dinero: la protección es reputacional |
| **1. Mercado Pago con split (marketplace)** | Cada vendedor conecta su cuenta de Mercado Pago (OAuth); el comprador paga en Carpetazo, el dinero se reparte solo entre vendedor y plataforma, y la comisión de Carpetazo se cobra con `marketplace_fee` | Carpetazo **no toca el dinero**; cobro con tarjeta, débito o saldo; comisión automática; la documentación del split existe para Chile | El vendedor necesita cuenta de Mercado Pago; plazos de liberación y contracargos dependen de Mercado Pago (no verifiqué sus condiciones en Chile); no es un «escrow» en el que tú decidas cuándo se libera |
| **2. Webpay Plus Mall (Transbank)** | Pasarela chilena para varios comercios | Marca conocida, cualquier tarjeta chilena | Contrato comercial y tiempos de Transbank; la integración «Mall» es más compleja; el vendedor debe ser comercio de Transbank; no encontré fuentes oficiales claras sobre liquidación a terceros |
| **3. Retención propia (escrow manual)** | Carpetazo recibe el pago, lo retiene y lo libera al confirmar la entrega | Máxima protección | Manejar dinero ajeno implica riesgo regulatorio (evaluar con un abogado), contabilidad e impuestos, riesgo de fraude y disputas, y mucho trabajo operativo |

## Recomendación
1. **Ahora, opción 0** (1 a 2 semanas): hace falta igual, no depende de nadie y prepara todo lo demás.
2. **Después, opción 1 como piloto opcional** con 3 a 5 vendedores de confianza. Es la que da protección de pago real sin que Carpetazo maneje dinero, y reutiliza lo que ya hay de Mercado Pago.
3. **No hacer 2 ni 3 por ahora**: más costo, contrato y riesgo para un volumen que todavía no lo justifica.

## Qué incluiría el piloto (opción 1)
- Botón «Conectar Mercado Pago» en el perfil del vendedor (OAuth; se guarda el token cifrado, con renovación cada ~180 días).
- «Pagar con Mercado Pago» en el carrito solo si el vendedor lo conectó; Checkout Pro con `marketplace_fee` (comisión de Carpetazo).
- Webhook que marca el pedido como pagado; la reserva de stock ya existe en el flujo de pedidos y se mantendría.
- Reglas: cancelaciones, reembolsos y qué pasa si el vendedor no despacha, escritas en los Términos antes de abrir el piloto.
- Panel de Moderación con los pagos, reembolsos y reclamos.

## Decisiones que son tuyas (antes de construir nada)
1. ¿La comisión será porcentaje fijo, solo planes pagados o ambos? (Hoy la plataforma se financia con planes.)
2. ¿Quién responde por un reclamo: el vendedor siempre, o Carpetazo cubre algún caso?
3. ¿Se ofrece el pago protegido solo a vendedores verificados?
4. Revisión legal y tributaria (boleta o factura por la comisión, IVA, Términos): conviene un contador y un abogado antes del piloto.

## Qué no verifiqué
- Tarifas y plazos de liberación del dinero de Mercado Pago en Chile, y si hay protección al comprador en este tipo de integración.
- Condiciones comerciales de Transbank para Webpay Plus Mall.
Ambos puntos se confirman con sus equipos comerciales o con la documentación vigente antes de comprometerse.

Fuentes consultadas: documentación de Split de Pagos de Mercado Pago Chile (https://www.mercadopago.cl/developers/es/docs/split-payments/split-1-1/overview) y de integración de marketplace (https://www.mercadopago.cl/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace).
