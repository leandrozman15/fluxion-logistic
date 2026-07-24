'use client';

import { useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Truck as TruckIcon, 
  Users, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Calendar,
  MapPin,
  DollarSign,
  Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Driver, Load } from "@/app/lib/types";
import { isBefore, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const db = useFirestore();

  // Queries para estatísticas
  const { data: trucks } = useCollection<Truck>(db ? collection(db, "trucks") : null);
  const { data: drivers } = useCollection<Driver>(db ? collection(db, "drivers") : null);
  const { data: loads } = useCollection<Load>(db ? collection(db, "loads") : null);

  const stats = useMemo(() => {
    const activeTrucks = trucks?.filter(t => t.status === 'in_trip').length || 0;
    const availableDrivers = drivers?.filter(d => d.status === 'active').length || 0;
    const pendingLoads = loads?.filter(l => l.status === 'pending').length || 0;
    const totalRevenue = loads?.filter(l => l.status === 'delivered')
      .reduce((acc, l) => acc + (l.totalAmount || 0), 0) || 0;

    return [
      { title: "Camiones en Ruta", value: activeTrucks, icon: TruckIcon, description: "Unidades operando agora" },
      { title: "Choferes Disponibles", value: availableDrivers, icon: Users, description: "Prontos para embarque" },
      { title: "Cargas Pendientes", value: pendingLoads, icon: Package, description: "Aguardando atribuição" },
      { title: "Faturamento (Entregas)", value: totalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }), icon: TrendingUp, description: "Total de viagens concluídas" },
    ];
  }, [trucks, drivers, loads]);

  // Lógica de Alertas de Documentação
  const alerts = useMemo(() => {
    const list: any[] = [];
    const now = new Date();
    const criticalThreshold = addDays(now, 15);

    // Alertas de Caminhões (RTO/Seguro)
    trucks?.forEach(t => {
      t.documentation?.forEach(doc => {
        if (doc.expiryDate) {
          const expiry = parseISO(doc.expiryDate);
          if (isBefore(expiry, now)) {
            list.push({ type: "CRÍTICO", title: `${t.plate}: ${doc.name} VENCIDO`, detail: "Unidade impedida de circular", color: "bg-red-600" });
          } else if (isBefore(expiry, criticalThreshold)) {
            list.push({ type: "AVISO", title: `${t.plate}: ${doc.name} Próx. Venc.`, detail: `Vence em ${doc.expiryDate}`, color: "bg-orange-500" });
          }
        }
      });
    });

    // Alertas de Motoristas (Licença/LINTI)
    drivers?.forEach(d => {
      if (d.licenseExpiry) {
        const expiry = parseISO(d.licenseExpiry);
        if (isBefore(expiry, now)) {
          list.push({ type: "CHOFER", title: `${d.lastName}: Licença Vencida`, detail: "Motorista inabilitado", color: "bg-red-600" });
        }
      }
      if (d.hasLinti && d.lintiExpiry) {
        const lintiExp = parseISO(d.lintiExpiry);
        if (isBefore(lintiExp, now)) {
          list.push({ type: "LINTI", title: `${d.lastName}: LINTI Vencida`, detail: "Inapto para cargas perigosas", color: "bg-orange-600" });
        }
      }
    });

    return list.slice(0, 5); // Mostrar apenas os 5 mais urgentes
  }, [trucks, drivers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitor Operativo</h1>
          <p className="text-slate-500 text-sm">Visão geral do ecossistema logístico em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" asChild>
            <Link href="/cargas/nuevo"><Plus className="w-4 h-4 mr-2" /> Nova Carga</Link>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            Exportar Relatório Diario
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <KPICard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
            <div>
              <CardTitle className="text-lg">Estado de la Flota</CardTitle>
              <CardDescription>Caminhões com atividade ou incidentes reportados.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-600" asChild>
              <Link href="/flota">Ver Frota Completa</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {trucks?.slice(0, 5).map((truck) => (
                <div key={truck.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <TruckIcon size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{truck.plate} <span className="text-xs font-normal text-slate-400">({truck.brand} {truck.model})</span></div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin size={10} /> {truck.location.city}, {truck.location.province}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={cn(
                      "border-none",
                      truck.status === 'available' ? "bg-green-100 text-green-700" : 
                      truck.status === 'in_trip' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {truck.status === 'available' ? 'Disponible' : truck.status === 'in_trip' ? 'En Viaje' : 'Mantenimiento'}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!trucks || trucks.length === 0) && (
                <div className="p-10 text-center text-slate-400 italic">Não há caminhões cadastrados.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" /> Alertas Críticos
              </CardTitle>
              <CardDescription className="text-white/40 text-xs">Vencimentos e restrições legais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-green-400 text-xs py-4">
                  <CheckCircle2 size={16} /> Tudo em conformidade legal.
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full", alert.color)}></div>
                      <span className="text-[9px] font-bold uppercase text-white/50">{alert.type}</span>
                    </div>
                    <p className="text-xs font-semibold">{alert.title}</p>
                    <p className="text-[10px] text-white/40">{alert.detail}</p>
                  </div>
                ))
              )}
              <Button variant="ghost" className="w-full text-[10px] text-white/40 hover:text-white uppercase font-bold" size="sm">
                Ver todos os Alertas
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed border-2 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-blue-600" /> Operaciones Recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {loads?.slice(0, 3).map((load) => (
                <div key={load.id} className="flex gap-3 items-start border-l-2 border-blue-200 pl-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">{load.clientName}</p>
                    <p className="text-[10px] text-slate-500">{load.origin.province} → {load.destination.province}</p>
                    <Badge variant="outline" className="text-[8px] h-4 uppercase mt-1">
                      {load.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!loads || loads.length === 0) && (
                <p className="text-xs text-slate-400 italic py-4">Nenhuma carga recente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}