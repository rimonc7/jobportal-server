require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
    console.log('Inside the logger');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        req.user = decoded;
        next();
    })

}


const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.by2cb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        await client.connect();

        const jobCollection = client.db("jobPortal").collection('jobs');
        const jobApplicationCollection = client.db("jobPortal").collection('job_applications')


        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                .send({ success: true });
        })

        app.post('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
                .send({ success: true })
        })

        app.get('/jobs', logger, async (req, res) => {
            const email = req.query.email;
            let query = {}
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const job = await jobCollection.findOne(query);
            res.send(job)
        })

        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email;

            // console.log(req.cookies)
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { applicant_email: email }
            const result = await jobApplicationCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/job-applications/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId }
            const result = await jobApplicationCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob)
            res.send(result)
        })

        app.post('/job-application', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application);

            const id = application.job_id;
            const query = { _id: new ObjectId(id) }
            const job = await jobCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1
            }
            else {
                newCount = 1
            }
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updatedResult = await jobCollection.updateOne(filter, updatedDoc)

            res.send(result)
        })


        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Job Server is Running')
})

app.listen(port, () => {
    console.log(`Job server running on port ${port}`)
})

