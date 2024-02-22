module.exports = {
  apps : [{
    name   : "mongodb-graphql",
    script : "./server.js",
    env: {
      MONGO_URI: 'mongodb://localhost:27017',
      PORT: 4003,
    },
  }]
}
