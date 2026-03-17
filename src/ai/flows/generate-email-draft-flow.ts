'use server';
/**
 * @fileOverview A Genkit flow to generate personalized B2B industrial email drafts.
 *
 * - generateEmailDraft - Function to generate a personalized email draft based on a template and prospect data.
 * - GenerateEmailDraftInput - Input schema for the flow.
 * - GenerateEmailDraftOutput - Output schema containing the improved subject and body.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEmailDraftInputSchema = z.object({
  templateSubject: z.string().describe('The base subject of the email template.'),
  templateBody: z.string().describe('The base body of the email template.'),
  prospect: z.object({
    companyName: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    industryTags: z.array(z.string()).optional(),
    websiteUrl: z.string().optional(),
    effectiveScore: z.number().optional(),
    scoreReasons: z.array(z.string()).optional(),
    contactName: z.string().optional(),
    contactRole: z.string().optional(),
  }).describe('The prospect data for personalization.'),
});
export type GenerateEmailDraftInput = z.infer<typeof GenerateEmailDraftInputSchema>;

const GenerateEmailDraftOutputSchema = z.object({
  subject: z.string().max(100).describe('The improved, concise subject line.'),
  body: z.string().describe('The improved, personalized email body.'),
});
export type GenerateEmailDraftOutput = z.infer<typeof GenerateEmailDraftOutputSchema>;

const emailDraftPrompt = ai.definePrompt({
  name: 'emailDraftPrompt',
  input: { schema: GenerateEmailDraftInputSchema },
  output: { schema: GenerateEmailDraftOutputSchema },
  prompt: `Você é um SDR B2B especialista em indústrias no Brasil. Sua tarefa é reescrever um email de prospecção para torná-lo mais direto, profissional e focado em conversão.

Objetivo: Iniciar uma conversa com o responsável (compras/produção) ou agendar uma demonstração rápida de 15 minutos.

Regras Estritas:
- Idioma: Português (pt-BR).
- Tom: Industrial, direto, respeitoso. SEM marketing exagerado, SEM promessas milagrosas.
- Comprimento: 90 a 140 palavras no corpo.
- Assunto: Tente manter abaixo de 55 caracteres, sendo muito impactante.
- SEM emojis.
- NÃO mencione "IA", "automação", nem "scraping".
- Inclua 1 CTA (Chamada para Ação) simples no final (ex: "Podemos conversar por 15 min na próxima terça?").
- Se houver contactName, use-o; senão, comece com "Olá".
- Use os dados do prospect para mostrar que você pesquisou sobre a empresa, mas não invente fatos que não estão nos dados.

Dados de Entrada:
TEMPLATE BASE ASSUNTO: {{{templateSubject}}}
TEMPLATE BASE CORPO: {{{templateBody}}}

DADOS DEL PROSPECT:
- Empresa: {{{prospect.companyName}}}
- Localização: {{{prospect.city}}}/{{{prospect.state}}}
- Tags: {{#each prospect.industryTags}}{{{this}}}, {{/each}}
- Score de Relevância: {{{prospect.effectiveScore}}}
- Motivos do Score: {{#each prospect.scoreReasons}}{{{this}}}; {{/each}}
- Website: {{{prospect.websiteUrl}}}
- Nome do Contato: {{{prospect.contactName}}}
- Cargo: {{{prospect.contactRole}}}

Gere o assunto e o corpo do email no formato JSON especificado.`,
});

const generateEmailDraftFlow = ai.defineFlow(
  {
    name: 'generateEmailDraftFlow',
    inputSchema: GenerateEmailDraftInputSchema,
    outputSchema: GenerateEmailDraftOutputSchema,
  },
  async (input) => {
    const { output } = await emailDraftPrompt(input);
    if (!output) {
      throw new Error('Falha ao gerar o rascunho de email com IA.');
    }
    return output;
  }
);

export async function generateEmailDraft(input: GenerateEmailDraftInput): Promise<GenerateEmailDraftOutput> {
  return generateEmailDraftFlow(input);
}
