import Knex from "knex";
import { MutationTransport } from "./transports";
import { AutographError } from "../../errors";

export class KnexMutationExecutor {
  knex: Knex;

  constructor(knex: Knex) {
    this.knex = knex;
  }

  async execute(mutation: MutationTransport) {
    const { trx, from, id, idField = "id", data } = mutation;

    const exec = this.knex(from);

    // console.log("[debug.knex.mutation] has trx?", !!trx);
    if (trx) exec.transacting(trx);

    /**
     * CREATE
     */
    if (data && !id) {
      const [id] = await exec.insert(data).returning(idField);
      return id as number;
    }

    /**
     * UPDATE
     */
    if (data && id) {
      await exec
        .where({ [idField]: id })
        .update(data)
        .returning(idField);
      return id as number;
    }

    /**
     * DELETE
     */
    if (!data && id) {
      await exec.where({ [idField]: id }).delete();
      return;
    }

    throw new AutographError("USE_MUTATION_INVALID_QUERY");
  }
}
