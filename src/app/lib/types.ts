
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'on_pause' | 'delivered' | 'incident' | 'cancelled' | 'archived';
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

export interface Truck {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  axles: number;
  grossCombinedWeightKg: number;
  unladenWeightKg: number;
  capacityKg: number;
  odometerKm: number;
  avgConsumption: number;
  status: TruckStatus;
  hasActiveAlert?: boolean; 
  alertType?: 'security' | 'mechanical' | 'accident';
  ownershipType: OwnershipType;
  haulingType: 'standard' | 'bitren' | 'chassis';
  location?: {
    city: string;
    province: string;
    country: string;
    lat: number;
    lng: number;
  };
  assignedDriverId?: string;
  assignedCompanionIds?: string[];
  avatarUrl?: string;
  documentation: VehicleDocument[];
  semiTrailer?: {
    plate: string;
    brand: string;
    model: string;
    type: string;
  };
  bitren?: {
    type: 'type_a' | 'type_b';
    firstSemiPlate: string;
    secondSemiPlate: string;
    totalAxles: number;
  };
  costs?: TruckCosts;
  updatedAt: any;
  createdAt: any;
}

export interface TruckCosts {
  fixed: {
    salaryWithSocial: number;
    insuranceTotal: number;
    patenteMonthly: number;
    satelliteGps: number;
    garageAdmin: number;
    taxesHabilitations: number;
    amortization: number;
  };
  variable: {
    preventiveMaintenance: { cost: number; frequencyKm: number };
    tires: { costFullSet: number; lifeSpanKm: number };
    unforeseenReservePerKm: number;
  };
  operational: {
    estimatedMonthlyKm: number;
  };
}

export interface VehicleDocument {
  id: string;
  name: string;
  category: 'unit' | 'semi' | 'authorization';
  description: string;
  expiryDate?: string;
  status: DocStatus;
  fileUrl?: string;
  isRequired: boolean;
}

export interface ProductWarehouse {
  hubId: string;
  hubName: string;
  location?: string; 
  stockQuantity: number;
  minStock: number;
  maxStock: number;
  lotNumber?: string;
  entryDate?: string;
}

export interface ProductVariant {
  id: string;
  sku: string; 
  value: string; 
  photoUrl?: string;
  cost?: number;
  markup?: number;
  price?: number;
  stockQuantity: number;
}

export interface Product {
  id: string;
  sku: string;
  gtin?: string; 
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
  
  unitWeightKg: number;
  dimensions?: { l: number; w: number; h: number };
  unitVolumeM3: number;
  unitType: 'unit' | 'kg' | 'liter' | 'meter' | 'box' | 'bag';
  conversionFactor?: number; 
  
  packagingType: 'box' | 'bag' | 'drum' | 'pallet' | 'loose' | 'container';
  unitsPerBox?: number;
  cajasPerPallet?: number;
  unitsPerPallet?: number;
  
  stockQuantity: number; 
  minStockAlert?: number;
  maxStockAlert?: number;
  managesStock: boolean;
  allowNegativeStock: boolean;
  isLotTracked: boolean;
  isSerialTracked: boolean;
  expiryControl: boolean;
  
  hasVariants: boolean;
  variants: ProductVariant[];

  reorderPoint?: number;
  safetyStock?: number;
  leadTimeDays?: number;
  economicOrderQty?: number;
  
  warehouses: ProductWarehouse[];
  
  mainSupplierId?: string;
  altSupplierId?: string;
  supplierCode?: string;
  lastCost?: number;
  avgCost?: number;
  currency?: string;
  
  markup?: number; 
  listPrice?: number;
  wholesalePrice?: number;
  wholesaleDiscount?: number; 
  distributorPrice?: number;
  retailPrice?: number;
  ivaRate: 0 | 10.5 | 21 | 27;

  ncmCode?: string; 
  origin: 'nacional' | 'importado';
  
  dangerLevel: 'none' | 'low' | 'medium' | 'high';
  onuNumber?: string;
  requiresReefer: boolean;
  tempRange?: { min: number; max: number };
  
  status: 'active' | 'inactive' | 'suspended';
  photoUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface WarehouseSlot {
  id: string; 
  coordinate: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  status: 'empty' | 'occupied' | 'reserved' | 'blocked';
  capacityKg?: number;
  currentWeightKg?: number;
  quantityUnits?: number;
  lotNumber?: string;
  entryDate?: string;
  expirationDate?: string;
  optionalExitDate?: string;
  notes?: string;
  lastAuditAt?: any;
  materials?: WarehouseSlotMaterial[];
}

export interface WarehouseSlotMaterial {
  productId: string;
  productSku: string;
  productName: string;
  quantityUnits: number;
  lotNumber?: string;
  entryDate?: string;
  expirationDate?: string;
  optionalExitDate?: string;
  notes?: string;
}

export interface WarehouseRack {
  id: string;
  name: string; 
  levels: number; 
  columns: number; 
  slots: WarehouseSlot[];
}

export interface WarehouseAisle {
  id: string;
  name: string; 
  racks: WarehouseRack[];
}

export interface WarehouseSection {
  id: string;
  name: string; 
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
  referenceId?: string; 
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
  password?: string; 
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
    layoutConfig?: {
      corridors: string[];
      positions: number;
      levels: number;
      prefix: string;
    };
    mapApiKey?: string;
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
  creditLimit: number;
  defaultPaymentMethod?: string;
  createdAt: any;
  updatedAt?: any;
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

