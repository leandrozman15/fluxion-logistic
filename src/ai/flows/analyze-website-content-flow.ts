
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
  prompt: `Você é um especialista em inteligência de mercado B2B industrial brasileiro.
Sua tarefa é analisar o conteúdo textual extraído do site de uma empresa e classificá-la para fins de prospecção.

Empresa: {{{companyName}}}
URL: {{{url}}}

CONTEÚDO EXTRAÍDO DO SITE:
"""
{{{text}}}
"""

REGRAS DE ANÁLISE:
1. Extraia de 3 a 6 tags de indústria precisas (ex: Metalurgia, Logística, Injeção Plástica, Manutenção Industrial, Autopeças).
2. Escreva um resumo executivo de no máximo 2 linhas sobre o que eles fabricam ou qual serviço técnico prestam. Seja direto e industrial.
3. Identifique palavras-chave técnicas relevantes (certificações, tipos de máquinas, processos específicos).
4. Se o conteúdo parecer genérico, institucional demais ou não industrial, marque confiança "low".
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
      // Use a timeout to prevent hanging the server action
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(input.websiteUrl, {
        headers: { 
          'User-Agent': 'FluxionRadar-IntelligenceBot/1.0 (B2B Industrial Research)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal,
        next: { revalidate: 3600 } 
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const html = await response.text();
      
      // Basic cleaning (remove scripts, styles, and extra whitespace)
      pageText = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 12000); // Limit to 12k chars for prompt efficiency

      if (pageText.length < 100) {
        throw new Error("Conteúdo insuficiente detectado no site.");
      }

    } catch (e: any) {
      console.error("Website Fetch Error:", e);
      if (e.name === 'AbortError') throw new Error("O site demorou muito para responder.");
      throw new Error(`Não foi possível acessar o site: ${input.websiteUrl}.`);
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
