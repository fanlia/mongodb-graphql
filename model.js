
var { buildSchema } = require("graphql")

module.exports = async (name) => {

  // Construct a schema, using GraphQL schema language
  var schema = buildSchema(`
    type Query {
      hello: String
    }
  `)

  // The root provides a resolver function for each API endpoint
  var root = {
    hello: (root, ctx, field) => {
      console.log({
        root,
        ctx,
        field,
      })
      return "Hello world!"
    },
  }

  return { schema, root }
}
