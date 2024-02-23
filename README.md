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
type Friend {
  _id: ID
  name: String
}
type Parent {
  _id: ID
  name: String
  type: ParentEnum
  children: [Child]
  created: DateTime
  friend_id: ID
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

- auto generate relation field
    * friend_id will generate friend for Parent
    * friend_id will generate parent_find for Friend

- type with _id will generate api

```gql
mutation friend_create {
  friend_create(data: [
    {
      name: "a friend"
    }
  ]) {
    _id
    name
  }
}

query friend_find {
  friend_find(query: {
    filter: {}
  }) {
    count
    data {
      _id
      name
      parent_find(query: {
        filter: {}
      }) {
        count
        data {
          _id
          name
          type
          created
          friend_id
        }
      }
    }
  }
}

query find {
  parent_find(
    query: {      
      filter: {
        # _id: {
        #   __in: ["65d734d9dad42f2e7cccf1f7"]
        # }
        # name: "hello2"
        # _id: "65d84219a7f9b96eb5516f98"
      }
      # limit: 2
      # sort: {
      #   # name: 1
      #   _id: 1
      # }
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
      friend_id
      friend {
        _id
        name
      }
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
      name: "hello with friend"
      type: user
      children: [
        {
          name: "child2"
        }
      ]
      created: "2024-02-01"
      friend_id: "65d734d9dad42f2e7cccf1f7"
    }
  ]) {
    _id
    name
    type
    created
    friend_id
  }
}

mutation update {
  parent_update(filter: {
    _id: "65d84219a7f9b96eb5516f98"
  }, data: {
    friend_id: "65d84701079eba2926f8af86"
    	# name: "hello world"
    	# created: "2024-02-03"
  })
}

mutation delete {
  parent_delete(filter: {})
}
```
