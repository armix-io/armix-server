import { ModelAny } from "../../model/model";
import { Resolver } from "../../types/resolver";
import { Adapter } from "../../types/adapter";
import { AutographError } from "../../errors";

export function getRootResolver(model: ModelAny, adapter: Adapter) {
  const acc: Record<string, Resolver> = {};
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

      // pass-through complete objects/arrays that don't need resolution
      if (result && typeof result === "object") return result;

      if (type.get._is === "object") {
        const id = result;
        const name = type.get.name;

        const {
          items: [item],
        } = await adapter.onQuery({
          name,
          id,
          context,
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
