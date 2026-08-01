
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'on_pause' | 'delivered' | 'incident' | 'cancelled';
export type DocStatus = 'pending' | 'valid' | 'expired' | 'warning';
export type HubType = 'hub' | 'warehouse' | 'office';
export type MapProvider = 'google' | 'mapbox';
export type Country = 'Argentina' | 'Chile' | 'Paraguay' | 'Ushort' | 'Bolivia' | 'Brasil' | 'UShort' | 'UShort' | 'Uruguay';

export type LoadDocType = 'remito' | 'factura' | 'cot' | 'otro' | 'despacho';

export type OwnershipType = 'company' | 'third_party';

export type MaintenanceType = 'preventive' | 'corrective' | 'inspection';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type DriverRole = 'admin' | 'sales_admin' | 'purchasing_admin' | 'coordinator' | 'manager' | 'warehouse' | 'driver' | 'companion' | 'viewer';

export type UserRole = 'admin' | 'sales_admin' | 'purchasing_admin' | 'coordinator' | 'manager' | 'warehouse' | 'driver' | 'viewer';

export interface AppUser {
  uid: string;
  tenantId: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status: 'active' | 'invited' | 'disabled';
  lastLogin?: any;
  createdAt: any;
}

export interface ProductWarehouse {
  hubId: string;
  hubName: string;
  location?: string; // Ej: Pasillo A, Estante 4
  stockQuantity: number;
  minStock: number;
  maxStock: number;
}

export interface Product {
  id: string;
  sku: string;
  gtin?: string; // EAN-13
  name: string;
  shortName?: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  description: string;
  category: string;
  subCategory?: string;
  productLine?: string;
  family?: string;
  afipRubro?: string;
  
  // Logistics
  unitWeightKg: number;
  dimensions?: { l: number; w: number; h: number };
  unitVolumeM3: number;
  unitType: 'unit' | 'kg' | 'liter' | 'meter' | 'box' | 'bag';
  conversionFactor?: number; // Ej: 1 caja = 12 unidades
  
  // Packaging
  packagingType: 'box' | 'bag' | 'drum' | 'pallet' | 'loose' | 'container';
  unitsPerBox?: number;
  cajasPerPallet?: number;
  unitsPerPallet?: number;
  
  // Inventory Policy
  stockQuantity: number; // Total consolidado
  minStockAlert?: number;
  maxStockAlert?: number;
  managesStock: boolean;
  allowNegativeStock: boolean;
  isLotTracked: boolean;
  isSerialTracked: boolean;
  expiryControl: boolean;
  
  // Stock Levels
  reorderPoint?: number;
  safetyStock?: number;
  leadTimeDays?: number;
  economicOrderQty?: number;
  
  // Multi-Warehouse
  warehouses: ProductWarehouse[];
  
  // Purchasing
  mainSupplierId?: string;
  altSupplierId?: string;
  supplierCode?: string;
  lastCost?: number;
  avgCost?: number;
  currency?: string;
  
  // Sales & Finance
  markup?: number; // Porcentaje de recargo sobre costo
  listPrice?: number;
  wholesalePrice?: number;
  wholesaleDiscount?: number; // Porcentaje de descuento sobre minorista
  distributorPrice?: number;
  retailPrice?: number;
  ivaRate: 0 | 10.5 | 21 | 27;

  // Compliance / Argentina
  ncmCode?: string; // Nomenclatura Común Mercosur
  origin: 'nacional' | 'importado';
  
  // Regulatory
  dangerLevel: 'none' | 'low' | 'medium' | 'high';
  onuNumber?: string;
  requiresReefer: boolean;
  tempRange?: { min: number; max: number };
  
  status: 'active' | 'inactive' | 'suspended';
  photoUrl?: string;
  createdAt: any;
  updatedAt: any;
}

// NUEVO: MODELO DE LAYOUT FÍSICO DE DEPÓSITO
export interface WarehouseSlot {
  id: string; // Ej: P01-R02-N03-C01
  coordinate: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  status: 'empty' | 'occupied' | 'reserved' | 'blocked';
  capacityKg?: number;
  currentWeightKg?: number;
  lastAuditAt?: any;
}

export interface WarehouseRack {
  id: string;
  name: string; // Ej: Rack 02
  levels: number; // Alturas
  columns: number; // Columnas
  slots: WarehouseSlot[];
}

export interface WarehouseAisle {
  id: string;
  name: string; // Ej: Pasillo 01 (A)
  racks: WarehouseRack[];
}

export interface WarehouseSection {
  id: string;
  name: string; // Ej: Sector Refrigerados, Sector A, etc.
  aisles: WarehouseAisle[];
}

export interface WarehouseLayout {
  id: string;
  hubId: string;
  name: string;
  sections: WarehouseSection[];
  updatedAt: any;
}

export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string; // e.g., Load ID or Remito ID
  actorEmail: string;
  createdAt: any;
}

export interface Maintenance {
  id: string;
  orderNumber: string;
  truckId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  scheduledDate: string;
  completedDate?: string;
  odometerAtMaintenance?: number;
  estimatedCost: number;
  actualCost?: number;
  workshopName: string;
  createdAt: any;
  updatedAt: any;
}

