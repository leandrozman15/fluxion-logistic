
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'delivered' | 'incident' | 'cancelled';
export type DocStatus = 'pending' | 'valid' | 'expired' | 'warning';
export type HubType = 'hub' | 'warehouse' | 'office';
export type MapProvider = 'google' | 'mapbox';

export interface VehicleDocument {
  id: string;
  name: string;
  category: 'standard' | 'specific' | 'trip';
  status: DocStatus;
  expiryDate?: string;
  fileUrl?: string;
  description?: string;
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
  status: TruckStatus;
  location: { city: string; province: string; lat: number; lng: number };
  documentation: VehicleDocument[];
  createdAt: any;
  updatedAt: any;
}

export interface Driver {
  id: string;
  docType: 'DNI' | 'LC' | 'LE' | 'Pasaporte' | 'CI';
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string;
  nationality: string;
  licenseNumber: string;
  licenseClasses: string[];
  licenseExpiry: string;
  hasLinti: boolean;
  lintiNumber?: string;
  lintiExpiry?: string;
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
  createdAt: any;
  updatedAt: any;
}

export interface Hub {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  type: HubType;
  phone: string;
  isMainBase?: boolean;
  createdAt: any;
}

export interface Client {
  id: string;
  name: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
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
  
  origin: {
    name: string;
    phone: string;
    contact: string;
    address: string;
    province: string;
    city?: string;
    zip: string;
    instructions: string;
    lat?: number;
    lng?: number;
  };
  
  destination: {
    name: string;
    phone: string;
    contact: string;
    address: string;
    province: string;
    city?: string;
    zip: string;
    instructions: string;
    lat?: number;
    lng?: number;
  };

  pickupDate: string;
  pickupTimeFrom: string;
  pickupTimeTo: string;
  deliveryLimitDate: string;
  deliveryTimeFrom: string;
  deliveryTimeTo: string;

  description: string;
  classification: string;
  weightKg: number;
  volumeM3: number;
  units: number;
  unitType: string;

  dangerousGoods?: {
    unClass: string;
    unNumber: string;
    packingGroup: string;
    emergencyPhone: string;
  };
  reefer?: {
    temp: number;
    tolerance: number;
  };

  basePrice: number;
  additionalCosts: {
    peajes: number;
    parking: number;
    handling: number;
    viaticos: number;
    others: number;
  };
  totalTaxes: number;
  totalAmount: number;
  paymentMethod: string;
  billingStatus: 'pending' | 'partial' | 'total' | 'cancelled';

  priority: 'low' | 'medium' | 'high' | 'critical';
  status: LoadStatus;
  assignedTruckId?: string;
  assignedDriverId?: string;
  routePlan?: string;
  distanceKm?: number;
  estimatedHours?: number;
  specialInstructions?: string;

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
    etaEstimated?: any;
    etaAdjusted?: any;
    lastUpdateAt: any;
    history: TrackingPoint[];
    alerts: DrivingAlert[];
  };

  createdAt: any;
  updatedAt: any;
}

export interface TenantSettings {
  mapProvider: MapProvider;
  mapApiKey?: string;
  fleetEngineEnabled?: boolean;
  onboardingCompleted?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  settings?: TenantSettings;
  updatedAt: any;
}
