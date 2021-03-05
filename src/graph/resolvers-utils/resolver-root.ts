import { ModelAny } from "../../model/model";
import { Resolver, Adapter, Sources, Context, Info } from "../../types";
import { AutographError } from "../../errors";

type Options = {
  getNodeIdFn: <
    T extends string,
    S extends T extends keyof Sources ? Sources[T] : any
  >(
    type: T,
    source: S,
    context: Context,
    info: Info
  ) => string | null;
};

export { Options as RootResolverOptions };

export function getRootResolver(
  model: ModelAny,
  adapter: Adapter,
  options: Options
) {
  const { getNodeIdFn } = options;

  const acc: Record<string, Resolver> = {};

  // add custom id resolver
  acc["id"] = async (...resolverArgs) => {
    const [source, , ...meta] = resolverArgs;
    const id = getNodeIdFn(model.name, source, ...meta);
    if (!id) throw new AutographError("UNRESOLVED_NODE_ID");
    return id;
  };

  Object.values(model.fields).forEach((field) => {
    const { get } = field;
    if (!get) return;

    const { name, type } = field;
    acc[name] = async (...resolverArgs) => {
      const [source, , context, info] = resolverArgs;

      // Use READ
      const onModelGet = model.hooks.onGet;
      const onModelUse = model.hooks.onUse;
      const onGet = field.hooks.onGet;
      const onUse = field.hooks.onUse;
      const hookArgs = [source, context, info] as const;
      onModelGet && (await onModelGet(...hookArgs));
      onModelUse && (await onModelUse(...hookArgs));
      onGet && (await onGet(...hookArgs));
      onUse && (await onUse(...hookArgs));

      const result = await get.resolver(...resolverArgs);

      // TODO: handle array of IDs for onQuery resolution
      // pass-through complete objects/arrays that don't need resolution
      if (result && typeof result === "object") return result;

      if (type.get._is === "object") {
        const id = result;
        const name = type.get.name;

        const {
          items: [item],
        } = await adapter.onQuery({
          context,
          info,
          name,
          id,
          // TODO: add ids field to suit array of IDs use case if type "object"
          internal: true,
        });

        if (!item && type.get.isNonNull) {
          throw new AutographError("NOT_FOUND");
        }

        return item;
      }
      return result;
    };
  });
  return {
    [model.name]: acc,
  };
}
