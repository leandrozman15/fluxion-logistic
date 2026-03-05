
import { Prospect } from "@/app/lib/types";

export const PERMITTED_VARIABLES = [
  'companyName',
  'cnpj',
  'city',
  'state',
  'websiteUrl',
  'domain',
  'contactName',
  'contactRole',
  'contactEmail',
  'phone'
] as const;

export type PermittedVariable = typeof PERMITTED_VARIABLES[number];

/**
 * Renderiza un string reemplazando variables dinámicas con datos del prospecto.
 */
export function renderTemplate(template: string, prospect: Partial<Prospect>): string {
  if (!template) return '';

  const context: Record<string, string> = {
    companyName: prospect.companyName || 'Empresa',
    cnpj: prospect.cnpj || '-',
    city: prospect.address?.city || '-',
    state: prospect.address?.state || '-',
    websiteUrl: prospect.websiteUrl || '-',
    domain: prospect.domain || '-',
    contactName: prospect.contacts?.[0]?.name || 'Prezado(a)',
    contactRole: prospect.contacts?.[0]?.role || '-',
    contactEmail: prospect.contacts?.[0]?.email || '-',
    phone: prospect.contacts?.[0]?.phone || '-',
  };

  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    if (PERMITTED_VARIABLES.includes(key as PermittedVariable)) {
      return context[key] || '';
    }
    return match; // Devolver el tag original si no es una variable permitida
  });
}

/**
 * Extrae las variables utilizadas en un string.
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/{{\s*(\w+)\s*}}/g);
  const found = new Set<string>();
  for (const match of matches) {
    if (PERMITTED_VARIABLES.includes(match[1] as PermittedVariable)) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}
