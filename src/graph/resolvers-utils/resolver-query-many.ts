import { ModelAny } from "../../model/model";
import { Resolver } from "../../types/resolver";
import { Adapter, QueryModifier } from "../../types/adapter";
import { QueryTransport } from "../../types/transports";
import { AutographError } from "../../errors";

type Args = {
  cursor?: string;
  order?: string;
  filters?: { [key: string]: any };
  limit?: number;
};

export function getQueryManyResolver(model: ModelAny, adapter: Adapter) {
  const { queryMany } = model;
  if (!queryMany) {
    return {};
  }

  const resolver = async (
    ...resolverArgs: Parameters<Resolver<undefined, Args>>
  ) => {
    const { name, hooks } = model;
    const [, args, context, info] = resolverArgs;

    if (args.cursor) {
      return await adapter.onQuery({ context, name, cursor: args.cursor });
    }

    const query: QueryTransport = {
      context,
      name,
      limit: Math.min(args.limit || model.limitDefault, model.limitMax),
    };

    if (args.order) {
      const [, orderFieldName, orderDirection] = (args.order.match(
        /^([\w\d]+)_(asc|desc)$/
      ) || []) as (string | undefined)[];
      if (!orderFieldName || !orderDirection)
        throw new AutographError("INVALID_QUERY_ORDER");

      const field = model.fields[orderFieldName];
      if (!(field && field.orderTarget))
        throw new AutographError("INVALID_QUERY_ORDER_FIELD");

      query.order = {
        target: field.orderTarget,
        direction: orderDirection as "asc" | "desc",
      };
    }

    if (args.filters) {
      Object.entries(args.filters).forEach(([filterName, value]) => {
        const filter = model.filters[filterName];
        if (filter.transport !== "internal") return;
        filter.resolver(value, query, context, info);
      });
    }

    const queryHook = hooks.onQueryMany || hooks.onQuery;
    const queryModifier: QueryModifier = (query) => {
      if (args.filters)
        Object.entries(args.filters).forEach(([filterName, value]) => {
          const filter = model.filters[filterName];
          if (filter.transport !== "adapter") return;
          filter.resolver(value, query, context, info);
        });

      queryHook && queryHook(query, context, info);
    };

    const { items, total, cursor } = await adapter.onQuery(
      query,
      queryModifier
    );

    return {
      items: items,
      total: total,
      cursor: cursor,
    };
  };

  return {
    [queryMany]: resolver,
  };
}
