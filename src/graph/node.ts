export const NodeType = `
  interface Node {
    # The ID of the object.
    id: ID!
  }
`;

export const NodeRootQuery = `
  node(id: ID!): Node
`;
