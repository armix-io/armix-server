import { ModelAny } from "../../model/model";
import { Adapter, QueryModifier } from "../../types/adapter";
import { QueryTransport } from "../../types/transports";
import { Context } from "../../types/context";
import { Info } from "../../types/info";
import { AutographError } from "../../errors";

export const createQueryOne = (model: ModelAny, adapter: Adapter) => async (
  id: string,
  context: Context,
  info: Info
) => {
  const { name, hooks } = model;

  const query: QueryTransport = {
    context,
    name,
    id,
  };

  const queryHook = hooks.onQueryOne || hooks.onQuery;
  const queryModifier: QueryModifier = (query) => {
    queryHook && queryHook(query, context, info);
  };

  const {
    items: [item],
  } = (await adapter.onQuery(query, queryModifier)) as {
    items: (Record<string, any> | undefined)[];
  };

  if (!item) throw new AutographError("NOT_FOUND");

  return item;
};
