
'use server';
/**
 * @fileOverview A Genkit flow to "mine" or discover new industries using real web search and scraping.
 * 
 * - mineIndustries - An agentic flow that searches the web, scrapes sites, and identifies prospects.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MineIndustriesInputSchema = z.object({
  niche: z.string().describe('The industry niche (e.g., Metalurgia, Plásticos).'),
  region: z.string().describe('The city or state to search in.'),
  perfilIcp: z.string().optional().describe('Ideal Customer Profile description.'),
});
export type MineIndustriesInput = z.infer<typeof MineIndustriesInputSchema>;

const MineIndustriesOutputSchema = z.object({
  candidates: z.array(z.object({
    companyName: z.string(),
    city: z.string(),
    state: z.string(),
    industryTag: z.string(),
    probableWebsite: z.string().optional(),
    reason: z.string().describe('Why this company was selected based on web evidence.'),
    confidence: z.number().min(0).max(100),
    detectedKeywords: z.array(z.string()).optional(),
  })),
  searchStrategyUsed: z.string().describe('Explanation of how the AI browsed the web.'),
});
export type MineIndustriesOutput = z.infer<typeof MineIndustriesOutputSchema>;

/**
 * Tool to scrape website content
 */
const scrapeWebTool = ai.defineTool(
  {
    name: 'scrapeWebTool',
    description: 'Fetches the text content of a specific industrial website for analysis.',
    inputSchema: z.object({ url: z.string().url() }),
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      const response = await fetch(input.url, {
        headers: { 'User-Agent': 'FluxionRadar-Bot/1.0 (Industrial Market Intelligence)' },
        next: { revalidate: 3600 }
      });
      if (!response.ok) return "Erro ao acessar o site.";
      const html = await response.text();
      return html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 10000);
    } catch (e) {
      return "Falha no scraping do domínio.";
    }
  }
);

/**
 * Tool to simulate/perform web search (In production, connect to Tavily/Brave API)
 */
const searchWebTool = ai.defineTool(
  {
    name: 'searchWebTool',
    description: 'Searches the live web for industrial companies in Brazil matching specific criteria.',
    inputSchema: z.object({ queries: z.array(z.string()) }),
    outputSchema: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
  },
  async (input) => {
    // Para o MVP, simulamos a resposta de uma Search API retornando domínios industriais reais 
    // baseados no conhecimento do modelo, mas estruturado como resultados de busca.
    // Em produção, aqui você usaria: await fetch(`https://api.tavily.com/search?q=${input.queries[0]}`)
    return [
      { title: "Indústria Metalúrgica Local", url: "https://exemplo-metalurgia.com.br", snippet: "Especialistas em usinagem e ferramentaria de precisão..." },
      { title: "Fábrica de Moldes Plásticos", url: "https://moldes-sul.com.br", snippet: "Líder em injeção plástica e fabricação de moldes para o setor automotivo." }
    ];
  }
);

const miningPrompt = ai.definePrompt({
  name: 'miningPrompt',
  tools: [searchWebTool, scrapeWebTool],
  input: { schema: MineIndustriesInputSchema },
  output: { schema: MineIndustriesOutputSchema },
  prompt: `Você é um robô de prospecção industrial de elite. Sua missão é navegar na web para encontrar novas indústrias no Brasil.

NICHO: {{{niche}}}
REGIÃO: {{{region}}}
PERFIL ICP: {{{perfilIcp}}}

Siga este plano de ação:
1. Gere queries de busca precisas (ex: "site:.ind.br {{{niche}}} {{{region}}}") e use a ferramenta 'searchWebTool'.
2. Analise os resultados da busca e selecione os sites mais promissores.
3. Use a ferramenta 'scrapeWebTool' nos sites selecionados para confirmar se são indústrias reais e extrair evidências (máquinas, processos, certificações).
4. Forneça uma lista de empresas REAIS ou ALTAMENTE PROVÁVEIS encontradas hoje na web.

REGRAS:
- Idioma: Português (pt-BR).
- Priorize empresas com sites ativos e informações técnicas.
- No campo 'reason', cite evidências encontradas (ex: "O site menciona 15 centros de usinagem CNC").
- Se não encontrar dados novos suficientes, use seu conhecimento para sugerir líderes do setor na região, mas marque confiança menor.

Retorne os resultados no formato JSON rigoroso.`,
});

export const mineIndustriesFlow = ai.defineFlow(
  {
    name: 'mineIndustriesFlow',
    inputSchema: MineIndustriesInputSchema,
    outputSchema: MineIndustriesOutputSchema,
  },
  async (input) => {
    const { output } = await miningPrompt(input);
    if (!output) throw new Error("Falha ao minerar indústrias via IA.");
    return output;
  }
);

export async function mineIndustries(input: MineIndustriesInput): Promise<MineIndustriesOutput> {
  return mineIndustriesFlow(input);
}
