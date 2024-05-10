const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.get("/",(req,res) => {
    res.send("Welcome to Projease")
})


// middleware
app.use(cors());
app.use(express.json());

// last middleware function. after this no middleware function should be added

app.use((err, req, res, next) => {
    if(err.message) {
        res.status(500).send(err.message);
    } else {
        res.status(500).send("There was an error!")
    }
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})