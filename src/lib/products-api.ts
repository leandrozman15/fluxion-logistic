import { Product } from '@/app/lib/types';
import { backendRequest, getListData } from '@/lib/backend-api';

function normalizeProduct(raw: any): Product {
  return {
    id: raw.id,
    sku: raw.sku || '',
    gtin: raw.gtin,
    name: raw.name || '',
    shortName: raw.shortName,
    brand: raw.brand,
    model: raw.model,
    manufacturer: raw.manufacturer,
    description: raw.description || '',
    category: raw.category || '',
    subCategory: raw.subCategory,
    productLine: raw.productLine,
    family: raw.family,
    afipRubro: raw.afipRubro,
    unitWeightKg: Number(raw.unitWeightKg || 0),
    dimensions: raw.dimensions,
    unitVolumeM3: Number(raw.unitVolumeM3 || 0),
    unitType: raw.unitType || 'unit',
    conversionFactor: raw.conversionFactor,
    packagingType: raw.packagingType || 'box',
    unitsPerBox: raw.unitsPerBox,
    cajasPerPallet: raw.cajasPerPallet,
    unitsPerPallet: raw.unitsPerPallet,
    stockQuantity: Number(raw.stockQuantity || 0),
    minStockAlert: raw.minStockAlert,
    maxStockAlert: raw.maxStockAlert,
    managesStock: Boolean(raw.managesStock),
    allowNegativeStock: Boolean(raw.allowNegativeStock),
    isLotTracked: Boolean(raw.isLotTracked),
    isSerialTracked: Boolean(raw.isSerialTracked),
    expiryControl: Boolean(raw.expiryControl),
    hasVariants: Boolean(raw.hasVariants),
    variants: raw.variants || [],
    warehouses: raw.warehouses || [],
    mainSupplierId: raw.mainSupplierId,
    altSupplierId: raw.altSupplierId,
    supplierCode: raw.supplierCode,
    lastCost: raw.lastCost,
    avgCost: raw.avgCost,
    currency: raw.currency,
    markup: raw.markup,
    listPrice: raw.listPrice,
    wholesalePrice: raw.wholesalePrice,
    wholesaleDiscount: raw.wholesaleDiscount,
    distributorPrice: raw.distributorPrice,
    retailPrice: raw.retailPrice,
    ivaRate: raw.ivaRate || 21,
    ncmCode: raw.ncmCode,
    origin: raw.origin || 'nacional',
    dangerLevel: raw.dangerLevel || 'none',
    onuNumber: raw.onuNumber,
    requiresReefer: Boolean(raw.requiresReefer),
    tempRange: raw.tempRange,
    status: raw.status || 'active',
    photoUrl: raw.photoUrl,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  } as Product;
}

export async function listProducts() {
  const response = await backendRequest<any[]>('/api/products?page=1&pageSize=500');
  return getListData(response).map(normalizeProduct);
}

export async function deleteProduct(id: string) {
  await backendRequest(`/api/products/${id}`, { method: 'DELETE' });
}
