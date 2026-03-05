
'use server';
/**
 * @fileOverview A Genkit flow to calculate a smart industrial score for a prospect.
 * 
 * - calculateProspectAiScore - Analyzes prospect data to generate a business potential score.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CalculateProspectAiScoreInputSchema = z.object({
  companyName: z.string(),
  industryTags: z.array(z.string()),
  city: z.string().optional(),
  state: z.string().optional(),
  hasWebsite: z.boolean(),
  hasCorporateEmail: z.boolean(),
  hasPhone: z.boolean(),
  status: z.string(),
  cnpj: z.string().optional(),
});
export type CalculateProspectAiScoreInput = z.infer<typeof CalculateProspectAiScoreInputSchema>;

const CalculateProspectAiScoreOutputSchema = z.object({
  aiScore: z.number().min(0).max(100).describe('Score based on business potential and data quality.'),
  confidence: z.enum(['low', 'medium', 'high']).describe('AI confidence in the assessment.'),
  reasons: z.array(z.string()).describe('Concise reasons for the assigned score.'),
});
export type CalculateProspectAiScoreOutput = z.infer<typeof CalculateProspectAiScoreOutputSchema>;

const prospectScorePrompt = ai.definePrompt({
  name: 'prospectScorePrompt',
  input: { schema: CalculateProspectAiScoreInputSchema },
  output: { schema: CalculateProspectAiScoreOutputSchema },
  prompt: `Você é um analista sênior de inteligência de mercado B2B industrial no Brasil.
Sua tarefa é avaliar o potencial de prospecção de uma empresa com base nos dados fornecidos.

Considere as seguintes heurísticas de valor industrial:
1. **Presença Digital**: Ter website e email corporativo (não gmail/outlook) é um sinal forte de maturidade.
2. **Segmento**: Indústrias de transformação, metalurgia, logística e manufatura têm maior peso.
3. **Localização**: Cidades industriais ou polos logísticos são pontos positivos.
4. **Acionabilidade**: Se temos nome da empresa, CNPJ e contato direto, a nota deve ser alta.

Regras Estritas:
- NÃO invente dados que não estão na entrada.
- Se a informação for muito escassa, a confiança deve ser "low".
- As razões devem ser curtas e citar os campos analisados (ex: "Possui domínio corporativo", "Localizada em polo industrial").

Dados do Prospect:
- Empresa: {{{companyName}}}
- Tags: {{#each industryTags}}{{{this}}}, {{/each}}
- Local: {{{city}}}/{{{state}}}
- Tem Website: {{#if hasWebsite}}Sim{{else}}Não{{/if}}
- Tem Email Corp: {{#if hasCorporateEmail}}Sim{{else}}Não{{/if}}
- Tem Telefone: {{#if hasPhone}}Sim{{else}}Não{{/if}}
- CNPJ: {{{cnpj}}}
- Status Atual: {{{status}}}

Forneça a saída estritamente no formato JSON solicitado.`,
});

export const calculateProspectAiScoreFlow = ai.defineFlow(
  {
    name: 'calculateProspectAiScoreFlow',
    inputSchema: CalculateProspectAiScoreInputSchema,
    outputSchema: CalculateProspectAiScoreOutputSchema,
  },
  async (input) => {
    const { output } = await prospectScorePrompt(input);
    if (!output) {
      throw new Error('Falha ao gerar score inteligente via IA.');
    }
    return output;
  }
);

export async function calculateProspectAiScore(input: CalculateProspectAiScoreInput): Promise<CalculateProspectAiScoreOutput> {
  return calculateProspectAiScoreFlow(input);
}
