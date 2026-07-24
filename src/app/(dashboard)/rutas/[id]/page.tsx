
'use client';

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, Phone, MessageSquare, CheckCircle2, 
  Truck, Package, FileText, ShieldAlert, Clock, 
  Navigation, Info, ChevronRight, AlertTriangle,
  Wallet, Plus, DollarSign, Camera, Fuel, Utensils, Bed, Wrench, Receipt
} from "lucide-react";
import { Load, Expense, ExpenseCategory } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: any }[] = [
  { id: 'fuel', label: 'Combustible', icon: Fuel },
  { id: 'toll', label: 'Peaje', icon: Navigation },
  { id: 'meal', label: 'Comida', icon: Utensils },
  { id: 'lodging', label: 'Hospedaje', icon: Bed },
  { id: 'maintenance', label: 'Taller/Manten.', icon: Wrench },
  { id: 'other', label: 'Otros', icon: Receipt },
];

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  // Expense Form State
  const [expenseData, setExpenseData] = useState<Partial<Expense>>({
    category: 'fuel',
    amount: 0,
    description: "",
    location: ""
  });

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return collection(db, "loads", id as string, "expenses");
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const totalSpent = useMemo(() => {
    return expenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;
  }, [expenses]);

  const handleUpdateStatus = async (newStatus: any) => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Estado Actualizado", description: `Viaje marcado como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddExpense = async () => {
    if (!db || !id || !user) return;
    setIsUpdating(true);
    try {
      await addDoc(collection(db, "loads", id as string, "expenses"), {
        ...expenseData,
        loadId: id,
        driverId: user.uid,
        status: 'registered',
        createdAt: serverTimestamp()
      });
      toast({ title: "Gasto Registrado", description: "El gasto ha sido enviado a administración." });
      setIsExpenseOpen(false);
      setExpenseData({ category: 'fuel', amount: 0, description: "", location: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar gasto" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Clock className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Viaje no encontrado.</div>;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Hoja de Ruta</h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{load.orderNumber}</p>
        </div>
        <Button variant="ghost" size="icon" className="text-red-500"><ShieldAlert /></Button>
      </div>

      <Tabs defaultValue="mission" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger value="mission">Misión</TabsTrigger>
          <TabsTrigger value="wallet">Billetera</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none overflow-hidden">
            <CardContent className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado de Misión</p>
                <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
              </div>
              <div className="flex gap-2">
                {load.status === 'assigned' && (
                  <Button className="w-full bg-blue-600 h-14 text-lg font-bold" onClick={() => handleUpdateStatus('on_route')} disabled={isUpdating}>
                    INICIAR VIAJE
                  </Button>
                )}
                {load.status === 'on_route' && (
                  <Button className="w-full bg-green-600 h-14 text-lg font-bold" onClick={() => handleUpdateStatus('delivered')} disabled={isUpdating}>
                    CONFIRMAR ENTREGA
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 px-2">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status !== 'pending' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                  {load.status !== 'pending' ? <CheckCircle2 size={16}/> : <Package size={16}/>}
                </div>
                <div className="w-0.5 h-full bg-slate-100 min-h-[80px]"></div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Punto de Carga (Origen)</h3>
                  <p className="text-xs text-slate-500">{load.origin.name}</p>
                </div>
                <Card className="bg-slate-50 border-none shadow-none">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{load.origin.address}, {load.origin.province}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status === 'delivered' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                   <Navigation size={16}/>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Punto de Entrega (Destino)</h3>
                  <p className="text-xs text-slate-500">{load.destination.name}</p>
                </div>
                <Card className="bg-slate-50 border-none shadow-none">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{load.destination.address}, {load.destination.province}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6 animate-in fade-in">
          <Card className="border-none shadow-sm bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Saldo Disponible</p>
                  <h2 className="text-3xl font-black italic">
                    {((load.budget?.initialAdvance || 0) - totalSpent).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </h2>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <Wallet className="text-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-white/40">Anticipo Recibido</p>
                  <p className="text-sm font-bold text-green-400">${load.budget?.initialAdvance?.toLocaleString() || '0'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] uppercase font-bold text-white/40">Gastos Registrados</p>
                  <p className="text-sm font-bold text-orange-400">${totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="px-2 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Últimos Movimientos</h4>
              <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 bg-blue-600 font-bold text-xs"><Plus size={14} className="mr-1" /> Registrar Gasto</Button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] rounded-xl">
                  <DialogHeader>
                    <DialogTitle>Nuevo Gasto de Viaje</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {EXPENSE_CATEGORIES.map(cat => (
                          <Button 
                            key={cat.id} 
                            variant={expenseData.category === cat.id ? 'default' : 'outline'}
                            className="flex flex-col h-16 gap-1 p-1 text-[9px]"
                            onClick={() => setExpenseData({...expenseData, category: cat.id})}
                          >
                            <cat.icon size={16} />
                            {cat.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Monto (ARS)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          type="number" 
                          className="pl-9" 
                          placeholder="0.00" 
                          value={expenseData.amount || ''} 
                          onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lugar / Estación</Label>
                      <Input placeholder="Ej: YPF Ruta 9 km 45" value={expenseData.location} onChange={e => setExpenseData({...expenseData, location: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción</Label>
                      <Input placeholder="Ej: Carga 80L Gasoil" value={expenseData.description} onChange={e => setExpenseData({...expenseData, description: e.target.value})} />
                    </div>
                    <Button variant="outline" className="w-full border-dashed border-2 h-16 text-slate-500">
                      <Camera className="mr-2" /> Adjuntar Foto Ticket
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-blue-600 h-12 text-lg font-bold" onClick={handleAddExpense} disabled={isUpdating || !expenseData.amount}>
                      {isUpdating ? <Clock className="animate-spin mr-2" /> : <DollarSign size={18} className="mr-2" />}
                      Guardar Gasto
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {expenses?.map(exp => {
                const CategoryIcon = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon || Receipt;
                return (
                  <Card key={exp.id} className="border-none shadow-sm bg-white">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 border">
                          <CategoryIcon size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">${exp.amount?.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{exp.location}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[8px] uppercase h-5 font-bold">
                          {exp.status === 'registered' ? 'Registrado' : exp.status}
                        </Badge>
                        <p className="text-[9px] text-slate-400 mt-1">14:30 hs</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!expenses || expenses.length === 0) && (
                <div className="py-10 text-center text-slate-400 text-xs italic">No hay gastos registrados aún.</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
         <Button variant="destructive" className="flex-1 h-14 font-bold shadow-lg">
           <AlertTriangle className="mr-2" /> INCIDENTE
         </Button>
         <Button className="bg-blue-600 flex-1 h-14 font-bold shadow-lg" onClick={() => window.open(`tel:0800-LOGISTICA`)}>
           <Phone className="mr-2" /> CENTRAL
         </Button>
      </div>
    </div>
  );
}
