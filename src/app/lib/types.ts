
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'on_pause' | 'delivered' | 'incident' | 'cancelled';
export type DocStatus = 'pending' | 'valid' | 'expired' | 'warning';
export type HubType = 'hub' | 'warehouse' | 'office';
export type MapProvider = 'google' | 'mapbox';
export type Country = 'Argentina' | 'Chile' | 'Paraguay' | 'Ushort' | 'Bolivia' | 'Brasil' | 'Uruguay';

export type LoadDocType = 'remito' | 'factura' | 'cot' | 'otro' | 'despacho';

export type OwnershipType = 'company' | 'third_party';

export type MaintenanceType = 'preventive' | 'corrective' | 'inspection';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

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

export interface TenantSettings {
  mapProvider?: MapProvider;
  mapApiKey?: string;
  fleetEngineEnabled?: boolean;
  scoringWeights?: { effective: number; ai: number };
  dailyTopLimit?: number;
  onboardingCompleted?: boolean;
  finalScoreMode?: 'weighted' | 'max';
  requireContactMethod?: string;
  cooldownDays?: number;
  hourlyEmailLimit?: number;
  dailyEmailLimit?: number;
  defaultTemplateId?: string | null;
  smtpConfig?: any;
  centralPhone?: string;
  logoUrl?: string;
  cuit?: string;
}

export interface Tenant {
  id: string;
  name: string;
  settings?: TenantSettings;
  plan?: 'free' | 'pro';
  createdAt?: any;
  updatedAt?: any;
}

export interface LoadDocument {
  id: string;
  type: LoadDocType;
  number: string;
  fileUrl?: string;
  uploadedAt: any;
  notes?: string;
  hasCot?: boolean;
  cotNumber?: string;
  despachoNumber?: string;
  sealNumber?: string;
  leg?: 'outbound' | 'return';
}

export interface LoadLegStop {
  id: string;
  locationId?: string;
  name: string;
  address: string;
  province: string;
  city?: string;
  country: Country;
  contact: string;
  phone: string;
  lat?: number;
  lng?: number;
  instructions?: string;
  dockName?: string;
  
  // Cargo details for THIS specific stop
  description: string;
  weightKg: number;
  volumeM3: number;
  units: number;
  unitType: string;
  documents: LoadDocument[];
}

export interface Expense {
  id: string;
  loadId: string;
  driverId: string;
  truckId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  location: string;
  status: 'registered' | 'approved' | 'rejected';
  createdAt: any;
  
  // Fuel Specific Fields
  liters?: number;
  odometerKm?: number;
  pricePerLiter?: number;
  fuelBrand?: string;
}

export type ExpenseCategory = 'fuel' | 'toll' | 'meal' | 'lodging' | 'maintenance' | 'other';
export type ExpenseStatus = 'registered' | 'approved' | 'rejected';

export interface VehicleDocument {
  id: string;
  name: string;
  category: 'unit' | 'semi' | 'authorization';
  status: DocStatus;
  expiryDate?: string;
  fileUrl?: string;
  description?: string;
  isRequired: boolean;
}

export interface SemiTrailer {
  plate: string;
  brand: string;
  model: string;
  year: number;
  type: string;
  axles: number;
}

export interface TruckCosts {
  // Bloque A: Costos Fijos
  fixed: {
    salaryWithSocial: number;
    insuranceTotal: number;
    patenteMonthly: number;
    satelliteGps: number;
    garageAdmin: number;
    taxesHabilitations: number;
    amortization: number;
  };
  // Bloque B: Costos Variables
  variable: {
    preventiveMaintenance: {
      cost: number;
      frequencyKm: number;
    };
    tires: {
      costFullSet: number;
      lifeSpanKm: number;
    };
    unforeseenReservePerKm: number;
  };
  // Bloque C: Datos Operativos
  operational: {
    estimatedMonthlyKm: number;
  };
}

export interface Truck {
  id: string;
  plate: string;
  chassis: string;
  brand: string;
  model: string;
  year: number;
  axles: number;
  vehicleType: string;
  capacityKg: number;
  volumeM3: number;
  dimensions: { length: number; width: number; height: number };
  bodyType: string;
  grossWeight: number;
  fuelType: string;
  tankLiters: number;
  odometerKm: number;
  avgConsumption: number;
  status: TruckStatus;
  location: { city: string; province: string; country: Country; lat: number; lng: number };
  documentation: VehicleDocument[];
  avatarUrl?: string;
  ownershipType: OwnershipType;
  assignedDriverId?: string;
  createdAt: any;
  updatedAt: any;
  
  // Datos del acoplado
  semiTrailer?: SemiTrailer;
  
  // Estructura de costos
  costs?: TruckCosts;
}

export interface LoadingBay {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'occupied';
}

export interface Driver {
  id: string;
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
  serviceType: 'FTL' | 'LTL' | 'reefer' | 'dangerous' | 'oversized' | 'customs' | 'standard';
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

  proofOfDelivery?: {
    receiverName: string;
    photoUrl?: string;
    receiverSignatureUrl?: string;
    driverSignatureUrl?: string;
    confirmedAt: any;
    notes?: string;
  };
}

export interface OptimizedRouteProposal {
  truckId: string;
  truckPlate: string;
  driverId?: string;
  stops: Client[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
}
