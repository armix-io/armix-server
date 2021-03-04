import { Graph } from "../types/graph";
import { ModelAny } from "../model/model";
import { Adapter } from "../types/adapter";
import {
  getRootResolver,
  RootResolverOptions,
} from "./resolvers-utils/resolver-root";
import { getQueryManyResolver } from "./resolvers-utils/resolver-query-many";
import {
  getMutationCreateResolver,
  getMutationUpdateResolver,
  getMutationDeleteResolver,
} from "./resolvers-utils/resolver-mutation";

type Options = RootResolverOptions;

export { Options as BuildResolversOptions };

export function buildResolvers(
  model: ModelAny,
  adapter: Adapter,
  options: Options
): Graph["resolvers"] {
  const { getNodeIdFn } = options;

  const root = Object.assign(
    {},
    getRootResolver(model, adapter, { getNodeIdFn }),
    ...model.resolvers["root"]
  );
  const query = Object.assign(
    {},
    getQueryManyResolver(model, adapter),
    ...model.resolvers["query"]
  );
  const mutation = Object.assign(
    {},
    getMutationCreateResolver(model, adapter),
    getMutationUpdateResolver(model, adapter),
    getMutationDeleteResolver(model, adapter),
    ...model.resolvers["mutation"]
  );

  return {
    root,
    query,
    mutation,
  };
}
