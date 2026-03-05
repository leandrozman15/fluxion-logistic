
'use server';
/**
 * @fileOverview A Genkit flow to predict the probability of closing a deal.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PredictCloseProbabilityInputSchema = z.object({
  baselineProbability: z.number(),
  deterministicSignals: z.array(z.string()),
  prospect: z.object({
    companyName: z.string(),
    industryTags: z.array(z.string()),
    status: z.string(),
    aiWebSummary: z.string().optional(),
    aiDetectedKeywords: z.array(z.string()).optional(),
    emailAttempts: z.number().optional(),
    lastContactAt: z.string().optional(),
  }),
  segmentPreferredChannel: z.string().optional(),
});
export type PredictCloseProbabilityInput = z.infer<typeof PredictCloseProbabilityInputSchema>;

const PredictCloseProbabilityOutputSchema = z.object({
  closeProbability: z.number().min(0).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
  drivers: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positive', 'negative']),
    evidence: z.string(),
  })).min(3).max(6),
});
export type PredictCloseProbabilityOutput = z.infer<typeof PredictCloseProbabilityOutputSchema>;

const closeProbabilityPrompt = ai.definePrompt({
  name: 'closeProbabilityPrompt',
  input: { schema: PredictCloseProbabilityInputSchema },
  output: { schema: PredictCloseProbabilityOutputSchema },
  prompt: `Você é um analista sênior de estratégia comercial B2B industrial. 
Sua tarefa é calcular a probabilidade final de fechamento de um negócio e explicar os motivos.

Você recebeu uma probabilidade BASE determinística de {{{baselineProbability}}}% baseada em regras de negócio.
Sinais detectados pelo sistema:
{{#each deterministicSignals}} - {{{this}}}
{{/each}}

Dados do Prospect:
- Empresa: {{{prospect.companyName}}}
- Tags: {{#each prospect.industryTags}}{{{this}}}, {{/each}}
- Status: {{{prospect.status}}}
- Resumo IA do Site: {{{prospect.aiWebSummary}}}
- Keywords Técnicas: {{#each prospect.aiDetectedKeywords}}{{{this}}}, {{/each}}
- Tentativas de E-mail: {{{prospect.emailAttempts}}}
- Canal Preferencial do Setor: {{{segmentPreferredChannel}}}

REGRAS DE OURO:
1. NÃO invente fatos. Use apenas os dados fornecidos.
2. A probabilidade final deve ser um ajuste fino da base, raramente mudando mais de 20 pontos percentuais para cima ou para baixo, a menos que haja uma evidência muito forte no resumo do site ou comportamento.
3. Drivers devem ser claros e citar evidências (ex: "Presença de tecnologias CNC indica maturidade técnica").
4. Se houver pouco dado, a confiança deve ser "low".

Gere a saída estritamente no formato JSON solicitado.`,
});

export const predictCloseProbabilityFlow = ai.defineFlow(
  {
    name: 'predictCloseProbabilityFlow',
    inputSchema: PredictCloseProbabilityInputSchema,
    outputSchema: PredictCloseProbabilityOutputSchema,
  },
  async (input) => {
    const { output } = await closeProbabilityPrompt(input);
    if (!output) {
      throw new Error('Falha ao prever probabilidade de fechamento via IA.');
    }
    return output;
  }
);

export async function predictCloseProbability(input: PredictCloseProbabilityInput): Promise<PredictCloseProbabilityOutput> {
  return predictCloseProbabilityFlow(input);
}
