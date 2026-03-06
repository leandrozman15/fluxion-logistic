
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, addDoc, serverTimestamp, query, where, doc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Building2, MapPin, Plus, Loader2, Sparkles, Factory, CheckCircle2, Zap, Globe, Users, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect, IndustryIndexCompany, SegmentStats } from "@/app/lib/types";
import { getSegmentKey } from "@/lib/utils/learning-loop";
import { fetchCnpjData, ReceitaWSResponse } from "@/services/receita-ws";

// Base Mock que simula o Radar Nacional (100k+ registros)
const MOCK_RADAR_INDEX: IndustryIndexCompany[] = [
  { id: "idx_1", companyName: "Metalúrgica Gerdau S.A.", cnpj: "00000000000191", city: "São Paulo", state: "SP", industryTag: "Metalurgia", cnae: "25", website: "gerdau.com", employeesRange: "500+", foundedYear: 1901 },
  { id: "idx_2", companyName: "Indústrias Romi", cnpj: "61383493000180", city: "Santa Bárbara d'Oeste", state: "SP", industryTag: "Máquinas e Equipamentos", cnae: "28", website: "romi.com", employeesRange: "500+", foundedYear: 1930 },
  { id: "idx_3", companyName: "WEG Equipamentos Elétricos", cnpj: "84429695000111", city: "Jaraguá do Sul", state: "SC", industryTag: "Eletrotécnica", cnae: "27", website: "weg.net", employeesRange: "500+", foundedYear: 1961 },
];

export default function DiscoveryPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [cnpjSearch, setCnpjSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [isCnpjLoading, setIsCnpjLoading] = useState(false);
  const [results, setResults] = useState<IndustryIndexCompany[]>([]);
  const [cnpjResult, setCnpjResult] = useState<ReceitaWSResponse | null>(null);
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"));
  }, [db, tenantId]);

  const { data: existingProspects } = useCollection<Prospect>(prospectsQuery);

  const segmentStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "segmentStats"), where("confidence", ">", 0.5));
  }, [db, tenantId]);

  const { data: hotSegments } = useCollection<SegmentStats>(segmentStatsQuery);

  const existingCnpjs = useMemo(() => {
    return new Set(existingProspects?.map(p => p.cnpj.replace(/\D/g, "")));
  }, [existingProspects]);

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      let filtered = [...MOCK_RADAR_INDEX];
      if (searchTerm) {
        filtered = filtered.filter(r => 
          r.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.industryTag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setResults(filtered);
      setIsSearching(false);
    }, 600);
  };

  const handleCnpjSearch = async () => {
    if (!cnpjSearch || cnpjSearch.length < 14) {
      toast({ variant: "destructive", title: "CNPJ inválido" });
      return;
    }
    setIsCnpjLoading(true);
    setCnpjResult(null);
    try {
      const data = await fetchCnpjData(cnpjSearch);
      setCnpjResult(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na consulta", description: e.message });
    } finally {
      setIsCnpjLoading(false);
    }
  };

  const handleAddToPipeline = async (item: any, isReceita = false) => {
    if (!db || !tenantId) return;
    const cnpj = isReceita ? item.cnpj : item.cnpj;
    const cleanCnpj = cnpj.replace(/\D/g, "");
    
    if (existingCnpjs.has(cleanCnpj)) {
      toast({ variant: "destructive", title: "Empresa já cadastrada" });
      return;
    }

    const id = isReceita ? `rf_${cleanCnpj}` : item.id;
    setIsAddingId(id);
    try {
      const prospectData: Partial<Prospect> = {
        tenantId,
        companyName: isReceita ? item.nome : item.companyName,
        cnpj: cleanCnpj,
        industryTags: isReceita ? [item.atividade_principal[0].text] : [item.industryTag],
        address: { 
          city: isReceita ? item.municipio : item.city, 
          state: isReceita ? item.uf : item.state, 
          country: "Brasil" 
        },
        status: "new",
        source: isReceita ? "auto_discovery" : "radar_index",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contacts: isReceita ? [{ name: "Contato via ReceitaWS", role: "N/A", email: item.email || "", phone: item.telefone || "" }] : [],
        aiScore: 60,
        scoreReasons: ["Importado via Receita Federal"]
      };

      const effectiveScore = calculateEffectiveScore(prospectData);
      
      await setDoc(doc(db, "tenants", tenantId, "prospects", id), {
        ...prospectData,
        effectiveScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Empresa adicionada!", description: `${prospectData.companyName} no pipeline.` });
      if (isReceita) setCnpjResult(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao adicionar" });
    } finally {
      setIsAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Discovery <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">PRO</Badge>
          </h1>
          <p className="text-muted-foreground">Encontre indústrias brasileiras via Índice Global ou Receita Federal.</p>
        </div>
      </div>

      <Tabs defaultValue="index" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="index" className="flex items-center gap-2">
            <Globe className="w-4 h-4" /> Radar Nacional
          </TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Busca por CNPJ (ReceitaWS)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="index" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="w-4 h-4" /> Filtros do Ecossistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Input 
                    placeholder="Nome ou Setor..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="bg-accent">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Explorar Índice
                </Button>
              </div>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><div className="font-bold">{item.companyName}</div><div className="text-[10px] text-muted-foreground">{item.cnpj}</div></TableCell>
                      <TableCell><div className="text-xs">{item.city}, {item.state}</div></TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{item.industryTag}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-accent" onClick={() => handleAddToPipeline(item)} disabled={isAddingId === item.id}>
                          {isAddingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Importar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cnpj">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Consultar CNPJ Oficial</CardTitle>
              <CardDescription>Busca dados em tempo real diretamente da base da Receita Federal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="00.000.000/0000-00" 
                  value={cnpjSearch} 
                  onChange={e => setCnpjSearch(e.target.value)} 
                />
                <Button onClick={handleCnpjSearch} disabled={isCnpjLoading}>
                  {isCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
              </div>

              {cnpjResult && (
                <div className="mt-6 p-4 rounded-xl bg-secondary/20 border animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-primary">{cnpjResult.nome}</h3>
                      <p className="text-sm text-muted-foreground">{cnpjResult.cnpj}</p>
                    </div>
                    <Badge className="bg-green-600">SITUAÇÃO: {cnpjResult.situacao}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Atividade Principal</div>
                      <div>{cnpjResult.atividade_principal[0].text}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Endereço</div>
                      <div>{cnpjResult.municipio}, {cnpjResult.uf}</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t flex justify-end">
                    <Button className="bg-accent" onClick={() => handleAddToPipeline(cnpjResult, true)} disabled={isAddingId === `rf_${cnpjResult.cnpj.replace(/\D/g, "")}`}>
                      {isAddingId?.startsWith('rf_') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Adicionar ao Pipeline
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2 text-[10px] text-blue-700">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                A API gratuita da ReceitaWS permite até 3 consultas por minuto. Use com sabedoria.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
