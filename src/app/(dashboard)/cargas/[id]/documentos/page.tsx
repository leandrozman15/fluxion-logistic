
'use client';

import { useMemo, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, ArrowLeft, Loader2, Upload, Camera, 
  CheckCircle2, Trash2, Plus, Package, MapPin, 
  ShieldCheck, Info, FileSearch, Ship, ScanBarcode, Save, X
} from "lucide-react";
import { Load, LoadDocument, LoadDocType, LoadLegStop } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";

export default function LoadDocumentsPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const [newDoc, setNewDoc] = useState<Partial<LoadDocument>>({
    type: 'remito',
    number: "",
    cotNumber: "",
    leg: 'outbound'
  });

  const handleAddDocument = async (stopId: string) => {
    if (!load || !loadRef || !newDoc.number) {
      toast({ variant: "destructive", title: "Falta el número de documento" });
      return;
    }

    setIsSubmitting(true);
    try {
      const docToAdd: LoadDocument = {
        id: Math.random().toString(36).substring(7),
        type: newDoc.type as LoadDocType,
        number: newDoc.number,
        cotNumber: newDoc.cotNumber || "",
        uploadedAt: new Date().toISOString(),
        fileUrl: newDoc.fileUrl || ""
      };

      const updatedStops = load.outboundStops.map(s => 
        s.id === stopId ? { ...s, documents: [...(s.documents || []), docToAdd] } : s
      );

      await updateDoc(loadRef, {
        outboundStops: updatedStops,
        updatedAt: serverTimestamp()
      });

      toast({ title: "Documento vinculado", description: "El remito ha sido guardado exitosamente." });
      setNewDoc({ type: 'remito', number: "", cotNumber: "", leg: 'outbound' });
      setActiveStopId(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDocument = async (stopId: string, docId: string) => {
    if (!load || !loadRef || !confirm("¿Eliminar este documento?")) return;
    
    try {
      const updatedStops = load.outboundStops.map(s => 
        s.id === stopId ? { ...s, documents: s.documents.filter(d => d.id !== docId) } : s
      );
      await updateDoc(loadRef, { outboundStops: updatedStops });
      toast({ title: "Documento eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingFile(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 1200, 1200, 0.6);
          setNewDoc(prev => ({ ...prev, fileUrl: compressed }));
          toast({ title: "Imagen procesada", description: "Documento listo para cargar." });
        } catch (err) {
          setNewDoc(prev => ({ ...prev, fileUrl: base64 }));
        } finally {
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Flete no encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18}/></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Gestión de Remitos</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Orden #{load.orderNumber} | {load.clientName}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono">
           {load.outboundStops.length} DESTINOS
        </Badge>
      </div>

      <div className="space-y-6">
        {load.outboundStops.map((stop, idx) => (
          <Card key={stop.id} className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white transition-all">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-200">
                      {idx + 1}
                   </div>
                   <div>
                      <CardTitle className="text-base font-black uppercase italic text-slate-800">{stop.name}</CardTitle>
                      <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                        <MapPin size={10} /> {stop.address}
                      </p>
                   </div>
                </div>
                <Badge className={cn(
                  "text-[8px] font-black uppercase h-5",
                  (stop.documents?.length || 0) > 0 ? "bg-green-600" : "bg-slate-200 text-slate-400"
                )}>
                  {(stop.documents?.length || 0)} DOCS
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
               {/* Listado de Documentos de la Parada */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {stop.documents?.map(doc => (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:border-blue-200 transition-all">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center text-blue-600">
                             <FileText size={16} />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-slate-400">Remito N°</p>
                             <p className="text-xs font-black text-slate-700 font-mono tracking-tight">{doc.number}</p>
                             {doc.cotNumber && <p className="text-[8px] font-bold text-blue-600 uppercase">COT: {doc.cotNumber}</p>}
                          </div>
                       </div>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.fileUrl && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => window.open(doc.fileUrl, '_blank')}>
                               <FileSearch size={16}/>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveDocument(stop.id, doc.id)}>
                             <Trash2 size={16}/>
                          </Button>
                       </div>
                    </div>
                  ))}
                  {(!stop.documents || stop.documents.length === 0) && (
                    <div className="col-span-full py-8 text-center bg-slate-50/50 border-2 border-dashed rounded-[1.5rem]">
                       <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                       <p className="text-[10px] font-black text-slate-300 uppercase italic">Sin remitos cargados para este punto</p>
                    </div>
                  )}
               </div>

               {/* Formulario de Carga para esta Parada */}
               {activeStopId === stop.id ? (
                 <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] space-y-6 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center">
                       <h4 className="text-[11px] font-black uppercase text-blue-700 tracking-widest flex items-center gap-2">
                          <Plus size={16}/> Nueva Documentación de Entrega
                       </h4>
                       <Button variant="ghost" size="icon" onClick={() => setActiveStopId(null)} className="text-blue-400"><X size={18}/></Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-500 ml-1">N° de Remito / Guía</Label>
                          <Input 
                            placeholder="Ej: 0001-00045678" 
                            className="bg-white h-11 rounded-xl border-none shadow-sm font-mono font-bold"
                            value={newDoc.number}
                            onChange={e => setNewDoc({...newDoc, number: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-500 ml-1">N° COT (Opcional)</Label>
                          <Input 
                            placeholder="Ej: 8877665544" 
                            className="bg-white h-11 rounded-xl border-none shadow-sm font-mono font-bold"
                            value={newDoc.cotNumber}
                            onChange={e => setNewDoc({...newDoc, cotNumber: e.target.value})}
                          />
                       </div>
                    </div>

                    <div className="space-y-3">
                       <Label className="text-[9px] font-black uppercase text-slate-500 ml-1">Digitalización del Documento</Label>
                       <div 
                        className={cn(
                          "aspect-video md:aspect-auto md:h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
                          newDoc.fileUrl ? "bg-white border-green-400" : "bg-white border-blue-200 hover:bg-blue-100"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                       >
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
                          {isProcessingFile ? (
                            <Loader2 className="animate-spin text-blue-600" />
                          ) : newDoc.fileUrl ? (
                            <div className="flex items-center gap-2 text-green-600 font-bold text-xs">
                               <CheckCircle2 size={20}/> ARCHIVO LISTO
                            </div>
                          ) : (
                            <>
                              <Camera className="text-blue-500" />
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Capturar Imagen o PDF</p>
                            </>
                          )}
                       </div>
                    </div>

                    <Button 
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-blue-200"
                      onClick={() => handleAddDocument(stop.id)}
                      disabled={isSubmitting || !newDoc.number}
                    >
                       {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                       VINCULAR REMITO A PARADA
                    </Button>
                 </div>
               ) : (
                 <Button 
                  variant="outline" 
                  className="w-full h-12 border-dashed border-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                  onClick={() => setActiveStopId(stop.id)}
                 >
                    <Plus size={16} className="mr-2" /> Agregar Documento a esta Parada
                 </Button>
               )}
            </CardContent>
          </Card>
        ))}

        {/* SECCIÓN DOCUMENTACIÓN COMEX / ADUANA */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
           <CardHeader className="bg-white/5 border-b border-white/10 p-8">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                    <Ship size={32}/>
                 </div>
                 <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Carpeta de Aduana / COMEX</CardTitle>
                    <CardDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Documentación maestra del tránsito internacional</CardDescription>
                 </div>
              </div>
           </CardHeader>
           <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><ScanBarcode size={14}/> N° Contenedor</p>
                 <p className="text-lg font-mono font-black uppercase tracking-widest">{load.international?.containerNumber || 'S/D'}</p>
                 <Button variant="outline" size="sm" className="w-full bg-white/5 border-white/10 text-[9px] font-bold h-7">EDITAR DATA</Button>
              </div>
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14}/> Precintos</p>
                 <p className="text-lg font-mono font-black tracking-widest">{load.international?.sealNumber || '---'}</p>
                 <Button variant="outline" size="sm" className="w-full bg-white/5 border-white/10 text-[9px] font-bold h-7">EDITAR DATA</Button>
              </div>
              <div className="p-5 bg-blue-600 rounded-2xl shadow-xl flex flex-col justify-center items-center text-center space-y-2">
                 <FileText size={32} className="text-white/50" />
                 <p className="text-xs font-black uppercase leading-tight">Digitalizar<br/>Carpeta Aduanera</p>
                 <p className="text-[8px] font-bold opacity-60 uppercase tracking-tighter">(PDF / IMÁGENES)</p>
              </div>
           </CardContent>
        </Card>
      </div>

      <div className="bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100 flex items-start gap-4 mx-1">
         <Info size={24} className="text-blue-600 shrink-0 mt-1" />
         <div className="space-y-1">
            <p className="text-xs font-black text-blue-800 uppercase tracking-tight italic">Protocolo de Archivo Digital Certificado</p>
            <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
               Toda la documentación cargada aquí se sincroniza automáticamente con el portal del cliente y los sistemas de auditoría central. Los archivos son optimizados para garantizar la velocidad de acceso en zonas de baja señal.
            </p>
         </div>
      </div>
    </div>
  );
}
