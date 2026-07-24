
'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Route, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Truck, 
  Package, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Calendar
} from "lucide-react";
import { Load, LoadStatus } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DriverRoutesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  // No MVP, buscamos todas as cargas. Em produção, filtramos por user.uid (assignedDriverId)
  const routesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: routes, loading } = useCollection<Load>(routesQuery);

  const getStatusConfig = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return { label: 'Pendiente', color: 'bg-orange-100 text-orange-700', icon: Clock };
      case 'assigned': return { label: 'Asignada', color: 'bg-blue-100 text-blue-700', icon: Truck };
      case 'on_route': return { label: 'En Ruta', color: 'bg-blue-600 text-white', icon: Navigation };
      case 'delivered': return { label: 'Entregada', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
      case 'incident': return { label: 'Incidente', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
      default: return { label: status, color: 'bg-slate-100 text-slate-600', icon: Package };
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Mis Viajes</h1>
        <p className="text-sm text-slate-500">Hoja de ruta digital para conductores.</p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : routes?.length === 0 ? (
          <Card className="border-dashed py-10 text-center">
            <CardContent className="space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm text-slate-500">No tienes viajes asignados para hoy.</p>
            </CardContent>
          </Card>
        ) : (
          routes?.map((route) => {
            const config = getStatusConfig(route.status);
            return (
              <Link key={route.id} href={`/rutas/${route.id}`}>
                <Card className="hover:border-blue-300 transition-all active:scale-[0.98] mb-4 overflow-hidden">
                  <div className={cn("h-1.5 w-full", config.color.split(' ')[0])}></div>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Orden de Carga</div>
                        <div className="font-bold text-lg">{route.orderNumber}</div>
                      </div>
                      <Badge className={cn("text-[10px] uppercase", config.color)} variant="outline">
                        <config.icon size={10} className="mr-1" /> {config.label}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                          <div className="w-[1px] h-6 bg-slate-100"></div>
                          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="text-xs">
                            <p className="text-slate-400 uppercase font-bold text-[9px]">Origen</p>
                            <p className="font-semibold text-slate-700 truncate">{route.origin.address}</p>
                          </div>
                          <div className="text-xs">
                            <p className="text-slate-400 uppercase font-bold text-[9px]">Destino</p>
                            <p className="font-bold text-slate-900 truncate">{route.destination.address}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {route.pickupDate}</span>
                      <span className="flex items-center gap-1 text-blue-600">Ver Hoja de Ruta <ChevronRight size={12}/></span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  );
}
