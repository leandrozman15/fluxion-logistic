
'use server';
/**
 * @fileOverview A Genkit flow to suggest probable corporate emails for a prospect.
 * 
 * - suggestCorporateEmails - Uses domain, contact names and patterns to suggest emails.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestEmailsInputSchema = z.object({
  domain: z.string().describe('The company domain (e.g., example.com.br).'),
  companyName: z.string(),
  contactName: z.string().optional().describe('Optional contact name to generate nominative patterns.'),
  existingEmails: z.array(z.string()).optional().describe('List of already known emails to help pattern detection.'),
  websiteTextSnippet: z.string().optional().describe('Optional text snippet from website to find explicit emails.'),
});
export type SuggestEmailsInput = z.infer<typeof SuggestEmailsInputSchema>;

const SuggestEmailsOutputSchema = z.object({
  suggestions: z.array(z.object({
    email: z.string().email(),
    type: z.enum(['verified_on_site', 'pattern_guess', 'generic_role']),
    confidence: z.enum(['low', 'medium', 'high']),
    reason: z.string().describe('Short explanation of why this email was suggested.'),
  })).max(8),
});
export type SuggestEmailsOutput = z.infer<typeof SuggestEmailsOutputSchema>;

const emailSuggestionPrompt = ai.definePrompt({
  name: 'emailSuggestionPrompt',
  input: { schema: SuggestEmailsInputSchema },
  output: { schema: SuggestEmailsOutputSchema },
  prompt: `Você é um assistente sênior de inteligência de prospecção B2B. Sua tarefa é sugerir e-mails corporativos prováveis para um prospect industrial, priorizando a precisão e evitando invenções sem base.

Regras Estritas:
1. Use APENAS o domínio fornecido: "{{{domain}}}".
2. Se o "websiteTextSnippet" contiver e-mails explícitos (ex: contato@..., vendas@...), marque-os como "verified_on_site" com confiança "high".
3. Se houver um "contactName" (ex: João Silva), sugira padrões nominativos (ex: joao.silva@..., jsilva@...) como "pattern_guess" com confiança "medium" ou "low".
4. Sugira sempre e-mails de função genérica ("generic_role") comuns no Brasil como: contato@, vendas@, compras@, diretoria@, comercial@.
5. NÃO invente nomes de pessoas que não estão na entrada.
6. Forneça no máximo 8 sugestões.
7. O campo "reason" deve ser uma frase curta e direta (ex: "Padrão comum para o nome fornecido", "Encontrado no conteúdo do site").

Dados de Entrada:
- Domínio: {{{domain}}}
- Empresa: {{{companyName}}}
- Nome do Contato: {{{contactName}}}
- E-mails existentes: {{#each existingEmails}}{{{this}}}, {{/each}}
- Trecho do Website: {{{websiteTextSnippet}}}

Forneça a saída estritamente no formato JSON solicitado.`,
});

export const suggestCorporateEmailsFlow = ai.defineFlow(
  {
    name: 'suggestCorporateEmailsFlow',
    inputSchema: SuggestEmailsInputSchema,
    outputSchema: SuggestEmailsOutputSchema,
  },
  async (input) => {
    const { output } = await emailSuggestionPrompt(input);
    if (!output) throw new Error("Falha ao gerar sugestões de e-mail via IA.");
    return output;
  }
);

export async function suggestCorporateEmails(input: SuggestEmailsInput): Promise<SuggestEmailsOutput> {
  return suggestCorporateEmailsFlow(input);
}
