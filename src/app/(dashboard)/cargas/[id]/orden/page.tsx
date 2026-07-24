
'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { 
  Printer, ArrowLeft, Truck, User, MapPin, 
  Package, Calendar, ShieldCheck, Globe, 
  FileText, Anchor, Loader2
} from "lucide-react";
import { Load, Driver, Truck as TruckType } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function LoadOrderDocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  useEffect(() => {
    async function fetchExtras() {
      if (!db || !load) return;
      try {
        if (load.assignedDriverId) {
          const dSnap = await getDoc(doc(db, "drivers", load.assignedDriverId));
          if (dSnap.exists()) setDriver(dSnap.data() as Driver);
        }
        // Para el MVP, si no hay asignación directa, buscamos el primer camión como ejemplo
        // En producción se usaría load.assignedTruckId
        const tSnap = await getDoc(doc(db, "trucks", "default_truck_id")); // Placeholder logic
        if (tSnap.exists()) setTruck(tSnap.data() as TruckType);
      } catch (e) {
        console.error("Error fetching extras", e);
      } finally {
        setLoadingExtras(false);
      }
    }
    if (load) fetchExtras();
  }, [db, load]);

  const handlePrint = () => {
    window.print();
  };

  if (loadLoading || loadingExtras) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
        <p className="text-slate-500 font-medium">Generando Documento de Transporte...</p>
      </div>
    );
  }

  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
        {/* Controls - Hidden on Print */}
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2" /> Volver
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600">
            <Printer className="mr-2" /> Imprimir / Guardar PDF
          </Button>
        </div>

        {/* The Document */}
        <div className="bg-white shadow-2xl rounded-xl p-12 print:shadow-none print:rounded-none min-h-[297mm] flex flex-col border border-slate-200 print:border-none">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-3xl">
                <Truck size={36} />
                <span>Logística<span className="text-slate-900">Ar</span></span>
              </div>
              <p className="text-[10px] text-slate-500 max-w-[200px] uppercase font-bold tracking-tighter">
                Servicios de Transporte Nacional e Internacional <br />
                Casa Central: Buenos Aires, Argentina
              </p>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black uppercase tracking-tighter">Orden de Transporte</h1>
              <p className="text-4xl font-mono text-blue-600 font-bold">{load.orderNumber}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">Fecha Emisión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>

          {/* Section: Main Cargo Info */}
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block">Dador de Carga / Cliente</h2>
              <div>
                <p className="text-xl font-bold text-slate-900">{load.clientName}</p>
                <p className="text-sm text-slate-600 mt-1">ID Operación: {load.id.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block">Tipo de Servicio</h2>
              <div className="flex items-center gap-2">
                {load.serviceType === 'customs' ? <Globe className="text-blue-600" /> : <Package className="text-blue-600" />}
                <p className="text-lg font-bold capitalize">{load.serviceType.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Section: Route */}
          <div className="grid grid-cols-2 gap-8 p-6 bg-slate-50 rounded-xl border border-slate-200 mb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <MapPin size={14} /> Punto de Carga
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900">{load.origin.name}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{load.origin.address}</p>
                <p className="text-[10px] font-black text-blue-600">{load.origin.province.toUpperCase()}, {load.origin.country.toUpperCase()}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <MapPin size={14} /> Punto de Destino
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900">{load.destination.name}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{load.destination.address}</p>
                <p className="text-[10px] font-black text-blue-600">{load.destination.province.toUpperCase()}, {load.destination.country.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Section: Resources */}
          <div className="grid grid-cols-2 gap-10 mb-10 border-t pt-8">
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase text-slate-400">Personal Asignado</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  <User size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{driver ? `${driver.lastName}, ${driver.firstName}` : 'SIN ASIGNAR'}</p>
                  <p className="text-xs text-slate-500">DNI: {driver?.dni || 'N/A'}</p>
                  <p className="text-[10px] font-bold text-slate-400">Licencia: {driver?.licenseNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase text-slate-400">Unidad de Transporte</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                  <Truck size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Patente: {truck?.plate || 'SIN ASIGNAR'}</p>
                  <p className="text-xs text-slate-500">{truck?.brand} {truck?.model}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidad: {truck?.capacityKg?.toLocaleString()} Kg</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Comex if applicable */}
          {load.serviceType === 'customs' && load.international && (
            <div className="mb-10 p-6 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/30">
              <h2 className="text-sm font-black uppercase flex items-center gap-2 text-blue-800 mb-4">
                <Anchor size={18} /> Información Aduanera (INTERNACIONAL)
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Aduana Salida</p>
                  <p className="text-xs font-bold">{load.international.exitCustoms}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-400">N° Declaración</p>
                  <p className="text-xs font-bold">{load.international.declarationNumber || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Manifiesto MIC/DTA</p>
                  <p className="text-xs font-bold">{load.international.micDtaNumber || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer & QR */}
          <div className="mt-auto border-t pt-10 flex justify-between items-end">
            <div className="space-y-6">
              <div className="flex gap-16">
                <div className="w-48 border-t border-slate-900 text-center pt-2">
                  <p className="text-[10px] font-bold uppercase">Firma Responsable Carga</p>
                </div>
                <div className="w-48 border-t border-slate-900 text-center pt-2">
                  <p className="text-[10px] font-bold uppercase">Firma Transportista</p>
                </div>
              </div>
              <p className="text-[8px] text-slate-400 italic max-w-sm">
                Este documento es una orden de transporte válida. El transportista declara haber recibido la mercadería en óptimas condiciones, salvo anotación en contrario.
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="p-2 border-2 border-slate-100 rounded-lg bg-white">
                <QRCodeSVG value={confirmationUrl} size={100} />
              </div>
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Escaneo de Confirmación</p>
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
