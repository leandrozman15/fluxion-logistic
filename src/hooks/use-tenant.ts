"use client";

import { useState, useEffect } from 'react';

/**
 * Hook simplificado para Modo Livre.
 * Retorna sempre a organização padrão para evitar erros de permissão e "N/A".
 */
export function useTenant() {
  // Em produção/modo livre, não precisamos de listeners complexos
  const [tenantId] = useState<string>("default_tenant");
  const [loading] = useState(false);

  return { tenantId, loading };
}
