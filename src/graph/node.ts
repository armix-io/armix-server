import { AutographError } from "../errors";
import { ModelAny } from "../model";
import { Adapter, Resolver, Sources, Context, Info } from "../types";
import { MaybePromise } from "../types/utils";
import { createQueryOne } from "./resolvers-utils/create-query-one";

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
  uuid?: boolean;
};

type Options = {
  models: ModelAny[];
  adapter: Adapter;
  getNodeInfoFn: (
    id: string,
    context: Context,
    info: Info
  ) => MaybePromise<NodeInfo>;
};

export { Options as NodeResolverOptions };

export const NodeResolver = (
  options: Options
): Resolver<undefined, { id: string }> => {
  const { models, adapter, getNodeInfoFn } = options;
  const nodeNameToModel = new Map(models.map((model) => [model.name, model]));
  return async (...resolverArgs) => {
    const [, { id }, ...meta] = resolverArgs;
    const nodeInfo = await getNodeInfoFn(id, ...meta);
    const model = nodeNameToModel.get(nodeInfo.name);
    if (!model) throw new AutographError("INVALID_NODE_MODEL");
    const node = await createQueryOne(model, adapter)(nodeInfo.id, ...meta);
    return { ...node, __type: model.name };
  };
};

export const NodeRootResolver = {
  __resolveType(source: { __type?: keyof Sources }) {
    return source.__type || null;
  },
};
