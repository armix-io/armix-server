import { ModelAny } from "../../model/model";
import { Resolver } from "../../types/resolver";
import { Adapter } from "../../types/adapter";
import { useGetOne } from "./use-get-one";

type Args = { id: string };

export function getQueryOneResolver(model: ModelAny, adapter: Adapter) {
  const getOne = useGetOne(model, adapter);

  const resolver = async (
    ...resolverArgs: Parameters<Resolver<undefined, Args>>
  ) => {
    const [, args, context, info] = resolverArgs;
    const { id } = args;
    return getOne(id, context, info);
  };

  return resolver;
}
