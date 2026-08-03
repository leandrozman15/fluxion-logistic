export type ListOptions = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
  status?: string;
};

function pickFirst(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

export function parseListOptions(query: Record<string, unknown>): ListOptions {
  const pageValue = Number(pickFirst(query.page));
  const pageSizeValue = Number(pickFirst(query.pageSize));

  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  const pageSizeRaw = Number.isFinite(pageSizeValue) && pageSizeValue > 0 ? Math.floor(pageSizeValue) : 20;
  const pageSize = Math.min(pageSizeRaw, 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search: pickFirst(query.search),
    status: pickFirst(query.status),
  };
}

export function buildListMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
