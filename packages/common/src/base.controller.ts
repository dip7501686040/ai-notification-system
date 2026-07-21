import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { Paginated } from "./types";
import type { RawListQuery } from "./list-query";
import type { BaseCrudService } from "./base.service";

// Generic REST surface (list/get/create/update/delete) for a resource
// backed by a BaseCrudService. Assumes the entity's unique identifier is
// its `id` field, matching every Prisma model in this monorepo.
//
// Services with authorization or ownership rules (e.g. tenant membership)
// should override these methods in the concrete controller and re-apply
// the route decorator -- overriding without re-decorating drops the route.
export abstract class BaseCrudController<Entity, CreateInput, UpdateInput, WhereUniqueInput> {
  protected constructor(
    // WhereInput/OrderByInput are irrelevant to this controller's surface
    // (it only ever passes a RawListQuery through to service.list()), so
    // they're intentionally erased here rather than threaded as two more
    // generic params every concrete controller would have to repeat.
    protected readonly service: BaseCrudService<
      Entity,
      CreateInput,
      UpdateInput,
      WhereUniqueInput,
      unknown,
      unknown
    >,
  ) {}

  @Get()
  list(@Query() query: RawListQuery): Promise<Paginated<Entity>> {
    return this.service.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Entity | null> {
    return this.service.findUnique({ id } as unknown as WhereUniqueInput);
  }

  @Post()
  create(@Body() dto: CreateInput): Promise<Entity> {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateInput): Promise<Entity> {
    return this.service.update({ id } as unknown as WhereUniqueInput, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string): Promise<Entity> {
    return this.service.delete({ id } as unknown as WhereUniqueInput);
  }
}
