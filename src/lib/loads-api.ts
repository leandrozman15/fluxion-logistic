import { Load } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeLoad(raw: any): Load {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber || '',
    serviceType: raw.serviceType || 'standard',
    clientName: raw.clientName || '',
    clientId: raw.clientId,
    assignedDriverId: raw.assignedDriverId,
    assignedTruckId: raw.assignedTruckId,
    isRoundTrip: Boolean(raw.isRoundTrip),
    pickupDate: raw.pickupDate || '',
    pickupTime: raw.pickupTime || '',
    estimatedArrivalDate: raw.estimatedArrivalDate || '',
    estimatedArrivalTime: raw.estimatedArrivalTime || '',
    returnPickupDate: raw.returnPickupDate,
    returnPickupTime: raw.returnPickupTime,
    returnEstimatedArrivalDate: raw.returnEstimatedArrivalDate,
    returnEstimatedArrivalTime: raw.returnEstimatedArrivalTime,
    origin: raw.origin || {
      name: '',
      phone: '',
      contact: '',
      address: '',
      province: '',
      country: 'Argentina',
      zip: '',
      instructions: '',
    },
    destination: raw.destination,
    outboundStops: raw.outboundStops || [],
    returnStops: raw.returnStops || [],
    returnDestination: raw.returnDestination,
    international: raw.international,
    budget: raw.budget,
    invoiceNumber: raw.invoiceNumber,
    basePrice: Number(raw.basePrice || 0),
    totalAmount: Number(raw.totalAmount || 0),
    status: raw.status || 'pending',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    tracking: raw.tracking,
    proofOfDelivery: raw.proofOfDelivery,
    dockEntryAuthorized: raw.dockEntryAuthorized,
    dockEntryMessage: raw.dockEntryMessage,
  } as Load;
}

export async function listLoads() {
  const response = await backendRequest<any[]>('/api/loads?page=1&pageSize=500');
  return getListData(response).map(normalizeLoad);
}
