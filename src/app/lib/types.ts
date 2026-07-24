
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'resting' | 'suspended';
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
  name: string;
  dni: string;
  licenseNumber: string;
  phone: string;
  status: DriverStatus;
  lintiVencimiento?: string;
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
