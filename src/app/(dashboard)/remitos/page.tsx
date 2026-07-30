
'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Files, Search, Loader2, Plus, 
  CheckCircle2, Clock, MapPin, 
  ArrowRight, FileText, ScanBarcode, Ship, Truck, User, Scale, Receipt, Camera, Trash2, X
} from "lucide-react";
import { PendingRemito, Client } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/utils/image-compression";

export default function RemitosDashboardPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [formData, setFormData] = useState<Partial<PendingRemito>>({
    number: "",
    cotNumber: "",
    clientId: "",
    weightKg: 0,
    fileUrl: ""
  });

  const remitosQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "pending_remitos"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
  }, [db]);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);

  const { data: remitos, loading } = useCollection<PendingRemito>(remitosQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const filteredRemitos = useMemo(() => {
    if (!remitos) return [];
    return remitos.filter(r => 
      r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [remitos, searchTerm]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingFile(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 1200, 1200, 0.6);
          setFormData(prev => ({ ...prev, fileUrl: compressed }));
          toast({ title: "Documento procesado" });
        } catch (err) {
          setFormData(prev => ({ ...prev, fileUrl: base64 }));
        } finally {
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddRemito = async () => {
    if (!db || !formData.clientId || !formData.number) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Cliente y N° Remito son obligatorios." });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients?.find(c => c.id === formData.clientId);
      if (!client) throw new Error("Cliente no encontrado");

      await addDoc(collection(db, "pending_remitos"), {
        ...formData,
        clientName: client.name,
        address: `${client.address.street} ${client.address.number}`,
        city: client.address.city,
        province: client.address.province,
        lat: client.address.lat,
        lng: client.address.lng,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast({ title: "Remito Ingresado", description: "Ya está disponible para que Tráfico lo asigne a una ruta." });
      setIsAddOpen(false);
      setFormData({ number: "", cotNumber: "", clientId: "", weightKg: 0, fileUrl: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este remito pendiente?")) return;
    try {
      await deleteDoc(doc(db, "pending_remitos", id));
      toast({ title: "Remito eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Buzón de Remitos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Área de Ventas y Administración: Ingrese los documentos para despacho.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-black uppercase text-[11px] h-12 px-6 rounded-2xl">
              <Plus className="w-5 h-5 mr-2" /> Ingresar Nuevo Remito
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic">Nuevo Remito Administrativo</DialogTitle>
              <DialogDescription>Cargue los datos para que Tráfico pueda organizar el reparto.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-slate-400">1. Cliente / Destino Final</Label>
                  <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 rounded-xl border-none font-bold">
                       <SelectValue placeholder="Seleccionar Cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.address.city})</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-400">N° Remito / Guía</Label>
                    <Input placeholder="0001-000XXXXX" className="h-12 bg-slate-50 border-none font-mono font-bold rounded-xl" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-400">N° COT (Opcional)</Label>
                    <Input placeholder="8877665544" className="h-12 bg-slate-50 border-none font-mono font-bold rounded-xl" value={formData.cotNumber} onChange={e => setFormData({...formData, cotNumber: e.target.value})} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-400">Peso de la Carga (KG)</Label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                      <Input type="number" className="pl-10 h-12 bg-slate-50 border-none font-black rounded-xl" value={formData.weightKg} onChange={e => setFormData({...formData, weightKg: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-black text-slate-400">Adjuntar Digitalización</Label>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
                     <Button 
                      variant="outline" 
                      className={cn(
                        "w-full h-12 rounded-xl border-dashed border-2 transition-all",
                        formData.fileUrl ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                     >
                        {isProcessingFile ? <Loader2 className="animate-spin" /> : formData.fileUrl ? <CheckCircle2 className="mr-2" /> : <Camera className="mr-2" />}
                        {formData.fileUrl ? 'ARCHIVO LISTO' : 'SUBIR FOTO/PDF'}
                     </Button>
                  </div>
               </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="font-bold text-slate-400">CANCELAR</Button>
              <Button onClick={handleAddRemito} disabled={isSubmitting || !formData.clientId || !formData.number} className="bg-indigo-600 font-black h-12 px-8 rounded-xl shadow-lg shadow-indigo-100">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                CONFIRMAR INGRESO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-indigo-600 text-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Remitos en Espera</p>
              <p className="text-4xl font-black italic">{remitos?.length || 0}</p>
            </div>
            <Files size={40} className="text-white/20" />
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tonelaje Pendiente</p>
              <p className="text-4xl font-black italic text-slate-800">
                {((remitos?.reduce((acc, r) => acc + (r.weightKg || 0), 0) || 0) / 1000).toFixed(1)} <span className="text-sm font-normal text-slate-400">TN</span>
              </p>
            </div>
            <Scale size={40} className="text-slate-100" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-slate-900 text-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
             <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Acción de Tráfico</p>
                <p className="text-sm font-bold leading-tight">Vaya a "Despacho Inteligente" para agrupar estos remitos en camiones.</p>
             </div>
             <Button variant="outline" size="icon" className="rounded-full bg-white/10 border-white/20 text-white" onClick={() => router.push('/despacho')}><ArrowRight /></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-50/50 border-b flex items-center justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por N° Remito o Cliente..." 
              className="bg-white pl-12 h-12 text-sm font-bold border-none shadow-inner rounded-2xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-white text-[10px] font-black uppercase h-8 px-4 border-slate-200">Buzón Administrativo</Badge>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Remito / Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Destino / Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Peso Declarado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Estado</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRemitos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay remitos pendientes de despacho.</TableCell></TableRow>
                ) : (
                  filteredRemitos.map((remito) => (
                    <TableRow key={remito.id} className="hover:bg-slate-50/50 transition-all group">
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                              <Receipt size={20} />
                           </div>
                           <div>
                              <p className="font-mono font-black text-slate-900 text-sm">{remito.number}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{remito.createdAt?.toDate ? remito.createdAt.toDate().toLocaleDateString() : 'Hoy'}</p>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-slate-800 truncate uppercase">{remito.clientName}</p>
                           <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-1">
                              <MapPin size={10} className="text-blue-500" /> {remito.city}, {remito.province}
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className="bg-slate-100 text-slate-700 border-none font-black px-3">{remito.weightKg.toLocaleString()} KG</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase animate-pulse">ESPERANDO TRÁFICO</Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                           {remito.fileUrl && (
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={() => window.open(remito.fileUrl, '_blank')}>
                               <FileText size={18} />
                             </Button>
                           )}
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => handleDelete(remito.id)}>
                             <Trash2 size={18} />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
