
'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Truck as TruckIcon, FileText, Calendar, AlertTriangle, 
  CheckCircle2, Clock, Upload, ArrowLeft, ShieldCheck, 
  MapPin, Gauge, Box, Info, Download, Trash2, MoreVertical
} from "lucide-react";
import { Truck, VehicleDocument, DocStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isBefore, isAfter, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const DEFAULT_DOCS: Omit<VehicleDocument, 'status'>[] = [
  { id: 'cedula', name: 'Cédula de Identificación (Verde)', category: 'standard', description: 'Título de propiedad del vehículo.' },
  { id: 'seguro', name: 'Seguro Obligatorio', category: 'standard', description: 'Responsabilidad Civil vigente.' },
  { id: 'rto', name: 'Revisión Técnica (RTO/VTV)', category: 'standard', description: 'Certificado de aptitud técnica.' },
  { id: 'ruta', name: 'Permiso RUTA', category: 'standard', description: 'Registro Único del Transporte Automotor.' },
  { id: 'linti', name: 'Habilitación LINTI', category: 'specific', description: 'Para transporte interjurisdiccional y cargas peligrosas.' },
  { id: 'bitren', name: 'Permiso Bitrén / Config. Especial', category: 'specific', description: 'Habilitación para tramos específicos de red vial.' }
];

export default function TruckDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const truckRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "trucks", id as string);
  }, [db, id]);

  const { data: truck, loading } = useDoc<Truck>(truckRef);

  // Inicializar documentos si no existem
  useEffect(() => {
    if (truck && !truck.documentation && truckRef) {
      const initialDocs = DEFAULT_DOCS.map(d => ({ ...d, status: 'pending' as DocStatus }));
      updateDoc(truckRef, { documentation: initialDocs });
    }
  }, [truck, truckRef]);

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'valid': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'expired': return <AlertTriangle className="text-red-500" size={18} />;
      case 'warning': return <Clock className="text-orange-500" size={18} />;
      default: return <Clock className="text-slate-300" size={18} />;
    }
  };

  const getStatusBadge = (status: DocStatus) => {
    switch (status) {
      case 'valid': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Vigente</Badge>;
      case 'expired': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Vencido</Badge>;
      case 'warning': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">Próximo a Vencer</Badge>;
      default: return <Badge variant="outline" className="text-slate-400">Pendiente</Badge>;
    }
  };

  const handleUpdateDocDate = async (docId: string, date: string) => {
    if (!truck || !truckRef) return;
    
    const now = new Date();
    const expiryDate = parseISO(date);
    let status: DocStatus = 'valid';
    
    if (isBefore(expiryDate, now)) {
      status = 'expired';
    } else if (isBefore(expiryDate, addDays(now, 30))) {
      status = 'warning';
    }

    const updatedDocs = truck.documentation.map(d => 
      d.id === docId ? { ...d, expiryDate: date, status } : d
    );

    try {
      await updateDoc(truckRef, { 
        documentation: updatedDocs,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Documento actualizado", description: "La fecha de vencimiento ha sido registrada." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Clock className="animate-spin text-blue-600" /></div>;
  if (!truck) return <div className="p-10 text-center">Camión no encontrado.</div>;

  const docProgress = truck.documentation ? 
    (truck.documentation.filter(d => d.status === 'valid').length / truck.documentation.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{truck.plate}</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 uppercase text-[10px]">
                {truck.brand} {truck.model}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <MapPin size={14} /> Base: {truck.location.city}, {truck.location.province}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-slate-600">
            <MoreVertical size={16} />
          </Button>
          <Button className="bg-blue-600">Asignar Chofer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-32 bg-slate-900 flex items-center justify-center text-white relative">
               <TruckIcon size={48} className="opacity-20" />
               <div className="absolute bottom-4 left-4">
                  <div className="text-[10px] uppercase font-bold text-white/50">Estado Operativo</div>
                  <div className="font-bold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    {truck.status === 'available' ? 'Disponible' : truck.status}
                  </div>
               </div>
            </div>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Capacidad</p>
                  <p className="font-bold text-slate-700">{truck.capacityKg / 1000} TN</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Configuración</p>
                  <p className="font-bold text-slate-700">{truck.axles} Ejes</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase">Cumplimiento Normativo</span>
                  <span className={cn("font-bold", docProgress === 100 ? "text-green-600" : "text-blue-600")}>
                    {Math.round(docProgress)}%
                  </span>
                </div>
                <Progress value={docProgress} className="h-2 bg-slate-100" />
                <p className="text-[10px] text-slate-400 italic">
                  {docProgress === 100 ? "✓ Vehículo habilitado para circular." : "⚠️ Faltan documentos para cumplir normativa."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-600 text-white">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck size={16} /> Verificación de Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs opacity-90 leading-relaxed">
              <p>Este vehículo cumple con la Resolución 1196/2025 de Vialidad Nacional para circulación en red troncal.</p>
              <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" size="sm">
                Descargar Ficha Técnica
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content (Tabs) */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="docs" className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="docs" className="flex items-center gap-2">
                <FileText size={16} /> Checklist Digital
              </TabsTrigger>
              <TabsTrigger value="specs" className="flex items-center gap-2">
                <Gauge size={16} /> Especificaciones
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Clock size={16} /> Auditoría
              </TabsTrigger>
            </TabsList>

            <TabsContent value="docs" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid gap-3">
                {truck.documentation?.map((doc) => (
                  <Card key={doc.id} className={cn(
                    "border shadow-none transition-all",
                    doc.status === 'expired' ? "border-red-200 bg-red-50/30" : "hover:border-blue-200"
                  )}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          doc.status === 'valid' ? "bg-green-100" : doc.status === 'expired' ? "bg-red-100" : "bg-slate-100"
                        )}>
                          {getStatusIcon(doc.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                            {getStatusBadge(doc.status)}
                            {doc.category === 'specific' && (
                              <Badge variant="outline" className="text-[8px] uppercase border-blue-200 text-blue-600">Especial</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">{doc.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Vencimiento</p>
                          <input 
                            type="date" 
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none focus:ring-0" 
                            value={doc.expiryDate || ""}
                            onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-100">
                            <Upload size={14} />
                          </Button>
                          {doc.fileUrl && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-slate-400">
                              <Download size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed flex items-start gap-3">
                <Info className="text-blue-500 mt-0.5" size={18} />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">Gestión Inteligente de Vencimientos</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    El sistema enviará una alerta automática 30 días antes del vencimiento de la RTO y el Seguro. 
                    Asegúrese de cargar el comprobante digital para auditoría.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specs">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Ficha Técnica Detallada</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Marca y Modelo</p>
                        <p className="text-sm font-semibold">{truck.brand} - {truck.model} ({truck.year})</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Chasis (VIN)</p>
                        <p className="text-sm font-mono">{truck.chassis}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Motorización</p>
                        <p className="text-sm font-semibold">{truck.fuelType} - Tanque {truck.tankLiters} L</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Dimensiones de Caja</p>
                        <p className="text-sm font-semibold">
                          {truck.dimensions.length}m x {truck.dimensions.width}m x {truck.dimensions.height}m
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Volumen Útil</p>
                        <p className="text-sm font-semibold">{truck.volumeM3} m³</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Carrocería</p>
                        <p className="text-sm font-semibold capitalize">{truck.bodyType}</p>
                      </div>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="border-none shadow-sm">
                <CardContent className="py-10 text-center space-y-4">
                   <Clock className="w-12 h-12 mx-auto text-slate-200" />
                   <div>
                     <p className="font-bold text-slate-600">Historial de Auditoría</p>
                     <p className="text-xs text-slate-400">Los cambios en la documentación y estado del vehículo aparecerán aquí.</p>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
