import { Adapter } from "../../types/adapter";
import { QueryTransport as KnexQueryTransport } from "./transports";
import { CursorStore } from "../../types/cursor";
import { UseQuery } from "./use-query";
import { AutographError } from "../../errors";

type Options = {
  useQuery: UseQuery;
  cursorStore: CursorStore;
};

export const onQuery = ({
  useQuery,
  cursorStore,
}: Options): Adapter<KnexQueryTransport>["onQuery"] => async (
  query,
  queryModifier
) => {
  if ("id" in query) {
    const { items, total } = await useQuery(query, { queryModifier });
    return { items, total };
  }

  if ("cursor" in query) {
    const { name, cursor: cursorArg } = query;
    const cursorId = `${name}:${cursorArg}`;
    const cursor = await cursorStore.get(cursorId);
    if (!cursor) {
      throw new AutographError("QUERY_CURSOR_INVALID");
    }

    // overwrite cursor query context (to prevent stale trx)
    cursor.query.context = query.context;

    const { items, position } = await useQuery(cursor.query, {
      position: cursor.position,
      queryModifier,
    });
    if (position) {
      await cursorStore.set(cursorId, {
        query: cursor.query,
        total: cursor.total,
        position,
      });
      return { items, total: cursor.total, cursor: cursorArg };
    }
    await cursorStore.remove(cursorId);
    return { items, total: cursor.total };
  }

  const { items, total, position } = await useQuery(query, { queryModifier });
  if (position) {
    const { name } = query;
    const cursorArg = await cursorStore.newId();
    const cursorId = `${name}:${cursorArg}`;
    await cursorStore.set(cursorId, { query, total, position });
    return { items, total, cursor: cursorArg };
  }

  return { items, total };
};
