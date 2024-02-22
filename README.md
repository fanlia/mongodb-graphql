# mongodb-graphql
set graphql api for mongodb database

## Getting Started

### env

- MONGO_URI=mongodb://localhost:27017
- PORT=4002

### develop

```sh
npm i
npm start
```

## How to

- prepare graphql type definition

```gql
  type Parent {
    _id: ID
    name: String
    type: ParentEnum
    children: [Child]
    created: DateTime
  }
  type Child {
    name: String
  }
  enum ParentEnum { user admin }
```

- auto generate input type
- auto generate list type
- scalar types
    * JSON
    * DateTime
    * String
    * ID
    * Int
    * Float
    * Boolean
    * XxxEnum

- type with _id will generate api

```gql

query find {
  parent_find(
    query: {      
      filter: {
        # name: "hello2"
        # _id: "65d70156f3ebe4e71655f53e"
      }
      # limit: 2
      sort: {
        name: 1
      }
    }
  ) {
    count
    data {
      _id
      name
      type
      children {
        name
      }
      created
    }
  }
}

query stats {
  parent_stats(
    filter: {}
    pipeline: [
      {
        __group: {
          _id: "$name",
          count: { __sum: 1 }
        }
      }
    ]
  )
}

mutation create {
  parent_create(data: [
    {
      name: "hello2"
      type: user
      children: [
        {
          name: "child2"
        }
      ]
      created: "2024-01-01"
    }
  ])
}

mutation update {
  parent_update(filter: {
    _id: "65d7309c006f5f821da57e2c"
  }, data: {
    name: "hello again"
    created: "2024-02-03"
  })
}

mutation delete {
  parent_delete(filter: {})
}
```
