
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
const { title } = require('process');

app.engine('hbs', exphbs.engine({
    extname: ".hbs",
    partialsDir: path.join(__dirname, "views", 'partials'),
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    runtimeOptions : {
        allowProtoMethodsByDefault : true,
        allowProtoPropertiesByDefault : true
    }
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
    cookie : {maxAge : 24*60*60*6.9444}
}))

function isAuthenticated(req, res, next){
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
app.get('/registernew',isAuthenticated, (req, res) => {
    res.render('registerstaff');
});

// Posting the new user to the database
app.post('/registernew', isAuthenticated, async (req, res) =>{
    const personInfo = req.body;
    console.log(personInfo);
    if (!personInfo.fname || !personInfo.lname || !personInfo.username || !personInfo.dept || !personInfo.password){
            res.send('Please enter valid details');
        } else {
            const loginUserId = req.session.userId;
            if(loginUserId){ 
                try {
                    const loginUser = await staff.findById(loginUserId);
                    if(loginUser.role== 'admin')  {
                        const check = await staff.findOne({ username: personInfo.username });
                        if (check) {
                            res.send('User already exists');
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
                            try {
                                await newPerson.save();
                                res.send('New person added successfully');
                            } catch (err){
                                console.log(err);
                                res.status(500).send('Internal server error');
                            }
                        }
                    } else{
                        res.send('you have no permition to register new users: '+loginUser.role);
                        console.log(loginUser)
                    }   
                } catch(err){
                    console.log(err);
                    res.status(500).send('internal server errror');
                }  

            } else{
                res.send('user not logged in');
            }
        }     
});

//rout for login page
app.get('/login', async(req, res)=>{
    res.render('login',{
        title : "Login"
    })
})

app.post('/login', async(req, res)=>{
    const staffInfo = req.body;
    var count = 1;
    console.log(count + " " +staffInfo);
    count++;
    if(!staffInfo.password || !staffInfo.username){
        res.status(400).send('invalid or incomplete details');
        console.log(count + " " + staffInfo);
    count++;
    } else{
        try{
            const check = await staff.findOne({username: staffInfo.username, password: staffInfo.password});
            if(check){
                req.session.userId = check._id;
                res.redirect('/home');
            } else{
                res.send("invalid Username or password");            }
        } catch(err){
            console.log(err);
            res.status(err).send('Internall server error')
        }
    }
})
// Defining schema for order items
const orderItemsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { data: Buffer, contentType: String }
});

const orderItems = mongoose.model('orderItems', orderItemsSchema);

// Defining collections for order items
app.get('/additem',isAuthenticated, (req, res) => {
    res.render('add');
});

// Adding of food item
app.post('/upload', isAuthenticated, upload.single('image'), async (req, res) => {
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
app.get('/home', isAuthenticated, async (req, res) => {
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
    username : {
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

app.post('/orders', isAuthenticated, async(req, res)=>{
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
                        username : loginUser.username,
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

app.get('/myorders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try {
            const loginUser = await staff.findById(loginUserId);
            if(loginUser){
                try{
                    const products = await orders.find({username : loginUser.username})
                    console.log(products);
                    res.render('myorders', {
                        title : "my orders",
                        products : products
                    })
                } catch(err){
                    console.log(err);
                    res.status(500).send("Internal server error");
                }
            } else{
                res.send('user not found');
            }
        } catch(err){
            console.log(err);
            res.status(500).send('Internal server error');
        }
    } else{
        res.send('user not loged in')
    }
})

//method to render the wards page
app.get('/ward', isAuthenticated,(req, res)=>{
    res.render('ward');
});

//
app.get('/addpatient', isAuthenticated, (req, res)=>{
    res.render('addpatient', {
        title : "Register patent"
    })
})

const patientSchema = mongoose.Schema({
    fname : {
        type : String,
        required : true
    }, lname : {
        type : String,
        required : true
    },
    patientNo : {
        type : String,
        required : true
    },
    regestry : {
        type : String,
        required : true,
    }
})

const patient = mongoose.model('patient',patientSchema);


app.post('/addpatient', isAuthenticated, async(req, res)=>{
    const patientInfo = req.body;
    if(!patientInfo.fname || !patientInfo.lname || !patientInfo.patientNo){
        res.send('invaid or incomplete details please try again');
    } else{
        try{
            const check = await staff.findOne({patientNo : patientInfo.patientNo});
            if(check){
                res.send('patient already exist');
            } else{
                const loginUserId = req.session.userId;
                if(loginUserId){
                    try{
                        const loginUser = await person.findById(loginUserId);
                        if(loginUser){
                           // res.send(loginUser.fname + " "+loginUser.lname);
                           const newPatient = new patient({
                            fname : patientInfo.fname,
                            lname : patientInfo.lname,
                            patientNo : patientInfo.patientNo,
                            regestry : loginUser.fname + " "+loginUser.lname
                            });

                           try{
                            await newPatient.save();
                                 res.send('patient registered succesfuly');
                            } catch(err){
                                 console.log(err);
                                 res.status(500).send('am error ocured');
                            }
                        } else{
                            res.send("User not found");
                        }
                    } catch(err){
                        console.log(err);
                        res.status(500).send('Internal server error');
                    }
                } else{
                    res.send("User not loged in");
                }
            } 
        } catch(err){
            console.log(err);
            res.status(500).send('Internal server error');
        }
    }
})