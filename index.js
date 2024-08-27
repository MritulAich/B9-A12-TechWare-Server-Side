const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const jwt = require('jsonwebtoken');

//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const paymentCollection = client.db('bistroDB').collection('payments');
    const memberCollection = client.db('techDB').collection('members');
    const reportCollection = client.db('techDB').collection('reports');
    const myProductCollection = client.db('techDB').collection('my_products');


    app.get('/products', async (req, res) => {
      const cursor = productCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    app.get('/products/:id', async (req, res) => {
      const productId = req.params.id;
      const query = { _id: productId }
      const result = await productCollection.findOne(query);
      res.send(result)
    })
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      console.log(newProduct);
      const result = await productCollection.insertOne(newProduct);
      res.send(result);
    })
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await productCollection.deleteOne(query);
      res.send(result);
    })
    app.put('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const options = { upsert: true };
      const updatedProduct = req.body;

      const products = {
        $set: {
          name: updatedProduct.name,
          image_url: updatedProduct.image_url,
          description: updatedProduct.description,
          tags: updatedProduct.tags,
          external_link: updatedProduct.external_link,
        }
      }
      const result = await productCollection.updateOne(query, products, options);
      res.send(result)
    })


    // middlewares
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ message: 'unauthorized' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'forbidden' })
        }
        req.decoded = decoded;
        console.log('decoded token', decoded);
        next();
      })
    }
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      console.log('Decoded token email:', email);
      const query = { email: email };
      const member = await memberCollection.findOne(query);
      console.log("Admin Check:", member);
      if (!member || member.role !== "admin") {
        return res.status(403).send({ message: 'admin only' });
      }
      next();
    }


    //search functionality
    app.get('/search', async (req, res) => {
      const query = req.query.q;
      const searchResult = await productCollection.find({
        tags: { $regex: query, $options: 'i' }
      }).toArray();
      res.json(searchResult)
    })

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })


    //payments
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await paymentCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult })
    })


    //reports
    app.post('/reports', async (req, res) => {
      const report = req.body;
      const result = await reportCollection.insertOne(report);
      res.send(result)
    })
    app.get('/reports', async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result);
    })
    app.get('/reports/:id', async (req, res) => {
      const productId = req.params.id;
      const query = { _id: productId };
      const result = await myProductCollection.findOne(query);
      res.send(result);
    })
    app.delete('/reports/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await reportCollection.deleteOne(query);
      res.send(result);
    })



    app.post('/myProducts', async (req, res) => {
      const report = req.body;
      const result = await myProductCollection.insertOne(report);
      res.send(result)
    })
    app.get('/myProducts', async (req, res) => {
      const result = await myProductCollection.find().toArray();
      res.send(result);
    })
    app.get('/myProducts/:id', async (req, res) => {
      const productId = req.params.id;
      const query = { _id: productId };
      const result = await myProductCollection.findOne(query);
      res.send(result);
    })
    app.delete('/myProducts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await myProductCollection.deleteOne(query);
      res.send(result);
    })




    app.post('/members', async (req, res) => {
      const member = req.body;
      const query = { email: member.email };
      const existingMember = await memberCollection.findOne(query);
      if (existingMember) {
        return res.send({ message: 'member already exists', insertedId: null })
      }
      const result = await memberCollection.insertOne(member);
      res.send(result);
    })

    app.get('/members', verifyToken, verifyAdmin, async (req, res) => {
      const result = await memberCollection.find().toArray();
      res.send(result);
    });


    app.patch('/members/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { role: "admin" }
      };
      const result = await memberCollection.updateOne(filter, updatedDoc);
      res.send(result)
    });

    app.get('/members/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const member = await memberCollection.findOne(query);
      let admin = false;
      if (member) {
        admin = member.role === 'admin';
      }
      res.send({ admin })
    })









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