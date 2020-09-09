import {
  IIOC,
  IModel,
  IResolver,
  ISchemaMutationTransactor,
} from "./SchemaGraphQL.types";

export default (ioc: IIOC) => {
  return (model: IModel) => {
    const { name, fields: _fields, resolvers } = model;
    const fields = new Map(Object.entries(_fields));

    const {
      queryById,
      queryByArgs,
      queryOnCreate,
      queryOnUpdate,
      queryOnDelete,
      errors,
    } = ioc;

    const queryById_throwNotFound = async (
      ...args: Parameters<typeof queryById>
    ) => {
      const result = await queryById(...args);
      if (!result) {
        const [table, id] = args;
        throw errors.NotFound(table, { id });
      }
      return result;
    };

    const resolverRoot: Record<any, IResolver<{ [key: string]: any }>> = {};

    for (const [fieldName, field] of fields) {
      if (field.private) continue;
      if (field.getter === null) continue;

      resolverRoot[fieldName] = async (..._args) => {
        const [source, args] = _args;

        if (typeof field.getter === "function") {
          const result = await field.getter(..._args);
          if (!result && field.nullable === false)
            throw errors.NotFound(field.type, args);
          return result;
        }

        const key =
          typeof field.getter === "string"
            ? field.getter
            : field.column || fieldName;

        if (field.relationship) {
          const result = await queryById(field.type, source[key], _args);
          if (!result && field.nullable === false)
            throw errors.NotFound(field.type, args);
          return result;
        }

        const value = source[key] || null;
        return value;
      };
    }

    const resolverQuery: IResolver<undefined, { id: string }> = async (
      ..._args
    ) => {
      const [, args, context] = _args;
      const { id } = args || {};
      const [defaultQuery, selectArgs] = await queryById(name, id);
      const query = resolvers?.getter
        ? resolvers.getter(name, selectArgs, defaultQuery)(args, context)
        : defaultQuery;
      const result = await query;
      if (!result) {
        throw errors.NotFound(name, args);
      }
      return result;
    };

    const resolverQueryMany: IResolver<
      never,
      { cursor?: string; order?: string }
    > = async (...resolverArgs) => {
      const [, args] = resolverArgs;
      const { cursor, order: orderArg } = args;
      const [, orderKey, orderDirection] =
        (orderArg && orderArg.match(/^([\w\d]+)(?::(asc|desc))?$/)) || [];

      // resolve view to data layer field name resolutions for queries
      const order =
        (orderKey && {
          name: fields.get(orderKey)?.column || orderKey,
          by: orderDirection,
        }) ||
        undefined;

      return queryByArgs(
        name,
        { cursor, order },
        resolverArgs,
        resolvers?.getterMany
      );
    };

    const getItemDataTransactors = <T extends { id: any | null }>(
      data: T[]
    ) => {
      const resolvers = data.map(
        (item): ISchemaMutationTransactor<T> => async (trx?) => {
          const { id = null } = item;
          if (id) await queryById_throwNotFound(name, id);

          const itemData = {};
          for (const [_key, _value] of Object.entries(item)) {
            const field = fields.get(_key);

            // TODO: raise error
            if (!field) continue;

            // skip
            if (field.primary) continue;
            if (field.setter === null) continue;

            let key = _key;
            let value = _value;

            if (field.setter) {
              if (typeof field.setter === "function") {
                value = await field.setter(trx)(value, item);
              } else {
                key =
                  typeof field.setter === "string"
                    ? field.setter
                    : field.column || key;
              }
            }
            Object.assign(itemData, { [key]: value });
          }

          return [id, itemData as T];
        }
      );

      return resolvers;
    };

    const resolverMutationCreate: IResolver<
      never,
      { data: { id: any; [key: string]: any }[] }
    > = async (..._args) => {
      const [, args] = _args;
      const { data } = args || {};
      if (!data.length) return [];
      const transactor = getItemDataTransactors(data);
      return queryOnCreate(name, transactor, _args);
    };

    const resolverMutationUpdate: IResolver<
      never,
      { data: { id: any; [key: string]: any }[] }
    > = async (..._args) => {
      const [, args] = _args;
      const { data } = args || {};
      if (!data.length) return [];
      const transactor = getItemDataTransactors(data);
      return queryOnUpdate(name, transactor, _args);
    };

    const resolverMutationDelete: IResolver<never, { ids: string[] }> = async (
      ..._args
    ) => {
      const [, args] = _args;
      const { ids = [] } = args || {};
      if (!ids.length) return [];
      return queryOnDelete(name, ids, _args);
    };

    const graphResolversRoot = {
      [`${name}`]: resolverRoot,
    };

    const graphResolversQuery = {
      [`${name}`]: resolverQuery,
      [`${name}_many`]: resolverQueryMany,
    };

    const graphResolversMutation = {
      [`${name}_create`]: resolverMutationCreate,
      [`${name}_update`]: resolverMutationUpdate,
      [`${name}_delete`]: resolverMutationDelete,
    };

    return {
      Root: graphResolversRoot,
      Query: graphResolversQuery,
      Mutation: graphResolversMutation,
    };
  };
};