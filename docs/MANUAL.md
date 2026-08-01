# Manual Exhaustivo de Funciones - LogísticaAr v3.0

Este documento detalla todas las capacidades operativas y técnicas implementadas en la plataforma.

## 1. Monitor Operativo (Dashboard)
- **KPIs en Tiempo Real**: Visualización de entregas finalizadas, salidas programadas, unidades en ruta, facturación mensual y alertas de incidentes.
- **Agenda Dinámica**: Listado inteligente de viajes filtrados por "Hoy", "Mañana" y "Semana".
- **Estado de Ruta**: Indicadores visuales de progreso (Carga -> En Tránsito -> Entregas -> Retorno).
- **Mapa Regional**: Localización de sedes, clientes y camiones activos mediante Leaflet.

## 2. Módulo Mercado Libre (Última Milla)
- **Scanner IA**: Lectura de etiquetas mediante Visión Artificial para extraer destinatario, dirección y tracking ID.
- **Geocoding Automático**: Conversión inmediata de direcciones de etiquetas a coordenadas GPS.
- **Modo Ráfaga**: Interfaz optimizada para el escaneo continuo de múltiples paquetes.
- **Optimización de Reparto**: Creación de hojas de ruta urbanas basadas en los paquetes escaneados.

## 3. Despacho Inteligente (Optimizer)
- **Buzón de Remitos**: Recepción de pedidos cargados por administración.
- **Cálculo IA de Rutas**: Agrupamiento de pedidos por proximidad geográfica para minimizar el kilometraje.
- **Asignación por Eficiencia**: Cruza el consumo promedio del camión con la distancia de la ruta para maximizar la rentabilidad.

## 4. Gestión de Flota y Activos
- **Ficha Técnica**: Registro de PBTC, Tara y cálculo automático de Carga Útil habilitada.
- **Gestión Documental**: Almacenamiento en Firebase Storage de Cédula Verde, RTO, VTV y Seguros con semáforo de vencimientos.
- **Auditoría de Costos**: Desglose de gastos fijos y variables. Cálculo del costo real por KM basado en la media móvil de combustible.
- **Control de Bitrenes**: Configuración especial para unidades de alto rendimiento (Tipo A/B) con doble semirremolque.

## 5. Gestión de Personal (Choferes y Staff)
- **Legajo Digital**: Fotos de perfil y documentos (DNI, Licencia, LINTI) almacenados en la nube.
- **Control de Acceso**: Creación de cuentas en Firebase Auth vinculadas al rol (Gerente, Chofer, Administrativo).
- **Historial de Conducción**: Registro de KM acumulados y viajes realizados por cada chofer.

## 6. Catálogo de Productos y Variantes
- **Estructura Madre-Variante**: Creación de productos base (ej. "Venecitas") con múltiples variantes (color, medida) que heredan propiedades pero tienen SKU y stock propio.
- **Logística del Producto**: Registro de peso, volumen, unidades por caja y factor de conversión.
- **Seguridad**: Clasificación de peligrosidad (ONU) y requisitos de cadena de frío (Reefer).

## 7. Layout de Racks (Depósito)
- **Configuración Visual**: Definición de corredores, cuerpos y niveles de estantería.
- **Gestión de Slots**: Control de estado (Disponible, Ocupado, Bloqueado, Reservado) para cada posición física.
- **Trazabilidad**: Asignación de productos, lotes y fechas de entrada/salida a coordenadas exactas.

## 8. Cargas, Remitos y Documentación
- **Buzón de Remitos**: Ingreso administrativo con fotos de documentos físicos.
- **Hoja de Ruta A4**: Generación de documentos vectoriales listos para imprimir o enviar por WhatsApp.
- **Billetera de Viaje**: Registro de gastos en ruta (combustible, peajes, comida) con auditoría de saldos y anticipos.
- **POD (Prueba de Entrega)**: Captura de firma digital del receptor y foto de evidencia de descarga.

## 9. Seguridad y Multi-Tenant
- **Aislamiento de Datos**: Reglas de Firestore que aseguran que cada empresa solo vea su propia información.
- **Storage Seguro**: Archivos protegidos y organizados por organización.
- **Modo Offline**: Cache local persistente para que los choferes operen en zonas sin señal de celular.
