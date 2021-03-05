import Knex from "knex";
import { MutationTransport as GraphMutationTransport } from "../../types/transports";
import { KnexMutationExecutor } from "./knex-mutation-executor";

type Options = {
  tableNames?: Map<string, string>;
  idColumn?: string;
};

export interface UseMutation {
  (mutation: GraphMutationTransport): Promise<string | undefined>;
}

export const createUseMutation = (knex: Knex, options: Options) => {
  const { tableNames = new Map<string, string>(), idColumn = "uuid" } = options;

  const knexMutationExecutor = new KnexMutationExecutor(knex);

  const useMutation: UseMutation = async (
    graphMutation
  ): ReturnType<UseMutation> => {
    const { name, id, newId, data } = graphMutation;
    const from = tableNames.get(name) || name;

    // @ts-ignore
    const trx: Knex.Transaction = graphMutation.context.trx;

    // if a newId is given (create operation) add to data object
    if (data && newId) {
      data[idColumn] = newId;
    }

    const nextId = await knexMutationExecutor.execute({
      trx,
      from,
      id,
      idColumn,
      data,
    });

    return nextId;
  };

  return useMutation;
};
