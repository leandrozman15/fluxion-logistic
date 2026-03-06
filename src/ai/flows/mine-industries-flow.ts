
'use server';
/**
 * @fileOverview A Genkit flow to "mine" or discover new industries using AI reasoning.
 * Simulates a browser search for specific niches and regions.
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
    reason: z.string().describe('Why this company was selected.'),
    confidence: z.number().min(0).max(100),
  })),
  searchStrategyUsed: z.string().describe('Explanation of how the AI "found" these companies.'),
});
export type MineIndustriesOutput = z.infer<typeof MineIndustriesOutputSchema>;

const miningPrompt = ai.definePrompt({
  name: 'miningPrompt',
  input: { schema: MineIndustriesInputSchema },
  output: { schema: MineIndustriesOutputSchema },
  prompt: `Você é um robô de prospecção industrial de elite especializado no mercado brasileiro.
Sua missão é "sair para o navegador" (simulado via sua base de conhecimento atualizada e lógica de busca) e identificar indústrias que correspondam ao nicho e região solicitados.

NICHO: {{{niche}}}
REGIÃO: {{{region}}}
ICP: {{{perfilIcp}}}

INSTRUÇÕES:
1. Identifique de 4 a 6 empresas REAIS que operam neste setor e localidade.
2. Priorize empresas que possuem presença digital (sites ativos).
3. Se não encontrar empresas reais específicas com 100% de certeza, sugira os nomes de empresas líderes do setor na região que você conhece.
4. Para cada empresa, explique o motivo da escolha baseado no potencial industrial.
5. Idioma: Português (pt-BR).

Formato de saída: JSON rigoroso.`,
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
