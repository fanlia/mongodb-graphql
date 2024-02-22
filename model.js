
const { parse, specifiedScalarTypes, GraphQLScalarType } = require("graphql")
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { ObjectId } = require('mongodb')
const dayjs = require('dayjs')

const ScalarTypeNames = ['JSON', 'DateTime', ...specifiedScalarTypes.map(d => d.name)]

const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Date custom scalar type',
  parseValue(value) {
    return new Date(value) // value from the client
  },
  serialize(value) {
    return  dayjs(value).format('YYYY-MM-DD HH:mm:ss')// value sent to the client
  },
  parseLiteral(ast) {
    const value = dayjs(ast.value)

    if (!value.isValid()) {
      throw new Error('invalid date')
    }

    return value.toDate()
  }
})

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


// const result = parse(gql, { noLocation: true })
//
// console.dir(result, { depth: null })
// console.log(print(result))
//

const get_field_input_type = ({ kind, name, type }) => {

  if (kind === 'NamedType') {
    return ScalarTypeNames.includes(name.value) || name.value.endsWith('Enum') ? `${name.value}!` : `${name.value}Input!`
  }

  if (kind === 'ListType') {
    return `[${get_field_input_type(type)}]!`
  }

  throw new Error('invalid field type')
}

const get_collection_info = (type_gql) => {
  const result = parse(type_gql, { noLocation: true })
  // console.dir(result, { depth: null })
  // get object type
  const types = result.definitions.filter(def => def.kind === 'ObjectTypeDefinition')
  // console.dir(types, { depth: null })
  // generate input type
  const input_gql = types.map(def => {
    const name = def.name.value

    const fields = def.fields.map(field => {
      const name = field.name.value
      if (name === '_id') return ''
      const type = get_field_input_type(field.type)
      return `  ${name}: ${type}`
    }).join('\n')

    return `input ${name}Input {\n${fields}\n}`
  }).join('\n')
  // console.log(input_gql)
  // get object type with _id
  const types_with_id = types.filter(def => def.fields.some(field => field.name.value === '_id'))
  // console.dir(types_with_id, { depth: null })
  // generate list type
  const list_gql = types_with_id.map(def => {
    const name = def.name.value

    return `type ${name}List { count: Int data: [${name}] }`
  }).join('\n')
  // console.log(list_gql)

  const gql = [type_gql, input_gql, list_gql].join('\n')

  const typeinfos = types_with_id.map(def => {
    const type = def.name.value
    const name = type.toLowerCase()
    const input = `${type}Input`
    const list = `${type}List`
    return {
      name,
      type,
      input,
      list,
    }
  })

  return { gql, typeinfos }
}

module.exports = async (dbname, client) => {

  const definition = client.db('definition')
  let type_gql = null

  if (dbname === 'demo') {
    type_gql = `
        type Parent {
          _id: ID
          name: String
          type: ParentEnum
          children: [Child]
        }
        type Child {
          name: String
        }
        enum ParentEnum { user admin }
    `
  } else if (dbname === 'definition') {
    // get type_gql by admin
    type_gql = `
        type Definition { _id: ID name: String gql: String }
    `
  } else {
    // get type_gql by dbname
    const found = await definition.collection('definition').findOne({ name: dbname })
    if (found) {
      type_gql = found.gql
    }
  }

  if (!type_gql) {
    throw new Error(`${dbname} not found`)
  }

  const { gql, typeinfos } = get_collection_info(type_gql)

  const collection_gqls = typeinfos.map(get_collection_gql)
  const query_gql = collection_gqls.map(d => d.query).join('\n')
  const mutation_gql = collection_gqls.map(d => d.mutation).join('\n')

  // Construct a schema, using GraphQL schema language
  const schema_gql = `
    scalar JSON
    scalar DateTime
    input QueryInput {
      filter: JSON
      sort: JSON
      limit: Int
      offset: Int
    }
    ${gql}
    type Query {
    ${query_gql}
    }
    type Mutation {
    ${mutation_gql}
    }
  `

  const resolveFunctions = {
    DateTime: GraphQLDateTime,
  }
  // console.log(schema_gql)
  const schema = makeExecutableSchema({
    typeDefs: schema_gql,
    resolvers: resolveFunctions,
  })

  // The root provides a resolver function for each API endpoint
  const root = typeinfos.reduce((m, d) => ({...m, ...get_collection_root(d.name)}), {})

  return { schema, root }
}

const get_collection_gql = ({ name, type, input, list }) => {

  const query = `
    ${name}_find(query: QueryInput): ${list}
    ${name}_stats(filter: JSON, pipeline: [JSON!]!): JSON
  `

  const mutation = `
    ${name}_create(data: [${input}!]!): Boolean
    ${name}_update(filter: JSON!, data: JSON!): Boolean
    ${name}_delete(filter: JSON!): Boolean
  `

  return {
    query,
    mutation,
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
