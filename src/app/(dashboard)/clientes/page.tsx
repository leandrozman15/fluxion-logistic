
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Plus, Search, MoreVertical, Trash2, Edit2, 
  Building2, Phone, Mail, MapPin, Loader2, Globe, FileText,
  ChevronRight, Star
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
import Link from "next/link";

export default function ClientesPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const clientsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "clients"), orderBy("name"));
  }, [db]);

  const { data: clients, loading } = useCollection<Client>(clientsQuery);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cuit.includes(searchTerm) ||
      c.internalCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este cliente de la base de datos?")) return;
    try {
      await deleteDoc(doc(db, "clients", id));
      toast({ title: "Cliente eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'premium': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">💎 Premium</Badge>;
      case 'regular': return <Badge variant="secondary">⭐ Regular</Badge>;
      case 'occasional': return <Badge variant="outline">📦 Ocasional</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cartera de Clientes</h1>
          <p className="text-slate-500 text-sm">Gestión de dadores de carga y contactos comerciales.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" asChild>
          <Link href="/clientes/nuevo">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
          </Link>
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, CUIT o código..." 
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
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Categoría</TableHead>
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
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{client.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{client.cuit}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Globe size={10} className="text-blue-500" /> {client.address?.country}
                          </div>
                          <div className="text-[10px] text-slate-500">{client.address?.city}, {client.address?.province}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryBadge(client.category)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-slate-500">
                          <span className="flex items-center gap-1">
                            <Mail size={10} className="text-blue-400" /> {client.mainContact?.email || "-"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone size={10} className="text-blue-400" /> {client.mainContact?.phone || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuLabel>Gestión Comercial</DropdownMenuLabel>
                             <DropdownMenuItem onClick={() => window.open(`https://wa.me/${client.mainContact?.phone?.replace(/\D/g, '')}`, '_blank')}>
                               <Globe className="w-4 h-4 mr-2" /> WhatsApp Directo
                             </DropdownMenuItem>
                             {client.address?.lat && client.address?.lng && (
                               <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps?q=${client.address.lat},${client.address.lng}`, '_blank')}>
                                 <MapPin className="w-4 h-4 mr-2" /> Ver en Google Maps
                               </DropdownMenuItem>
                             )}
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(client.id)}>
                               <Trash2 className="w-4 h-4 mr-2" /> Eliminar Cliente
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
