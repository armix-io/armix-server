import { ModelAny } from "../../model/model";
import { Resolver } from "../../types/resolver";
import { Adapter } from "../../types/adapter";
import { MutationTransport } from "../../types/transports";
import { AutographError } from "../../errors";
import { createQueryOne } from "./create-query-one";

export type Operation = "create" | "update" | "delete";

type Args = { ids: string[]; data: Record<string, any>[] };

export function getMutationResolver(
  model: ModelAny,
  adapter: Adapter,
  operation: Operation
) {
  const getOne = createQueryOne(model, adapter);

  return async (...resolverArgs: Parameters<Resolver<undefined, Args>>) => {
    const { name, fields, hooks } = model;
    const [, args, context, info] = resolverArgs;

    const getItem = (id: string) => getOne(id, context, info);

    const mutation: MutationTransport = {
      name,
      context,
    };

    if (operation === "delete") {
      const { ids } = args;
      await Promise.all(
        ids.map(async (id) => {
          const source = await getItem(id);

          // hook
          const onDelete = hooks.onDelete;
          const onMutation = hooks.onMutation;
          onDelete && (await onDelete(source, context, info));
          onMutation && (await onMutation(source, context, info));

          // field hooks
          await Promise.all(
            Object.values(fields).map(async ({ hooks }) => {
              const onDelete = hooks.onDelete;
              const onMutation = hooks.onMutation;
              onDelete && (await onDelete(source, context, info));
              onMutation && (await onMutation(source, context, info));
            })
          );

          await adapter.onMutation({ ...mutation, id });

          // hook
          const onDeleteAfterData = hooks.onDeleteAfterData;
          const onMutationAfterData = hooks.onMutationAfterData;
          onDeleteAfterData && (await onDeleteAfterData(source, context, info));
          onMutationAfterData &&
            (await onMutationAfterData(source, context, info));

          const fieldErrors = {};

          // field hooks
          await Promise.all(
            Object.values(fields).map(async ({ name, hooks }) => {
              try {
                const onDeleteAfterData = hooks.onDeleteAfterData;
                const onMutationAfterData = hooks.onMutationAfterData;
                onDeleteAfterData &&
                  (await onDeleteAfterData(source, context, info));
                onMutationAfterData &&
                  (await onMutationAfterData(source, context, info));
              } catch (e) {
                Object.assign(fieldErrors, { [name]: e });
              }
            })
          );

          if (Object.keys(fieldErrors).length)
            throw new AutographError("FIELD_ERRORS", fieldErrors);
        })
      );

      return ids;
    }

    const { data: itemPartials } = args;
    // resolve all setters for each item to resolve insert data
    const dataResolvers = await Promise.all(
      itemPartials.map(async (itemPartial) => {
        /**
         * id to source
         */
        const id =
          operation === "update" ? (itemPartial.id as string) : undefined;
        const source = id ? await getItem(id) : undefined;

        const fieldErrors = {};

        /**
         * preData
         * go through all fields of itemPartial and resolve those fields
         */
        const data: Record<string, any> = {};
        await Promise.all(
          Object.entries(itemPartial).map(async ([name, value]) => {
            try {
              const field = fields[name];

              // Use WRITE
              const hookArgs = [source, context, info] as const;
              const onModelSet = model.hooks.onSet;
              const onModelUse = model.hooks.onUse;
              const onSet = field.hooks.onSet;
              const onUse = field.hooks.onUse;
              onModelSet && (await onModelSet(...hookArgs));
              onModelUse && (await onModelUse(...hookArgs));
              onSet && (await onSet(...hookArgs));
              onUse && (await onUse(...hookArgs));

              // validate
              const onValidate = field.validate;
              if (onValidate) {
                const validation = await onValidate(value, ...hookArgs);
                if (validation === false) throw "INVALID";
                else if (typeof validation === "string") throw validation;
              }

              const { setCreate, setUpdate } = field;

              // result could be partial of source, or actual next value
              const result =
                operation === "create" && setCreate
                  ? await setCreate.resolver(value, undefined, context, info)
                  : operation === "update" && setUpdate
                  ? await setUpdate.resolver(value, source!, context, info)
                  : undefined;

              Object.assign(
                data,
                result && typeof result === "object"
                  ? result
                  : { [field.key]: result }
              );
            } catch (e) {
              Object.assign(fieldErrors, { [name]: e });
            }
          })
        );

        if (Object.keys(fieldErrors).length)
          throw new AutographError("FIELD_ERRORS", fieldErrors);

        // model hooks
        const onCreate = hooks.onCreate;
        const onUpdate = hooks.onUpdate;
        const onMutation = hooks.onMutation;
        Object.assign(
          data,
          operation === "create" && onCreate && (await onCreate(context, info)),
          operation === "update" &&
            onUpdate &&
            (await onUpdate(source!, context, info)),
          onMutation && (await onMutation(source, context, info))
        );

        // field hooks
        await Promise.all(
          Object.values(fields).map(async ({ name, hooks }) => {
            try {
              const onCreate = hooks.onCreate;
              const onUpdate = hooks.onUpdate;
              const onMutation = hooks.onMutation;
              Object.assign(
                data,
                operation === "create" &&
                  onCreate &&
                  (await onCreate(context, info)),
                operation === "update" &&
                  onUpdate &&
                  (await onUpdate(source!, context, info)),
                onMutation && (await onMutation(source, context, info))
              );
            } catch (e) {
              Object.assign(fieldErrors, { [name]: e });
            }
          })
        );

        if (Object.keys(fieldErrors).length)
          throw new AutographError("FIELD_ERRORS", fieldErrors);

        /**
         * postData
         */
        const callback = async (source: Record<string, any>) => {
          const fieldErrors = {};

          await Promise.all(
            Object.entries(itemPartial).map(async ([name, value]) => {
              try {
                const field = fields[name];
                const { setCreateAfterData, setUpdateAfterData } = field;
                operation === "create" &&
                  setCreateAfterData &&
                  (await setCreateAfterData.resolver(
                    value,
                    source,
                    context,
                    info
                  ));
                operation === "update" &&
                  setUpdateAfterData &&
                  (await setUpdateAfterData.resolver(
                    value,
                    source,
                    context,
                    info
                  ));
              } catch (e) {
                Object.assign(fieldErrors, { [name]: e });
              }
            })
          );

          if (Object.keys(fieldErrors).length)
            throw new AutographError("FIELD_ERRORS", fieldErrors);

          // model hooks
          const onCreate = hooks.onCreateAfterData;
          const onUpdate = hooks.onUpdateAfterData;
          const onMutation = hooks.onMutationAfterData;
          operation === "create" &&
            onCreate &&
            (await onCreate(source, context, info));
          operation === "update" &&
            onUpdate &&
            (await onUpdate(source!, context, info));
          onMutation && (await onMutation(source, context, info));

          // field hooks
          await Promise.all(
            Object.values(fields).map(async ({ name, hooks }) => {
              try {
                const onCreate = hooks.onCreateAfterData;
                const onUpdate = hooks.onUpdateAfterData;
                const onMutation = hooks.onMutationAfterData;
                operation === "create" &&
                  onCreate &&
                  (await onCreate(source, context, info));
                operation === "update" &&
                  onUpdate &&
                  (await onUpdate(source, context, info));
                onMutation && (await onMutation(source, context, info));
              } catch (e) {
                Object.assign(fieldErrors, { [name]: e });
              }
            })
          );

          if (Object.keys(fieldErrors).length)
            throw new AutographError("FIELD_ERRORS", fieldErrors);
        };

        return {
          id,
          data,
          callback,
        };
      })
    );

    return await Promise.all(
      dataResolvers.map(async (dataResolver) => {
        const { id, data, callback } = dataResolver;

        const source = await adapter.onMutation({
          ...mutation,
          id,
          data,
        });

        if (!source)
          throw new AutographError(
            "MUTATION_ERROR",
            `(${operation}) expected result, got undefined`
          );

        await callback(source);

        return source;
      })
    );
  };
}

export const getMutationCreateResolver = (
  model: ModelAny,
  adapter: Adapter
) => {
  const { mutationCreate } = model;
  if (!mutationCreate) return {};
  return {
    [mutationCreate]: getMutationResolver(model, adapter, "create"),
  };
};

export const getMutationUpdateResolver = (
  model: ModelAny,
  adapter: Adapter
) => {
  const { mutationUpdate } = model;
  if (!mutationUpdate) return {};
  return {
    [mutationUpdate]: getMutationResolver(model, adapter, "update"),
  };
};

export const getMutationDeleteResolver = (
  model: ModelAny,
  adapter: Adapter
) => {
  const { mutationDelete } = model;
  if (!mutationDelete) return {};
  return {
    [mutationDelete]: getMutationResolver(model, adapter, "delete"),
  };
};
