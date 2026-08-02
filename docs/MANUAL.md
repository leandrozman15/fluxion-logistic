# Manual Exhaustivo de Funciones - LogísticaAr v3.0

Este documento detalla todas las capacidades operativas y técnicas implementadas en la plataforma, divididas por perfiles de usuario.

## 1. Monitor Operativo (Dashboard Maestro)
- **KPIs en Tiempo Real**: Visualización de entregas finalizadas, salidas programadas, unidades en ruta y alertas de incidentes.
- **Mapa de Red Regional**: Proyección dinámica de Sedes Propias (Ámbar), Cartera de Clientes (Verde) y Camiones (Azul). Soporte para modo oscuro.
- **Gestión de Alertas S.O.S**: Sistema de alerta temprana donde el icono del camión cambia a rojo vibrante con animación de pulso ante emergencias reportadas por el chofer.
- **Agenda Dinámica**: Listado inteligente de viajes filtrados por "Hoy", "Mañana" y "Semana" con visualización de progreso (Carga -> En Tránsito -> Entregas).
- **Control de Despacho (Dock Control)**: Capacidad de autorizar el ingreso a bocas de carga y enviar mensajes de "Vía Libre" directamente al terminal del chofer.

## 2. Gestión de Flota y Activos
- **Ficha Técnica Legal**: Registro de PBTC, Tara y cálculo automático de Carga Útil habilitada según normativa vial.
- **Asignación de Personal**: Vinculación permanente de un Chofer Principal y múltiples Acompañantes/Ayudantes a cada unidad de tracción.
- **Gestión Documental Digital**: Almacenamiento en Firebase Storage de Cédula Verde, RTO, VTV y Seguros con sistema de alertas preventivas de vencimiento.
- **Auditoría de Costos**: Desglose de gastos fijos y variables. Cálculo del costo real por KM basado en la media móvil de las cargas de combustible auditadas.
- **Control de Bitrenes**: Soporte para unidades de alto rendimiento (Tipo A/B) con gestión de patentes de doble semirremolque y ejes totales.

## 3. Inventario y WMS (Stock)
- **Layout de Racks Virtual**: Mapa interactivo del depósito donde se definen pasillos, cuerpos y niveles. Visualización de slots ocupados, libres, reservados o bloqueados.
- **Trazabilidad por Ubicación**: Gestión de stock indicando la coordenada física exacta (Rack), el número de lote y la fecha de entrada de cada bulto.
- **Ajustes Auditados**: Registro persistente de movimientos (Entrada/Salida/Ajuste) vinculando al usuario que realizó la operación para auditoría contable.
- **Gestión de Variantes**: Soporte para productos con variantes (talle, color, modelo) con control de stock único por SKU derivado.

## 4. Despacho Inteligente (Optimizer)
- **Buzón de Remitos**: Recepción administrativa de pedidos cargados por ventas para su posterior ruteo.
- **Cálculo IA de Rutas**: Heurística de barrido para agrupar pedidos por proximidad geográfica, minimizando el kilometraje total de la flota.
- **Asignación por Eficiencia**: Algoritmo que empareja las rutas más largas con los camiones de menor consumo promedio para maximizar la rentabilidad operativa.

## 5. Aplicación del Chofer (Móvil)
- **Terminal de Conducción**: Interfaz simplificada y optimizada para uso en carretera con botones grandes y alto contraste.
- **Navegación GPS**: Enlace directo a Google Maps con las coordenadas precisas del cliente.
- **Protocolo S.O.S**: Botón de emergencia para reporte inmediato de siniestros, fallas mecánicas o problemas de seguridad.
- **Pruebas de Entrega (POD)**: Captura digital de firma del receptor, firma del chofer y evidencia fotográfica del bulto entregado.
- **Comunicación con Central**: Botones de contacto rápido para llamadas de voz o WhatsApp al número configurado por la empresa.
- **Modo Offline**: Capacidad de operar y capturar firmas sin conexión, sincronizando datos automáticamente al recuperar señal.

## 6. Módulo Mercado Libre (Última Milla)
- **Scanner IA**: Lectura de etiquetas mediante Visión Artificial para extraer destinatario, dirección y tracking ID.
- **Geocoding Automático**: Conversión inmediata de direcciones de etiquetas a coordenadas GPS mediante IA.
- **Modo Ráfaga**: Interfaz optimizada para el escaneo continuo de múltiples paquetes, ideal para colectas directas en depósitos.

## 7. Documentación y PDF
- **Generación Vectorial A4**: Creación programática de Fichas Técnicas de Productos, Hojas de Ruta y Rendiciones de Gastos listas para impresión.
- **Auditoría QR**: Inclusión de códigos QR en documentos físicos para validación digital de la carga.

## 8. Seguridad y Arquitectura
- **Aislamiento Multi-Tenant**: Aislamiento total de datos entre organizaciones mediante reglas de seguridad de Firestore.
- **Acceso por Roles**: Experiencia de usuario diferenciada para Gerentes (Panel de Control) y Choferes (App Móvil).
- **Firebase Studio Core**: Uso intensivo de servicios en la nube para garantizar 99.9% de disponibilidad y escalabilidad.
