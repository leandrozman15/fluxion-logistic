
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, addDoc, serverTimestamp, query, where, doc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Building2, MapPin, Plus, Loader2, Globe, ShieldCheck, AlertCircle, TrendingUp, Filter, Factory, Calendar, Sparkles, BrainCircuit, Bot, SearchCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect, IndustryIndexCompany } from "@/app/lib/types";
import { fetchCnpjData, type ReceitaWSResponse } from "@/services/receita-ws";
import { mineIndustries, type MineIndustriesOutput } from "@/ai/flows/mine-industries-flow";
import Link from "next/link";

// Base Real Expandida para simular mineração profissional
const MOCK_RADAR_INDEX: IndustryIndexCompany[] = [
  { id: "idx_1", companyName: "Metalúrgica Gerdau S.A.", cnpj: "00000000000191", city: "São Paulo", state: "SP", industryTag: "Metalurgia", cnae: "25", website: "gerdau.com.br", employeesRange: "500+", foundedYear: 1901 },
  { id: "idx_2", companyName: "Indústrias Romi S.A.", cnpj: "61383493000180", city: "Santa Bárbara d'Oeste", state: "SP", industryTag: "Máquinas e Equipamentos", cnae: "28", website: "romi.com", employeesRange: "500+", foundedYear: 1930 },
  { id: "idx_3", companyName: "WEG Equipamentos Elétricos", cnpj: "84429695000111", city: "Jaraguá do Sul", state: "SC", industryTag: "Eletrotécnica", cnae: "27", website: "weg.net", employeesRange: "500+", foundedYear: 1961 },
  { id: "idx_4", companyName: "Embraer S.A.", cnpj: "60198514000143", city: "São José dos Campos", state: "SP", industryTag: "Aeroespacial", cnae: "30", website: "embraer.com", employeesRange: "500+", foundedYear: 1969 },
  { id: "idx_5", companyName: "TechMetal Startups", cnpj: "12345678000100", city: "Florianópolis", state: "SC", industryTag: "Usinagem de Precisão", cnae: "25", website: "techmetal.io", employeesRange: "11-50", foundedYear: 2022 },
  { id: "idx_6", companyName: "EcoFabril Sustentável", cnpj: "98765432000199", city: "Curitiba", state: "PR", industryTag: "Reciclagem Industrial", cnae: "38", website: "ecofabril.com.br", employeesRange: "51-200", foundedYear: 2018 },
  { id: "idx_7", companyName: "Moldes Brasil Ltda", cnpj: "11223344000155", city: "Joinville", state: "SC", industryTag: "Injeção Plástica", cnae: "22", website: "moldesbrasil.com.br", employeesRange: "201-500", foundedYear: 1995 },
  { id: "idx_8", companyName: "SolarIndustrial S.A.", cnpj: "55667788000122", city: "Betim", state: "MG", industryTag: "Energia Renovável", cnae: "35", website: "solarindustrial.ind.br", employeesRange: "1-10", foundedYear: 2023 },
];

