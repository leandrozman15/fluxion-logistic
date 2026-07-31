
'use server';
/**
 * @fileOverview Agente de IA especializado en la extracción de datos de etiquetas logísticas.
 * Optimizado para Mercado Libre y envíos de última milla.
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
    barrio: z.string().optional().describe("Barrio o zona industrial"),
    city: z.string().describe("Ciudad/Localidad"),
    province: z.string().describe("Provincia"),
    zipCode: z.string().describe("Código Postal"),
    references: z.string().optional().describe("Referencias visuales (ej: portón azul)"),
    observations: z.string().optional().describe("Notas de entrega"),
  }),
  tracking: z.object({
    id: z.string().describe("Número de seguimiento o Tracking ID (ej: MLA...)"),
    carrier: z.string().default("Mercado Libre").describe("Empresa de correo"),
    barcode: z.string().optional().describe("Valor del código de barras"),
    qrData: z.string().optional().describe("Valor del código QR"),
    distributionCenter: z.string().optional().describe("Centro de distribución de origen"),
    deliveryWindow: z.string().optional().describe("Horario sugerido de entrega"),
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
  prompt: `Eres un experto en logística de última milla y reconocimiento de documentos.
Tu tarea es extraer la información de entrega de esta etiqueta de Mercado Libre con precisión militar.

REGLAS ESTRICTAS:
1. Extrae los datos de forma estructurada siguiendo el esquema JSON.
2. Si un dato no es visible, devuelve null. NO INVENTES DATOS.
3. Si la dirección es ambigua, intenta deducir la ciudad por el código postal.
4. Identifica el número de tracking MLA o similar.
5. Separa 'piso' y 'departamento' si están presentes en la dirección.

Foto de la Etiqueta: {{media url=photoDataUri}}`,
});

export async function parseLogisticsLabel(photoDataUri: string): Promise<LabelOutput> {
  const { output } = await labelPrompt({ photoDataUri });
  if (!output) throw new Error("No se pudo leer la etiqueta.");
  return output;
}
