const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // ? collections
    const tasksCollection = client.db("Projease").collection("tasks");

    // ! database code start here
    // ? Task api endpoints here
    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const result = await tasksCollection.insertOne(task);
      if(result?.insertedId) {
        res.status(200).send(result)
      } else{
        res.status(404).send({
          message: "can't insert task try again later",
          status: false
        })
      }
    });
    
    app.get("/tasks", async(req,res) => {
      const result = await tasksCollection.find();
      res.status(200).send(result)
    })

    app.patch("/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const query = { _id: ObjectId(id) };
      const result = await tasksCollection.updateOne(query, body);
      res.send(result);
    });

    app.patch("/deleteTask/:id", async (req,res) => {
        const id = req.params.id;
        const result = await tasksCollection.deleteOne({_id: ObjectId(id)})
        res.send(result)
    })

    // ! database code ends here
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

// last middleware function. after this no middleware function should be added

app.use((err, req, res, next) => {
  if (err.message) {
    res.status(500).send(err.message);
  } else {
    res.status(500).send("There was an error!");
  }
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
