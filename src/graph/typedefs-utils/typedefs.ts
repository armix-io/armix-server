import { Type } from "../../types/type";
import { Node } from "../../types/graph";
import { ModelAny } from "../../model/model";
import { Field } from "../../model/field";
import { getType } from "./get-type";
import { getTypeDictArgs } from "./get-type-dict-args";

const mapFields = (
  fields: ModelAny["fields"],
  resolveType: (field: Field<any>) => Type | undefined,
  resolveArgs?: (field: Field<any>) => Record<string, Type> | undefined,
  partial: boolean = false
) => {
  const acc: string[] = [];
  Object.values(fields).forEach((field) => {
    const type = resolveType(field);
    const args = resolveArgs && resolveArgs(field);
    if (!type) return;

    const $name = field.name;
    const $args =
      args && Object.keys(args).length ? `(${getTypeDictArgs(args)})` : "";
    const $type = getType(type, partial);

    acc.push(`${$name}${$args}: ${$type}`);
  });
  return acc.join("\n");
};

function mapFilters(filters: ModelAny["filters"]) {
  const acc: string[] = [];
  Object.values(filters).forEach((filter) => {
    const $name = filter.name;
    const $arg = getType(filter.type, true);

    acc.push(`${$name}: ${$arg}`);
  });
  return acc.join("\n");
}

export function getRootType({ name, fields }: ModelAny) {
  return `
    type ${name} implements Node {
      ${mapFields(
        fields,
        ({ type, get }) => get && type.get,
        ({ get }) => get && get.args
      )}
    }
  `;
}

export function getRootListType({ name }: ModelAny) {
  return `
    type ${name}List {
      items: [${name}!]!
      total: Int
      cursor: String
    }
  `;
}

export function getRootCreateInput({ name, fields, mutationCreate }: ModelAny) {
  if (!mutationCreate) return;
  return `
    input ${name}CreateInput {
      ${mapFields(fields, ({ name, type, setCreate, setCreateAfterData }) =>
        name === "id"
          ? undefined
          : (setCreate || setCreateAfterData) && type.set
      )}
    }
  `;
}

export function getRootUpdateInput({ name, fields, mutationUpdate }: ModelAny) {
  if (!mutationUpdate) return;
  return `
    input ${name}UpdateInput {
      id: ID!
      ${mapFields(
        fields,
        ({ name, type, setUpdate, setUpdateAfterData }) =>
          name === "id"
            ? undefined
            : (setUpdate || setUpdateAfterData) && type.set,
        undefined,
        true
      )}
    }
  `;
}

export function getRootFiltersInput({ name, filters }: ModelAny) {
  return `
    input ${name}Filters {
      ${mapFilters(filters)}
    }
  `;
}

export function getRootOrderEnum({ name, fields, queryMany }: ModelAny) {
  if (!queryMany) return;
  return `
    enum ${name}Order {
      ${Object.values(fields)
        .filter((field) => field.orderTarget)
        .map(({ name }) => {
          return `"""Order by \`${name}\` in ascending order."""\n${name}_asc,"""Order by \`${name}\` in descending order."""\n\n${name}_desc,`;
        })
        .join("\n")}
    }
  `;
}

export function getQueryManyResolver({ name, queryMany }: ModelAny) {
  if (!queryMany) return;
  return `
    ${queryMany}(
      cursor: String
      order: ${name}Order
      filters: ${name}Filters
      limit: Int
    ): ${name}List!
  `;
}

export function getMutationCreateResolver({ name, mutationCreate }: ModelAny) {
  if (!mutationCreate) return;
  return `
    ${mutationCreate}(
      data: [${name}CreateInput!]!
    ): [${name}!]!
  `;
}

export function getMutationUpdateResolver({ name, mutationUpdate }: ModelAny) {
  if (!mutationUpdate) return;
  return `
    ${mutationUpdate}(
      data: [${name}UpdateInput!]!
    ): [${name}!]!
  `;
}

export function getMutationDeleteResolver({ name, mutationDelete }: ModelAny) {
  if (!mutationDelete) return;
  return `
    ${name}Delete(
      ids: [ID!]!
    ): [ID!]!
  `;
}

export function getOtherTypeDefs(model: ModelAny, node: Node) {
  return model.typeDefs[node].join("\n");
}
