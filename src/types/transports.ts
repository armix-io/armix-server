import { Context } from "./context";
import { Config } from "./config";

// generic query format given to adapter
export interface QueryTransport {
  // context from resolvers
  context: Context;
  // target object type e.g. "User" as in "Type User { ... }"
  name: string;
  // if given, MUST target one item, otherwise many items
  id?: string | null;
  // if given, ID will be treated raw ID, rather than public UUID
  internal?: boolean;
  // if given, query is to continue from previous state
  cursor?: string;
  limit?: number;
  order?: {
    target: string;
    direction: "asc" | "desc";
  };
  filters?: {
    target: string;
    operator: string;
    value: any;
  }[];
}

// generic mutation format given to adapter
export interface MutationTransport<Source = {}> {
  // context from resolvers
  context: Context;
  // target object type/name, as above
  name: string;
  // if given, operation will be either UPDATE or DELETE, otherwise CREATE
  id?: string;
  // if data only: CREATE, if id + data: UPDATE, if id only: DELETE
  data?: Partial<Record<Exclude<keyof Source, number | symbol>, any>>;
}

// derive adapter transport from config if specified, to use for model hooks
export type AdapterTransport = "AdapterTransport" extends keyof Config
  ? Config["AdapterTransport"]
  : unknown;
