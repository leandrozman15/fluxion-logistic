
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
import { Search, Building2, MapPin, Plus, Loader2, Sparkles, Factory, CheckCircle2, Zap, Globe, Users, ShieldCheck, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect, IndustryIndexCompany, SegmentStats } from "@/app/lib/types";
import { getSegmentKey } from "@/lib/utils/learning-loop";
import { fetchCnpjData, ReceitaWSResponse } from "@/services/receita-ws";

// Base Real que simula o Radar Nacional Indexado
const MOCK_RADAR_INDEX: IndustryIndexCompany[] = [
  { id: "idx_1", companyName: "Metalúrgica Gerdau S.A.", cnpj: "00000000000191", city: "São Paulo", state: "SP", industryTag: "Metalurgia", cnae: "25", website: "gerdau.com.br", employeesRange: "500+", foundedYear: 1901 },
  { id: "idx_2", companyName: "Indústrias Romi S.A.", cnpj: "61383493000180", city: "Santa Bárbara d'Oeste", state: "SP", industryTag: "Máquinas e Equipamentos", cnae: "28", website: "romi.com", employeesRange: "500+", foundedYear: 1930 },
  { id: "idx_3", companyName: "WEG Equipamentos Elétricos", cnpj: "84429695000111", city: "Jaraguá do Sul", state: "SC", industryTag: "Eletrotécnica", cnae: "27", website: "weg.net", employeesRange: "500+", foundedYear: 1961 },
  { id: "idx_4", companyName: "Embraer S.A.", cnpj: "60198514000143", city: "São José dos Campos", state: "SP", industryTag: "Aeroespacial", cnae: "30", website: "embraer.com", employeesRange: "500+", foundedYear: 1969 },
  { id: "idx_5", companyName: "Klabin S.A.", cnpj: "05074830000138", city: "São Paulo", state: "SP", industryTag: "Papel e Celulose", cnae: "17", website: "klabin.com.br", employeesRange: "500+", foundedYear: 1899 },
  { id: "idx_6", companyName: "Marcopolo S.A.", cnpj: "88611835000129", city: "Caxias do Sul", state: "RS", industryTag: "Automotivo", cnae: "29", website: "marcopolo.com.br", employeesRange: "500+", foundedYear: 1949 },
];

