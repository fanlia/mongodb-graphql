
var { buildSchema } = require("graphql")
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

  const parents_gql = get_collection_gql('parents')

  // Construct a schema, using GraphQL schema language
  var schema = buildSchema(`
    scalar JSON
    input QueryInput {
      filter: JSON
      sort: JSON
      limit: Int
      offset: Int
    }
    ${parents_gql.type}
    type Query {
      hello: String
    ${parents_gql.query}
    }
    type Mutation {
    ${parents_gql.mutaion}
    }
  `)

  const parents_root = get_collection_root('parents')

  const root = {
    hello: (args, ctx, field) => {
      console.log({
        root,
        ctx,
        field,
      })
      return "Hello world!"
    },
    ...parents_root,
  }

  // The root provides a resolver function for each API endpoint

  return { schema, root }
}

const get_collection_gql = (collection_name = 'docs') => {

  const type = `
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
  `

  const query = `
    ${collection_name}_find(query: QueryInput): Parents
    ${collection_name}_stats(filter: JSON, pipeline: [JSON!]!): JSON
  `

  const mutaion = `
    ${collection_name}_create(data: [ParentInput!]!): Boolean
    ${collection_name}_update(filter: JSON!, data: JSON!): Boolean
    ${collection_name}_delete(filter: JSON!): Boolean
  `

  return {
    type,
    query,
    mutaion,
  }
}

const get_collection_root = (collection_name = 'docs') => ({
  [`${collection_name}_find`]: async ({ query = {} }, { db }, field) => {
    let {
      filter,
      sort,
      limit = 10,
      offset = 0,
    } = query
    filter = handleFilter(filter)
    const model = db.collection(collection_name)
    const [count, data] = await Promise.all([
      model.countDocuments(filter),
      model.find(filter).sort(sort).limit(limit).skip(offset).toArray(),
    ])
    return {
      count,
      data,
    }
  },
  [`${collection_name}_stats`]: async ({ filter, pipeline }, { db }, field) => {
    filter = handleFilter(filter)
    const model = db.collection(collection_name)
    pipeline = handle$(pipeline)
    pipeline = [
      { $match: filter },
      ...pipeline
    ]
    const result = await model.aggregate(pipeline).toArray()

    return result
  },
  [`${collection_name}_create`]: async ({ data }, { db }, field) => {
    const model = db.collection(collection_name)
    const result = await model.insertMany(data)

    return true
  },
  [`${collection_name}_update`]: async ({ filter, data }, { db }, field) => {
    filter = handleFilter(filter)
    const model = db.collection(collection_name)
    data = handle$(data)

    const result = await model.updateMany(filter, data)

    return true
  },
  [`${collection_name}_delete`]: async ({ filter }, { db }, field) => {
    filter = handleFilter(filter)
    const model = db.collection(collection_name)
    const result = await model.deleteMany(filter)

    return true
  },
})
