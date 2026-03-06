'use server';
/**
 * @fileOverview Service to interact with ReceitaWS API for Brazilian company data.
 * This is now a Server Action to bypass CORS and manage requests server-side.
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
 * Fetches company data from ReceitaWS via server-side fetch.
 */
export async function fetchCnpjData(cnpj: string): Promise<ReceitaWSResponse> {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  
  if (cleanCnpj.length !== 14) {
    throw new Error("CNPJ inválido. Deve conter 14 dígitos.");
  }

  try {
    // We call the API from the server to avoid CORS issues in the browser
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json' 
      },
      // Using a slightly shorter cache for the server action or none to ensure fresh data
      next: { revalidate: 3600 } 
    });

    if (response.status === 429) {
      throw new Error("Limite da Receita Federal atingido (3 consultas/min). Aguarde um momento.");
    }

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error("O servidor da Receita Federal demorou a responder. Tente novamente.");
      }
      throw new Error(`Erro na conexão com a Receita Federal: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "ERROR") {
      // ReceitaWS returns 200 OK but with status: "ERROR" for invalid/not found CNPJs
      throw new Error(data.message || "Empresa não encontrada na base da Receita Federal.");
    }

    return data as ReceitaWSResponse;
  } catch (error: any) {
    console.error("ReceitaWS Server Error:", error.message);
    throw error;
  }
}
