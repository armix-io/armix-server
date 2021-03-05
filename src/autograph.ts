import omit from "lodash.omit";
import { Node, Sources, Resolver, Adapter } from "./types";
import {
  NodeType,
  NodeRootQuery,
  NodeResolver,
  NodeResolverOptions,
  NodeRootResolver,
} from "./graph";
import { ModelAny } from "./model";
import { buildTypeDefs } from "./graph/build-typedefs";
import { buildResolvers, BuildResolversOptions } from "./graph/build-resolvers";
import {
  mergeTypeDefs,
  mergeResolvers,
  wrapResolvers,
} from "./graph/graph-utils";

type Options = {
  models: ModelAny[];
  adapter: Adapter;
  typeDefs?: Partial<Record<Node, string>>;
  resolvers?: Partial<Record<Node, Record<string, any>>>;
  wrapper?: (resolver: Resolver) => Resolver;
  wrapperExcludes?: Partial<Record<Exclude<Node, "root">, string[]>>;
  newIdsFn: BuildResolversOptions["newIdsFn"];
  getNodeIdFn: BuildResolversOptions["getNodeIdFn"];
  getNodeInfoFn: NodeResolverOptions["getNodeInfoFn"];
};

export { Options as AutographOptions };

export class Autograph {
  typeDefs: string;
  resolvers: Record<"Node" | "Query" | "Mutation", Record<string, Resolver>>;

  constructor(options: Options) {
    const {
      models,
      adapter,
      typeDefs,
      resolvers,
      wrapper,
      wrapperExcludes,
      newIdsFn,
      getNodeIdFn,
      getNodeInfoFn,
    } = options;

    const node = NodeResolver({
      models,
      adapter,
      getNodeInfoFn,
    });

    const modelsTypeDefs = models.map((model) => buildTypeDefs(model));
    const modelsResolvers = models.map((model) =>
      buildResolvers(model, adapter, { newIdsFn, getNodeIdFn })
    );

    this.typeDefs = `
      ${NodeType}
      ${typeDefs?.root || ""}
      ${mergeTypeDefs(modelsTypeDefs)}
      type Query {
        ${NodeRootQuery}
        ${typeDefs?.query || ""}
        ${mergeTypeDefs(modelsTypeDefs, "query")}
      }
      type Mutation {
        ${typeDefs?.mutation || ""}
        ${mergeTypeDefs(modelsTypeDefs, "mutation")}
      }
    `;

    const rootResolvers = {
      ...(resolvers?.root || {}),
      ...mergeResolvers(modelsResolvers),
    };
    const queryResolvers = {
      ...({ node } as Record<string, Resolver>),
      ...(resolvers?.query || {}),
      ...mergeResolvers(modelsResolvers, "query"),
    };
    const mutationResolvers = {
      ...(resolvers?.mutation || {}),
      ...mergeResolvers(modelsResolvers, "mutation"),
    };

    this.resolvers = {
      ...rootResolvers,
      Node: NodeRootResolver,
      Query: {
        ...queryResolvers,
        ...(wrapper
          ? wrapResolvers(
              omit(queryResolvers, wrapperExcludes?.query || []),
              wrapper
            )
          : {}),
      },
      Mutation: {
        ...mutationResolvers,
        ...(wrapper
          ? wrapResolvers(
              omit(mutationResolvers, wrapperExcludes?.mutation || []),
              wrapper
            )
          : {}),
      },
    };
  }
}
