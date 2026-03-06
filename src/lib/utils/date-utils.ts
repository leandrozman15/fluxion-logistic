
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Converte e formata qualquer valor de data (Timestamp, ISO, Date) de forma segura.
 */
export function formatSafeDate(value: any, formatStr: string = "dd/MM/yyyy HH:mm"): string {
  if (!value) return "N/A";

  let date: Date;

  try {
    // 1. Caso seja Firestore Timestamp
    if (value && typeof value === 'object' && 'toDate' in value) {
      date = value.toDate();
    } 
    // 2. Caso seja string ou Date
    else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) return "Data Inválida";

    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return "Erro na data";
  }
}

/**
 * Retorna um objeto Date real para cálculos, independente da origem.
 */
export function toSafeDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (value && typeof value === 'object' && 'toDate' in value) return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}
