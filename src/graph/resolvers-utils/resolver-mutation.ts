import { ModelAny } from "../../model/model";
import { Resolver } from "../../types/resolver";
import { Adapter } from "../../types/adapter";
import { MutationTransport } from "../../types/transports";
import { AutographError } from "../../errors";
import { useGetOne } from "./use-get-one";

export type Operation = "create" | "update" | "delete";

type Args = { ids: string[]; data: Record<string, any>[] };

export function getMutationResolver(
  model: ModelAny,
  adapter: Adapter,
  operation: Operation
) {
  const getOne = useGetOne(model, adapter);

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
          const onDelete = hooks["on-delete"];
          onDelete && (await onDelete(source, context, info));
          const onMutation = hooks["on-mutation"];
          onMutation && (await onMutation(source, context, info));

          // field hooks
          await Promise.all(
            Object.values(fields).map(async ({ hooks }) => {
              const onDelete = hooks["on-delete"];
              onDelete && (await onDelete(source, context, info));
              const onMutation = hooks["on-mutation"];
              onMutation && (await onMutation(source, context, info));
            })
          );

          await adapter.onMutation({ ...mutation, id });

          // hook
          const onDeleteAfterData = hooks["on-delete-after-data"];
          onDeleteAfterData && (await onDeleteAfterData(source, context, info));
          const onMutationAfterData = hooks["on-mutation-after-data"];
          onMutationAfterData &&
            (await onMutationAfterData(source, context, info));

          const fieldErrors = {};

          // field hooks
          await Promise.all(
            Object.values(fields).map(async ({ name, hooks }) => {
              try {
                const onDeleteAfterData = hooks["on-delete-after-data"];
                onDeleteAfterData &&
                  (await onDeleteAfterData(source, context, info));
                const onMutationAfterData = hooks["on-mutation-after-data"];
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

              // access WRITE
              const onAccessField = field.hooks["on-access"];
              const hookArgs = [source, context, info] as const;
              onAccessField && onAccessField(...hookArgs);

              const { setCreate, setUpdate } = field;
              Object.assign(
                data,
                operation === "create" && setCreate
                  ? await setCreate.resolver(value, undefined, context, info)
                  : undefined,
                operation === "update" && setUpdate
                  ? await setUpdate.resolver(value, source!, context, info)
                  : undefined
              );
            } catch (e) {
              Object.assign(fieldErrors, { [name]: e });
            }
          })
        );

        if (Object.keys(fieldErrors).length)
          throw new AutographError("FIELD_ERRORS", fieldErrors);

        // model hooks
        const onCreate = hooks["on-create"];
        const onUpdate = hooks["on-update"];
        const onMutation = hooks["on-mutation"];
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
              const onCreate = hooks["on-create"];
              const onUpdate = hooks["on-update"];
              const onMutation = hooks["on-mutation"];
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
          const onCreate = hooks["on-create-after-data"];
          const onUpdate = hooks["on-update-after-data"];
          const onMutation = hooks["on-mutation-after-data"];
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
                const onCreate = hooks["on-create-after-data"];
                const onUpdate = hooks["on-update-after-data"];
                const onMutation = hooks["on-mutation-after-data"];
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