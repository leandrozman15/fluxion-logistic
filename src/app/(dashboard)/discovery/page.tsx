
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Building2, MapPin, Plus, Loader2, Sparkles, Factory, CheckCircle2, Zap, Globe, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect, IndustryIndexCompany, SegmentStats } from "@/app/lib/types";
import { getSegmentKey } from "@/lib/utils/learning-loop";

// Base Mock que simula o Radar Nacional (100k+ registros)
const MOCK_RADAR_INDEX: IndustryIndexCompany[] = [
  { id: "idx_1", companyName: "Metalúrgica Gerdau S.A.", cnpj: "00000000000191", city: "São Paulo", state: "SP", industryTag: "Metalurgia", cnae: "25", website: "gerdau.com", employeesRange: "500+", foundedYear: 1901 },
  { id: "idx_2", companyName: "Indústrias Romi", cnpj: "61383493000180", city: "Santa Bárbara d'Oeste", state: "SP", industryTag: "Máquinas e Equipamentos", cnae: "28", website: "romi.com", employeesRange: "500+", foundedYear: 1930 },
  { id: "idx_3", companyName: "WEG Equipamentos Elétricos", cnpj: "84429695000111", city: "Jaraguá do Sul", state: "SC", industryTag: "Eletrotécnica", cnae: "27", website: "weg.net", employeesRange: "500+", foundedYear: 1961 },
  { id: "idx_4", companyName: "Tupy S.A.", cnpj: "84683374000149", city: "Joinville", state: "SC", industryTag: "Metalurgia", cnae: "25", website: "tupy.com.br", employeesRange: "500+", foundedYear: 1938 },
  { id: "idx_5", companyName: "Usiminas Mecânica", cnpj: "07689002000189", city: "Ipatinga", state: "MG", industryTag: "Metalurgia", cnae: "25", website: "usiminas.com", employeesRange: "500+", foundedYear: 1970 },
  { id: "idx_6", companyName: "Plásticos Ipiranga", cnpj: "12345678000199", city: "Curitiba", state: "PR", industryTag: "Plásticos", cnae: "22", website: "pipiranga.com.br", employeesRange: "51-200", foundedYear: 1995 },
  { id: "idx_7", companyName: "Metal-X Componentes", cnpj: "99887766000122", city: "Caxias do Sul", state: "RS", industryTag: "Metalurgia", cnae: "25", website: "metalx.com.br", employeesRange: "11-50", foundedYear: 2010 },
  { id: "idx_8", companyName: "Bioquímica Industrial", cnpj: "55443322000111", city: "Salvador", state: "BA", industryTag: "Química", cnae: "20", website: "bioquimica.ind.br", employeesRange: "51-200", foundedYear: 2005 },
];

