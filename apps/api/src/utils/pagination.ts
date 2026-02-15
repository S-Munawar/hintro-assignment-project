interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginationResult {
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Convert page/limit to Prisma skip/take. */
export function paginate({ page, limit }: PaginationParams): PaginationResult {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/** Build pagination metadata for API responses. */
export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
