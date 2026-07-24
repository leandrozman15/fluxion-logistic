
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Building2, MapPin, Plus, Phone, Search, 
  MoreVertical, Trash2, Globe, Loader2, Map as MapIcon, Crosshair, Star
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hub, HubType } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

export default function SedesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<Hub>>({
    name: "",
    address: "",
    city: "",
    province: "Buenos Aires",
    type: "hub",
    phone: "",
    isMainBase: false,
    lat: -34.6037,
    lng: -58.3816
  });

  const hubsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "hubs"), orderBy("name"));
  }, [db]);

  const { data: hubs, loading } = useCollection<Hub>(hubsQuery);

  const filteredHubs = useMemo(() => {
    if (!hubs) return [];
    return hubs.filter(h => 
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.city.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [hubs, searchTerm]);

  const handleGetLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
        toast({ title: "Coordenadas Capturadas", description: "Ubicación base establecida." });
      });
    }
  };

  const handleAddHub = async () => {
    if (!db || !formData.name || !formData.address) return;
    setIsSubmitting(true);
    try {
      // Se for marcar como base principal, desmarcar as outras
      if (formData.isMainBase) {
        const batch = writeBatch(db);
        const snapshot = await getDocs(collection(db, "hubs"));
        snapshot.docs.forEach(doc => {
          if (doc.data().isMainBase) batch.update(doc.ref, { isMainBase: false });
        });
        await batch.commit();
      }

      await addDoc(collection(db, "hubs"), {
        ...formData,
        createdAt: serverTimestamp()
      });
      toast({ title: "Sede Registrada", description: `La sede ${formData.name} ha sido añadida.` });
      setIsAddOpen(false);
      setFormData({ name: "", address: "", city: "", province: "Buenos Aires", type: "hub", phone: "", isMainBase: false, lat: -34.6037, lng: -58.3816 });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetMainBase = async (id: string) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, "hubs"));
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isMainBase: doc.id === id });
      });
      await batch.commit();
      toast({ title: "Base Principal Actualizada", description: "La sede seleccionada ahora es su Casa Central." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleDeleteHub = async (id: string) => {
    if (!db || !confirm("¿Eliminar esta sede logística?")) return;
    try {
      await deleteDoc(doc(db, "hubs", id));
      toast({ title: "Sede eliminada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const getHubTypeBadge = (type: HubType) => {
    switch (type) {
      case 'hub': return <Badge className="bg-blue-100 text-blue-700 border-none">Centro Regional (Hub)</Badge>;
      case 'warehouse': return <Badge className="bg-orange-100 text-orange-700 border-none">Depósito</Badge>;
      case 'office': return <Badge className="bg-slate-100 text-slate-700 border-none">Oficina Administrativa</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sedes Logísticas</h1>
          <p className="text-slate-500 text-sm">Gestión de bases operativas y centros de transferencia multisede.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nueva Sede Logística
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Registrar Nueva Base</DialogTitle>
              <DialogDescription>Establezca un punto de apoyo operativo para su flota.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre de la Sede</Label>
                <Input id="name" placeholder="Ej: Hub Buenos Aires Norte" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-blue-900">Casa Central</Label>
                  <p className="text-[10px] text-blue-700">Establecer como sede principal de la empresa.</p>
                </div>
                <Switch checked={formData.isMainBase} onCheckedChange={v => setFormData({...formData, isMainBase: v})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v: HubType) => setFormData({...formData, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hub">Hub Principal</SelectItem>
                      <SelectItem value="warehouse">Depósito</SelectItem>
                      <SelectItem value="office">Oficina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Provincia</Label>
                  <Select value={formData.province} onValueChange={v => setFormData({...formData, province: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Dirección Completa</Label>
                <Input placeholder="Calle y número" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Ciudad</Label>
                  <Input placeholder="Ciudad" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Teléfono de Base</Label>
                  <Input placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
                 <p className="text-xs font-bold text-slate-500 uppercase">Geolocalización para Mapa</p>
                 <div className="flex gap-2">
                    <Input className="bg-white text-xs" placeholder="Lat" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value) || 0})} />
                    <Input className="bg-white text-xs" placeholder="Lng" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value) || 0})} />
                    <Button variant="outline" size="icon" onClick={handleGetLocation} title="Usar GPS Actual"><Crosshair size={14}/></Button>
                 </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddHub} disabled={isSubmitting} className="bg-blue-600">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Building2 className="mr-2" size={16} />}
                Guardar Sede
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar sedes o ciudades..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Tipo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHubs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">
                      No hay sedes registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHubs.map((hub) => (
                    <TableRow key={hub.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hub.isMainBase ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                            {hub.isMainBase ? <Star size={20} fill="currentColor" /> : <Building2 size={18} />}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-slate-900">{hub.name}</div>
                              {hub.isMainBase && <Badge variant="secondary" className="bg-amber-50 text-amber-700 text-[8px] uppercase">Central</Badge>}
                            </div>
                            {getHubTypeBadge(hub.type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-slate-700">{hub.address}</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin size={10} /> {hub.city}, {hub.province}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                           <Phone size={12} className="text-blue-500" /> {hub.phone || "Sin tel"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             {!hub.isMainBase && (
                               <DropdownMenuItem onClick={() => handleSetMainBase(hub.id)}>
                                 <Star className="w-4 h-4 mr-2 text-amber-500" /> Definir como Principal
                               </DropdownMenuItem>
                             )}
                             <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps?q=${hub.lat},${hub.lng}`, '_blank')}>
                               <Globe className="w-4 h-4 mr-2" /> Ver en Google Maps
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteHub(hub.id)}>
                               <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
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
