
'use client';

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, ArrowLeft, Loader2, CheckCircle2, 
  AlertTriangle, Receipt, TrendingUp, Filter,
  PieChart, CreditCard, Wallet, Clock, XCircle
} from "lucide-react";
import { Load, Expense, ExpenseStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function LoadWalletPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "loads", id as string, "expenses"), orderBy("createdAt", "desc"));
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const stats = useMemo(() => {
    if (!expenses) return { total: 0, pending: 0, approved: 0 };
    return {
      total: expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0),
      pending: expenses.filter(e => e.status === 'registered').length,
      approved: expenses.reduce((acc, exp) => exp.status === 'approved' ? acc + exp.amount : acc, 0)
    };
  }, [expenses]);

  const handleUpdateStatus = async (expenseId: string, status: ExpenseStatus) => {
    if (!db || !id) return;
    setIsUpdatingId(expenseId);
    try {
      await updateDoc(doc(db, "loads", id as string, "expenses", expenseId), {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: `Gasto ${status === 'approved' ? 'Aprobado' : 'Rechazado'}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdatingId(null);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const budgetUsed = load.budget?.totalBudget ? (stats.total / load.budget.totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Billetera de Viaje</h1>
            <p className="text-sm text-slate-500">Control de gastos y presupuesto para orden #{load.orderNumber}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 uppercase">
           {load.clientName}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900 text-white border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-white/50 font-bold">Saldo Actual Anticipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
               ${((load.budget?.initialAdvance || 0) - stats.total).toLocaleString()}
            </div>
            <p className="text-[10px] text-white/40 mt-1">De un total de ${load.budget?.initialAdvance?.toLocaleString()} otorgados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-slate-400 font-bold">Total Gastos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">${stats.total.toLocaleString()}</div>
            <p className="text-[10px] text-orange-500 flex items-center gap-1 mt-1">
               <AlertTriangle size={10} /> {stats.pending} pendientes de aprobación
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase text-slate-400 font-bold">Consumo de Presupuesto General</CardTitle>
            <Badge variant={budgetUsed > 90 ? 'destructive' : 'secondary'} className="text-[10px]">
              {Math.round(budgetUsed)}%
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={budgetUsed} className={cn("h-2", budgetUsed > 90 ? "bg-red-100" : "bg-slate-100")} />
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
               <span>GASTADO: ${stats.total.toLocaleString()}</span>
               <span>TOTAL ASIGNADO: ${load.budget?.totalBudget?.toLocaleString() || '0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
             <CardTitle className="text-sm flex items-center gap-2">
               <Receipt className="text-blue-600" /> Detalle de Gastos en Ruta
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Categoría / Lugar</TableHead>
                   <TableHead>Monto</TableHead>
                   <TableHead>Estado</TableHead>
                   <TableHead className="text-right">Acciones</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {expenses?.map(exp => (
                   <TableRow key={exp.id}>
                     <TableCell>
                       <div className="space-y-0.5">
                         <div className="font-bold text-slate-900 capitalize">{exp.category}</div>
                         <div className="text-[10px] text-slate-400 uppercase font-bold">{exp.location}</div>
                       </div>
                     </TableCell>
                     <TableCell className="font-bold text-slate-700">${exp.amount?.toLocaleString()}</TableCell>
                     <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[9px] uppercase font-bold",
                          exp.status === 'approved' ? "bg-green-50 text-green-700" :
                          exp.status === 'rejected' ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                        )}>
                          {exp.status === 'registered' ? 'Pendiente' : exp.status}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {exp.status === 'registered' && (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                onClick={() => handleUpdateStatus(exp.id, 'approved')}
                                disabled={isUpdatingId === exp.id}
                              >
                                <CheckCircle2 size={16} />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() => handleUpdateStatus(exp.id, 'rejected')}
                                disabled={isUpdatingId === exp.id}
                              >
                                <XCircle size={16} />
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400">
                             <Filter size={14} />
                          </Button>
                        </div>
                     </TableCell>
                   </TableRow>
                 ))}
                 {(!expenses || expenses.length === 0) && (
                   <TableRow>
                     <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No hay gastos registrados.</TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
           <Card className="border-none shadow-sm">
             <CardHeader><CardTitle className="text-sm">Distribución de Costos</CardTitle></CardHeader>
             <CardContent className="space-y-4">
                <div className="h-[200px] bg-slate-50 rounded-lg flex items-center justify-center border border-dashed">
                   <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-2"><PieChart size={16} /> Gráfico por Categoría</p>
                </div>
                <div className="space-y-2">
                   {['Combustible', 'Peajes', 'Viáticos'].map(cat => (
                     <div key={cat} className="flex justify-between items-center text-xs">
                       <span className="text-slate-500">{cat}</span>
                       <span className="font-bold">33%</span>
                     </div>
                   ))}
                </div>
             </CardContent>
           </Card>

           <Card className="bg-blue-600 text-white border-none">
             <CardHeader>
               <CardTitle className="text-sm flex items-center gap-2">
                 <CreditCard size={16} /> Liquidación Final
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 text-xs opacity-90 leading-relaxed">
               <p>Al finalizar el viaje, el sistema generará automáticamente la rendición de cuentas comparando el anticipo otorgado con los tickets aprobados.</p>
               <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" size="sm">
                 Pre-Liquidación PDF
               </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
