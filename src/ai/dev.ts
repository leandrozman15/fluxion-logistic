
import { config } from 'dotenv';
config();

import '@/ai/flows/calculate-industrial-relevance-score-flow.ts';
import '@/ai/flows/enrich-prospect-data-automatically-flow.ts';
import '@/ai/flows/generate-email-draft-flow.ts';
import '@/ai/flows/calculate-prospect-ai-score-flow.ts';
import '@/ai/flows/analyze-website-content-flow.ts';
import '@/ai/flows/suggest-corporate-emails-flow.ts';
import '@/ai/flows/generate-whatsapp-message-flow.ts';
