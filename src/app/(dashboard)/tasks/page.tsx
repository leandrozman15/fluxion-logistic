
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageCircle, 
  Mail, 
  SearchCode, 
  Calendar,
  Loader2,
  ExternalLink,
  RotateCcw,
  Zap
} from "lucide-react";
import { Task, TaskType, TaskState } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isBefore, isToday, addDays, isAfter } from "date-fns";
import Link from "next/link";
import { normalizePhoneBR, buildWaMeUrl } from "@/lib/utils/whatsapp";
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";

export default function TasksPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const tasksQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "tasks"),
      where("state", "==", "open"),
      orderBy("dueAt", "asc")
    );
  }, [db, tenantId]);

  const { data: tasks, loading } = useCollection<Task>(tasksQuery);

  const groupedTasks = useMemo(() => {
    if (!tasks) return { overdue: [], today: [], upcoming: [] };
    const now = new Date();
    return {
      overdue: tasks.filter(t => {
        const d = toSafeDate(t.dueAt);
        return d && isBefore(d, now) && !isToday(d);
      }),
      today: tasks.filter(t => {
        const d = toSafeDate(t.dueAt);
        return d && isToday(d);
      }),
      upcoming: tasks.filter(t => {
        const d = toSafeDate(t.dueAt);
        return d && isAfter(d, now) && !isToday(d);
      })
    };
  }, [tasks]);

  const handleCompleteTask = async (taskId: string) => {
    if (!db || !tenantId) return;
    setIsActionLoading(taskId);
    try {
      await updateDoc(doc(db, "tenants", tenantId, "tasks", taskId), {
        state: "done",
        completedAt: serverTimestamp()
      });
      toast({ title: "Tarefa concluída!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao concluir tarefa" });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSnoozeTask = async (taskId: string, days: number) => {
    if (!db || !tenantId) return;
    setIsActionLoading(taskId);
    try {
      const newDate = addDays(new Date(), days);
      await updateDoc(doc(db, "tenants", tenantId, "tasks", taskId), {
        dueAt: newDate,
        state: "open"
      });
      toast({ title: `Adiada para ${formatSafeDate(newDate, "dd/MM")}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao adiar" });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleTaskAction = async (task: Task) => {
    if (!db || !tenantId) return;
    
    if (task.type === 'followup_whatsapp') {
      const pSnap = await getDoc(doc(db, "tenants", tenantId, "prospects", task.prospectId));
      const pData = pSnap.data();
      const phone = pData?.contacts?.[0]?.phone || pData?.contacts?.[0]?.whatsapp;
      const normalized = normalizePhoneBR(phone || "");
      if (normalized) window.open(buildWaMeUrl(normalized, task.notes), "_blank");
      else toast({ variant: "destructive", title: "Telefone não encontrado" });
    } else if (task.type === 'followup_email') {
      window.location.href = `/prospects/${task.prospectId}?action=prepare`;
    } else {
      window.location.href = `/prospects/${task.prospectId}`;
    }
  };

  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'followup_whatsapp': return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'followup_email': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'call': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'check_website': return <SearchCode className="w-4 h-4 text-purple-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderTaskList = (taskList: Task[], emptyMsg: string) => {
    if (taskList.length === 0) {
      return (
        <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto opacity-10" />
          <p className="text-muted-foreground">{emptyMsg}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {taskList.map((task) => (
          <div key={task.id} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-card border hover:border-accent/50 transition-all group gap-4">
            <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                {getTaskIcon(task.type)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {task.type.replace('_', ' ')}
                  </span>
                  {toSafeDate(task.dueAt) && isBefore(toSafeDate(task.dueAt)!, new Date()) && !isToday(toSafeDate(task.dueAt)!) && (
                    <Badge variant="destructive" className="h-4 text-[9px]">Atrasada</Badge>
                  )}
                </div>
                <div className="font-bold text-sm truncate">{task.companyName || "Prospect Desconhecido"}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" /> 
                  {formatSafeDate(task.dueAt, "dd 'de' MMM")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button variant="ghost" size="sm" onClick={() => handleTaskAction(task)} className="h-8 text-xs font-bold text-accent">
                Executar <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={() => handleSnoozeTask(task.id, 2)}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleCompleteTask(task.id)} disabled={isActionLoading === task.id}>
                {isActionLoading === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Minhas Tarefas</h1>
        <p className="text-muted-foreground">Follow-ups e ações recomendadas para manter o pipeline aquecido.</p>
      </div>

      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="overdue" className="relative">
            Atrasadas
            {groupedTasks.overdue.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {groupedTasks.overdue.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="today">Hoje ({groupedTasks.today.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Próximos 7 dias ({groupedTasks.upcoming.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <TabsContent value="overdue">
              {renderTaskList(groupedTasks.overdue, "Nenhuma tarefa atrasada. Bom trabalho!")}
            </TabsContent>
            <TabsContent value="today">
              {renderTaskList(groupedTasks.today, "Nada programado para hoje.")}
            </TabsContent>
            <TabsContent value="upcoming">
              {renderTaskList(groupedTasks.upcoming, "Sua agenda para os próximos dias está limpa.")}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
