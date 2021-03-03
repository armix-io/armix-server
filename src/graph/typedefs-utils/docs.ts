import { ModelAny } from "../../model/model";

export function getDocs({
  name,
  limitDefault,
  limitMax,
  defaultDocs,
}: ModelAny) {
  const enabled = defaultDocs || undefined;
  return {
    queryMany:
      enabled &&
      `# Accepts a combination of one or many options to paginate through many \`${name}\` items. - \`cursor\`, used from a previous request to the get page of items. If specified, all other arguments are ignored. - \`order\`, used to order items (e.g. "fieldA:asc", "fieldB:desc") - \`filters\`, a map of filters and their values used to conditionally filter items. See \`${name}ManyFilters\` for available filters and value types. - \`limit\`, specify how many items per page (default: \`${limitDefault}\`, max: \`${limitMax}\`) Returns \`${name}ManyResult\` with a \`cursor\` value (to be used in a subsequent request to fetch the next page of items, \`null\` if no more items), \`total\` (to denote how many items exist), and \`items\` of \`${name}\`.`,
    mutationCreate:
      enabled &&
      `# Accepts \`data\` as an array of \`${name}Create\` to persist, and returns those new items.`,
    mutationUpdate:
      enabled &&
      `# Accepts \`data\` as an array of \`${name}Update\` to update items by the given \`{ id }\` field, and returns those updated items.`,
    mutationDelete:
      enabled &&
      `# Accepts \`ids\` as an array of \`ID\`s and returns those \`ID\`s after deletion.`,
  };
}
