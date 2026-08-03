import { Driver } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeDriver(raw: any): Driver {
  return {
    id: raw.id,
    role: raw.role || 'driver',
    docType: raw.docType || '',
    dni: raw.dni || '',
    dniFileUrl: raw.dniFileUrl,
    dniBackFileUrl: raw.dniBackFileUrl,
    firstName: raw.firstName || raw.name || '',
    lastName: raw.lastName || '',
    birthDate: raw.birthDate || '',
    gender: raw.gender,
    nationality: raw.nationality || 'Argentina',
    licenseNumber: raw.licenseNumber || '',
    licenseClasses: raw.licenseClasses || [],
    licenseExpiry: raw.licenseExpiry || '',
    licenseFileUrl: raw.licenseFileUrl,
    licenseBackFileUrl: raw.licenseBackFileUrl,
    hasLinti: Boolean(raw.hasLinti),
    lintiNumber: raw.lintiNumber,
    lintiExpiry: raw.lintiExpiry,
    lintiFileUrl: raw.lintiFileUrl,
    hasCnrt: Boolean(raw.hasCnrt),
    cnrtNumber: raw.cnrtNumber,
    medicalCertificateExpiry: raw.medicalCertificateExpiry || '',
    experienceYears: Number(raw.experienceYears || 0),
    phone: raw.phone || '',
    email: raw.email || '',
    emergencyContact: raw.emergencyContact || '',
    emergencyPhone: raw.emergencyPhone || '',
    address: raw.address || '',
    bloodType: raw.bloodType || '',
    healthInsurance: raw.healthInsurance || '',
    medicalConditions: raw.medicalConditions,
    hireDate: raw.hireDate || '',
    contractType: raw.contractType || '',
    observations: raw.observations,
    avatarUrl: raw.avatarUrl,
    status: raw.status || 'active',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listDrivers() {
  const response = await backendRequest<any[]>('/api/drivers?page=1&pageSize=500');
  return getListData(response).map(normalizeDriver);
}

export async function deleteDriver(id: string) {
  await backendRequest(`/api/drivers/${id}`, { method: 'DELETE' });
}
