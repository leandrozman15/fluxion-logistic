
'use server';
/**
 * @fileOverview A Genkit flow to generate a tactical prospecting approach plan.
 * 
 * - generateApproachPlan - Analyzes prospect signals to suggest the best message and channel.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateApproachPlanInputSchema = z.object({
  prospect: z.object({
    companyName: z.string(),
    industryTags: z.array(z.string()),
    aiWebSummary: z.string().optional(),
    contacts: z.array(z.object({
      name: z.string(),
      role: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })).optional(),
    doNotContact: z.boolean().optional(),
  }),
  closeProbability: z.number().optional(),
  drivers: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positive', 'negative']),
    evidence: z.string(),
  })).optional(),
  preferredChannel: z.enum(['email', 'whatsapp', 'none']).optional(),
  emailQuality: z.enum(['corporate', 'generic', 'spam']).optional(),
  spamRisk: z.number().optional(),
});
export type GenerateApproachPlanInput = z.infer<typeof GenerateApproachPlanInputSchema>;

const GenerateApproachPlanOutputSchema = z.object({
  recommendedChannel: z.enum(['whatsapp', 'email']),
  approachAngle: z.enum(['operacional', 'comercial', 'compliance', 'dados']),
  subject: z.string().optional().describe('Suggest if email is the channel.'),
  message: z.string().describe('The primary outreach message.'),
  followupMessage: z.string().describe('A short follow-up message for 2 days later.'),
  qualifyingQuestions: z.array(z.string()).describe('2-3 questions to ask the prospect.'),
});
export type GenerateApproachPlanOutput = z.infer<typeof GenerateApproachPlanOutputSchema>;

const approachPlanPrompt = ai.definePrompt({
  name: 'approachPlanPrompt',
  input: { schema: GenerateApproachPlanInputSchema },
  output: { schema: GenerateApproachPlanOutputSchema },
  prompt: `Você é um SDR B2B sênior especialista em indústrias no Brasil. 
Sua tarefa é criar o plano de abordagem perfeito para o prospect abaixo.

DADOS DO PROSPECT:
- Empresa: {{{prospect.companyName}}}
- Tags: {{#each prospect.industryTags}}{{{this}}}, {{/each}}
- Resumo IA: {{{prospect.aiWebSummary}}}
- Probabilidade de Fechamento: {{{closeProbability}}}%
- Drivers detectados:
{{#each drivers}}  * {{{factor}}} ({{{impact}}}): {{{evidence}}}
{{/each}}
- Canal Preferencial do Segmento: {{{preferredChannel}}}
- Qualidade do E-mail: {{{emailQuality}}}

REGRAS E DIRETRIZES:
1. Idioma: Português (pt-BR). Tom: Industrial, respeitoso, sem emojis.
2. NÃO INVENTE DADOS. Se não souber algo, não cite.
3. Use os "Drivers" como evidência de que você pesquisou sobre eles (ex: "Vi que vocês possuem tecnologias CNC...").
4. Se o e-mail for "generic" (contato@, vendas@), sua mensagem deve pedir para falar com o responsável ou sugerir WhatsApp.
5. Se closeProbability for alta (>70%), a abordagem deve ser mais direta e nominal.
6. Se spamRisk for alto, a mensagem de e-mail deve ser curta e sem muitos links.
7. O campo "message" deve ter entre 4 a 8 linhas. "followupMessage" deve ter 2-3 linhas.

Gere o plano de abordagem no formato JSON especificado.`,
});

export const generateApproachPlanFlow = ai.defineFlow(
  {
    name: 'generateApproachPlanFlow',
    inputSchema: GenerateApproachPlanInputSchema,
    outputSchema: GenerateApproachPlanOutputSchema,
  },
  async (input) => {
    if (input.prospect.doNotContact) {
      throw new Error("Abordagem bloqueada: Prospect em lista Do Not Contact.");
    }

    const { output } = await approachPlanPrompt(input);
    if (!output) {
      throw new Error("Falha ao gerar o plano de abordagem via IA.");
    }
    return output;
  }
);

export async function generateApproachPlan(input: GenerateApproachPlanInput): Promise<GenerateApproachPlanOutput> {
  return generateApproachPlanFlow(input);
}
