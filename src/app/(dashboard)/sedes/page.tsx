
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
  MoreVertical, Trash2, Globe, Loader2, Map as MapIcon, Crosshair, Star, Edit2, Save
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hub, HubType, Country } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const INITIAL_FORM_DATA: Partial<Hub> = {
  name: "",
  address: "",
  city: "",
  province: "",
  country: "Argentina",
  type: "hub",
  phone: "",
  isMainBase: false,
  lat: -34.6037,
  lng: -58.3816
};

export default function SedesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<Hub>>(INITIAL_FORM_DATA);

  const hubsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "hubs"), orderBy("name"));
  }, [db]);

  const { data: hubs, loading } = useCollection<Hub>(hubsQuery);

  const filteredHubs = useMemo(() => {
    if (!hubs) return [];
    return hubs.filter(h => 
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.country.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM_DATA);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (hub: Hub) => {
    setEditingId(hub.id);
    setFormData(hub);
    setIsDialogOpen(true);
  };

  const handleSubmitHub = async () => {
    if (!db || !formData.name || !formData.address) return;
    setIsSubmitting(true);
    try {
      // Si se marca como base principal, desmarcar las otras
      if (formData.isMainBase) {
        const batch = writeBatch(db);
        const snapshot = await getDocs(collection(db, "hubs"));
        snapshot.docs.forEach(docSnap => {
          if (docSnap.data().isMainBase && docSnap.id !== editingId) {
            batch.update(docSnap.ref, { isMainBase: false });
          }
        });
        await batch.commit();
      }

      if (editingId) {
        // ACTUALIZAR
        await updateDoc(doc(db, "hubs", editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Sede Actualizada", description: `Los cambios en ${formData.name} han sido guardados.` });
      } else {
        // CREAR NUEVA
        await addDoc(collection(db, "hubs"), {
          ...formData,
          createdAt: serverTimestamp()
        });
        toast({ title: "Sede Registrada", description: `La sede ${formData.name} ha sido añadida.` });
      }

      setIsDialogOpen(false);
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al procesar", description: "No se pudo guardar la información de la sede." });
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Red Logística Regional</h1>
          <p className="text-slate-500 text-sm">Gestión de bases operativas en todo el Cono Sur.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Alta de Sede Regional
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar sedes, ciudades o países..." 
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
                <TableRow className="bg-slate-50/50">
                  <TableHead>Sede / Tipo</TableHead>
                  <TableHead>País / Ubicación</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHubs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">
                      No hay sedes regionales registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHubs.map((hub) => (
                    <TableRow key={hub.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hub.isMainBase ? 'bg-amber-100 text-amber-600 shadow-sm border border-amber-200' : 'bg-blue-50 text-blue-600'}`}>
                             {hub.isMainBase ? <Star size={18} fill="currentColor" /> : <Building2 size={18} />}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {hub.name}
                              {hub.isMainBase && <Badge className="text-[7px] bg-amber-500 border-none h-3 px-1">BASE HQ</Badge>}
                            </div>
                            <Badge variant="outline" className="text-[8px] uppercase">{hub.type}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="font-bold text-blue-700 flex items-center gap-1">
                            <Globe size={10} /> {hub.country}
                          </span>
                          <span className="text-slate-500">{hub.city}, {hub.province}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                           <Phone size={12} className="text-blue-500" /> {hub.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-52">
                             <DropdownMenuLabel>Gestión de Sede</DropdownMenuLabel>
                             <DropdownMenuItem onClick={() => handleOpenEdit(hub)}>
                               <Edit2 className="w-4 h-4 mr-2" /> Editar Información
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps?q=${hub.lat},${hub.lng}`, '_blank')}>
                               <Globe className="w-4 h-4 mr-2" /> Ver en Mapa
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => handleDeleteHub(hub.id)}>
                               <Trash2 className="w-4 h-4 mr-2" /> Eliminar Sede
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Sede Regional' : 'Registrar Nueva Base'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifique los parámetros de la base operativa.' : 'Establezca un punto de apoyo operativo en su red.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>País</Label>
                <Select value={formData.country} onValueChange={(v: Country) => setFormData({...formData, country: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo de Sede</Label>
                <Select value={formData.type} onValueChange={(v: HubType) => setFormData({...formData, type: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hub">Hub Principal</SelectItem>
                    <SelectItem value="warehouse">Depósito</SelectItem>
                    <SelectItem value="office">Oficina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la Sede</Label>
              <Input id="name" placeholder="Ej: Hub Santiago Sur" className="bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="flex items-center space-x-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <Switch 
                id="main-base" 
                checked={formData.isMainBase} 
                onCheckedChange={(v) => setFormData({...formData, isMainBase: v})} 
              />
              <Label htmlFor="main-base" className="text-xs font-bold text-blue-700 cursor-pointer">Definir como Sede Principal (HQ)</Label>
            </div>

            <div className="grid gap-2">
              <Label>Dirección Completa</Label>
              <Input placeholder="Calle, número, zona" className="bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Ciudad</Label>
                <Input placeholder="Ciudad" className="bg-white" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Estado / Prov.</Label>
                <Input placeholder="Provincia/Estado" className="bg-white" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
              </div>
            </div>
            <div className="grid gap-2">
               <Label>Teléfono de Contacto</Label>
               <Input placeholder="Ej: +54 11 ..." className="bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Geolocalización GPS</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold text-blue-600" onClick={handleGetLocation}><Crosshair size={10} className="mr-1" /> AUTO-CAPTURAR</Button>
               </div>
               <div className="flex gap-2">
                  <Input className="bg-white text-xs font-mono" placeholder="Lat" type="number" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value) || 0})} />
                  <Input className="bg-white text-xs font-mono" placeholder="Lng" type="number" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value) || 0})} />
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-slate-500 font-bold">CANCELAR</Button>
            <Button onClick={handleSubmitHub} disabled={isSubmitting} className="bg-blue-600 font-bold min-w-[120px]">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : editingId ? <Save className="mr-2" size={16} /> : <Building2 className="mr-2" size={16} />}
              {editingId ? 'GUARDAR CAMBIOS' : 'HABILITAR SEDE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
