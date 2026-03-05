
'use client';

import { useState, useMemo } from "react";
import { useFirestore } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Building2, MapPin, Plus, Loader2, Sparkles, Factory, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect } from "@/app/lib/types";

// Mock de dados para simular a busca em base pública (Dados Abertos CNPJ)
const MOCK_DISCOVERY_RESULTS = [
  { name: "Metalúrgica Gerdau S.A.", cnpj: "00.000.000/0001-91", city: "São Paulo", state: "SP", sector: "Metalurgia", website: "gerdau.com" },
  { name: "Indústrias Romi", cnpj: "61.383.493/0001-80", city: "Santa Bárbara d'Oeste", state: "SP", sector: "Máquinas e Equipamentos", website: "romi.com" },
  { name: "WEG Equipamentos Elétricos", cnpj: "84.429.695/0001-11", city: "Jaraguá do Sul", state: "SC", sector: "Eletrotécnica", website: "weg.net" },
  { name: "Tupy S.A.", cnpj: "84.683.374/0001-49", city: "Joinville", state: "SC", sector: "Fundição", website: "tupy.com.br" },
  { name: "Embraer S.A.", cnpj: "07.689.002/0001-89", city: "São José dos Campos", state: "SP", sector: "Aeroespacial", website: "embraer.com" },
  { name: "Klabin S.A.", cnpj: "89.637.490/0001-45", city: "Telêmaco Borba", state: "PR", sector: "Papel e Celulose", website: "klabin.com.br" },
  { name: "Braskem S.A.", cnpj: "42.150.391/0001-70", city: "Camaçari", state: "BA", sector: "Petroquímica", website: "braskem.com.br" },
];

export default function DiscoveryPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

  const handleSearch = () => {
    setIsSearching(true);
    // Simula delay de rede e busca em base externa
    setTimeout(() => {
      let filtered = MOCK_DISCOVERY_RESULTS;
      if (searchTerm) {
        filtered = filtered.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.sector.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      if (stateFilter !== "all") {
        filtered = filtered.filter(r => r.state === stateFilter);
      }
      setResults(filtered);
      setIsSearching(false);
    }, 800);
  };

  const handleAddToPipeline = async (item: any) => {
    if (!db || !tenantId) return;
    setIsAddingId(item.cnpj);
    try {
      // 1. Verificar se já existe (Deduplicação)
      const q = query(collection(db, "tenants", tenantId, "prospects"), where("cnpj", "==", item.cnpj.replace(/\D/g, "")));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Empresa já cadastrada", description: "Esta empresa já faz parte do seu pipeline." });
        return;
      }

      // 2. Criar objeto prospecto
      const prospectData: Partial<Prospect> = {
        tenantId,
        companyName: item.name,
        cnpj: item.cnpj.replace(/\D/g, ""),
        industryTags: [item.sector],
        websiteUrl: `https://www.${item.website}`,
        domain: item.website,
        address: { city: item.city, state: item.state, country: "Brasil" },
        status: "new",
        source: "web",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contacts: [{ name: "Contato via Discovery", role: "N/A", email: `contato@${item.website}`, phone: "" }],
        aiScore: 50,
        scoreReasons: ["Importado via Discovery Engine"]
      };

      const effectiveScore = calculateEffectiveScore(prospectData);
      
      await addDoc(collection(db, "tenants", tenantId, "prospects"), {
        ...prospectData,
        effectiveScore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Empresa adicionada!", description: `${item.name} foi enviada para o seu pipeline.` });
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
          <h1 className="text-2xl font-bold text-primary">Discovery Engine</h1>
          <p className="text-muted-foreground">Encontre novas indústrias em todo o Brasil para sua base.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Search className="w-4 h-4" /> Filtros de Prospecção Ativa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input 
                placeholder="Setor ou Nome (ex: Metalurgia, Romi...)" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Brasil (Todos)</SelectItem>
                <SelectItem value="SP">São Paulo</SelectItem>
                <SelectItem value="SC">Santa Catarina</SelectItem>
                <SelectItem value="PR">Paraná</SelectItem>
                <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                <SelectItem value="MG">Minas Gerais</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isSearching} className="bg-accent hover:bg-accent/90">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Buscar Oportunidades
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item) => (
                <TableRow key={item.cnpj}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">{item.cnpj}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <MapPin className="w-3 h-3" /> {item.city}, {item.state}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{item.sector}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                      <Globe className="w-3 h-3" /> {item.website}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-accent hover:text-accent hover:bg-accent/10"
                      disabled={isAddingId === item.cnpj}
                      onClick={() => handleAddToPipeline(item)}
                    >
                      {isAddingId === item.cnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                      Add Pipeline
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : !isSearching && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
          <Factory className="w-12 h-12 mx-auto opacity-10 mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Use os filtros acima para descobrir novas indústrias.</p>
        </div>
      )}
    </div>
  );
}
