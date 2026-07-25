
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'delivered' | 'incident' | 'cancelled';
export type DocStatus = 'pending' | 'valid' | 'expired' | 'warning';
export type HubType = 'hub' | 'warehouse' | 'office';
export type MapProvider = 'google' | 'mapbox';
export type Country = 'Argentina' | 'Chile' | 'Paraguay' | 'Ushort' | 'Bolivia' | 'Brasil' | 'Uruguay';

export type LoadDocType = 'remito' | 'factura' | 'cot' | 'otro' | 'despacho';

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
  
  // Cargo details for THIS specific stop
  description: string;
  weightKg: number;
  volumeM3: number;
  units: number;
  unitType: string;
  documents: LoadDocument[];
}

export type ExpenseCategory = 
  | 'fuel' 
  | 'toll' 
  | 'meal' 
  | 'lodging' 
  | 'maintenance' 
  | 'parking' 
  | 'documentation' 
  | 'loading_unloading' 
  | 'emergency' 
  | 'other';

export type ExpenseStatus = 'registered' | 'pending_approval' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  loadId: string;
  driverId: string;
  truckId?: string;
  category: ExpenseCategory;
  subCategory?: string;
  amount: number;
  currency: string;
  description: string;
  location: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  createdAt: any;
  approvedAt?: any;
  approvedBy?: string;
  observations?: string;
}

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
  createdAt: any;
  updatedAt: any;
  
  // Datos del acoplado
  semiTrailer?: SemiTrailer;
}

export interface Driver {
  id: string;
  docType: 'DNI' | 'LC' | 'LE' | 'Pasaporte' | 'CI' | 'RUT' | 'RUC' | 'CPF';
  dni: string;
  dniFileUrl?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string;
  nationality: string;
  licenseNumber: string;
  licenseClasses: string[];
  licenseExpiry: string;
  licenseFileUrl?: string;
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
  createdAt: any;
}

export type ClientType = 'company' | 'monotax' | 'government' | 'cooperative' | 'international';
export type ClientCategory = 'premium' | 'regular' | 'occasional' | 'potential' | 'inactive';

export interface ClientContact {
  name: string;
  role: string;
  email: string;
  emailAlt?: string;
  phone: string;
  phoneAlt?: string;
  whatsapp?: string;
}

export interface Client {
  id: string;
  internalCode: string;
  type: ClientType;
  name: string;
  cuit: string; 
  ivaCondition: string;
  industry: string;
  fiscalObservations?: string;
  facadePhotoUrl?: string;
  
  comex?: {
    countryOfOrigin: Country;
    impExpCode: string;
    operatorType: 'importer' | 'exporter' | 'agent' | 'carrier';
    registrations: {
      sicnea: boolean;
      sita: boolean;
      malvina: boolean;
      vucea: boolean;
    }
  };

  mainContact: ClientContact;
  secondaryContacts?: Partial<ClientContact>[];
  
  address: {
    street: string;
    number: string;
    floor?: string;
    barrio?: string;
    city: string;
    province: string;
    country: Country;
    zip: string;
    lat?: number;
    lng?: number;
  };
  
  category: ClientCategory;
  preferredPaymentMethod: string;
  creditLimit: number;
  standardLeadTimeHours: number;
  internalNotes?: string;
  
  status: 'active' | 'inactive';
  createdAt: any;
  updatedAt: any;
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
  };
  
  outboundStops: LoadLegStop[];
  returnStops: LoadLegStop[];

  international?: {
    operationType: 'import' | 'export' | 'transit';
    exitCustoms: string;
    entryCustoms: string;
    declarationNumber: string;
    micDtaNumber: string;
    micDtaExpiry?: string;
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
    categories: Partial<Record<ExpenseCategory, number>>;
  };

  basePrice: number;
  currency: 'ARS' | 'USD' | 'CLP' | 'BRL' | 'PYG' | 'BOB';
  totalAmount: number;
  status: LoadStatus;
  createdAt: any;
  updatedAt: any;

  tracking?: {
    currentLat: number;
    currentLng: number;
    currentSpeed: number;
    avgSpeed: number;
    maxSpeed: number;
    distanceTraveledKm: number;
    distanceRemainingKm: number;
    timeOnRouteMinutes: number;
    timeStoppedMinutes: number;
    estimatedFuelLiters: number;
    lastUpdateAt: any;
    history: TrackingPoint[];
    alerts: DrivingAlert[];
  };
}