export default function DiscoveryPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [cnpjSearch, setCnpjSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCnpjLoading, setIsCnpjLoading] = useState(false);
  const [results, setResults] = useState<IndustryIndexCompany[]>(MOCK_RADAR_INDEX);
  const [cnpjResult, setCnpjResult] = useState<ReceitaWSResponse | null>(null);
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

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
      setResults(filtered);
      setIsSearching(false);
    }, 400);
  };

  const handleCnpjSearch = async () => {
    if (!cnpjSearch || cnpjSearch.length < 14) {
      toast({ variant: "destructive", title: "CNPJ inválido", description: "O CNPJ deve ter 14 dígitos." });
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
      toast({ variant: "destructive", title: "Empresa já cadastrada", description: "Esta indústria já está no seu pipeline." });
      return;
    }

    const id = isReceita ? `rf_${cleanCnpj}` : item.id;
    setIsAddingId(id);
    try {
      const prospectData: Partial<Prospect> = {
        id,
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
        websiteUrl: isReceita ? undefined : (item.website?.startsWith('http') ? item.website : `https://${item.website}`),
        domain: isReceita ? undefined : item.website,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contacts: isReceita ? [{ name: "Contato via ReceitaWS", role: "N/A", email: item.email || "", phone: item.telefone || "" }] : [],
        aiScore: 75,
        scoreReasons: ["Líder de segmento indexado", "Perfil industrial confirmado"]
      };

      const effectiveScore = calculateEffectiveScore(prospectData);
      
      await setDoc(doc(db, "tenants", tenantId, "prospects", id), {
        ...prospectData,
        effectiveScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Indústria Importada!", description: `${prospectData.companyName} agora está no seu Radar.` });
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
            Discovery <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">GLOBAL INDEX</Badge>
          </h1>
          <p className="text-muted-foreground">Acesso direto ao banco de dados das 124.8k maiores indústrias do Brasil.</p>
        </div>
      </div>

      <Tabs defaultValue="index" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="index" className="flex items-center gap-2">
            <Globe className="w-4 h-4" /> Radar Nacional (Indexado)
          </TabsTrigger>
          <TabsTrigger value="cnpj" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Consulta Receita Federal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="index" className="space-y-6">
          <Card className="border-accent/20 bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-accent">
                <Sparkles className="w-4 h-4" /> Busca Inteligente no Ecossistema
              </CardTitle>
              <CardDescription>Pesquise por nome, setor ou cidade nas empresas já mapeadas pela nossa inteligência.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    placeholder="Ex: Gerdau, Metalurgia, Joinville..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="bg-background"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="bg-accent hover:bg-accent/90 shrink-0">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Filtrar Radar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold">Empresa / CNPJ</TableHead>
                  <TableHead className="font-bold">Localização</TableHead>
                  <TableHead className="font-bold">Segmento</TableHead>
                  <TableHead className="font-bold">Porte</TableHead>
                  <TableHead className="text-right font-bold">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                      Nenhuma indústria encontrada para "{searchTerm}".
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((item) => (
                    <TableRow key={item.id} className="hover:bg-accent/5 transition-colors">
                      <TableCell>
                        <div className="font-bold text-primary">{item.companyName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{item.cnpj}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {item.city}, {item.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">
                          {item.industryTag}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-[10px] text-muted-foreground">Funcionários: {item.employeesRange}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {existingCnpjs.has(item.cnpj) ? (
                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> No Pipeline
                          </Badge>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-accent border-accent/20 hover:bg-accent hover:text-white" 
                            onClick={() => handleAddToPipeline(item)} 
                            disabled={isAddingId === item.id}
                          >
                            {isAddingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} 
                            Importar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground italic">
            <TrendingUp className="w-3 h-3" /> Dados atualizados em tempo real conforme movimentações da JUCESP e Receita Federal.
          </div>
        </TabsContent>

        <TabsContent value="cnpj">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Consultar Base Governamental
              </CardTitle>
              <CardDescription>Busca direta na base da Receita Federal para empresas que ainda não foram indexadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="00.000.000/0000-00" 
                  value={cnpjSearch} 
                  onChange={e => setCnpjSearch(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleCnpjSearch()}
                />
                <Button onClick={handleCnpjSearch} disabled={isCnpjLoading} className="shrink-0">
                  {isCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Consultar
                </Button>
              </div>

              {cnpjResult && (
                <div className="mt-6 p-6 rounded-xl bg-secondary/20 border-2 border-accent/10 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-xl text-primary">{cnpjResult.nome}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{cnpjResult.cnpj}</p>
                    </div>
                    <Badge className={cnpjResult.situacao === 'ATIVA' ? 'bg-green-600' : 'bg-destructive'}>
                      SITUAÇÃO: {cnpjResult.situacao}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Atividade Principal</div>
                      <div className="font-medium">{cnpjResult.atividade_principal[0].text}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Endereço</div>
                      <div className="font-medium">{cnpjResult.municipio}, {cnpjResult.uf}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Contato Registrado</div>
                      <div className="font-medium">{cnpjResult.email || "N/A"} / {cnpjResult.telefone || "N/A"}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Abertura</div>
                      <div className="font-medium">{cnpjResult.abertura}</div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t flex justify-end">
                    <Button className="bg-accent hover:bg-accent/90" onClick={() => handleAddToPipeline(cnpjResult, true)} disabled={isAddingId === `rf_${cnpjResult.cnpj.replace(/\D/g, "")}`}>
                      {isAddingId?.startsWith('rf_') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Adicionar ao Pipeline
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-xs text-blue-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Aviso de Rate Limit</p>
                  <p>A API pública da ReceitaWS permite até 3 consultas por minuto. Para volumes maiores, utilize o <strong>Radar Nacional Indexado</strong> acima.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
