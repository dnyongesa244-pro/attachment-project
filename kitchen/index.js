
const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const hbs = require('hbs');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const mongoStore = require('connect-mongo')
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { type } = require('os');

app.engine('hbs', exphbs.engine({
    extname: ".hbs",
    partialsDir: path.join(__dirname, "views", 'partials'),
    layoutsDir: path.join(__dirname, 'views', 'layouts')
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret : "shh its a secreat",
    resave : false,
    saveUninitialized : false,
    store : mongoStore.create({
        mongoUrl : "mongodb://localhost:27017/kitchen",
        collectionName : "sessions"
    }),
    cookie : {maxAge : 24*60*60*1000}
}))

function isAutaumticated(req, res, next){
    if(req.session.userId){
        return next();
    } else{
        res.redirect('/login');
    }
}
// Setting up MongoDB database connection
mongoose.connect('mongodb://localhost:27017/kitchen')
    .then(() => {
        console.log('Database connected successfully');
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch(err => {
        console.log(err);
    });

// Defining the database schema
const personSchema = new mongoose.Schema({
    fname: { type: String, required: true },
    sname: { type: String },
    lname: { type: String, required: true },
    username: { type: String, required: true },
    dept: { type: String, required: true },
    email: { type: String, required: true },
    phoneNo: { type: Number, required: true },
    role: { type: String, required: true },
    password: { type: String, required: true }
});

// Defining the collection
const staff = mongoose.model('staff', personSchema);

// Getting the add new user page
app.get('/addNew',isAutaumticated, (req, res) => {
    res.render('addNew');
});

// Posting the new user to the database
app.post('/addnew', isAutaumticated, async (req, res) => {
    const personInfo = req.body;

    if (!personInfo.fname || !personInfo.lname || !personInfo.username || !personInfo.dept || !personInfo.email || !personInfo.password || !personInfo.phoneNo || !personInfo.role) {
        res.send('Please enter correct information');
    } else {
        try {
            const check = await staff.findOne({ $or: [{ username: personInfo.username }, { email: personInfo.email }] });
            if (check) {
                if (check.username === personInfo.username && check.email === personInfo.email) {
                    res.send(`User with username: ${check.username} and email: ${check.email} already exist`);
                } else if (check.username === personInfo.username) {
                    res.send(`Username: ${check.username} already exists, please try a different username`);
                } else if (check.email === personInfo.email) {
                    res.send(`User with email: ${check.email} already exists`);
                }
            } else {
                const newPerson = new staff({
                    fname: personInfo.fname,
                    sname: personInfo.sname,
                    lname: personInfo.lname,
                    username: personInfo.username,
                    dept: personInfo.dept,
                    email: personInfo.email,
                    phoneNo: personInfo.phoneNo,
                    role: personInfo.role,
                    password: personInfo.password
                });

                await newPerson.save();
                res.send('New user created successfully');
            }
        } catch (err) {
            console.log(err);
            res.status(500).send('An error occurred');
        }
    }
});

// Displaying login form
app.get('/login', (req, res) => {
    res.render('login');
});

// Verifying login and opening of home page
app.post('/login', async (req, res) => {
    const personInfo = req.body;

    if (!personInfo.username || !personInfo.password) {
        res.send('Please enter the valid details');
    } else {
        try {
            const check = await staff.findOne({ username: personInfo.username, password : personInfo.password});
            if (check) {
                req.session.userId = check._id;
                res.redirect('/home');
            } else {
                res.send('Incorrect username or password');
            }
        } catch (err) {
            console.log(err);
            res.status(500).send('Internal server error');
        }
    }
});

// Defining schema for order items
const orderItemsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { data: Buffer, contentType: String }
});

const orderItems = mongoose.model('orderItems', orderItemsSchema);

// Defining collections for order items
app.get('/additem',isAutaumticated, (req, res) => {
    res.render('add');
});

// Adding of food item
app.post('/upload',isAutaumticated, upload.single('image'), async (req, res) => {
    const orderItemsInfo = req.body;
    const image = req.file;

    if (!image || !orderItemsInfo.name || !orderItemsInfo.price) {
        res.status(400).send('Please submit a valid file and provide product name and price');
    } else {
        const newOrderItems = new orderItems({
            name: orderItemsInfo.name,
            price: orderItemsInfo.price,
            image: {
                data: image.buffer,
                contentType: image.mimetype
            }
        });

        try {
            await newOrderItems.save();
            res.status(200).send('Product saved successfully');
        } catch (err) {
            res.status(500).send('An error occurred');
            console.log(err);
        }
    }
});

// Rendering home page with products
app.get('/home', isAutaumticated, async (req, res) => {
    try {
        const products = await orderItems.find({});
        const productsWithBase64Images = products.map(orderItem => {
            if (orderItem.image && orderItem.image.data && orderItem.image.contentType) {
                return {
                    ...orderItem._doc,
                    image: {
                        data: orderItem.image.data.toString('base64'),
                        contentType: orderItem.image.contentType
                    }
                };
            } else {
                return orderItem._doc;
            }
        });
        res.render('home', { products: productsWithBase64Images });
    } catch (err) {
        console.log('An error occurred', err);
        res.status(500).send('Error occurred');
    }
});


//order items schema
const ordersSchema = mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    dept : {
        type : String,
        required : true
    },
    item : {
        type : String,
        required : true
    },
    price : {
        type : Number,
    },
    status : {
        type : String,
        required : true
    }
});

const orders = mongoose.model('orders', ordersSchema);

app.post('/orders', isAutaumticated, async(req, res)=>{
    const ordersInfo = req.body;
    console.log(ordersInfo)
    if(!ordersInfo.name || !ordersInfo.price){
        res.send('invalid order');
    } else{
        const loginUserId = req.session.userId;
        if(loginUserId){
            try{
                const loginUser = await staff.findById(loginUserId);
                if(loginUser){
                    const newOrders = new orders({
                        name : loginUser.fname + " "+loginUser.lname,
                        dept : loginUser.dept,
                        item : ordersInfo.name,
                        price : ordersInfo.price,
                        status : "pending",
                    });
                    
                    try{
                        await newOrders.save();
                        res.send('order submited successfuly');
                    } catch(err){
                        console.log(err);
                        res.status(500).send('and error ocurred');
                    }
                } else{
                    res.send('User not found');
                }
            } catch(err){
                console.log(err);
                res.send('an error occured');
            }
        } else{
            res.send('user not loged in');
        }
    }
})

app.get('/myorders', isAutaumticated, async(req, res)=>{
     const loginUserId = req.session.userId;
     if(loginUserId){
        try{
            const loginUser = await orders.findById(loginUserId);
            if(loginUser){
                console.log(loginUser);
                res.send('succes')
            } else{
                res.send('user not found');
            }
        } catch(err){
            console.log(err);
            res.status(500).send('internal server error');
        }
     }
})