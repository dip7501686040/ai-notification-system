export interface RawListQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

export interface ListOptions {
  searchableFields?: string[];
  defaultLimit?: number;
  maxLimit?: number;
}

export interface ParsedListQuery {
  page: number;
  limit: number;
  skip: number;
  take: number;
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const result: unknown = JSON.parse(value);
    return result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// search is either a JSON object string ({"field": "value", ...}, AND-ed
// together as exact/contains filters per field) or a plain string, OR-ed
// as a case-insensitive "contains" across the caller-supplied searchable
// fields (fuzzy search).
function buildSearchWhere(
  search: string | undefined,
  searchableFields: string[],
): Record<string, unknown> | undefined {
  if (!search) {
    return undefined;
  }

  const parsed = tryParseJsonObject(search);
  if (parsed) {
    const clauses = Object.entries(parsed).map(([field, value]) =>
      typeof value === "string"
        ? { [field]: { contains: value, mode: "insensitive" } }
        : { [field]: { equals: value } },
    );
    return clauses.length > 0 ? { AND: clauses } : undefined;
  }

  if (searchableFields.length === 0) {
    return undefined;
  }

  return {
    OR: searchableFields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })),
  };
}

function buildOrderBy(
  sortFields: string | undefined,
  sortType: string | undefined,
): Array<Record<string, "asc" | "desc">> | undefined {
  if (!sortFields) {
    return undefined;
  }

  const direction: "asc" | "desc" = sortType === "desc" ? "desc" : "asc";
  const fields = sortFields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  return fields.length > 0 ? fields.map((field) => ({ [field]: direction })) : undefined;
}

export function parseListQuery(query: RawListQuery, options: ListOptions = {}): ParsedListQuery {
  const maxLimit = options.maxLimit ?? 100;
  const defaultLimit = options.defaultLimit ?? 20;

  const page = Math.max(1, parseInt(query.page ?? "", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit ?? "", 10) || defaultLimit));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    where: buildSearchWhere(query.search, options.searchableFields ?? []),
    orderBy: buildOrderBy(query.sort_fields, query.sort_type),
  };
}
