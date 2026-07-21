import type { Paginated } from "./types";
import { parseListQuery, type ListOptions, type RawListQuery } from "./list-query";

// Structural shape shared by every Prisma model delegate (prisma.<model>).
// Kept duck-typed rather than imported from @prisma/client so this package
// stays free of a Prisma dependency -- each service supplies its own
// generated types as generic parameters.
export interface CrudDelegate<
  Entity,
  CreateInput,
  UpdateInput,
  WhereUniqueInput,
  WhereInput,
  OrderByInput = unknown,
> {
  create(args: { data: CreateInput }): Promise<Entity>;
  findUnique(args: { where: WhereUniqueInput }): Promise<Entity | null>;
  findMany(args?: {
    where?: WhereInput;
    skip?: number;
    take?: number;
    orderBy?: OrderByInput | OrderByInput[];
  }): Promise<Entity[]>;
  count(args?: { where?: WhereInput }): Promise<number>;
  update(args: { where: WhereUniqueInput; data: UpdateInput }): Promise<Entity>;
  delete(args: { where: WhereUniqueInput }): Promise<Entity>;
}

export abstract class BaseCrudService<
  Entity,
  CreateInput,
  UpdateInput,
  WhereUniqueInput,
  WhereInput = never,
  OrderByInput = never,
> {
  protected constructor(
    private readonly delegate: CrudDelegate<
      Entity,
      CreateInput,
      UpdateInput,
      WhereUniqueInput,
      WhereInput,
      OrderByInput
    >,
  ) {}

  create(data: CreateInput): Promise<Entity> {
    return this.delegate.create({ data });
  }

  findUnique(where: WhereUniqueInput): Promise<Entity | null> {
    return this.delegate.findUnique({ where });
  }

  findMany(where?: WhereInput): Promise<Entity[]> {
    return this.delegate.findMany(where === undefined ? undefined : { where });
  }

  // Paginated listing with optional fuzzy/field search (?search=) and
  // sorting (?sort_fields=&sort_type=). See list-query.ts for the query
  // param contract. baseWhere is a caller-supplied filter (e.g. tenant
  // scoping) that's always applied, ANDed with whatever ?search= derives --
  // unlike the query-driven where, it isn't optional at the caller's
  // discretion.
  async list(
    query: RawListQuery,
    options: ListOptions = {},
    baseWhere?: WhereInput,
  ): Promise<Paginated<Entity>> {
    const parsed = parseListQuery(query, options);
    const searchWhere = parsed.where as WhereInput | undefined;
    const where =
      baseWhere !== undefined && searchWhere !== undefined
        ? ({ AND: [baseWhere, searchWhere] } as WhereInput)
        : (baseWhere ?? searchWhere);
    const orderBy = parsed.orderBy as OrderByInput[] | undefined;

    const [list, total] = await Promise.all([
      this.delegate.findMany({ where, skip: parsed.skip, take: parsed.take, orderBy }),
      this.delegate.count({ where }),
    ]);

    return { list, total, page: parsed.page, pageSize: parsed.limit };
  }

  update(where: WhereUniqueInput, data: UpdateInput): Promise<Entity> {
    return this.delegate.update({ where, data });
  }

  delete(where: WhereUniqueInput): Promise<Entity> {
    return this.delegate.delete({ where });
  }
}
