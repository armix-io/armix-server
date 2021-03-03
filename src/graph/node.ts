import { AutographError } from "../errors";
import { ModelAny } from "../model";
import { Adapter, Resolver, Sources } from "../types";
import { MaybePromise } from "../types/utils";
import { getQueryOneResolver } from "./resolvers-utils/resolver-query-one";

export const NodeType = `
  interface Node {
    # The ID of the object.
    id: ID!
  }
`;

export const NodeRootQuery = `
  node(id: ID!): Node
`;

type NodeInfo = {
  name: keyof Sources;
  id: string;
};

type Options = {
  models: ModelAny[];
  adapter: Adapter;
  getNodeInfoFn: (id: string) => MaybePromise<NodeInfo>;
};

export { Options as NodeResolverOptions };

export const NodeResolver = (
  options: Options
): Resolver<undefined, { id: string }> => {
  const { models, adapter, getNodeInfoFn } = options;
  const nodeNameToModel = new Map(models.map((model) => [model.name, model]));
  return async (...resolverArgs) => {
    const [, { id }, ...meta] = resolverArgs;
    const nodeInfo = await getNodeInfoFn(id);
    const model = nodeNameToModel.get(nodeInfo.name);
    if (!model) throw new AutographError("INVALID_NODE_MODEL");
    const queryArgs = [undefined, { id: nodeInfo.id }, ...meta] as const;
    return getQueryOneResolver(model, adapter)(...queryArgs);
  };
};
