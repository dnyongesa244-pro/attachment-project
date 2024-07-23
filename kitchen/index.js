
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
const { METHODS } = require('http');
const { warn, assert } = require('console');

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
    if(!staffInfo.password || !staffInfo.username){
        res.status(400).send('invalid or incomplete details');
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
const mealsItemsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { data: Buffer, contentType: String }
});

const meals = mongoose.model('orderItems', mealsItemsSchema);

// Defining collections for order items
app.get('/additem',isAuthenticated, (req, res) => {
    res.render('add');
});

// Adding of food item
app.post('/upload', isAuthenticated, upload.single('image'), async (req, res) => {
    const mealsInfo = req.body;
    const image = req.file;

    if (!image || !mealsInfo.name || !mealsInfo.price) {
        res.status(400).send('Please submit a valid file and provide product name and price');
    } else {
        const newMeals = new meals({
            name: mealsInfo.name,
            price: mealsInfo.price,
            image: {
                data: image.buffer,
                contentType: image.mimetype
            }
        });

        try {
            await newMeals.save();
            res.status(200).send('Product saved successfully');
        } catch (err) {
            res.status(500).send('An error occurred');
            console.log(err);
        }
    }
});

// Rendering home page with meals
app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const products = await meals.find({});
        const productsWithBase64Images = products.map(meal => {
            if (meal.image && meal.image.data && meal.image.contentType) {
                return {
                    ...meal._doc,
                    image: {
                        data: meal.image.data.toString('base64'),
                        contentType: meal.image.contentType
                    }
                };
            } else {
                return meal._doc;
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
                    const products = await orders.find({username : loginUser.username, status : 'pending'})
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
app.get('/addpatient', isAuthenticated,async (req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staff.findById(loginUserId);
            if(loginUser){
                res.render('registerPatient', {
                    title : "Register patent",
                    ward : loginUser.dept
                })
            } else{
                res.send('user not found');
            }
        } catch(err){
            console.log(err);
            res.status(500).send("Internal server error");
        }
    } else{
        res.send("user not logged in");
    }
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
    ward : {
        type : String,
        required : true,
    },
    regestry : {
        type : String,
        required : true,
    }
})

const patient = mongoose.model('patient',patientSchema);

//rout for storing new patients details to database
app.post('/addpatient', isAuthenticated, async(req, res)=>{
    const patientInfo = req.body;
    if(!patientInfo.fname || !patientInfo.lname || !patientInfo.patientNo || !patientInfo.ward){
        res.send('invaid or incomplete details please try again');
        console.log(patientInfo)
    } else{
        try{
            const check = await patient.findOne({patientNo : patientInfo.patientNo});
            if(check){
                res.send('patient already exist');
            } else{
                const loginUserId = req.session.userId;
                if(loginUserId){
                    try{
                        const loginUser = await staff.findById(loginUserId);
                        if(loginUser){
                           // res.send(loginUser.fname + " "+loginUser.lname);
                           const newPatient = new patient({
                            fname : patientInfo.fname,
                            lname : patientInfo.lname,
                            patientNo : patientInfo.patientNo,
                            ward : patientInfo.ward,
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

//method to remder page for patent clearend
app.get('/clearpatient', isAuthenticated,(req, res)=>{
    res.render('clearpatient'),{
        title : "Clear patient"
    };
});

//method to get the patient details
app.post('/clearpatient',isAuthenticated, async(req, res)=>{
    const patientNoInfo = req.body.patientNo;
    if(!patientNoInfo){
        res.send('invalid details');
    } else{
        const loginUserId = req.session.userId;
        if(loginUserId){
            try{
                const loginUser = await staff.findById(loginUserId);
                if(loginUser){
                    try{
                        const check = await patient.findOne({patientNo : patientNoInfo});
                        if(check){
                            res.render('rmpatient', {
                                patientNo : patientNoInfo,
                                ward : loginUser.dept,
                                name : check.fname + " " + check.lname,
                                patientId : check._id
                            });
                        } else{
                            res.send('patient douse not exist');
                        }
                    } catch(err){
                        console.log(err);
                        res.status(500).send(err);
                    }
                } else{
                    res.send("user not found");
                }
            } catch(err){
                console.log(err);
                res.status(500).send("Internal server error");
            }
        } else{
            res.send('user not logged in');
        }
    }
});

//defining the schema for cleared patients
const clearedPatientsSchema = mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    ward : {
        type : String,
        required : true
    },
    patientNo : {
        type : String,
        required : true
    }
})

//definding models for cleard patietds
const clearedPatients = mongoose.model('clearedPatients', clearedPatientsSchema);

//rout to cleare patiets and record then in cleaded patient table
app.post('/cleare', isAuthenticated, async(req, res)=>{
     const patientInfo = req.body;
     if(!patient.name || !patientInfo.ward || !patientInfo.patientNo || !patientInfo.patientId){
        res.send("Error with details");
     } else {
        const loginUserId = req.session.userId;
        if(loginUserId){
            try{
                const loginUser = await staff.findById(loginUserId);
                if(loginUser){
                    const newPatient = clearedPatients({
                        name : patientInfo.name,
                        ward : patientInfo.ward,
                        patientNo : patientInfo.patientNo
                    });

                    try {
                        const remove = await patient.findByIdAndDelete(patientInfo.patientId);
                        if(!remove){
                            res.send('patient not found');
                        } else {
                            try{
                                await newPatient.save();
                                res.send('patient cleared succesfully');
                            } catch(err){
                                console.log('err');
                                res.status(500).send('internal server error');
                            }
                        }
                    } catch(err){
                        console.log(err);
                        res.status(500).send('Internal server eror');
                    }
                } else{
                    res.send('user not found');
                }
            } catch(err){
                console.log(err);
                res.status(500).send('Internal server error');
            }
        } else{
            res.send('user not loged in');
        }
     }
})

app.get('/kitchen', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        const loginUser = await staff.findById(loginUserId);
        if(loginUser.dept=='kitchen' || loginUser.role == 'admin'){
            try{
                const products = await meals.find({});
                const productsWithBase64Images = products.map(meal=>{
                    if(meal.image && meal.image.contentType && meal.image.data){
                        return {
                            ...meal._doc,
                            image : {
                                data : meal.image.data.toString('base64'),
                                contentType : meal.image.contentType
                            }
                        } 
                    } else{
                        return meal._doc;
                    }
                })
                res.render('kitchen',{
                    products : productsWithBase64Images
                })
            } catch(err){
                console.log(err);
                res.status(500).send("Internal server error");
            }
        } else{
            res.send('user not found');
        }
    } else{
        res.send('User not loged in');
    }
});
app.get('/addmeal', isAuthenticated,(req, res)=>{
    res.render('add', {
        title : "Add meal"
    });
});


app.get('/deletemeal', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staff.findById(loginUserId);
            if(loginUser){
                console.log(loginUser)
                if(loginUser.dept=='kichen' || loginUser.role == 'admin'){
                    try{
                         const products = await  meals.find({});
                         const productsWithBase64Images = products.map(meal=>{
                            if(meal.image && meal.image.data && meal.image.contentType){
                                 return {
                                    ...meal._doc,
                                    image : meal.image.data.toString('base64'),
                                    contentType : meal.image.contentType
                                 }
                            } else{
                                return meal._doc;
                            }
                         })
                         res.render('kitchen',{
                            products : productsWithBase64Images
                        })
                    } catch(err){
                        console.log(err);
                        res.status(500).send('Internal server error');
                    }
                } else{
                    res.send('you have no permition to acces this page');
                }
            }
        } catch(err){
            console.log(err);
            res.status(500).send("Internal servr error");
        }
    }
})

app.get('/viewpedingordsers', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try {
            const loginUser = await staff.findById(loginUserId);
            if(loginUser){
                if(loginUser.dept == 'kitchen' || loginUser.role == 'admin'){
                    const products = await orders.find({status : "pending"});
                    console.log(products)
                    res.render('pending', {
                        products : products
                    })
                } else {
                    res.render("You have no permition to acces this page");
                }
            } else{
                res.render("user not found");
            }
        } catch(err){
            console.log(err);
            res.status(500).render("Internal server error");
        }
    } else{
        res.send("User not logged in");
    }
});

app.get('/patients', isAuthenticated, async(req, res)=>{
    
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staff.findById(loginUserId);
            if(loginUser.dept == 'kitchen' || loginUser.role == 'admin'){
                try {
                    const patientDetails = await patient.find({ward : loginUser.dept});
                    var count = 0;
                    patientDetails.forEach(element=>{
                        count++;
                    })
                    res.render('patients', {
                        details : patientDetails,
                        total : count,
                        ward : loginUser.dept
                    })
                } catch(err){
                    console.log(err);
                    res.status(500).send('Internal server error');
                }
            } else{
                res.send('User not found');
            }
        }catch(err){
            console.log(err);
            res.status(500).send("Internal server error");
        }
    } else{
        res.send("User not found");
    }
});

app.post('/concledorders', isAuthenticated, async(req, res)=>{
    const ordersInfo = req.body.id;
    if(!ordersInfo){
        res.send("An error occured");
    } else{
        try {
            const order = await orders.findById(ordersInfo);
            if(!order){
                res.status(404).send("Order not found");
            } else{
                order.status = "councled";
                try {
                    await order.save();
                    res.send("order councled succesfuly");
                } catch(err){
                    console.log(err);
                    res.status(500).send("Internal server error");
                }
            }
        } catch(err){
            console.log(err);
            res.send("Internal server error");
        }
    }
})

app.get('/concledorders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staff.findById(loginUserId);
            if(loginUser){
                try {
                    const product = await orders.find({username : loginUser.username , status : 'councled'});
                    res.render('councledOrders', {
                        products : product
                    })
                } catch(err){
                    console.log(err);
                    res.status(500).send("Internal server error");
                }
            } else {
                res.send("User not found");
            }
        } catch(err){
            console.log(err);
            res.status(500).send("Internal server error")
        }
    } else{
        res.send("user not loged in");
    }
});

//app.post('pendings')