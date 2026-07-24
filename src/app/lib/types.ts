
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'resting' | 'suspended';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'delivered';

export interface Truck {
  id: string;
  plate: string; // Patente
  chassis: string; // VIN
  brand: string;
  model: string;
  year: number;
  axles: number; // Ejes
  vehicleType: string;
  
  // Especificaciones
  capacityKg: number;
  volumeM3: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  bodyType: string; // Carrocería
  grossWeight: number; // PBV
  fuelType: string;
  tankLiters: number;

  // Ubicación y Documentación
  status: TruckStatus;
  location: {
    city: string;
    province: string;
    lat?: number;
    lng?: number;
  };
  vencimientos: {
    soat: string;
    rto: string;
    seguro: string;
  };
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
