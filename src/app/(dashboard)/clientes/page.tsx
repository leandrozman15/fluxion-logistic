
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Plus, Search, MoreVertical, Trash2, Edit2, 
  Building2, Phone, Mail, MapPin, Loader2, Globe, FileText
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Client } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

export default function ClientesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState<Partial<Client>>({
    name: "", cuit: "", email: "", phone: "", address: "", city: "", province: "Buenos Aires", status: "active"
  });

  const clientsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "clients"), orderBy("name"));
  }, [db]);

  const { data: clients, loading } = useCollection<Client>(clientsQuery);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cuit.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleSaveClient = async () => {
    if (!db || !formData.name || !formData.cuit) return;
    setIsSubmitting(true);
    try {
      if (editingClient) {
        await updateDoc(doc(db, "clients", editingClient.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Cliente Actualizado", description: `${formData.name} ha sido guardado.` });
      } else {
        const newRef = doc(collection(db, "clients"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Cliente Registrado", description: `${formData.name} añadido a la cartera.` });
      }
      setIsAddOpen(false);
      setEditingClient(null);
      setFormData({ name: "", cuit: "", email: "", phone: "", address: "", city: "", province: "Buenos Aires", status: "active" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData(client);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este cliente de la base de datos?")) return;
    try {
      await deleteDoc(doc(db, "clients", id));
      toast({ title: "Cliente eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cartera de Clientes</h1>
          <p className="text-slate-500 text-sm">Gestión de dadores de carga y contactos comerciales.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(v) => { setIsAddOpen(v); if(!v) { setEditingClient(null); setFormData({ name: "", cuit: "", email: "", phone: "", address: "", city: "", province: "Buenos Aires", status: "active" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</DialogTitle>
              <DialogDescription>Ingrese los datos fiscales y de contacto del dador de carga.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Razón Social / Nombre</Label>
                  <Input placeholder="Ej: ACME Corp S.A." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>CUIT</Label>
                  <Input placeholder="30-XXXXXXXX-X" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email Comercial</Label>
                  <Input type="email" placeholder="admin@empresa.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Teléfono de Contacto</Label>
                  <Input placeholder="+54 11 ..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Dirección Fiscal</Label>
                <Input placeholder="Calle, número, piso..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Ciudad</Label>
                  <Input placeholder="Ciudad" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveClient} disabled={isSubmitting} className="bg-blue-600">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Building2 className="mr-2" size={16} />}
                {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
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
              placeholder="Buscar por nombre o CUIT..." 
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
                  <TableHead>Cliente / Razón Social</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay clientes registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Building2 size={20} />
                          </div>
                          <div className="font-bold text-slate-900">{client.name}</div>
                        </div>
                      </TableCell>
                      <TableCell><div className="text-xs font-mono">{client.cuit}</div></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="font-medium text-slate-700">{client.city || "-"}</span>
                          <span className="text-slate-400">{client.province}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-slate-500">
                          <span className="flex items-center gap-1"><Mail size={10} className="text-blue-400" /> {client.email || "-"}</span>
                          <span className="flex items-center gap-1"><Phone size={10} className="text-blue-400" /> {client.phone || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleEdit(client)}>
                               <Edit2 className="w-4 h-4 mr-2" /> Editar
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(client.id)}>
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
