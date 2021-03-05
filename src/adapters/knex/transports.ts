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

// TODO: convert to ops, like QueryTransport
export interface MutationTransport {
  from: string;
  id?: string;
  idColumn?: string;
  data?: any;
  trx?: Knex.Transaction;
}
