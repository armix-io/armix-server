import Knex from "knex";
import cloneDeep from "lodash.clonedeep";
import { QueryTransport as GraphQueryTransport } from "../../types/transports";
import { QueryModifier } from "../../types/adapter";
import { QueryTransport, op } from "./transports";
import { KnexQueryExecutor } from "./knex-query-executor";
import { AutographError } from "../../errors";

export type Options = {
  tableNames?: Map<string, string>;
  uuidField?: string;
};

const FILTER_OPERATOR_MAP = new Map([
  ["eq", "="],
  ["ne", "!="],
  ["gt", ">"],
  ["gte", ">="],
  ["lt", "<"],
  ["lte", "<="],
]);

export interface UseQuery {
  (
    query: GraphQueryTransport,
    options?: {
      // position is stored id for cursor to start FROM
      position?: number;
      // provided from model onQuery/One/Many hook, if given
      queryModifier?: QueryModifier<QueryTransport>;
    }
  ): Promise<{
    items: Record<string, any>[];
    total: number;
    position?: number;
  }>;
}

export const createUseQuery = (knex: Knex, options: Options) => {
  const {
    tableNames = new Map<string, string>(),
    uuidField = "uuid",
  } = options;

  const knexQueryExecutor = new KnexQueryExecutor(knex);

  const useQuery: UseQuery = async (
    graphQuery,
    options = {}
  ): ReturnType<UseQuery> => {
    const { position, queryModifier } = options;

    /**
     * queryModifier wrapper to mutate graphQuery
     */
    const useQueryResolver = (query: QueryTransport) =>
      queryModifier && queryModifier(query);

    /**
     * [endpoint]
     * graphQuery with cursor --- not supported
     */
    if (graphQuery.cursor)
      throw new AutographError("USE_QUERY_CURSOR_UNSUPPORTED");

    /**
     * [knex]
     * from <- name
     * trx <- graph.context.trx
     */
    const { name: queryName } = graphQuery;
    const table = tableNames.get(queryName) || queryName;

    // @ts-ignore
    const trx: Knex.Transaction = graphQuery.context?.trx;

    const ops: QueryTransport["ops"] = [];
    const queryMessage: QueryTransport = { table, ops };

    ops.push(op((query) => query.from(table), "from"));
    if (trx) ops.push(op((query) => query.transacting(trx), "trx"));

    /**
     * [endpoint]
     * graphQuery with id
     */
    if (graphQuery.id) {
      const { id, internal = false } = graphQuery;

      ops.push(op((query) => query.select(`${table}.*`), "select"));
      const idField = internal ? "id" : uuidField;
      ops.push(
        op((query) => query.where(`${table}.${idField}`, "=", id), "where")
      );

      useQueryResolver(queryMessage);
      const items = await knexQueryExecutor.execute(queryMessage);
      return { items, total: items.length };
    }

    /**
     * catch when id comes from a resolved value which is null
     * whereas if id is undefined, we continue as a "many" query
     */
    if (graphQuery.id === null) {
      return { items: [], total: 0 };
    }

    /**
     * [knex]
     * wheres <- filters
     * apply filters first, will affect count and normal fetches
     */
    const { filters: queryFilters = [] } = graphQuery;
    queryFilters.forEach((filter) => {
      const { target: filterTarget, operator: _operator, value } = filter;
      // if internal filter is targetting "id", rewrite to target uuid instead
      const target = filterTarget === "id" ? uuidField : filterTarget;
      const operator = FILTER_OPERATOR_MAP.get(_operator) || _operator;
      ops.push(
        op(
          (query) => query.where(`${table}.${target}`, operator, value),
          `where-${target}-${_operator}`
        )
      );
    });

    /**
     * [result]
     * total
     * if index is provided, a cursor is being used, thus total already fetched
     */
    const total = await (async function () {
      if (position !== undefined) return -1;

      const countMessage = cloneDeep(queryMessage);
      countMessage.ops.filter(({ tag }) => tag !== "trx");
      countMessage.ops.push(
        op(
          (query, knex) =>
            query
              .clear("select")
              .clear("limit")
              .clear("order")
              .select(knex.raw("count(*)")),
          "count"
        )
      );
      useQueryResolver(countMessage);
      const [row] = await knexQueryExecutor.execute<{ count: string }>(
        countMessage
      );
      return parseInt(row.count);
    })();

    /**
     * [knex]
     * if position given, create a complex where statement using
     *   id => position[0] --- if query order not given (default sort by id)
     *   order,id => position[0],position[1] --- if query order given
     * order must be before id to prioritise it
     */
    const { order: queryOrder } = graphQuery;
    if (position) {
      const direction = queryOrder?.direction || "asc";
      const $operator = direction === "asc" ? ">=" : "<=";
      ops.push(
        op((query) => query.where(`${table}.id`, $operator, position), "where")
      );
    }

    /**
     * selects
     */
    ops.push(op((query) => query.select(`${table}.*`), "select"));

    /**
     * order
     */
    const orders = [
      { column: `${table}.id`, order: queryOrder?.direction || "asc" },
    ];
    if (queryOrder)
      orders.unshift({
        column: `${table}.${queryOrder.target}`,
        order: queryOrder.direction,
      });
    ops.push(op((query) => query.orderBy(orders), "order"));

    /**
     * limit
     */
    const { limit: queryLimit } = graphQuery;
    if (queryLimit === undefined)
      throw new AutographError("USE_QUERY_LIMIT_REQUIRED");
    const limit = queryLimit + 1;
    ops.push(op((query) => query.limit(limit), "limit"));

    /**
     * [result]
     * items
     */
    useQueryResolver(queryMessage);
    const items = await knexQueryExecutor.execute(queryMessage);

    /**
     * [result]
     * index
     */
    const nextItem = items.length === limit ? items.pop() : undefined;
    const nextPosition = nextItem && (nextItem["id"] as number);

    return { items, total, position: nextPosition };
  };

  return useQuery;
};
