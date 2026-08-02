# LogísticaAr v3.0 - Fluxion Logistic

Sistema integral de gestión logística y ERP profesional para el transporte de carga pesada y última milla en el Mercosur.

## 🚀 Características Principales

### 📊 Monitor Operativo (Control Hub)
- **Seguimiento en Vivo**: Monitoreo de telemetría GPS, velocidad y consumo estimado de combustible en tiempo real.
- **Alertas S.O.S**: Gestión inmediata de incidentes de seguridad, mecánicos o accidentes.
- **Agenda Dinámica**: Control de salidas programadas, tramos de ida/vuelta y cierres de jornada.

### 🚛 Gestión de Flota y Activos
- **Legajo Digital**: Almacenamiento certificado de documentación (VTV, RTO, Seguros, LINTI, CNRT).
- **Auditoría de Costos**: Cálculo automático del **Costo Real por KM** basado en gastos auditados vs telemetría.
- **Control de Bitrenes**: Soporte para unidades de alto rendimiento y doble semirremolque.

### 📦 WMS e Inventario (Almacén)
- **Mapa de Racks Virtual**: Visualización física de las estanterías por sede, corredor y niveles.
- **Trazabilidad por Lote**: Gestión de existencias con coordenadas exactas en depósito.
- **Ajustes Auditados**: Registro de cada movimiento de stock para auditoría contable.

### 📈 ERP Comercial y Presupuestos
- **Cotizaciones Pro**: Emisión de presupuestos multimoneda con fotos de productos y cálculos de IVA.
- **Generación A4**: Generación vectorial de Fichas Técnicas, Hojas de Ruta y Rendiciones de Gastos.

### 📱 App del Chofer
- **Terminal Móvil**: Interfaz optimizada para carretera con botones de alto contraste.
- **Pruebas de Entrega (POD)**: Captura de firmas digitales (Chofer y Receptor) y evidencia fotográfica en pantalla completa.
- **Modo Offline**: Capacidad de operar y capturar firmas sin conexión, sincronizando al recuperar señal.

## 🛠️ Stack Tecnológico
- **Framework**: Next.js 15 (App Router)
- **Base de Datos**: Firebase Firestore (Multi-tenant)
- **Archivos**: Firebase Storage (Documentación y POD)
- **Autenticación**: Firebase Auth
- **UI**: Tailwind CSS + ShadCN UI + Lucide Icons
- **IA**: Google Genkit + Gemini 2.5 Flash

## 📦 Configuración y Despliegue

1. **Clonar y Preparar**:
   ```bash
   git clone https://github.com/leandrozman15/fluxion-logistic.git
   cd fluxion-logistic
   npm install
   ```

2. **Variables de Entorno**:
   Crea un archivo `.env` basado en `.env.example` con tus credenciales de Firebase.

3. **Conectar a GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: LogísticaAr v3.0 completo"
   git branch -M main
   git remote add origin https://github.com/leandrozman15/fluxion-logistic.git
   git push -u origin main
   ```

---
*Desarrollado para la eficiencia y transparencia en el transporte terrestre.*