  dockEntryAuthorized?: boolean;
  dockEntryMessage?: string;

  tracking?: {
    tripStartedAt?: any; 
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
    // Tramo de regreso a base: se inicia manualmente por el chofer tras terminar las entregas de ida.
    returnStartedAt?: any;
    returnArrivedAt?: any;
    // Snapshot de distanceTraveledKm al iniciar el regreso, para poder separar km de ida vs. regreso.
    outboundDistanceKm?: number;
  };

  proofOfDelivery?: ProofOfDelivery;
}

export interface LoadLegStop {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  country: Country;
  zip?: string;
  phone?: string;
  contact?: string;
  lat: number;
  lng: number;
  description?: string;
  weightKg: number;
  volumeM3: number;
  units: number;
  unitType: string;
  dockName?: string;
  documents: LoadDocument[];
  deliveredAt?: string;
  failedAt?: string;
  proofOfDelivery?: ProofOfDelivery;
}

export interface LoadDocument {
  id: string;
  type: LoadDocType;
  number: string;
  pendingRemitoId?: string;
  cotNumber?: string;
  fileUrl: string;
  uploadedAt: string;
  leg: 'outbound' | 'return';
}

export interface ProofOfDelivery {
  receiverName: string;
  receiverSignatureUrl: string;
  driverSignatureUrl?: string;
  photoUrl?: string;
  confirmedAt: string;
  notes?: string;
  status: 'delivered' | 'failed';
  failedReason?: 'absent' | 'refused' | 'address_error' | 'other';
}

export interface OptimizedRouteProposal {
  truckId: string;
  truckPlate: string;
  driverId?: string;
  stops: PendingRemito[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
}

export interface PendingRemito {
  id: string;
  number: string;
  cotNumber?: string;
  clientId: string;
  clientName: string;
  clientCuit?: string;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  weightKg: number;
  volumeM3: number;
  notes?: string;
  items: PendingRemitoItem[];
  fileUrl?: string;
  status: 'pending' | 'dispatched' | 'delivered' | 'archived';
  loadId?: string;
  dispatchedDate?: string;
  deliveredAt?: string;
  createdAt: any;
  updatedAt: any;
}

export interface PendingRemitoItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  weightKg: number;
  volumeM3: number;
  photoUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  monthlyFee: number;
  subscriptionStatus: 'active' | 'suspended';
  activationDate?: string;
  expirationDate?: string;
  settings: TenantSettings;
  createdAt: any;
  updatedAt: any;
}

export interface TenantSettings {
  logoUrl?: string;
  cuit: string;
  country?: string;
  adminEmail?: string;
  legalAddress?: string;
  legalCityState?: string;
  centralPhone?: string;
  responsibleName?: string;
  enabledModules: string[];
  mapProvider: MapProvider;
  mapApiKey?: string;
  fleetEngineEnabled?: boolean;
  gpsIntervalSeconds: number;
  onboardingCompleted?: boolean;
  smtpConfig?: SmtpConfig;
}

export interface SmtpConfig {
  user: string;
  pass: string;
  fromName?: string;
}

export interface Expense {
  id: string;
  loadId: string;
  truckId: string;
  driverId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  location: string;
  receiptNumber?: string;
  docsPresented?: boolean;
  status: 'registered' | 'approved' | 'rejected';
  liters?: number; 
  pricePerLiter?: number;
  createdAt: any;
  updatedAt: any;
}

export type ExpenseCategory = 'fuel' | 'toll' | 'meal' | 'lodging' | 'maintenance' | 'other';

export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'ordered';

export interface QuotationItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  ivaRate: number;
  subtotal: number;
  total: number;
  photoUrl?: string;
  warehouseId?: string;
}

export interface Quotation {
  id: string;
  number: string;
  date: string;
  expiryDate: string;
  
  clientId: string;
  clientName: string;
  clientCuit: string;
  ivaCondition: string;
  
  branchId?: string;
  sellerId?: string;
  sellerName?: string;
  priceListId?: string;
  
  currency: 'ARS' | 'USD' | 'BRL';
  exchangeRate: number;

  items: QuotationItem[];
  
  subtotal: number;
  commercialDiscount: number;
  logisticSurcharge: number;
  taxTotal: number;
  totalAmount: number;

  includeTransport: boolean;
  transportPaidBy: 'company' | 'client';
  freightValue: number;
  deliveryType: string;
  deliveryAddress: string;

  paymentMethod: string;
  paymentTerm: string;
  deliveryTimeDays: number;
  warrantyInfo: string;

  status: QuotationStatus;
  notes: string; // Visible al cliente
  internalNotes: string; // Solo empresa
  
  tenantId: string;
  createdAt: any;
  updatedAt: any;
}
