const path = require('node:path')
const express = require("express")
const cors = require('cors')
const { formidable } = require('formidable')
const { createHandler } = require("graphql-http/lib/use/express")
const { ruruHTML } = require("ruru/server")
const { GraphQLError } = require("graphql")

const { MongoClient, ServerApiVersion } = require('mongodb')
const model = require('./model')

const uploadDir = path.join(__dirname, './upload')

const app = express()
const mongodb_uri = process.env.MONGO_URI || 'mongodb://localhost:27017'
const client = new MongoClient(mongodb_uri)

app.use(cors())

app.use('/upload', express.static(uploadDir));

app.get('/api/upload', (req, res) => {
  res.send(`
    <h2>Upload</h2>
    <form action="/api/upload" enctype="multipart/form-data" method="post">
      <p>File: <input type="file" name="file" multiple /></p>
      <input type="submit" value="Upload" />
    </form>
  `);
});

app.post('/api/upload', (req, res, next) => {
  const form = formidable({
    uploadDir,
    keepExtensions: true,
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      next(err);
      return;
    }
    const infos = files.file.map(d => ({
      name: d.originalFilename,
      url: `upload/${d.newFilename}`,
    }))
    res.json(infos);
  });
});

// Create and use the GraphQL handler.
app.all(
  "/graphql/:dbname",
  async (req, res) => {
    const dbname = req.params.dbname
    await client.connect()
    const db = client.db(`graphql_${dbname}`)
    const definition = client.db('graphql_definition')
    try {
      const { schema, root } = await model(dbname, definition)
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
const port = process.env.PORT || 4002
app.listen(port)
console.log(`Running a GraphQL API server at http://localhost:${port}`)
