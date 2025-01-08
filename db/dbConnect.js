const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectToDB() {
  if (!db) {
    await client.connect();
    db = client.db("Projease");
    console.log("Connected to MongoDB");
  }
  return db;
}

module.exports = { connectToDB };
