
/**
 * @fileOverview Service to interact with ReceitaWS API for Brazilian company data.
 */

export interface ReceitaWSResponse {
  status: string;
  message?: string;
  cnpj: string;
  tipo: string;
  porte: string;
  nome: string;
  fantasia: string;
  abertura: string;
  atividade_principal: Array<{ code: string; text: string }>;
  atividades_secundarias: Array<{ code: string; text: string }>;
  natureza_juridica: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  bairro: string;
  municipio: string;
  uf: string;
  email: string;
  telefone: string;
  qsa: Array<{ nome: string; qual: string }>;
  situacao: string;
}

/**
 * Fetches company data from ReceitaWS.
 * Note: Public API has a limit of 3 requests per minute.
 */
export async function fetchCnpjData(cnpj: string): Promise<ReceitaWSResponse> {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  
  if (cleanCnpj.length !== 14) {
    throw new Error("CNPJ inválido. Deve conter 14 dígitos.");
  }

  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 } // Cache for 24h
    });

    if (response.status === 429) {
      throw new Error("Limite de consultas atingido (3/min). Tente novamente em instantes.");
    }

    if (!response.ok) {
      throw new Error(`Erro na API ReceitaWS: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === "ERROR") {
      throw new Error(data.message || "CNPJ não encontrado ou inválido.");
    }

    return data as ReceitaWSResponse;
  } catch (error: any) {
    console.error("ReceitaWS Fetch Error:", error);
    throw error;
  }
}
