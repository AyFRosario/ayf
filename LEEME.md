# A&F · Gestión del bar — versión 0.2

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
| **Usuarios** | Dueño | Cuatro roles: dueño, encargado, mozo y cocina. |
| **Ajustes** | Todos | Impresora de cada dispositivo. Datos del negocio y mesas (solo encargado y dueño). |

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

## 4. Escáner de códigos

- **Android (Chrome):** usa el lector que trae el navegador. Es rápido y funciona sin conexión.
- **iPhone:** Safari no trae ese lector, así que la primera vez se descarga uno en WebAssembly (ZXing, unos cientos de KB). Después queda guardado.
- **PC:** cualquier lector de mano USB o Bluetooth "tipo teclado" funciona en la comanda y en Productos, sin configurar nada.
- **Dónde se escanea:**
  - en la comanda, para cargar una lata o una botella a la mesa;
  - en Productos, para cargar el código;
  - en **Ingreso de mercadería**, donde cada escaneo suma stock y se puede elegir de a 1, 6, 12 o 24. Los códigos que no existen se dan de alta al terminar.
- La cámara solo funciona con `https` (GitHub Pages ya lo tiene) o en `localhost`.

## 5. Sin conexión

Firestore guarda una copia local. Si se corta el wifi, la app sigue funcionando: se abren mesas, se cargan pedidos y se cobra. Todo se sube solo cuando vuelve la red. Arriba aparece "Sin conexión" en rojo.

Para que eso no rompa los números:
- el stock se descuenta siempre con **incrementos**, nunca pisando el valor, así dos celulares vendiendo a la vez no se pisan;
- el número de venta lleva el código del dispositivo (`C15-0001`), así nunca se repite.

Lo único que necesita conexión es **entrar por primera vez** en cada dispositivo.

## 6. Archivos

```
index.html  manifest.json  sw.js  firestore.rules
css/app.css
js/config.js       ← configuración (Firebase, ARCA)
js/app.js          ← arranque, sesión, menú, navegación
js/db.js           ← capa de datos (demo o Firebase)
js/db-demo.js  js/db-firebase.js
js/store.js        ← estado, roles, datos del dispositivo
js/util.js  js/buscar.js  js/scanner.js  js/print.js
js/vistas/         ← salon, mesa, cobro, cocina, caja, productos, usuarios, ajustes
```

**Colecciones** (dentro de `negocios/{id}/`): `config`, `usuarios`, `mesas`, `productos`, `comandas`, `items`, `ventas`, `jornadas`, `movCaja`, `logs`.

## 7. De dónde salió cada cosa

- **JPSoft Tienda:**
  - cobro con descuento y medios de pago;
  - caja por turnos (pasó a jornada con arqueo);
  - anulaciones con historial;
  - alta de usuarios con una segunda instancia de Firebase;
  - modo sin conexión.
- **Dietética Josué:** buscador tolerante y fonético, escáner con cámara y detección del lector USB.
- **Dairus Rosario:** precios en tanda.
- **JPSoft Cocheras:** grilla (pasó a mapa de mesas) y botón de ARCA.

Problemas de los proyectos anteriores que esta versión no hereda:
- se descuenta stock con incrementos;
- los ítems guardan el id del producto, así las anulaciones devuelven bien el stock;
- no se guarda ninguna contraseña en el navegador;
- si falla la lectura del rol, no se entra como administrador;
- los roles se controlan en las reglas de Firestore.

## 8. Lo que sigue (fase 2)

- Carta QR por mesa (`?mesa=5`) y reservas (de Dairus)
- Stock por receta / insumos en gramos (base: los combos de Tienda)
- Compras y proveedores, clientes con cuenta corriente
- Reportes por período, productos más vendidos, rendimiento por mozo
- Recordatorios (habilitación, matafuegos, campana, plagas) y backup a Excel (de Cocheras)
- Promos tipo "2 pintas + papas"
