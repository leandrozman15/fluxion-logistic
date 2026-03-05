
'use server';
/**
 * @fileOverview A Genkit flow to analyze a prospect's website content.
 * 
 * - analyzeWebsiteContent - Fetches and classifies website info into industrial tags and summaries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeWebsiteInputSchema = z.object({
  websiteUrl: z.string().url(),
  companyName: z.string().optional(),
});
export type AnalyzeWebsiteInput = z.infer<typeof AnalyzeWebsiteInputSchema>;

const AnalyzeWebsiteOutputSchema = z.object({
  industryTags: z.array(z.string()).describe('Suggested industrial categories found.'),
  summary: z.string().describe('A 1-2 sentence summary of what the company does.'),
  confidence: z.enum(['low', 'medium', 'high']),
  detectedKeywords: z.array(z.string()).describe('Key industrial terms found (e.g., usinagem, CNC, ISO 9001).'),
});
export type AnalyzeWebsiteOutput = z.infer<typeof AnalyzeWebsiteOutputSchema>;

const webAnalysisPrompt = ai.definePrompt({
  name: 'webAnalysisPrompt',
  input: { schema: z.object({ url: z.string(), text: z.string(), companyName: z.string().optional() }) },
  output: { schema: AnalyzeWebsiteOutputSchema },
  prompt: `Você é um especialista em inteligência de mercado B2B industrial.
Sua tarefa é analisar o conteúdo textual extraído do site de uma empresa e classificá-la.

Empresa: {{{companyName}}}
URL: {{{url}}}

CONTEÚDO EXTRAÍDO:
"""
{{{text}}}
"""

REGRAS:
1. Extraia de 3 a 6 tags de indústria (ex: Metalurgia, Logística, Injeção Plástica, Manutenção Industrial).
2. Escreva um resumo de no máximo 2 linhas sobre o que eles fabricam ou qual serviço prestam.
3. Identifique palavras-chave técnicas (certificações, máquinas, processos).
4. Se o conteúdo parecer genérico ou não industrial, marque confiança "low".
5. Idioma: Português (pt-BR).

Forneça a saída estritamente no formato JSON solicitado.`,
});

export const analyzeWebsiteContentFlow = ai.defineFlow(
  {
    name: 'analyzeWebsiteContentFlow',
    inputSchema: AnalyzeWebsiteInputSchema,
    outputSchema: AnalyzeWebsiteOutputSchema,
  },
  async (input) => {
    // 1. Fetch content (Server-side)
    let pageText = "";
    try {
      const response = await fetch(input.websiteUrl, {
        headers: { 'User-Agent': 'FluxionRadar-Bot/1.0' },
        next: { revalidate: 3600 } // Cache for 1 hour at fetch level
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const html = await response.text();
      
      // Basic cleaning (remove scripts, styles, and extra whitespace)
      pageText = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 15000); // Limit to 15k chars for prompt efficiency

    } catch (e) {
      console.error("Fetch error:", e);
      throw new Error("Não foi possível acessar o site. Verifique a URL ou permissões de rede.");
    }

    // 2. AI Analysis
    const { output } = await webAnalysisPrompt({ 
      url: input.websiteUrl, 
      text: pageText, 
      companyName: input.companyName 
    });

    if (!output) throw new Error("Falha na análise de conteúdo via IA.");

    return output;
  }
);

export async function analyzeWebsiteContent(input: AnalyzeWebsiteInput): Promise<AnalyzeWebsiteOutput> {
  return analyzeWebsiteContentFlow(input);
}
