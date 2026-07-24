
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'in_trip' | 'resting' | 'suspended' | 'retired';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'delivered';
export type DocStatus = 'pending' | 'valid' | 'expired' | 'warning';

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
  
  // Especificaciones
  capacityKg: number;
  volumeM3: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  bodyType: string;
  grossWeight: number;
  fuelType: string;
  tankLiters: number;

  // Ubicación y Estado
  status: TruckStatus;
  location: {
    city: string;
    province: string;
    lat?: number;
    lng?: number;
  };
  
  // Documentación (Checklist Digital)
  documentation: VehicleDocument[];
  
  createdAt: any;
  updatedAt: any;
}

export interface Driver {
  id: string;
  // Paso 1
  docType: 'DNI' | 'LC' | 'LE' | 'Pasaporte' | 'CI';
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: string;
  nationality: string;

  // Paso 2
  licenseNumber: string;
  licenseClasses: string[];
  licenseExpiry: string;
  hasLinti: boolean;
  lintiNumber?: string;
  lintiExpiry?: string;
  medicalCertificateExpiry: string;
  experienceYears: number;

  // Paso 3
  phone: string;
  email: string;
  emergencyContact: string;
  emergencyPhone: string;
  address: string;
  bloodType: string;
  healthInsurance: string;
  medicalConditions?: string;

  // Paso 4
  hireDate: string;
  contractType: string;
  status: DriverStatus;
  observations?: string;

  createdAt: any;
  updatedAt: any;
}

export interface Load {
  id: string;
  description: string;
  weightKg: number;
  origin: string;
  destination: string;
  clientName: string;
  status: LoadStatus;
  priceArs: number;
  createdAt: any;
}
