var express = require("express")
var { createHandler } = require("graphql-http/lib/use/express")
var { ruruHTML } = require("ruru/server")
var { GraphQLError } = require("graphql")

const { MongoClient, ServerApiVersion } = require('mongodb')
const model = require('./model')

var app = express()
const client = new MongoClient('mongodb://localhost:27017', {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// Create and use the GraphQL handler.
app.all(
  "/graphql/:dbname",
  async (req, res) => {
    const dbname = req.params.dbname
    await client.connect()
    const db = client.db(dbname)
    try {
      const { schema, root } = await model(dbname)
      const handler = createHandler({
        schema,
        rootValue: root,
        context: { req, db },
      })
      handler(req, res)
    } catch (e) {
      res.status(500).send({
        errors: [new GraphQLError(e)],
      })
    }
  }
)

// Serve the GraphiQL IDE.
app.get("/:dbname", (req, res) => {
  const dbname = req.params.dbname
  res.type("html")
  res.end(ruruHTML({ endpoint: `/graphql/${dbname}` }))
})

// Start the server at port
app.listen(4002)
console.log("Running a GraphQL API server at http://localhost:4002/graphql")
