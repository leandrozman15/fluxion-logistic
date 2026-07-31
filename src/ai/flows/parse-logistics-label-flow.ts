'use server';
/**
 * @fileOverview Agente de IA especializado en la extracción de datos de etiquetas logísticas.
 *
 * - parseLogisticsLabel - Procesa la imagen de una etiqueta y devuelve un objeto estructurado.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LabelInputSchema = z.object({
  photoDataUri: z.string().describe("Data URI de la foto de la etiqueta (base64)"),
});

const LabelOutputSchema = z.object({
  recipient: z.object({
    name: z.string().describe("Nombre completo del destinatario"),
    phone: z.string().optional().describe("Teléfono de contacto si figura"),
  }),
  address: z.object({
    street: z.string().describe("Nombre de la calle"),
    number: z.string().describe("Altura/Número"),
    floor: z.string().optional().describe("Piso"),
    dept: z.string().optional().describe("Departamento"),
    city: z.string().describe("Ciudad/Localidad"),
    province: z.string().describe("Provincia"),
    zipCode: z.string().describe("Código Postal"),
    observations: z.string().optional().describe("Notas de entrega (ej: tocar timbre izquierdo)"),
  }),
  tracking: z.object({
    id: z.string().describe("Número de seguimiento o Tracking ID"),
    carrier: z.string().default("Mercado Libre").describe("Empresa de correo"),
    barcode: z.string().optional().describe("Valor del código de barras"),
    qrData: z.string().optional().describe("Valor del código QR"),
  }),
  validation: z.object({
    isAddressComplete: z.boolean().describe("Indica si la dirección tiene calle, altura y ciudad"),
    confidence: z.number().min(0).max(100),
  })
});

export type LabelOutput = z.infer<typeof LabelOutputSchema>;

const labelPrompt = ai.definePrompt({
  name: 'labelPrompt',
  input: { schema: LabelInputSchema },
  output: { schema: LabelOutputSchema },
  prompt: `Eres un experto en logística de última milla. Tu tarea es extraer la información de entrega de esta etiqueta de Mercado Libre.

Reglas:
1. Extrae los datos de forma estructurada siguiendo el esquema JSON.
2. Si la dirección es ambigua, intenta deducir la ciudad por el código postal.
3. El campo 'recipient.name' debe ser el nombre de la persona que recibe.
4. Identifica el número de tracking (suele empezar con ML o ser un número largo de 10+ dígitos).

Foto de la Etiqueta: {{media url=photoDataUri}}`,
});

export async function parseLogisticsLabel(photoDataUri: string): Promise<LabelOutput> {
  const { output } = await labelPrompt({ photoDataUri });
  if (!output) throw new Error("No se pudo leer la etiqueta.");
  return output;
}
