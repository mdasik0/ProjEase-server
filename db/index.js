// db/index.js
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;

module.exports = async () => {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();

    const db = client.db("Projease");
    return {
      tasksCollection: db.collection("tasks"),
      usersCollection: db.collection("users"),
      projectsCollection: db.collection("projects"),
      invitationCollection: db.collection("invitations"),
      projectTasksCollection: db.collection("projectTasks"),
    };
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};
