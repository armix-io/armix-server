import Knex from "knex";

export type Op = {
  tag?: string;
  func: (query: Knex.QueryBuilder, knex: Knex) => void;
};

export const op = (func: Op["func"], tag?: Op["tag"]): Op => ({
  tag,
  func,
});

export interface QueryTransport {
  table: string;
  ops: Op[];
}

export interface MutationTransport {
  from: string;
  id?: number;
  data?: any;
  trx?: Knex.Transaction;
}
