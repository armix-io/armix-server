import { Context } from "./context";
import { Config } from "./config";
import { Info } from "./info";

// generic query format given to adapter
export interface QueryTransport {
  // context and info from resolvers
  context: Context;
  info: Info;
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
  // context and info from resolvers
  context: Context;
  info: Info;
  // target object type/name, as above
  name: string;
  // if given, operation will be either UPDATE or DELETE, otherwise CREATE
  id?: string;
  // if given, ID will be treated raw ID, rather than public UUID
  newId?: string;
  // if data only: CREATE, if id + data: UPDATE, if id only: DELETE
  data?: Partial<Record<string, any>>;
}

// derive adapter transport from config if specified, to use for model hooks
export type AdapterTransport = "AdapterTransport" extends keyof Config
  ? Config["AdapterTransport"]
  : unknown;
