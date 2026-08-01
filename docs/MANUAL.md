# Manual Exhaustivo de Funciones - LogísticaAr v3.0

Este documento detalla todas las capacidades operativas y técnicas implementadas en la plataforma.

## 1. Monitor Operativo (Dashboard)
- **KPIs en Tiempo Real**: Visualización de entregas finalizadas, salidas programadas, unidades en ruta y alertas de incidentes.
- **Agenda Dinámica**: Listado inteligente de viajes filtrados por "Hoy", "Mañana" y "Semana".
- **Estado de Ruta**: Indicadores visuales de progreso (Carga -> En Tránsito -> Entregas -> Retorno).
- **Mapa Regional**: Localización de sedes, clientes y camiones activos mediante Leaflet con soporte para modo oscuro.

## 2. Módulo Mercado Libre (Última Milla)
- **Scanner IA**: Lectura de etiquetas mediante Visión Artificial para extraer destinatario, dirección y tracking ID.
- **Geocoding Automático**: Conversión inmediata de direcciones de etiquetas a coordenadas GPS mediante Google Maps API.
- **Modo Ráfaga**: Interfaz optimizada para el escaneo continuo de múltiples paquetes, ideal para colectas directas.
- **Optimización de Reparto**: Creación de hojas de ruta urbanas basadas en los paquetes escaneados por el propio chofer.

## 3. Inventario y WMS (Stock)
- **Trazabilidad por Ubicación**: Tabla de stock con filas expandibles para visualizar la coordenada física (Rack), el número de lote y la fecha de entrada de cada bulto.
- **Layout de Racks Virtual**: Mapa interactivo del depósito donde se definen pasillos, cuerpos y niveles. Visualización de slots ocupados, libres, reservados o bloqueados.
- **Gestión de Variantes**: Al registrar productos con variantes (talle, color, modelo), el sistema crea automáticamente registros independientes en el catálogo para un control de stock único por SKU derivado.

## 4. Despacho Inteligente (Optimizer)
- **Buzón de Remitos**: Recepción administrativa de pedidos cargados por ventas para su posterior ruteo.
- **Cálculo IA de Rutas**: Heurística de barrido para agrupar pedidos por proximidad geográfica, minimizando el kilometraje total de la flota.
- **Asignación por Eficiencia**: Empareja las rutas más largas con los camiones de menor consumo promedio para maximizar la rentabilidad operativa.

## 5. Gestión de Flota y Activos
- **Ficha Técnica Legal**: Registro de PBTC, Tara y cálculo automático de Carga Útil habilitada según normativa vial.
- **Gestión Documental Digital**: Almacenamiento en Firebase Storage de Cédula Verde, RTO, VTV y Seguros con sistema de alertas preventivas de vencimiento.
- **Auditoría de Costos**: Desglose de gastos fijos y variables. Cálculo del costo real por KM basado en la media móvil de las cargas de combustible auditadas.
- **Control de Bitrenes**: Soporte para unidades de alto rendimiento (Tipo A/B) con gestión de patentes de doble semirremolque.

## 6. Gestión de Personal (Choferes y Staff)
- **Legajo Digital**: Fotos de perfil y documentos (DNI, Licencia, LINTI) almacenados de forma segura en la nube.
- **Control de Acceso**: Creación de cuentas reales en Firebase Auth con roles específicos (Gerente, Chofer, Administrativo).
- **Historial de Conducción**: Registro de KM acumulados y viajes realizados por cada chofer para evaluación de desempeño.

## 7. Documentación y PDF
- **Ficha Técnica A4**: Generación de documentos técnicos de productos con códigos de barra e información de seguridad Mercosur.
- **Hoja de Ruta Vectorial**: Órdenes de transporte listas para impresión o envío digital, incluyendo QR de seguimiento.
- **Rendición de Gastos**: Reporte PDF de auditoría que cruza el anticipo entregado con los gastos reales declarados por el chofer.

## 8. Seguridad y Arquitectura
- **Aislamiento Multi-Tenant**: Reglas de Firestore que aseguran que la información de cada empresa esté 100% aislada de otras organizaciones.
- **Firebase Storage**: Integración nativa para que todas las imágenes y documentos sean archivos reales, mejorando el rendimiento de la base de datos.
- **Modo Offline**: Cache local persistente que permite a los choferes operar y capturar firmas incluso en zonas sin señal de celular.
