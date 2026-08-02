'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Building2, Plus, Search, MoreVertical, Trash2, Edit2, 
  MapPin, Loader2, Globe, Locate, Eye, Fuel, Navigation
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Client, Hub } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { calculateDistance, estimateFuelLiters } from "@/lib/utils/tracking-math";
import Link from "next/link";

export default function ClientesPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  
  // AlertDialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const clientsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "clients"), orderBy("name"));
  }, [db, tenantId]);

  const hubsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "hubs"));
  }, [db, tenantId]);

  const { data: clients, loading } = useCollection<Client>(clientsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  // Identificar la sede principal para los cálculos
  const mainHub = useMemo(() => {
    if (!hubs) return null;
    return hubs.find(h => h.isMainBase) || hubs[0];
  }, [hubs]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cuit.includes(searchTerm) ||
      c.internalCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const confirmDelete = async () => {
    if (!db || !tenantId || !deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "clients", deleteId));
      toast({ title: "Cliente eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cartera de Clientes / Destinos</h1>
          <p className="text-slate-500 text-sm">Gestión de puntos de entrega georreferenciados para la red regional.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" asChild>
          <Link href="/clientes/nuevo">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Punto de Entrega
          </Link>
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, CUIT o código..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {mainHub && (
            <div className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-400">
               <Building2 size={14} className="text-blue-600" /> Referencia Base: {mainHub.name}
            </div>
          )}
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punto de Destino / CUIT</TableHead>
                  <TableHead>Dirección Exhaustiva</TableHead>
                  <TableHead>Estimación Logística</TableHead>
                  <TableHead>Estado Mapa</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay puntos de destino registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => {
                    // Cálculo de logística desde la base principal
                    let distance = 0;
                    let fuel = 0;
                    if (mainHub && client.address?.lat && client.address?.lng) {
                      distance = calculateDistance(mainHub.lat, mainHub.lng, client.address.lat, client.address.lng);
                      fuel = estimateFuelLiters(distance);
                    }

                    return (
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
                          <div className="flex flex-col max-w-[200px]">
                            <div className="text-xs font-bold text-slate-700 truncate">
                              {client.address?.street} {client.address?.number}
                            </div>
                            <div className="text-[9px] text-blue-600 font-bold">
                              {client.address?.city}, {client.address?.province}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           {distance > 0 ? (
                             <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                                   <Navigation size={10} className="text-blue-500" /> {Math.round(distance)} KM
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600">
                                   <Fuel size={10} className="text-green-500" /> ~{Math.round(fuel)} L <span className="text-[8px] font-normal text-slate-400">(ID)</span>
                                </div>
                             </div>
                           ) : (
                             <span className="text-[10px] text-slate-300 italic">No calculable</span>
                           )}
                        </TableCell>
                        <TableCell>
                          {client.address?.lat && client.address?.lng ? (
                            <Badge className="bg-green-100 text-green-700 border-none text-[8px] h-4">Ubicado</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 text-[8px] h-4">Sin GPS</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><MoreVertical size={20} /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-none shadow-2xl">
                               <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">Logística de Destino</DropdownMenuLabel>
                               <DropdownMenuItem onClick={() => router.push(`/clientes/${client.id}/editar`)} className="font-bold h-10 rounded-lg cursor-pointer">
                                 <Edit2 className="w-4 h-4 mr-2" /> Editar Punto de Entrega
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps?q=${client.address?.lat},${client.address?.lng}`, '_blank')} className="font-bold h-10 rounded-lg cursor-pointer">
                                 <Locate className="w-4 h-4 mr-2" /> Ver en Google Maps
                               </DropdownMenuItem>
                               <DropdownMenuItem disabled={!client.facadePhotoUrl} onClick={() => setViewerUrl(client.facadePhotoUrl!)} className="font-bold h-10 rounded-lg cursor-pointer">
                                 <Eye className="w-4 h-4 mr-2" /> Ver Fachada
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem 
                                className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-10 rounded-lg cursor-pointer" 
                                onSelect={(e) => { e.preventDefault(); setDeleteId(client.id); setDeleteName(client.name); }}
                               >
                                 <Trash2 className="w-4 h-4 mr-2" /> Eliminar Punto
                               </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewerUrl} onOpenChange={(o) => !o && setViewerUrl(null)}>
        <DialogContent className="max-w-2xl h-[60vh] flex flex-col rounded-[2rem]">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Foto de Fachada / Destino</DialogTitle></DialogHeader>
          <div className="flex-1 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border mt-2">
            <img src={viewerUrl || undefined} className="max-w-full max-h-full object-contain" alt="Fachada" />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic tracking-tighter">¿Eliminar Cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500">
              Está por eliminar a <span className="font-bold text-slate-900">{deleteName}</span> de la cartera regional. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-red-100"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              CONFIRMAR ELIMINACIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}