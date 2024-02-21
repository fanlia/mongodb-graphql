var express = require("express")
var { createHandler } = require("graphql-http/lib/use/express")
var { ruruHTML } = require("ruru/server")

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
  "/graphql/:collection",
  async (req, res) => {
    const collection = req.params.collection
    await client.connect()
    const db = client.db(collection)
    try {
      const { schema, root } = await model(collection)
      const handler = createHandler({
        schema,
        rootValue: root,
        context: { req, db },
      })
      handler(req, res)
    } catch (e) {
      res.status(500).end(e.message || e)
    }
  }
)

// Serve the GraphiQL IDE.
app.get("/:collection", (req, res) => {
  const collection = req.params.collection
  res.type("html")
  res.end(ruruHTML({ endpoint: `/graphql/${collection}` }))
})

// Start the server at port
app.listen(4002)
console.log("Running a GraphQL API server at http://localhost:4002/graphql")
