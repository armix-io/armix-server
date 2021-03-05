import Knex from "knex";
import { Adapter } from "../../types/adapter";
import { CursorStore } from "../../types/cursor";
import { MemoryCursorStore } from "../../cursors";
import { onQuery } from "./on-query";
import { onMutation } from "./on-mutation";
import { createUseQuery } from "./use-query";
import { createUseMutation } from "./use-mutation";

type Options = {
  tableNames?: Map<string, string>;
  cursorStore?: CursorStore;
  // what column to map to if not an internal ID
  idColumn?: string;
};

export class KnexAdapter implements Adapter {
  onQuery: Adapter["onQuery"];
  onMutation: Adapter["onMutation"];

  constructor(knex: Knex, options: Options = {}) {
    const {
      tableNames,
      cursorStore = new MemoryCursorStore(),
      idColumn,
    } = options;

    const useQuery = createUseQuery(knex, { tableNames, idColumn });
    this.onQuery = onQuery({ useQuery, cursorStore });

    const useMutation = createUseMutation(knex, { tableNames, idColumn });
    this.onMutation = onMutation({ useQuery, useMutation });
  }
}
