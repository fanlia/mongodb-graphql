var express = require("express")
var { createHandler } = require("graphql-http/lib/use/express")
var { buildSchema } = require("graphql")
var { ruruHTML } = require("ruru/server")

const { MongoClient, ServerApiVersion } = require('mongodb')

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

var app = express()

// Create and use the GraphQL handler.
app.all(
  "/graphql",
  createHandler({
    schema: schema,
    rootValue: root,
    context: async (req) => {
      const db = new MongoClient('mongodb://localhost:27017', {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
      })
      await db.connect()
      return {
        req,
        db,
      }
    },
  })
)

// Serve the GraphiQL IDE.
app.get("/", (_req, res) => {
  res.type("html")
  res.end(ruruHTML({ endpoint: "/graphql" }))
})

// Start the server at port
app.listen(4002)
console.log("Running a GraphQL API server at http://localhost:4002/graphql")
