import Knex from "knex";
import { MutationTransport as GraphMutationTransport } from "../../types/transports";
import { KnexMutationExecutor } from "./knex-mutation-executor";

type Options = {
  tableNames?: Map<string, string>;
  uuidField?: string;
};

export interface UseMutation {
  (mutation: GraphMutationTransport): Promise<number | undefined>;
}

export const createUseMutation = (knex: Knex, options: Options) => {
  const {
    tableNames = new Map<string, string>(),
    uuidField = "uuid",
  } = options;

  const knexMutationExecutor = new KnexMutationExecutor(knex);

  const useMutation: UseMutation = async (
    graphMutation
  ): ReturnType<UseMutation> => {
    const { name: queryName } = graphMutation;
    const from = tableNames.get(queryName) || queryName;

    // @ts-ignore
    const trx: Knex.Transaction = graphMutation.context?.trx;

    const { id: queryId } = graphMutation;
    const id = (queryId && parseInt(queryId)) || undefined;

    const { data: queryData } = graphMutation;
    const data = queryData;

    const nextId = await knexMutationExecutor.execute({
      trx,
      from,
      id,
      idField: uuidField,
      data,
    });

    return nextId;
  };

  return useMutation;
};
