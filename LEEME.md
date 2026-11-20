# A&F — versión 0.7

PWA para celular, tablet y PC. HTML, CSS y JS sin compilar, igual que el resto de JPSoft. Se publica en GitHub Pages y usa Firebase (Firestore + Auth) con caché sin conexión.

## Qué hace esta versión

| Pantalla | Quién la usa | Qué hace |
|---|---|---|
| **Salón** | Mozo, encargado, dueño | Mesas por sector, con total, tiempo abierta y avisos (por ejemplo, "2 listos", "sin enviar" o "pidió la cuenta"). Arriba aparece la franja "Listo para llevar". |
| **Comanda** | Mozo | Carta por categorías con buscador tolerante: "milaneza" encuentra "milanesa". Escáner de códigos con la cámara o con un lector USB. Notas por ítem. Enviar a cocina o barra. Precuenta, pasar a otra mesa, cerrar sin cobrar. |
| **Cocina y barra** | Cocina | Pedidos en columnas: Pendiente → En preparación → Listo. Suena un aviso al entrar un pedido y se puede imprimir solo. La pantalla no se apaga. |
| **Cobro** | Encargado (y mozos si se habilita) | Descuento en % o $, pago dividido entre varios medios, vuelto, ticket no fiscal y botón **Facturar en ARCA**. |
| **Caja** | Encargado, dueño | La jornada no se corta a medianoche. Muestra totales por medio de pago, y permite cargar gastos, retiros e ingresos. El cierre hace el arqueo (contado contra esperado) y la anulación de ventas devuelve el stock. |
| **Productos** | Encargado, dueño | Alta y edición con código de barras. Control de stock con aviso de stock bajo. **Ingreso de mercadería escaneando con el celular**. Precios en tanda. |
| **Reservas** | Mozo, encargado, dueño | Reservas por día: confirmar por WhatsApp, sentar en una mesa, "no vino". Las de hoy aparecen arriba del salón. |
| **Compras** | Encargado, dueño | Compras que suman stock (insumos y bebidas) y actualizan el costo. Proveedores con lo que se les debe. |
| **Clientes** | Encargado, dueño | Cuenta corriente: cobrar "a cuenta", registrar pagos y mandar el saldo por WhatsApp. |
| **Vencimientos** | Encargado, dueño | Matafuegos, campana, plagas, habilitación, seguro… con aviso en el salón. |
| **Usuarios** | Dueño | Cuatro roles: dueño, encargado, mozo y cocina. |
| **Ajustes** | Todos | Impresora de cada dispositivo. Datos del negocio, mesas y respaldo completo en Excel (solo encargado y dueño). |

En el celular, la barra de abajo muestra hasta cuatro pantallas y el botón **Más** con el resto. Al mozo le entran todas, así que no lo ve.

## 1. Probarlo ya (modo demo)

Con `firebase: null` en `js/config.js`, la app arranca en **modo demo**: los datos se guardan solo en ese navegador y trae una carta y mesas de ejemplo.

- Subí la carpeta a un repo y activá GitHub Pages, o probá en la PC con `python -m http.server` y abrí `http://localhost:8000`.
- Elegí un usuario (Juan es mozo, Laura es encargada, también está Cocina).
- **Para ver el circuito completo** abrí dos pestañas del mismo navegador: una como Juan y otra como Cocina. Lo que carga el mozo aparece al instante en la cocina.

Con `?demo` al final de la dirección se fuerza el modo demo aunque Firebase esté configurado.

## 2. Conectarlo a Firebase

