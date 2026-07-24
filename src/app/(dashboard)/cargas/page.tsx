
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, Plus, Search, MapPin, Scale, DollarSign, 
  Loader2, MoreVertical, Trash2, Truck, CheckCircle2, 
  Clock, AlertTriangle, FileText, ExternalLink, Printer, Wallet, FilePlus, Upload, Trash
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Load, LoadStatus, LoadDocType, LoadDocument } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CargasPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Document management state
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [selectedLoadForDocs, setSelectedLoadForDocs] = useState<Load | null>(null);
  const [newDocType, setNewDocType] = useState<LoadDocType>("remito");
  const [newDocNumber, setNewDocNumber] = useState("");
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (l.description || "").toLowerCase().includes(search) ||
        (l.clientName || "").toLowerCase().includes(search) ||
        (l.orderNumber || "").toLowerCase().includes(search);
      
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [loads, searchTerm, statusFilter]);

  const getStatusBadge = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pendiente</Badge>;
      case 'assigned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Asignada</Badge>;
      case 'on_route': return <Badge className="bg-blue-600 text-white border-none">En Ruta</Badge>;
      case 'delivered': return <Badge className="bg-green-600 text-white border-none">Entregada</Badge>;
      case 'incident': return <Badge variant="destructive">Incidente</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (!db || !id) return;
    
    const shouldDelete = window.confirm("¿Está seguro de eliminar esta operación? Esta acción no se puede deshacer.");
    if (!shouldDelete) return;

    const docRef = doc(db, "loads", id);
    
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Operación eliminada" });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleUpdateStatus = (id: string, newStatus: LoadStatus) => {
    if (!id || !db) return;
    
    const docRef = doc(db, "loads", id);
    
    updateDoc(docRef, { 
      status: newStatus,
      updatedAt: serverTimestamp()
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });

    toast({ title: `Estado actualizado` });
  };

  const handleAddDocument = async () => {
    if (!db || !selectedLoadForDocs || !newDocNumber) return;
    setIsSavingDoc(true);

    const newDocObj: LoadDocument = {
      id: Math.random().toString(36).substring(7),
      type: newDocType,
      number: newDocNumber,
      uploadedAt: new Date().toISOString(),
      notes: ""
    };

    const updatedDocs = [...(selectedLoadForDocs.documents || []), newDocObj];
    const docRef = doc(db, "loads", selectedLoadForDocs.id);

    try {
      await updateDoc(docRef, { 
        documents: updatedDocs,
        updatedAt: serverTimestamp()
      });
      setSelectedLoadForDocs({...selectedLoadForDocs, documents: updatedDocs});
      setNewDocNumber("");
      toast({ title: "Documento adjuntado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar documento" });
    } finally {
      setIsSavingDoc(false);
    }
  };

  const removeDocument = async (docId: string) => {
    if (!db || !selectedLoadForDocs) return;
    const updatedDocs = selectedLoadForDocs.documents?.filter(d => d.id !== docId) || [];
    
    try {
      await updateDoc(doc(db, "loads", selectedLoadForDocs.id), { 
        documents: updatedDocs,
        updatedAt: serverTimestamp()
      });
      setSelectedLoadForDocs({...selectedLoadForDocs, documents: updatedDocs});
      toast({ title: "Documento eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cargas y Fletes</h1>
          <p className="text-slate-500 text-sm">Gestión de pedidos de transporte y seguimiento de entregas.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={() => router.push('/cargas/nuevo')}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Operación / Flete
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="search" 
              placeholder="Buscar por N° Orden o cliente..." 
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm pl-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
            <TabsList className="bg-white border">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="on_route">En Ruta</TabsTrigger>
              <TabsTrigger value="delivered">Entregadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden / Carga</TableHead>
                  <TableHead>Ruta (Origen - Destino)</TableHead>
                  <TableHead>Docs / Peso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay operaciones que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoads.map((load) => (
                    <TableRow key={load.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <Package size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{load.orderNumber}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[150px]">{load.clientName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                            <div className="w-[1px] h-3 bg-slate-200"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-500 truncate max-w-[200px]">{load.origin?.address || "Origen no especificado"}</span>
                            <span className="font-bold truncate max-w-[200px]">{load.destination?.address || "Destino no especificado"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                             <Badge variant="secondary" className="text-[9px] h-4 font-bold bg-slate-100">
                               <FileText size={10} className="mr-1" /> {load.documents?.length || 0} Adjuntos
                             </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                            <Scale size={10} /> {load.weightKg?.toLocaleString() || 0} Kg
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(load.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Gestión de Flete</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => { setSelectedLoadForDocs(load); setIsDocsOpen(true); }}>
                              <FilePlus className="w-4 h-4 mr-2" /> Cargar Remitos/Facturas
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`/cargas/${load.id}/orden`)}>
                              <Printer className="w-4 h-4 mr-2" /> Generar Orden (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`/cargas/${load.id}/billetera`)}>
                              <Wallet className="w-4 h-4 mr-2" /> Ver Billetera / Gastos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => handleUpdateStatus(load.id, 'on_route')}>
                              <Truck className="w-4 h-4 mr-2" /> Iniciar Tránsito
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleUpdateStatus(load.id, 'delivered')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Entrega
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:bg-red-50 focus:text-red-600" 
                              onSelect={(e) => {
                                e.preventDefault();
                                handleDelete(load.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar Orden
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

      {/* Dialog for Documents Management */}
      <Dialog open={isDocsOpen} onOpenChange={setIsDocsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="text-blue-600" /> Documentación del Flete
            </DialogTitle>
            <DialogDescription>
              Adjunte los comprobantes legales (Remitos, COT, Facturas) de la orden {selectedLoadForDocs?.orderNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-dashed">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Documento</Label>
                <Select value={newDocType} onValueChange={(v: LoadDocType) => setNewDocType(v)}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remito">📄 Remito</SelectItem>
                    <SelectItem value="factura">💰 Factura</SelectItem>
                    <SelectItem value="cot">🚛 COT / Tránsito</SelectItem>
                    <SelectItem value="otro">📎 Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Número de Documento</Label>
                <Input 
                  className="bg-white"
                  placeholder="Ej: 0001-000456" 
                  value={newDocNumber} 
                  onChange={e => setNewDocNumber(e.target.value)} 
                />
              </div>
              <Button 
                onClick={handleAddDocument} 
                disabled={!newDocNumber || isSavingDoc}
                className="bg-blue-600 w-full"
              >
                {isSavingDoc ? <Loader2 className="animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Adjuntar
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-1">Documentos Registrados</h4>
              {selectedLoadForDocs?.documents && selectedLoadForDocs.documents.length > 0 ? (
                <div className="grid gap-2">
                  {selectedLoadForDocs.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                           <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-700">{doc.type}</p>
                          <p className="text-sm font-mono">{doc.number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => removeDocument(doc.id)}>
                            <Trash size={14} />
                         </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed">
                  <p className="text-xs text-slate-400 italic">No hay documentos adjuntos todavía.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDocsOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
