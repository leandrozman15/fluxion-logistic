
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
  MapPin, Gauge, Box, Info, Download, Trash2, MoreVertical, LayoutGrid
} from "lucide-react";
import { Truck, VehicleDocument, DocStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isBefore, isAfter, addDays, parseISO } from "date-fns";

const DEFAULT_DOCS: Omit<VehicleDocument, 'status'>[] = [
  { id: 'cedula_verde', name: 'Cédula de Identificación (Verde)', category: 'unit', description: 'Acredita la titularidad del camión.', isRequired: true },
  { id: 'vtv_rto', name: 'Revisión Técnica (RTO/VTV)', category: 'unit', description: 'Aptitud técnica obligatoria.', isRequired: true },
  { id: 'seguro', name: 'Seguro Obligatorio', category: 'unit', description: 'Responsabilidad Civil vigente.', isRequired: true },
  { id: 'patente_pago', name: 'Impuesto a la Radicación (Patente)', category: 'unit', description: 'Comprobante de último pago.', isRequired: true },
  { id: 'cedula_semi', name: 'Cédula de Identificación del Semi', category: 'semi', description: 'Título registral del acoplado.', isRequired: true },
  { id: 'rto_semi', name: 'RTO Propia del Semi', category: 'semi', description: 'Inspección técnica independiente del acoplado.', isRequired: true },
  { id: 'seguro_semi', name: 'Seguro del Semirremolque', category: 'semi', description: 'Cobertura del acoplado.', isRequired: true },
  { id: 'cnrt', name: 'Habilitación CNRT', category: 'authorization', description: 'Obligatorio para fletes a terceros.', isRequired: false }
];

export default function TruckDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();

  const truckRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "trucks", id as string);
  }, [db, id]);

  const { data: truck, loading } = useDoc<Truck>(truckRef);

  // Inicializar documentos si no existen
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
      case 'warning': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">Próximo</Badge>;
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
      toast({ title: "Documento actualizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Clock className="animate-spin text-blue-600" /></div>;
  if (!truck) return <div className="p-10 text-center">Vehículo no encontrado.</div>;

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="h-32 bg-slate-900 flex items-center justify-center text-white relative">
               <TruckIcon size={48} className="opacity-20" />
               <div className="absolute bottom-4 left-4">
                  <div className="text-[10px] uppercase font-bold text-white/50">Estado Operativo</div>
                  <div className="font-bold flex items-center gap-2 text-green-400 uppercase italic">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    {truck.status}
                  </div>
               </div>
            </div>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase">Salud Legal del Equipo</span>
                  <span className={cn("font-bold", docProgress === 100 ? "text-green-600" : "text-blue-600")}>
                    {Math.round(docProgress)}%
                  </span>
                </div>
                <Progress value={docProgress} className="h-2 bg-slate-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-2 text-orange-800">
                <Info size={14} /> Nota Legislativa 2024
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] text-orange-700 leading-relaxed">
              El <b>Decreto 1109/2024</b> eliminó el RUTA. El sistema ya no lo marca como obligatorio para transporte de carga propia.
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="tractor" className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="tractor" className="flex items-center gap-2">
                <TruckIcon size={16} /> Unidad Tractora
              </TabsTrigger>
              <TabsTrigger value="semi" className="flex items-center gap-2">
                <LayoutGrid size={16} /> Semirremolque
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tractor" className="space-y-4 animate-in fade-in">
              {truck.documentation?.filter(d => d.category === 'unit').map((doc) => (
                <Card key={doc.id} className={cn("border shadow-none", doc.status === 'expired' ? "border-red-200 bg-red-50/20" : "")}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(doc.status)}
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                        <p className="text-[9px] text-slate-500">{doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <input 
                         type="date" 
                         className="text-xs font-bold bg-transparent outline-none" 
                         value={doc.expiryDate || ""}
                         onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)}
                       />
                       <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600"><Upload size={14}/></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="semi" className="space-y-4 animate-in fade-in">
              {truck.documentation?.filter(d => d.category === 'semi').map((doc) => (
                <Card key={doc.id} className="border shadow-none">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(doc.status)}
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                        <p className="text-[9px] text-slate-500">{doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <input 
                         type="date" 
                         className="text-xs font-bold bg-transparent outline-none" 
                         value={doc.expiryDate || ""}
                         onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)}
                       />
                       <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600"><Upload size={14}/></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
