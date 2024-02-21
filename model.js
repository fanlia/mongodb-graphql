
var { buildSchema, parse } = require("graphql")
const { ObjectId } = require('mongodb')

const handleFilter = (filter = {}) => {
  const { _id, ...other } = filter
  if (!_id) return filter
  return {
    ...other,
    _id: new ObjectId(_id),
  }
}

const handle$ = (d) => {
  if (Array.isArray(d)) {
    return d.map(handle$)
  }
  if (typeof d === 'object' && d) {
    const newd = {}
    for (let key in d) {
      const val = d[key]
      const newkey = /^__/.test(key) ? key.replace('__', '$') : key
      const newval = handle$(val)
      newd[newkey] = newval
    }
    return newd
  }
  return d
}

// const data = [
//   {
//     __group: {
//       _id: "$name",
//       count: { __sum: 1 }
//     }
//   }
// ]
//
// console.log(JSON.stringify(handle$(data), null, 2))

module.exports = async (dbname) => {

  // Construct a schema, using GraphQL schema language
  var schema = buildSchema(`
    scalar JSON
    input QueryInput {
      filter: JSON
      sort: JSON
      limit: Int
      offset: Int
    }
    input ChildInput {
      name: String!
    }
    input ParentInput {
      name: String!
      children: [ChildInput!]!
    }
    type Parent {
      _id: String
      name: String
      children: [Child]
    }
    type Child {
      name: String
    }
    type Parents {
      count: Int
      data: [Parent]
    }
    type Query {
      hello: String
      parents_find(query: QueryInput): Parents
      parents_stats(filter: JSON, pipeline: [JSON!]!): JSON
    }
    type Mutation {
      parents_create(data: [ParentInput!]!): Boolean
      parents_update(filter: JSON!, data: JSON!): Boolean
      parents_delete(filter: JSON!): Boolean
    }
  `)

  // The root provides a resolver function for each API endpoint
  var root = {
    parents_find: async ({ query = {} }, { db }, field) => {
      let {
        filter,
        sort,
        limit = 10,
        offset = 0,
      } = query
      filter = handleFilter(filter)
      const model = db.collection('parents')
      const [count, data] = await Promise.all([
        model.countDocuments(filter),
        model.find(filter).sort(sort).limit(limit).skip(offset).toArray(),
      ])
      return {
        count,
        data,
      }
    },
    parents_stats: async ({ filter, pipeline }, { db }, field) => {
      filter = handleFilter(filter)
      const model = db.collection('parents')
      pipeline = handle$(pipeline)
      pipeline = [
        { $match: filter },
        ...pipeline
      ]
      const result = await model.aggregate(pipeline).toArray()

      return result
    },
    parents_create: async ({ data }, { db }, field) => {
      const model = db.collection('parents')
      const result = await model.insertMany(data)

      return true
    },
    parents_update: async ({ filter, data }, { db }, field) => {
      filter = handleFilter(filter)
      const model = db.collection('parents')
      data = handle$(data)

      const result = await model.updateMany(filter, data)

      return true
    },
    parents_delete: async ({ filter }, { db }, field) => {
      filter = handleFilter(filter)
      const model = db.collection('parents')
      const result = await model.deleteMany(filter)

      return true
    },
    hello: (args, ctx, field) => {
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