export interface LoadingBay {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'occupied';
}

export interface Driver {
  id: string;
  role: DriverRole;
  docType: string;
  dni: string;
  dniFileUrl?: string;
  dniBackFileUrl?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string;
  nationality: string;
  licenseNumber: string;
  licenseClasses: string[];
  licenseExpiry: string;
  licenseFileUrl?: string;
  licenseBackFileUrl?: string;
  hasLinti: boolean;
  lintiNumber?: string;
  lintiExpiry?: string;
  lintiFileUrl?: string;
  hasCnrt: boolean;
  cnrtNumber?: string;
  medicalCertificateExpiry: string;
  experienceYears: number;
  phone: string;
  email: string;
  password?: string; // Contraseña provisoria
  emergencyContact: string;
  emergencyPhone: string;
  address: string;
  bloodType: string;
  healthInsurance: string;
  medicalConditions?: string;
  hireDate: string;
  contractType: string;
  status: DriverStatus;
  observations?: string;
  avatarUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Hub {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  country: Country;
  lat: number;
  lng: number;
  type: HubType;
  phone: string;
  isMainBase?: boolean;
  loadingBays?: LoadingBay[];
  createdAt: any;
  settings?: {
    layoutId?: string;
  }
}

export interface Client {
  id: string;
  internalCode: string;
  name: string;
  cuit: string; 
  address: {
    street: string;
    number: string;
    city: string;
    province: string;
    country: Country;
    zip: string;
    lat?: number;
    lng?: number;
  };
  mainContact: {
    name: string;
    email: string;
    phone: string;
  };
  industry: string;
  facadePhotoUrl?: string;
  status: 'active' | 'inactive';
  createdAt: any;
}

export interface TrackingPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: any;
}

export interface DrivingAlert {
  type: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: any;
}

export interface Load {
  id: string;
  orderNumber: string;
  serviceType: 'FTL' | 'LTL' | 'reefer' | 'dangerous' | 'oversized' | 'customs' | 'standard' | 'meli';
  clientName: string;
  clientId?: string;
  assignedDriverId?: string;
  assignedTruckId?: string;
  
  isRoundTrip: boolean;

  // Planificación Temporal
  pickupDate: string;
  pickupTime: string;
  estimatedArrivalDate: string;
  estimatedArrivalTime: string;
  
  returnPickupDate?: string;
  returnPickupTime?: string;
  returnEstimatedArrivalDate?: string;
  returnEstimatedArrivalTime?: string;

  origin: {
    id?: string;
    name: string;
    phone: string;
    contact: string;
    address: string;
    province: string;
    city?: string;
    country: Country;
    zip: string;
    instructions: string;
    lat?: number;
    lng?: number;
    dockName?: string;
  };

  destination?: {
    id?: string;
    name: string;
    phone: string;
    contact: string;
    address: string;
    province: string;
    city?: string;
    country: Country;
    zip: string;
    instructions: string;
    lat?: number;
    lng?: number;
    dockName?: string;
  };
  
  outboundStops: LoadLegStop[];

  returnStops: LoadLegStop[];
  returnDestination?: {
    id?: string;
    name: string;
    phone: string;
    contact: string;
    address: string;
    province: string;
    city?: string;
    country: Country;
    zip: string;
    instructions: string;
    lat?: number;
    lng?: number;
    dockName?: string;
  };

  international?: {
    operationType: 'import' | 'export' | 'transit';
    exitCustoms: string;
    entryCustoms: string;
    declarationNumber: string;
    micDtaNumber: string;
    containerNumber: string;
    sealNumber: string;
    transportDocType: 'BL' | 'CP' | 'AWB';
    transportDocNumber: string;
    fobValueUsd: number;
    freightValueUsd: number;
    insuranceValueUsd: number;
    cifValueUsd: number;
    importDutiesUsd: number;
    customsIvaUsd: number;
    totalCustomsCostsUsd: number;
    isMalvinaPresented: boolean;
  };

  budget?: {
    initialAdvance: number;
    totalBudget: number;
    driverCommission?: number;
    otherInternalCosts?: number;
    categories: Partial<Record<ExpenseCategory, number>>;
  };

  invoiceNumber?: string;
  basePrice: number;
  totalAmount: number;
  status: LoadStatus;
  createdAt: any;
  updatedAt: any;

  // NUEVO: Control de Despacho en Sede
  dockEntryAuthorized?: boolean;
  dockEntryMessage?: string;

  tracking?: {
    tripStartedAt?: any; // Marca de tiempo de inicio real
    currentLat: number;
    currentLng: number;
    currentSpeed: number;
    avgSpeed: number;
    maxSpeed: number;
    distanceTraveledKm: number;
    distanceRemainingKm: number;
    timeOnRouteMinutes: number;
    timeStoppedMinutes: number;
    lastUpdateAt: any;
    history: TrackingPoint[];
    alerts: DrivingAlert[];
    lastPauseType?: string;
    pauseStartedAt?: any;
    estimatedFuelLiters?: number;
  };

  proofOfDelivery?: ProofOfDelivery;
}

export interface OptimizedRouteProposal {
  truckId: string;
  truckPlate: string;
  driverId?: string;
  stops: PendingRemito[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
}