1. Creá un proyecto nuevo en [console.firebase.google.com](https://console.firebase.google.com) (por ejemplo, `jpsoft-af`).
2. **Authentication → Método de acceso → Correo/contraseña → Habilitar.**
3. **Firestore Database → Crear base de datos** (modo producción, región `southamerica-east1`).
4. **Firestore → Reglas:** pegá el contenido de `firestore.rules` y tocá **Publicar**.
5. **Configuración del proyecto → Tus apps → Web (</>)**. Copiá el objeto `firebaseConfig` y pegalo en `js/config.js`, en lugar de `firebase: null`.
6. **Authentication → Configuración → Dominios autorizados:** agregá `tuusuario.github.io`.
7. En **Authentication → Usuarios → Agregar usuario**, creá tu propia cuenta (la del dueño).
8. Entrá a la app con esa cuenta. Como el negocio todavía no existe, te ofrece **Crear negocio** y quedás como dueño. Hacelo apenas publicás: el primero que entra queda como dueño.
9. Desde **Usuarios** creá a los mozos, al encargado y a la cuenta de cocina. Cada uno entra con su email y su contraseña.

Todo queda guardado en `negocios/af/…`. Si después A&F se vende a otro bar, se cambia `negocioId` y los datos no se mezclan.

## 3. Impresoras (58 y 80 mm)

Cada dispositivo elige su impresora en **Ajustes → Este dispositivo**.

| Modo | Dónde | Conexión | ¿Imprime sin preguntar? |
|---|---|---|---|
| **Bluetooth directo** | Chrome en Android o PC | Térmicas Bluetooth (BLE) | Sí. **Es el recomendado para la tablet de cocina.** |
| **USB directo** | Chrome en Android con cable OTG | USB | Sí |
| **App RawBT** | Android | Bluetooth clásico, USB y **de red/wifi** | Abre RawBT un instante |
| **Impresora de la PC** | Windows | Cualquier impresora instalada (USB o red) | Solo si se configura Chrome en modo kiosco (ver abajo) |

- Los tickets salen con ñ y acentos (página de códigos PC850). Si alguna impresora imprime símbolos raros, activá "Imprimir sin acentos".
- Desde el navegador **no se puede mandar datos directo a una impresora de red**. Para eso están RawBT (en Android) o el driver de Windows (en la PC).
- **Cocina en PC con impresión automática:** creá un acceso directo de Chrome con `--kiosk-printing` al final del destino. Así imprime en la impresora predeterminada sin mostrar el diálogo:
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://tuusuario.github.io/AF/`
- En la tablet de cocina, activá **Imprimir solo** en la pantalla de cocina. Con Bluetooth, la primera vez de cada sesión hay que tocar "Conectar impresora".
- **Antes de comprar la impresora**, conviene que sea térmica ESC/POS con Bluetooth BLE o USB. Las Xprinter, Gprinter y las "58mm Bluetooth" genéricas suelen funcionar.

## 3 bis. Cargar la carta desde Excel

**Productos → Excel** tiene tres opciones:

- **Descargar plantilla:** un Excel con las columnas (Nombre, Categoría, Precio, Prepara, Código de barras, Controla stock, Stock, Stock mínimo, Activo), ejemplos y una hoja de instrucciones. Se lo podés pasar al bar para que lo complete.
- **Importar desde Excel** (.xlsx, .xls, .csv, .ods):
  - Reconoce encabezados con otros nombres: "Producto", "Rubro", "Precio ($)", "Cod. barras"…
  - Entiende precios escritos como `15500`, `15.500` o `$ 15.500`, y los CSV que guarda Excel en Windows.
  - También acepta una **carta sin encabezados**: una fila con la categoría y abajo los productos con su precio.
  - Si no dice quién prepara cada producto, lo deduce: bebidas → Barra; latas, botellas o con código → Mozo; el resto → Cocina.
  - **Antes de guardar muestra qué es nuevo, qué cambia y qué tiene errores**, y descarga una copia de la carta anterior.
  - Los productos se reconocen por código de barras o por nombre, así que reimportar no duplica nada.
  - Opciones: ordenar la carta como en el archivo (activada sola cuando el archivo es la carta completa) y desactivar los productos que no están en el archivo (no los borra).
- **Exportar la carta actual:** sirve de respaldo y para actualizar precios en Excel y volver a importarla.

El lector de Excel (SheetJS) se descarga la primera vez que se usa.

## 3 ter. Carta QR para los clientes

- **Dónde está:** **Ajustes → Carta QR**. Ahí está la dirección de la carta (`carta.html`) y los botones para verla, imprimir los **QR de las mesas** y bajar un **QR general** en PNG para la entrada o Instagram.
- **QR de las mesas:** se imprimen 12 por hoja A4. Cada uno abre la carta con el nombre de la mesa. Usa el id interno de la mesa, así que sigue funcionando aunque la renombres.
- **Actualización:** la carta se publica sola. Cuando un encargado o el dueño tiene la app abierta y cambia productos, precios, stock o mesas, se vuelve a publicar en unos segundos.
- **Qué ven los clientes:**
  - los productos activos con "Mostrar en la carta QR" marcado;
  - los que se quedaron sin stock, como "Agotado";
  - la descripción de cada producto (se carga en el producto o en la columna "Descripción" del Excel);
  - al pie, dirección, horario, Instagram y WhatsApp (se cargan en Ajustes → Negocio).
- **Por qué no expone datos:** la página no inicia sesión. Lee un único documento (`negocios/af/publico/carta`) por la API de Firestore, así que cada visita gasta una sola lectura y no puede ver stock ni ventas.
- **Sin señal:** el teléfono del cliente guarda la última carta que vio y la muestra si se queda sin conexión.
- **Requisito:** **hay que volver a publicar `firestore.rules`**, que ahora incluye la regla `publico`.

## 3 quater. Reportes

En **Reportes** (encargado y dueño) se elige el período: última jornada, últimos 7 días, este mes, mes anterior o fechas a elección. Cada número se compara con el período anterior equivalente.

- **Totales:** vendido, mesas cobradas, ticket promedio, gasto por persona, descuentos y ventas anuladas (las anuladas no se suman).
- **Gráficos:** ventas por día, hora de llegada de las mesas, medios de pago y ventas por categoría. Pasando el mouse o tocando una barra se ve el detalle.
- **Rankings:** productos más vendidos (y los menos pedidos) y rendimiento por mozo.
- **Excel:** exporta el período con las hojas Resumen, Ventas, Productos, Mozos y Días.

El **día comercial empieza a las 6 de la mañana**: lo que se cobra a las 2 de la madrugada cuenta para la noche anterior.

## 3 quinquies. Stock por receta (insumos)

- **Insumos:** se cargan en **Productos → Insumos** (carne, muzzarella, papas, harina, aceite…), cada uno con su unidad (kg, g, l, ml o unidades), el stock, el mínimo para avisar y el costo opcional.
- **Recetas:** en cada producto, la sección **Receta** dice qué insumos usa cada unidad vendida. Por ejemplo, una milanesa napolitana usa 0,25 kg de carne, 0,1 kg de muzzarella y 0,3 kg de papas. Si los insumos tienen costo, se ve el costo del plato y su margen.
- **Cuándo se descuenta:** cuando el mozo **envía** el pedido, no al cobrar. Así el aviso llega durante el servicio. Si se anula un ítem enviado, los insumos vuelven. Lo que se cobra sin haberse enviado se descuenta al cobrar.
- **Avisos:**
  - en el **Salón**, una banda roja con los insumos por debajo del mínimo (solo para encargado y dueño);
  - en la pestaña **Insumos**, un contador;
  - en la carta del mozo, la etiqueta "falta muzzarella" cuando un insumo llega a 0. Avisa pero no bloquea la venta.
- **Ingreso de insumos:** tocás el insumo, escribís cuánto entró y se suma. Un conteo físico se carga editando el stock del insumo.
- **Diferencia con los productos envasados:** el stock de las bebidas y otros envasados (con "Controlar stock") se sigue descontando al cobrar.
- **Requisito:** hay que volver a publicar `firestore.rules`, que ahora incluye la regla `insumos`.

## 3 sexies. Reservas, compras, clientes, vencimientos y respaldo (v0.6)

**Antes de usar esta versión hay que volver a publicar `firestore.rules`.** Trae reglas para `reservas`, `proveedores`, `compras`, `clientes`, `movClientes` y `recordatorios`. Sin ellas, esas pantallas no guardan.

### Reservas
- Se cargan por día con nombre, teléfono, hora, personas, mesa (opcional) y una nota.
- **WhatsApp** abre el chat con el mensaje de confirmación ya escrito. Al volver, la app pregunta si confirmó.
- **Sentar** abre la mesa con los comensales de la reserva y la marca como sentada. Si la mesa asignada está ocupada, deja elegir otra.
- En el **Salón**:
  - las reservas de hoy aparecen arriba, con el botón Sentar;
  - una reserva pasa a "demorada" 15 minutos después de la hora;
  - la mesa reservada se marca en azul desde 3 horas antes;
  - al abrir una mesa reservada, la app pregunta si es la reserva.
- En la **carta QR** hay un botón **Reservar mesa**: el cliente completa nombre, día, hora y personas, y se abre WhatsApp con el pedido. No se guarda solo; lo carga el bar al confirmar. Aparece si en Ajustes hay un WhatsApp cargado, y se puede apagar.

### Compras y proveedores
- **Nueva compra:** se elige el proveedor y se buscan o escanean los ítems que llegaron, con cantidad y costo.
- **Qué se actualiza:**
  - los insumos suman stock y toman el costo nuevo, así el costo de las recetas queda al día;
  - las bebidas y los envasados suman stock y guardan el último costo.
- **Cómo se paga:**
  - con **efectivo de la caja**: queda como gasto en el arqueo;
  - por **transferencia u otro medio**: no toca la caja;
  - **queda debiendo**: se suma a lo que se le debe al proveedor.
- Los **pagos a proveedores** se registran desde la ficha de cada uno.
- Una compra o un pago se pueden **anular**: se revierte el stock y la deuda. Si fue con la caja todavía abierta, también se quita el gasto.

### Clientes con cuenta corriente
- **Cobrar a cuenta:** en el cobro aparece el medio **Cuenta corriente**. Al elegirlo, se elige el cliente (o se crea uno nuevo, solo encargado y dueño). Se puede combinar con otros medios; por ejemplo, la mitad en efectivo y la otra mitad a cuenta.
- La venta queda registrada como cualquier otra. Lo que va a cuenta **no entra al arqueo** de efectivo.
- En **Clientes**:
  - el saldo de cada uno y el total que te deben;
  - los movimientos;
  - **Registrar pago**: un pago en efectivo con la caja abierta entra como ingreso en el arqueo;
  - **WhatsApp**: manda el saldo pendiente.
- **Anular** una venta cargada a cuenta descuenta ese monto del saldo.
- Se puede apagar en **Ajustes → Negocio**.

### Vencimientos
- Hay plantillas listas: matafuegos, campana, plagas, tanque de agua, habilitación, seguro y carnet de manipulación.
- Cada vencimiento tiene una fecha, cada cuánto se repite y con cuántos días de anticipación avisar.
- El **Salón** muestra los vencidos (en rojo) y los próximos (en ámbar) a encargado y dueño.
- **Hecho** pasa la fecha al próximo vencimiento.

### Respaldo
- **Dónde:** en **Ajustes → Respaldo**, que descarga un Excel con todo.
- **Qué incluye:**
  - la carta, en el mismo formato del importador, así se puede volver a cargar;
  - insumos y recetas;
  - mesas;
  - ventas y su detalle;
  - cajas y movimientos de caja;
  - clientes y cuentas corrientes;
  - proveedores y compras;
  - reservas, vencimientos y usuarios;
  - el registro de cambios.
- Al **cerrar la caja**, si pasaron 7 días desde el último respaldo, la app lo sugiere con un botón para descargarlo ahí mismo.
- Los datos ya están en Firebase. El respaldo sirve como copia propia, para guardarla en el Drive o en la PC.

## 3 septies. Logo, contactos y firma (v0.7)

- **Logo:** debajo de A&F van las dos hojas con el tenedor, como en el cartel del bar. En el menú de la PC, el logo va sobre una tarjeta blanca. En toda la app dice solo "A&F".
- **Íconos al instalar:** el logo ocupa casi todo el ícono.
  - En la PC y en Windows, el ícono va sin fondo.
  - En Android se adapta a la forma del celular (círculo, cuadrado redondeado), sobre fondo blanco.
  - En iPhone usa `apple-touch-icon.png`.
  - Para ver el ícono nuevo hay que desinstalar la app y volver a instalarla.
- **Contactos de la carta QR:** van al pie, como en la carta de Dairus: WhatsApp, Instagram, Facebook y la dirección, cada uno con su logo y como enlace directo.
  - Se cargan en **Ajustes → Negocio**. Los que quedan vacíos no aparecen.
  - La dirección abre Google Maps. Se puede pegar el enlace exacto del local, el de "Compartir" en Maps.
- **Firma "Desarrollado por Joaquín Pedemonte"** con WhatsApp, en:
  - la pantalla de inicio;
  - el pie del menú en la PC;
  - el menú de usuario, en el celular;
  - el final de Ajustes;
  - la carta QR.
- **Categorías:**
  - en el alta de producto, el desplegable muestra todas las categorías y la opción **＋ Nueva categoría…**;
  - en **Productos → Categorías** se renombran y se ordenan; el orden es el de la carta QR y el de la comanda;
  - la categoría "Menúes" pasa sola a llamarse "Menús" la primera vez que un dueño o encargado abre esta versión.
- **Carta QR:** las etiquetas de arriba quedan marcadas al tocarlas y siguen la sección que se está viendo. El desplazamiento con el dedo ya no se corta.

## 4. Escáner de códigos

- **Android (Chrome):** usa el lector que trae el navegador. Es rápido y funciona sin conexión.
- **iPhone:** Safari no trae ese lector, así que la primera vez se descarga uno en WebAssembly (ZXing, unos cientos de KB). Después queda guardado.
- **PC:** cualquier lector de mano USB o Bluetooth "tipo teclado" funciona en la comanda y en Productos, sin configurar nada.
- **Dónde se escanea:**
  - en la comanda, para cargar una lata o una botella a la mesa;
  - en Productos, para cargar el código;
  - en **Productos → Escanear → Asignar códigos**, que muestra uno por uno los productos sin código (primero bebidas y envasados): escaneás el envase y pasa al siguiente, con botones para saltear o volver;
  - en **Productos → Escanear → Ingreso de mercadería**, donde cada escaneo suma stock y se puede elegir de a 1, 6, 12 o 24. Los códigos que no existen se pueden **asignar a un producto que ya está cargado** (y se suman las unidades) o dar de alta como producto nuevo.
- La cámara solo funciona con `https` (GitHub Pages ya lo tiene) o en `localhost`.

## 5. Sin conexión

Firestore guarda una copia local. Si se corta el wifi, la app sigue funcionando: se abren mesas, se cargan pedidos y se cobra. Todo se sube solo cuando vuelve la red. Arriba aparece "Sin conexión" en rojo.

Para que eso no rompa los números:
- el stock se descuenta siempre con **incrementos**, nunca pisando el valor, así dos celulares vendiendo a la vez no se pisan;
- el número de venta lleva el código del dispositivo (`C15-0001`), así nunca se repite.

Lo único que necesita conexión es **entrar por primera vez** en cada dispositivo.

## 6. Archivos

```
index.html  carta.html  manifest.json  sw.js  firestore.rules
css/app.css
js/config.js       ← configuración (Firebase, ARCA)
js/app.js          ← arranque, sesión, menú, navegación
js/db.js           ← capa de datos (demo o Firebase)
js/db-demo.js  js/db-firebase.js
js/store.js        ← estado, roles, datos del dispositivo
js/util.js  js/buscar.js  js/scanner.js  js/print.js
js/importar.js     ← carta desde/hacia Excel
js/publicar.js     ← mantiene publicada la carta QR
js/carta.js        ← página pública de la carta
js/vendor/qrcode.mjs ← generador de QR (Kazuhiko Arase, licencia MIT)
js/respaldo.js     ← respaldo completo en Excel
js/firma.js        ← firma del desarrollador y contactos (WhatsApp, redes, Maps)
js/vistas/         ← salon, mesa, cobro, cocina, caja, productos, insumos, reportes,
                     reservas, compras, clientes, recordatorios, usuarios, ajustes
```

**Colecciones** (dentro de `negocios/{id}/`): `config`, `usuarios`, `mesas`, `productos`, `insumos`, `comandas`, `items`, `ventas`, `jornadas`, `movCaja`, `reservas`, `proveedores`, `compras`, `clientes`, `movClientes`, `recordatorios`, `logs`, `publico`.

## 7. De dónde salió cada cosa

- **JPSoft Tienda:**
  - cobro con descuento y medios de pago;
  - caja por turnos (pasó a jornada con arqueo);
  - anulaciones con historial;
  - alta de usuarios con una segunda instancia de Firebase;
  - modo sin conexión.
- **Dietética Josué:** buscador tolerante y fonético, escáner con cámara y detección del lector USB.
- **Dairus Rosario:** precios en tanda y reservas.
- **JPSoft Cocheras:** grilla (pasó a mapa de mesas), botón de ARCA, recordatorios y respaldo a Excel.

Problemas de los proyectos anteriores que esta versión no hereda:
- se descuenta stock con incrementos;
- los ítems guardan el id del producto, así las anulaciones devuelven bien el stock;
- no se guarda ninguna contraseña en el navegador;
- si falla la lectura del rol, no se entra como administrador;
- los roles se controlan en las reglas de Firestore.

## 8. Lo que sigue

- "Llamar al mozo" desde la carta QR
- Fotos de los productos en la carta QR
- Promos tipo "2 pintas + papas" o 2x1 en tragos
- Facturación electrónica con ARCA (cuando haga falta)
