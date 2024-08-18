const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.S3_BUCKET}:${process.env.SECRET_KEY}@cluster0.ku98crh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const productCollection = client.db('techDB').collection('products');
    
    app.get('/products', async (req, res) => {
      const cursor = productCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    
    app.get('/products/:id', async (req, res) => {
      const productId = req.params.id;
      const product = await productCollection.findOne({ _id: productId });
      res.json(product)
    })
    

    //search functionality
    app.get('/search', async(req, res)=>{
      const query = req.query.q;
      const searchResult = await productCollection.find({
        tags: {$regex:query, $options: 'i'}
      }).toArray();
      res.json(searchResult)
      })

    
    const reviewCollection = client.db('techDB').collection('posted_reviews');






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server-12 is running')
})
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
})