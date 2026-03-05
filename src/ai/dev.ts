import { config } from 'dotenv';
config();

import '@/ai/flows/calculate-industrial-relevance-score-flow.ts';
import '@/ai/flows/enrich-prospect-data-automatically-flow.ts';
import '@/ai/flows/generate-email-draft-flow.ts';
