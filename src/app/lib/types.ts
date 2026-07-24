
export type TruckStatus = 'available' | 'in_trip' | 'maintenance';
export type DriverStatus = 'active' | 'resting' | 'suspended';
export type LoadStatus = 'pending' | 'assigned' | 'on_route' | 'delivered';

export interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  capacityKg: number;
  status: TruckStatus;
  location: {
    city: string;
    province: string;
  };
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
