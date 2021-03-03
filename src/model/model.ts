import {
  Type,
  Scalar,
  Types,
  asScalar,
  AsScalar,
  Node,
  Sources,
  Resolver,
  ModelHooks,
} from "../types";
import { Field, GetResolver } from "./field";
import { Options, OptionsCallback } from "./field-options";
import { Filter, FilterResolver } from "./filter";
import { useMappers } from "./use-mappers";
import { useDefaultFilters } from "./use-default-filters";

type ResolveGet<T extends Type | { get: Type; set: Scalar }> = T extends {
  get: Type;
}
  ? T["get"]
  : T extends Type
  ? T
  : unknown;

type ResolveSet<T extends Type | { get: Type; set: Scalar }> = T extends {
  set: Scalar;
}
  ? T["set"]
  : T extends Type
  ? AsScalar<T>
  : unknown;

export class Model<
  Name extends string,
  Source extends Name extends keyof Sources ? Sources[Name] : any
> {
  readonly name: Name;

  readonly fields: Record<string, Field<Source>>;
  readonly filters: Record<string, Filter>;
  readonly hooks: Partial<ModelHooks<Source>>;
  readonly typeDefs: Record<Node, string[]>;
  readonly resolvers: Record<Node, Resolver[]>;

  readonly queryOne: string | undefined;
  readonly queryMany: string | undefined;
  readonly mutationCreate: string | undefined;
  readonly mutationUpdate: string | undefined;
  readonly mutationDelete: string | undefined;
  readonly limitDefault: number;
  readonly limitMax: number;
  readonly defaultDocs: boolean;

  constructor(
    name: Name,
    options?: {
      queryOne?: string | boolean;
      queryMany?: string | boolean;
      mutationCreate?: string | boolean;
      mutationUpdate?: string | boolean;
      mutationDelete?: string | boolean;
      onQuery?: ModelHooks<Source>["onQuery"];
      onQueryOne?: ModelHooks<Source>["onQueryOne"];
      onQueryMany?: ModelHooks<Source>["onQueryMany"];
      onCreate?: ModelHooks<Source>["onCreate"];
      onCreateAfterData?: ModelHooks<Source>["onCreateAfterData"];
      onUpdate?: ModelHooks<Source>["onUpdate"];
      onUpdateAfterData?: ModelHooks<Source>["onUpdateAfterData"];
      onDelete?: ModelHooks<Source>["onDelete"];
      onDeleteAfterData?: ModelHooks<Source>["onDeleteAfterData"];
      onMutation?: ModelHooks<Source>["onMutation"];
      onMutationAfterData?: ModelHooks<Source>["onMutationAfterData"];
      onFieldGet?: ModelHooks<Source>["onGet"];
      onFieldSet?: ModelHooks<Source>["onSet"];
      onFieldUse?: ModelHooks<Source>["onUse"];
      defaultId?: boolean;
    } & Partial<
      Pick<Model<any, any>, "limitDefault" | "limitMax" | "defaultDocs">
    >
  ) {
    this.name = name;

    this.fields = {};
    this.filters = {};
    this.typeDefs = { root: [], query: [], mutation: [] };
    this.resolvers = { root: [], query: [], mutation: [] };

    const {
      queryOne = true,
      queryMany = true,
      mutationCreate = true,
      mutationUpdate = true,
      mutationDelete = true,
      limitDefault = 20,
      limitMax = 50,
      defaultDocs = true,
      defaultId = true,
      onQuery,
      onQueryOne,
      onQueryMany,
      onCreate,
      onCreateAfterData,
      onUpdate,
      onUpdateAfterData,
      onDelete,
      onDeleteAfterData,
      onMutation,
      onMutationAfterData,
      onFieldGet: onGet,
      onFieldSet: onSet,
      onFieldUse: onUse,
    } = options || {};

    this.hooks = {
      onQuery,
      onQueryOne,
      onQueryMany,
      onCreate,
      onCreateAfterData,
      onUpdate,
      onUpdateAfterData,
      onDelete,
      onDeleteAfterData,
      onMutation,
      onMutationAfterData,
      onGet,
      onSet,
      onUse,
    };

    this.queryOne = queryOne === true ? `${name}` : queryOne || undefined;
    this.queryMany =
      queryMany === true ? `${name}Many` : queryMany || undefined;
    this.mutationCreate =
      mutationCreate === true ? `${name}Create` : mutationCreate || undefined;
    this.mutationUpdate =
      mutationUpdate === true ? `${name}Update` : mutationUpdate || undefined;
    this.mutationDelete =
      mutationDelete === true ? `${name}Delete` : mutationDelete || undefined;
    this.limitDefault = limitDefault;
    this.limitMax = limitMax;
    this.defaultDocs = defaultDocs;

    if (defaultId) {
      this.field("id", Types.ID);
    }
  }

  field<T extends Type | { get: Type; set: Scalar }>(
    name: string,
    type: T,
    options?:
      | Options<Source, ResolveSet<T>>
      | OptionsCallback<Source, ResolveGet<T>, ResolveSet<T>>
  ) {
    const mappers = useMappers<Source, ResolveGet<T>, ResolveSet<T>>();

    const {
      alias,
      get,
      set,
      setCreate,
      setUpdate,
      setAfterData,
      setCreateAfterData,
      setUpdateAfterData,
      orderTarget,
      filterTarget,
      defaultFilters = true,
      validate,
      onGet,
      onSet,
      onUse,
      onModelCreate: onCreate,
      onModelCreateAfterData: onCreateAfterData,
      onModelUpdate: onUpdate,
      onModelUpdateAfterData: onUpdateAfterData,
      onModelDelete: onDelete,
      onModelDeleteAfterData: onDeleteAfterData,
      onModelMutation: onMutation,
      onModelMutationAfterData: onMutationAfterData,
    } = options
      ? typeof options === "function"
        ? options(mappers)
        : options
      : ({} as NonNullable<typeof options>);

    const key = alias || (name as Exclude<keyof Source, number | symbol>);

    const defaultGet = {
      args: {},
      resolver: (source: any) => source[key],
    };

    const defaultSet = {
      resolver: (value: any) => value,
    };

    /**
     * defaults of setCreate and setUpdate, known as setACTION
     * (1) if setACTION === null (forced off), use undefined
     * (2) if setACTION is specified in options, use setACTION
     * (3) if setACTION is not specified, check "set" definition
     * (4) if set === null (forced off), use undefined
     * (5) if setAfterData or setACTIONAfterData is specified, use undefined
     * (6) otherwise try set, or fallback to defaultSet handler
     *
     * In essence, if set isn't nulled, use default for ACTION. If specified,
     * the setACTION given will be used instead. If setACTIONAfterData is
     * specified then setACTION will not be used, unless setACTION is specified.
     */
    this.fields[name] = {
      key,
      name,
      type: {
        get: "get" in type ? (type as { get: Type }).get : (type as Type),
        set:
          "set" in type
            ? (type as { set: Scalar }).set
            : asScalar(type as Type),
      },
      get: get === null ? undefined : get || defaultGet,
      setCreate:
        setCreate === null
          ? undefined
          : setCreate ||
            (set === null
              ? undefined
              : !(setAfterData || setCreateAfterData)
              ? set || defaultSet
              : undefined),
      setUpdate:
        setUpdate === null
          ? undefined
          : setUpdate ||
            (set === null
              ? undefined
              : !(setAfterData || setUpdateAfterData)
              ? set || defaultSet
              : undefined),
      setCreateAfterData: setCreateAfterData || setAfterData,
      setUpdateAfterData: setUpdateAfterData || setAfterData,
      validate: Array.isArray(validate)
        ? async (...args) => {
            for (const func of validate) {
              const result = await func(...args);
              if (result) return result;
            }
          }
        : validate,
      hooks: {
        onGet,
        onSet,
        onUse,
        onCreate,
        onCreateAfterData,
        onUpdate,
        onUpdateAfterData,
        onDelete,
        onDeleteAfterData,
        onMutation,
        onMutationAfterData,
      },
      orderTarget: orderTarget ?? get === undefined ? key : undefined,
      filterTarget: filterTarget ?? get === undefined ? key : undefined,
    };

    if (defaultFilters) {
      useDefaultFilters(this.fields[name]!, this.filters);
    }

    return this;
  }

  /**
   *
   * @param name name of filter
   * @param type graph type to receive value
   * @param resolver
   */
  filter<T extends Scalar>(
    name: string,
    type: T,
    resolver: FilterResolver<T, "adapter">
  ) {
    this.filters[name] = {
      name,
      type,
      transport: "adapter",
      resolver,
    };

    return this;
  }

  hook<E extends keyof ModelHooks<Source>, H extends ModelHooks<Source>[E]>(
    event: E,
    handler: H
  ) {
    this.hooks[event] = handler;

    return this;
  }

  typeDef(node: Node, value: string) {
    this.typeDefs[node].push(value);

    return this;
  }

  resolver(node: Node, resolver: GetResolver<any>) {
    this.resolvers[node].push(resolver);

    return this;
  }
}

// @ts-ignore
export type ModelAny = Model<keyof Sources, any>;
