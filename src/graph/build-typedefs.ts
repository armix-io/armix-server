import { ModelAny } from "../model/model";
import { Graph } from "../types/graph";
import {
  getRootType,
  getRootListType,
  getRootCreateInput,
  getRootUpdateInput,
  getRootFiltersInput,
  getRootOrderEnum,
  getQueryManyResolver,
  getMutationCreateResolver,
  getMutationUpdateResolver,
  getMutationDeleteResolver,
  getOtherTypeDefs,
} from "./typedefs-utils/typedefs";
import { getDocs } from "./typedefs-utils/docs";

const identity = <T>(a: T) => a;

export function buildTypeDefs(model: ModelAny): Graph["typeDefs"] {
  const docs = getDocs(model);

  const root = [
    getRootType(model),
    getRootListType(model),
    getRootCreateInput(model),
    getRootUpdateInput(model),
    getRootFiltersInput(model),
    getRootOrderEnum(model),
    getOtherTypeDefs(model, "root"),
  ]
    .filter(identity)
    .map((a) => a!.trim())
    .join("\n");

  const query = [
    docs.queryMany,
    getQueryManyResolver(model),
    getOtherTypeDefs(model, "query"),
  ]
    .filter(identity)
    .map((a) => a!.trim())
    .join("\n");

  const mutation = [
    docs.mutationCreate,
    getMutationCreateResolver(model),
    docs.mutationUpdate,
    getMutationUpdateResolver(model),
    docs.mutationDelete,
    getMutationDeleteResolver(model),
    getOtherTypeDefs(model, "mutation"),
  ]
    .filter(identity)
    .map((a) => a!.trim())
    .join("\n");

  return {
    root,
    query,
    mutation,
  };
}
