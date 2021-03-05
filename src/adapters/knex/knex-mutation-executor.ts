import Knex from "knex";
import { MutationTransport } from "./transports";
import { AutographError } from "../../errors";

export class KnexMutationExecutor {
  knex: Knex;

  constructor(knex: Knex) {
    this.knex = knex;
  }

  async execute(mutation: MutationTransport) {
    const { trx, from, id, idColumn = "id", data } = mutation;

    const exec = this.knex(from);

    if (trx) {
      exec.transacting(trx);
    } else {
      console.warn(`[autograph.knex.mutation] no trx, not transactional!`);
    }

    /**
     * CREATE
     */
    if (data && !id) {
      const [id] = await exec.insert(data).returning(idColumn);
      return id;
    }

    /**
     * UPDATE
     */
    if (data && id) {
      await exec
        .where({ [idColumn]: id })
        .update(data)
        .returning(idColumn);
      return id;
    }

    /**
     * DELETE
     */
    if (!data && id) {
      await exec.where({ [idColumn]: id }).delete();
      return;
    }

    throw new AutographError("USE_MUTATION_INVALID_QUERY");
  }
}
