
'use server';
/**
 * @fileOverview A Genkit flow to generate/improve WhatsApp messages for industrial prospects.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateWhatsAppMessageInputSchema = z.object({
  templateBaseText: z.string().describe('The base message to be improved.'),
  prospect: z.object({
    companyName: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    industryTags: z.array(z.string()).optional(),
    contactName: z.string().optional(),
    contactRole: z.string().optional(),
  }).describe('The prospect data for personalization.'),
});
export type GenerateWhatsAppMessageInput = z.infer<typeof GenerateWhatsAppMessageInputSchema>;

const GenerateWhatsAppMessageOutputSchema = z.object({
  message: z.string().describe('The improved WhatsApp message.'),
});
export type GenerateWhatsAppMessageOutput = z.infer<typeof GenerateWhatsAppMessageOutputSchema>;

const whatsappMessagePrompt = ai.definePrompt({
  name: 'whatsappMessagePrompt',
  input: { schema: GenerateWhatsAppMessageInputSchema },
  output: { schema: GenerateWhatsAppMessageOutputSchema },
  prompt: `Você é um SDR B2B especialista em indústrias no Brasil. Sua tarefa é reescrever uma mensagem de WhatsApp para torná-la mais direta, profissional e amigável, mantendo o foco industrial.

Regras Estritas:
- Idioma: Português (pt-BR).
- Tom: Industrial, direto, mas leve (apropriado para WhatsApp).
- Comprimento: Máximo 4 linhas no corpo principal.
- SEM emojis.
- NÃO use termos como "IA", "automação" ou jargões de marketing digital.
- Inclua 1 CTA (Chamada para Ação) simples e curta no final.
- Se houver contactName, use-o; senão, comece com "Olá".
- Use os dados do prospect para dar contexto, mas sem inventar fatos.

Mensagem Base:
{{{templateBaseText}}}

Dados do Prospect:
- Empresa: {{{prospect.companyName}}}
- Localização: {{{prospect.city}}}/{{{prospect.state}}}
- Tags: {{#each prospect.industryTags}}{{{this}}}, {{/each}}
- Contato: {{{prospect.contactName}}}
- Cargo: {{{prospect.contactRole}}}

Gere a mensagem final no formato JSON especificado.`,
});

export const generateWhatsAppMessageFlow = ai.defineFlow(
  {
    name: 'generateWhatsAppMessageFlow',
    inputSchema: GenerateWhatsAppMessageInputSchema,
    outputSchema: GenerateWhatsAppMessageOutputSchema,
  },
  async (input) => {
    const { output } = await whatsappMessagePrompt(input);
    if (!output) {
      throw new Error('Falha ao gerar a mensagem de WhatsApp com IA.');
    }
    return output;
  }
);

export async function generateWhatsAppMessage(input: GenerateWhatsAppMessageInput): Promise<GenerateWhatsAppMessageOutput> {
  return generateWhatsAppMessageFlow(input);
}