export default function DiscoveryPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<IndustryIndexCompany[]>([]);
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
    // Simula latência de rede/índice global
    setTimeout(() => {
      let filtered = [...MOCK_RADAR_INDEX];
      if (searchTerm) {
        filtered = filtered.filter(r => 
          r.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.industryTag.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      if (stateFilter !== "all") {
        filtered = filtered.filter(r => r.state === stateFilter);
      }
      if (sizeFilter !== "all") {
        filtered = filtered.filter(r => r.employeesRange === sizeFilter);
      }

      // Ranking Inteligente: Priorizar empresas de segmentos com alta conversão (Learning Loop)
      filtered = filtered.sort((a, b) => {
        const keyA = getSegmentKey({ industryTags: [a.industryTag], address: { state: a.state } } as any);
        const keyB = getSegmentKey({ industryTags: [b.industryTag], address: { state: b.state } } as any);
        const isAHot = hotSegments?.some(s => s.id === keyA);
        const isBHot = hotSegments?.some(s => s.id === keyB);
        if (isAHot && !isBHot) return -1;
        if (!isAHot && isBHot) return 1;
        return 0;
      });

      setResults(filtered);
      setIsSearching(false);
    }, 600);
  };

  const handleAddToPipeline = async (item: IndustryIndexCompany) => {
    if (!db || !tenantId) return;
    const cleanCnpj = item.cnpj.replace(/\D/g, "");
    
    if (existingCnpjs.has(cleanCnpj)) {
      toast({ variant: "destructive", title: "Empresa já cadastrada" });
      return;
    }

    setIsAddingId(item.id);
    try {
      const prospectData: Partial<Prospect> = {
        tenantId,
        companyName: item.companyName,
        cnpj: cleanCnpj,
        industryTags: [item.industryTag],
        websiteUrl: item.website ? `https://www.${item.website}` : undefined,
        domain: item.website,
        address: { city: item.city, state: item.state, country: "Brasil" },
        status: "new",
        source: "radar_index",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contacts: [{ name: "Contato via Radar Nacional", role: "N/A", email: item.website ? `contato@${item.website}` : "", phone: "" }],
        aiScore: 60, // Empresas do índice já vem pré-qualificadas
        scoreReasons: ["Importado via Radar Nacional Industrial", `Empresa porte ${item.employeesRange}`]
      };

      const effectiveScore = calculateEffectiveScore(prospectData);
      
      await addDoc(collection(db, "tenants", tenantId, "prospects"), {
        ...prospectData,
        effectiveScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Empresa adicionada!", description: `${item.companyName} foi enviada para o seu pipeline.` });
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
            Radar Nacional <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">PRO</Badge>
          </h1>
          <p className="text-muted-foreground">Índice Industrial com 124.000+ empresas brasileiras.</p>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Search className="w-4 h-4" /> Filtros do Ecossistema Industrial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Input 
                placeholder="Nome ou Setor (ex: Metalurgia, Romi...)" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Brasil (Todos)</SelectItem>
                <SelectItem value="SP">São Paulo</SelectItem>
                <SelectItem value="SC">Santa Catarina</SelectItem>
                <SelectItem value="MG">Minas Gerais</SelectItem>
                <SelectItem value="PR">Paraná</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger><SelectValue placeholder="Porte (Func.)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tamanhos</SelectItem>
                <SelectItem value="1-10">1-10 funcionários</SelectItem>
                <SelectItem value="11-50">11-50 funcionários</SelectItem>
                <SelectItem value="51-200">51-200 funcionários</SelectItem>
                <SelectItem value="500+">500+ funcionários</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isSearching} className="bg-accent hover:bg-accent/90">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Explorar Índice
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa / Porte</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Inteligência</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item) => {
                const isExisting = existingCnpjs.has(item.cnpj);
                const sKey = getSegmentKey({ industryTags: [item.industryTag], address: { state: item.state } } as any);
                const isHot = hotSegments?.some(s => s.id === sKey);

                return (
                  <TableRow key={item.id} className={isHot ? 'bg-accent/5' : ''}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{item.companyName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{item.cnpj}</span>
                          <Badge variant="outline" className="text-[8px] h-4 py-0 flex items-center gap-1">
                            <Users className="w-2 h-2" /> {item.employeesRange}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="w-3 h-3 text-muted-foreground" /> {item.city}, {item.state}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{item.industryTag}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {isHot && (
                          <Badge variant="outline" className="w-fit text-[8px] bg-accent/10 text-accent border-accent/20 flex items-center gap-1">
                            <Zap className="w-2 h-2" /> Alta Conversão
                          </Badge>
                        )}
                        {item.website && (
                          <span className="text-[9px] text-green-600 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Website Ativo
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isExisting ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> No Pipeline
                        </Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-accent hover:text-accent hover:bg-accent/10 h-8"
                          disabled={isAddingId === item.id}
                          onClick={() => handleAddToPipeline(item)}
                        >
                          {isAddingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                          Importar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : !isSearching && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
          <Factory className="w-12 h-12 mx-auto opacity-10 mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Use os filtros acima para explorar o Radar Nacional Industrial.</p>
        </div>
      )}
    </div>
  );
}