export default function DiscoveryPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [porteFilter, setPorteFilter] = useState("all");
  const [idadeFilter, setIdadeFilter] = useState("all");
  const [cnpjSearch, setCnpjSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCnpjLoading, setIsCnpjLoading] = useState(false);
  const [results, setResults] = useState<IndustryIndexCompany[]>(MOCK_RADAR_INDEX);
  const [cnpjResult, setCnpjResult] = useState<ReceitaWSResponse | null>(null);
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

  // AI Mining State
  const [miningQuery, setMiningMiningQuery] = useState("");
  const [miningRegion, setMiningRegion] = useState("Joinville/SC");
  const [isMining, setIsMining] = useState(false);
  const [miningStatus, setMiningStatus] = useState<string | null>(null);
  const [miningResults, setMiningResults] = useState<MineIndustriesOutput | null>(null);

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"));
  }, [db, tenantId]);

  const { data: existingProspects } = useCollection<Prospect>(prospectsQuery);

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
          r.industryTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.city.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      if (porteFilter !== "all") {
        filtered = filtered.filter(r => r.employeesRange === porteFilter);
      }
      const currentYear = new Date().getFullYear();
      if (idadeFilter === "new") {
        filtered = filtered.filter(r => (currentYear - r.foundedYear) <= 5);
      } else if (idadeFilter === "established") {
        filtered = filtered.filter(r => (currentYear - r.foundedYear) > 5 && (currentYear - r.foundedYear) <= 20);
      } else if (idadeFilter === "historical") {
        filtered = filtered.filter(r => (currentYear - r.foundedYear) > 20);
      }
      setResults(filtered);
      setIsSearching(false);
    }, 400);
  };

  const handleCnpjSearch = async () => {
    if (!cnpjSearch || cnpjSearch.replace(/\D/g, "").length < 14) {
      toast({ variant: "destructive", title: "CNPJ inválido" });
      return;
    }
    setIsCnpjLoading(true);
    try {
      const data = await fetchCnpjData(cnpjSearch);
      setCnpjResult(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na consulta", description: e.message });
    } finally {
      setIsCnpjLoading(false);
    }
  };

  const handleAiMining = async () => {
    if (!miningQuery) return;
    setIsMining(true);
    setMiningStatus("Iniciando Agente de Pesquisa...");
    try {
      setTimeout(() => setMiningStatus("Navegando pela Web Industrial..."), 2000);
      setTimeout(() => setMiningStatus("Analisando sites e extraindo sinais técnicos..."), 5000);
      
      const res = await mineIndustries({
        niche: miningQuery,
        region: miningRegion
      });
      setMiningResults(res);
      toast({ title: "Mineração Concluída!", description: `Identificamos ${res.candidates.length} oportunidades via IA.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na mineração IA", description: e.message });
    } finally {
      setIsMining(false);
      setMiningStatus(null);
    }
  };

  const handleAddToPipeline = async (item: any, source: Prospect['source'] = 'radar_index') => {
    if (!db || !tenantId) return;
    const cleanCnpj = (item.cnpj || `00000000000000`).replace(/\D/g, "");
    
    const id = item.cnpj ? (source === 'auto_discovery' ? `rf_${cleanCnpj}` : `idx_${cleanCnpj}`) : `ai_${Date.now()}`;
    
    if (cleanCnpj !== "00000000000000" && existingCnpjs.has(cleanCnpj)) {
      toast({ variant: "destructive", title: "Já cadastrada" });
      return;
    }

    setIsAddingId(id);
    try {
      const prospectData: Partial<Prospect> = {
        id,
        tenantId,
        companyName: item.nome || item.companyName,
        cnpj: cleanCnpj,
        industryTags: item.atividade_principal ? [item.atividade_principal[0].text] : [item.industryTag],
        address: { 
          city: item.municipio || item.city, 
          state: item.uf || item.state, 
          country: "Brasil" 
        },
        status: "new",
        source: source,
        websiteUrl: item.website || item.probableWebsite,
        aiScore: 75,
        scoreReasons: [item.reason || "Importado via Agente de Descoberta"]
      };

      const effectiveScore = calculateEffectiveScore(prospectData);
      
      await setDoc(doc(db, "tenants", tenantId, "prospects", id), {
        ...prospectData,
        effectiveScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Importada!" });
      if (source === 'auto_discovery') setCnpjResult(null);
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
            Discovery <Badge variant="secondary" className="bg-accent/10 text-accent">PERFIL ICP</Badge>
          </h1>
          <p className="text-muted-foreground">Encontre o perfil exato de indústrias para sua solução.</p>
        </div>
      </div>

      <Tabs defaultValue="index" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="index" className="flex items-center gap-2"><Globe className="w-4 h-4" /> Mineração de Base</TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2"><SearchCode className="w-4 h-4 text-accent" /> AI Live Web Agent</TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Busca Direta (CNPJ)</TabsTrigger>
        </TabsList>

        <TabsContent value="index" className="space-y-6">
          <Card className="border-accent/20 bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-accent">
                <Filter className="w-4 h-4" /> Filtros de Segmentação Industrial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Palavra-chave ou Cidade</Label>
                  <Input 
                    placeholder="Ex: Joinville, Metalurgia, Plásticos..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Porte (Funcionários)</Label>
                  <Select value={porteFilter} onValueChange={setPorteFilter}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os portes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os portes</SelectItem>
                      <SelectItem value="1-10">Micro (1-10)</SelectItem>
                      <SelectItem value="11-50">Pequena (11-50)</SelectItem>
                      <SelectItem value="51-200">Média (51-200)</SelectItem>
                      <SelectItem value="500+">Grande (500+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Tempo de Mercado</Label>
                  <Select value={idadeFilter} onValueChange={setIdadeFilter}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Qualquer idade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer idade</SelectItem>
                      <SelectItem value="new">Novas (Até 5 anos)</SelectItem>
                      <SelectItem value="established">Consolidadas (5-20 anos)</SelectItem>
                      <SelectItem value="historical">Históricas (+20 anos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="w-full mt-4 bg-accent hover:bg-accent/90">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Minerar Oportunidades
              </Button>
            </CardContent>
          </Card>

          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold">Empresa</TableHead>
                  <TableHead className="font-bold">Localização</TableHead>
                  <TableHead className="font-bold">Perfil</TableHead>
                  <TableHead className="text-right font-bold">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                      Nenhum resultado para estes filtros. Tente ampliar sua busca.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((item) => (
                    <TableRow key={item.id} className="hover:bg-accent/5 transition-colors">
                      <TableCell>
                        <div className="font-bold text-primary">{item.companyName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{item.industryTag}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" /> {item.city}, {item.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                            <Factory className="w-3 h-3 text-accent" /> Porte: {item.employeesRange}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="w-3 h-3" /> Desde {item.foundedYear}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {existingCnpjs.has(item.cnpj.replace(/\D/g, "")) ? (
                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">No Pipeline</Badge>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-accent border-accent/20 hover:bg-accent hover:text-white" 
                            onClick={() => handleAddToPipeline(item)} 
                            disabled={isAddingId === item.id}
                          >
                            {isAddingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Importar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="bg-primary text-white border-none shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Bot className="w-32 h-32" /></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-accent" /> Agente de Mineração Web (Live)</CardTitle>
              <CardDescription className="text-white/70">A IA gera queries de busca, navega na web e analisa o conteúdo dos sites em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Nicho / Especialidade</Label>
                  <Input 
                    placeholder="Ex: Fabricantes de moldes plásticos" 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    value={miningQuery}
                    onChange={e => setMiningMiningQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Região Alvo</Label>
                  <Input 
                    placeholder="Ex: Caxias do Sul / RS" 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    value={miningRegion}
                    onChange={e => setMiningRegion(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleAiMining} 
                disabled={isMining || !miningQuery}
                className="w-full bg-accent hover:bg-accent/90 text-primary font-bold"
              >
                {isMining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Comandar Agente de Busca Viva
              </Button>
              {miningStatus && (
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> {miningStatus}
                </div>
              )}
            </CardContent>
          </Card>

          {miningResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {miningResults.candidates.map((cand, i) => (
                <Card key={i} className="border-accent/20 hover:border-accent transition-all cursor-default">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{cand.industryTag}</Badge>
                      <Badge className="bg-green-500/10 text-green-600 text-[10px]">{cand.confidence}% Match</Badge>
                    </div>
                    <CardTitle className="text-lg mt-2">{cand.companyName}</CardTitle>
                    <CardDescription className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cand.city}, {cand.state}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-secondary/30 rounded-lg border text-xs italic leading-relaxed">
                      <span className="font-bold block mb-1 text-primary">Evidência Web:</span>
                      "{cand.reason}"
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-accent text-primary font-bold"
                        onClick={() => handleAddToPipeline(cand, 'ai_mining')}
                        disabled={isAddingId?.includes(cand.companyName)}
                      >
                        {isAddingId?.includes(cand.companyName) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                        Adicionar ao Funil
                      </Button>
                      {cand.probableWebsite && (
                        <Button size="sm" variant="outline" asChild title="Abrir site">
                          <a href={cand.probableWebsite.startsWith('http') ? cand.probableWebsite : `https://${cand.probableWebsite}`} target="_blank"><Globe className="w-3 h-3" /></a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cnpj">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Consulta ReceitaWS</CardTitle>
              <CardDescription>Busca exata por CNPJ para enriquecimento instantâneo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="00.000.000/0000-00" value={cnpjSearch} onChange={e => setCnpjSearch(e.target.value)} />
                <Button onClick={handleCnpjSearch} disabled={isCnpjLoading}>
                  {isCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />} Consultar
                </Button>
              </div>
              {cnpjResult && (
                <div className="p-4 border-2 border-accent/10 rounded-xl bg-accent/5 animate-in fade-in">
                  <h3 className="font-bold text-lg">{cnpjResult.nome}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{cnpjResult.municipio}, {cnpjResult.uf}</p>
                  <Button className="w-full bg-accent" onClick={() => handleAddToPipeline(cnpjResult, 'auto_discovery')}>Adicionar ao Pipeline</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
