
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
const { warn, assert, count } = require('console');
const { statfs } = require('fs');
const { escape } = require('querystring');

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
const staffs = mongoose.model('staffs', personSchema);

const wardSchema = mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    head : {
        type : String,
        required : true
    }
})

const wards = mongoose.model('wards', wardSchema);
const deptSchema = mongoose.Schema({
    deptName : {
        type : String,
        required : true
    },
    head : {
        type :String,
        required : true
    }
})

const depts = mongoose.model('depts',deptSchema);


// Getting the add new user page
app.get('/registernew',isAuthenticated, async(req, res) => {
    const deptt =  await depts.find({});
    console.log(deptt);
    res.render('registerstaff', {
        deptt : deptt
    });
});

// Posting the new user to the database
app.post('/registernew', isAuthenticated, async (req, res) => {
    const personInfo = req.body;

    // Check if all required fields are present
    if (!personInfo.fname || !personInfo.lname || !personInfo.username || !personInfo.dept || !personInfo.password || !personInfo.email) {
        return res.send('Please enter valid details');
    }

    const loginUserId = req.session.userId;

    if (!loginUserId) {
        return res.send('User not logged in');
    }

    try {
        const loginUser = await staffs.findById(loginUserId);

        // Check if the logged-in user is an admin
        if (loginUser.role !== 'admin') {
            return res.send('You do not have permission to register new users: ' + loginUser.role);
        }

        // Check if username or email already exists
        const check = await staffs.findOne({
            $or: [
                { username: personInfo.username },
                { email: personInfo.email }
            ]
        });
        if (check) {
            if (check.username === personInfo.username) {
                return res.send('Username already exists, please use a different username');
            } else if (check.email === personInfo.email) {
                return res.send('Email already exists, please use a different email');
            }
        }

        // Create and save the new user
        const newPerson = new staffs({
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
        res.send('New person added successfully');
        
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal server error');
    }
});


//rout for login page
app.get('/login', async(req, res)=>{
    res.render('login',{
        title : "Login"
    })
})

//validating login before proceeding to homepage
app.post('/login', async(req, res)=>{
    const staffInfo = req.body;
    if(!staffInfo.password || !staffInfo.username){
        res.status(400).send('invalid or incomplete details');
    } else{
        try{
            const check = await staffs.findOne({username: staffInfo.username, password: staffInfo.password});
            if(check){
                req.session.userId = check._id;
                res.redirect('/');
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

const meals = mongoose.model('meals', mealsItemsSchema);

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
app.get('/', isAuthenticated, async (req, res) => {
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
    },
    delivery : String,
    action : {
        type : String,
        required : true
    }
});

const orders = mongoose.model('orders', ordersSchema);

//rrout to record subbmited orders
app.post('/orders', isAuthenticated, async(req, res)=>{
    const ordersInfo = req.body;
    if(!ordersInfo.name || !ordersInfo.price){
        res.send('invalid order');
    } else{
        const loginUserId = req.session.userId;
        if(loginUserId){
            try{
                const loginUser = await staffs.findById(loginUserId);
                if(loginUser){
                    const newOrders = new orders({
                        name : loginUser.fname + " "+loginUser.lname,
                        username : loginUser.username,
                        dept : loginUser.dept,
                        item : ordersInfo.name,
                        price : ordersInfo.price,
                        status : "pending",
                        action : 'pending'
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

//rout to view made orders for the loggged in user
app.get('/myorders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try {
            const loginUser = await staffs.findById(loginUserId);
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

//rout for registering new patiends in the word
app.get('/addpatient', isAuthenticated,async (req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser){
                const check = await wards.find({name : loginUser.dept});
                if(check || loginUser.role === 'admin'){
                    res.render('registerPatient', {
                        title : "Register patent",
                        ward : loginUser.dept
                    })
                }                
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

//patiend schema
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
                        const loginUser = await staffs.findById(loginUserId);
                        if(loginUser){
                           // res.send(loginUser.fname + " "+loginUser.lname);
                           const check = await wards.findOne({name : loginUser.dept})
                           if(check){
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
                            return res.send("Action denied");
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
                const loginUser = await staffs.findById(loginUserId);
                if(loginUser){
                    try{
                        const check = await patient.findOne({patientNo : patientNoInfo, ward : loginUser.dept});
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
                const loginUser = await staffs.findById(loginUserId);
                if(loginUser){
                    const check = await staffs.find({name : loginUser.dept});
                    if(!check){
                        return res.send("Action denied");
                    } else{
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

//rout for kitchen staff
app.get('/kitchen', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        const loginUser = await staffs.findById(loginUserId);
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
            res.send('Acces denied');
        }
    } else{
        res.send('User not loged in');
    }
});

//rout for adding a meal
app.get('/addmeal', isAuthenticated,(req, res)=>{
    res.render('add', {
        title : "Add meal"
    });
});


//rout for deleting a meal
app.post('/deletemeal', isAuthenticated, async(req, res)=>{
    const  mealInfo = req.body;
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser){
                if(loginUser.dept=='kichen' || loginUser.role == 'admin'){
                    try{
                         const products = await  meals.findByIdAndDelete(mealInfo.id);
                         res.redirect('/kitchen')
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

//rout for viewing pending orders
app.get('/viewpedingordsers', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try {
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser){
                if(loginUser.dept == 'kitchen' || loginUser.role == 'admin'){
                    const products = await orders.find({status : "pending", action : pending});
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

//rout for viewing patiends
app.get('/patients', isAuthenticated, async(req, res)=>{
    
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staffs.findById(loginUserId);
            const check = await wards.find({name : loginUser.dept})
            if(check){
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
                res.send('Access denied');
            }
        }catch(err){
            console.log(err);
            res.status(500).send("Internal server error");
        }
    } else{
        res.send("User not found");
    }
});

//rout for councling orders
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
                order.action = "councled";
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

//councled orders by staff
app.get('/concledorders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staffs.findById(loginUserId);
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

//view pendin orders by kichen and admin 
app.post('/pending', isAuthenticated, async(req, res)=>{
    const ordersInfo = req.body;
    const loginUserId  = req.session.userId;
    if(loginUserId){
        try {
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser.dept == 'kitchen' || loginUser.role == 'admin'){
                if(ordersInfo.dept && ordersInfo.item){
                    try{
                        const products = await orders.find({dept : ordersInfo.dept, item : ordersInfo.item})
                        var count = 0;
                        products.forEach(element=>{
                           count++;
                        });
                        try{
                            const deptsList = await depts.find({});
                            deptsList.forEach(element=>{
                                console.log(element)
                            })
                            res.render('kitchenPending',{
                                products : products,
                                deptsList : deptsList,
                                total : count
                            })
                        } catch(err){
                            console.log(err);
                            res.send("Internal server error");
                        }
                    } catch(err){
                        console.log(err);
                        res.status(500).send("An error occured")
                    }
                } if(ordersInfo.item){
                    try{
                        const products = await orders.find({item : ordersInfo.item})
                        var count = 0;
                        products.forEach(element=>{
                           count++;
                        });
                        res.render('kitchenPending',{
                            products : products,
                            total : count
                        })
                    } catch(err){
                        console.log(err);
                        res.status(500).send("An error occured")
                    }
                }else if(ordersInfo.dept){
                    try{
                        const products = await orders.find({dept : ordersInfo.dept})
                        var count = 0;
                        products.forEach(element=>{
                           count++;
                        });
                        res.render('kitchenPending',{
                            products : products,
                            total : count
                        })
                    } catch(err){
                        console.log(err);
                        res.status(500).send("An error occured")
                    }
                } else{
                    try{
                        const products = await orders.find({})
                        var count = 0;
                        products.forEach(element=>{
                           count++;
                        });
                        res.render('kitchenPending',{
                            products : products,
                            total : count
                        })
                    } catch(err){
                        console.log(err);
                        res.status(500).send("An error occured")
                    }
                }
            } else{
                res.send("You cant acces this page");
            }
        }  catch(err){
            console.log(err);
            res.status(500).send("Internal server error");
        }
    }
});
//view filtered pending
app.get('/pending',isAuthenticated,async(req, res)=>{
    const loginUserId = req.session.userId;
    if(loginUserId){
        try{
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser.dept == 'kitchen' || loginUser.role == 'admin'){
                try{
                    const products = await orders.find({status : 'pending'});
                    var count = 0;
                    products.forEach(element=>{
                        count++;
                    })
                    try{
                        const deptsList = await depts.find({});
                        console.log(deptsList);
                        res.render('kitchenPending',{
                            products : products,
                            total : count,
                            deptsList : deptsList
                        })
                    } catch(err){
                        console.log(err);
                        res.status(500).send("internal sever error");
                    }
                } catch(err){
                    console.log(err);
                    res.status(500).send("Internal server error");
                }
            } else{
                res.send("you have no permition to acces this page");
            }
        } catch(err){
            console.log(err);
            res.status(500).send("Internal server error");
        }
    } else{
        res.send("User not found");
    }
})

//rout for adding departmet
app.get('/addDept', isAuthenticated, (req, res)=>{
    res.render('addDept');
})
//rout for storing added department to database
app.post("/addDept", isAuthenticated, async(req, res)=>{
    const {dept, head} = req.body;
    const loginUserId = req.session.userId;
    if(!dept || !head){
        return res.status(500).send("Invalid details");
    }
    if(!loginUserId){
        return res.status(401).send("User not loged in");
    }   
       try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.status(404).send('user not found');
        }
        if(loginUser.role !== 'admin'){
            res.status(403).send("Action denied");
        }

        const deptUpper = dept.toUpperCase();
        const check = await depts.findOne({deptName: deptUpper});
        if(!check){
            const newDepts = new depts({
                deptName : deptUpper,
                head : head
            })

            try{
                await newDepts.save();
                res.send("Success");
            } catch(Err){
                console.log(Err);
                res.send("internal server error");
            }
        } else{
             return res.send("Department already exist");
        }
       } catch(err){
        console.log(err);
        res.send("error");
       }
})



//rout too  mark order as deliverd by kitchen staff
app.post('/ktchnnmarkdeliverd', isAuthenticated, async(req, res) => {
    const loginUserId = req.session.userId;
    if(loginUserId) {
        try {
            const loginUser = await staffs.findById(loginUserId);
            if(loginUser.dept === 'kitchen' || loginUser.role === 'admin') {
                const { orderId } = req.body; // Assuming req.body contains orderId
                try {
                    const order = await orders.findById(orderId);
                    if(order) {
                        order.action = "delivered"; // Ensure the field name matches your schema
                        order.status = 'delivered';
                        order.delivery = loginUser.fname + " " + loginUser.lname;
                        
                        try {
                            await order.save(); // Save the updated order
                            res.send("Order delivery successful");
                        } catch(err) {
                            console.log(err);
                            res.status(500).send("Internal server error");
                        }
                    } else {
                        res.send("Order not found");
                    }
                } catch(err) {
                    console.log(err);
                    res.status(500).send("Internal server error");
                }
            } else {
                res.send("You're not allowed to perform this action");
            }
        } catch(err) {
            console.log(err);
            res.status(500).send("Internal server error");
        }
    } else {
        res.send("User not logged in");
    }
});

//list to view deliverd order by logged in user
app.get('/delivered',isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.status(404).send("User not found");
    } else{
        try {
            const loginUser = await staffs.findById(loginUserId);
            if(!loginUser){
                res.send("User not found");
            } else{}
                const product = await orders.find({username : loginUser.username, status : 'delivered' , action : "delivered"});
                res.render('delivered', {
                    products : product
                });
            } catch(err){
                res.send(err);
                console.log("Internal server error");
            }
        }
    })

//rout to cofirm delivery of order by logged in user
app.post('/confirmdelivery', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    const ordersInfo = req.body.id;
    if(!ordersInfo){
        return res.send("Invalid request")
    }

    if(!loginUserId){
        return res.send("User not loged in");
    }

    try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("user not found");
        } else{
            const product = await orders.findById(ordersInfo);
            if(!product){
                return res.send("Invalid reques");
            } else{
                product.action = 'confirmed';
                product.status = "complete"
                const check = await product.save();
                 res.send("success");
                 console.log(product);
            }
        }
    } catch(err){
        console.log(err);
        res.send("internal server error");
    }
})

//rout for getting the completed order for the logged in user
app.get('/completeprders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not logged in");
    }

    try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("User not found");
        } else{
            console.log(loginUser);
            const products = await orders.find({username : loginUser.username, status : 'complete', action : 'confirmed'});
            res.render('completeprders',{
                products : products
            })
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error");
    }
})

//rout to get the completed orders for all system users by kitchen staff
app.get('/kitchencompletedOrders', isAuthenticated, async(req, res)=>{
    const ordersInfo = req.body;
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not loged in");
    }
     try{
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            if(loginUser.dept === 'kitchen' || loginUser.role === 'admin'){
                const products = await orders.find({status : 'complete', action : 'confirmed'});
                res.render('kitchencompletedOrders', {
                    products : products
                })
            } else {
                res.send("acces dennied");
            }
        } else{
            res.send("user not found");
        }
     }catch(err){
        console.log(err);
        res.send("Internal server error");
     }
    
})

//rout to view all deliverd order by kitchen department
app.get('/Kitchendelivered', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("Not loged in");
    }

    try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("User not found");
        } else if(loginUser.dept === 'kitchen' || loginUser.role === 'admin'){
            const products = await orders.find({status : "delivered", action : 'delivered'});
            console.log(products);
            res.render('Kitchendelivered',{
                products : products
            })
        }
    } catch(err){
        console.log(err);
        res.send("internal server error");
    }
})

//rout to view all ouncled orders by kitche department
app.get('/kitchenconcledorders',isAuthenticated, async(req, res)=>{
    const loginUserId  = req.session.userId;
    if(!loginUserId){
        return res.send("User not logged in");
    }
    try{
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            if(loginUser.dept === 'kitchen' || loginUser.role === 'admin'){
                const products =await   orders.find({status : 'councled'});
                console.log(products);
                res.render('kitchenconcledorders', {
                    products : products
                })
            } else{
                return res.send("Acces denied");
            }
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error");
    }
})

//rout to add ward
app.get('/addward', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not logged in");
    }
     try{
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            if(loginUser.role === 'admin'){
                res.render('addward');
            }
        }
     } catch(err){
        console.log(err);
        res.send("interal server error")
     }
})

//rout to record new ward  added in the database
app.post('/addward', isAuthenticated, async(req, res)=>{
    const wardInfo = req.body;
    const loginUserId = req.session.userId;
    if(!wardInfo.wardname || !wardInfo.head){
        return res.send("Invalid details");
    }
    if(!loginUserId){
        return res.send("user not loged in");
    }

    try{
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            if(loginUser.role === 'admin'){
                const check = await ward.findOne({name : wardInfo.wardname.toUpperCase()});
                if(!check){
                    const newWard = new ward({
                        name : wardInfo.wardname.toUpperCase(),
                        head : wardInfo.head
                    })
                    await newWard.save();
                    res.send("Ward added succesfully");
                } else{
                    return res.send(`${wardInfo.wardname} already exists`);
                }
            } else{
                return res.send("Access denied");
            }
        } else{
            return res.send("User not found");
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error")
    }
})
//rout to make orders in the wards
app.get("/makewardorders", isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not loged in")
    }
    try {
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            const check = await wards.find({dept : loginUser.dept});
            if(check){
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
                var count  = 0;
                const patients = await patient.find({});
                patients.forEach(element=>{
                    count++;
                })
                console.log(count);
                res.render('makewardorders',{
                    products : productsWithBase64Images,
                    total : count.toString()
                });
            } else {
                return res.send("Acces denied");
            }
        } else{
            return res.send("User not found");
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error")
    }
})

//ward schema
const wardOrdersSchema = mongoose.Schema(
    {
        requester : {
            type : String,
            required : true
        },
        meal : {
            type : String,
            required : true
        },
        ward : {
            type : String,
            required : true
        },
        tatalPatients : {
            type : Number,
            required : true
        },
        price : {
            type : Number,
            required : true
        },
        status : {
            type : String,
            required : true
        },
        action : {
            type : String,
            required : true
        }
    }
)

const wardOrders = mongoose.model('wardOrders', wardOrdersSchema);

//rout to recorde orders made in the ward
app.post('/wardorder',isAuthenticated,async(req, res)=>{
    const ordersInfo = req.body;
    const loginUserId  = req.session.userId;
    if(!loginUserId){
        return res.send("User not loged in")
    }
    if(!ordersInfo.name || !ordersInfo.price){
        console.log(ordersInfo)
        return res.send("Invalid details")
    }

    try {
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("User not logged in");
        } else{
            const check = await wards.findOne({name : loginUser.dept});
            if(!check){
                return res.send("You have no permition to order")
            } else{
                var count  = 0;
                const patients = await patient.find({});
                patients.forEach(element=>{
                    count++;
                })
                if(count<ordersInfo.total){
                    res.send("Number of patients cannot exceed those in the ward")
                } else{
                    const newWardOrder = new wardOrders({
                        requester : loginUser.fname + " " + loginUser.lname,
                        meal : ordersInfo.name,
                        ward : loginUser.dept,
                        tatalPatients : ordersInfo.total,
                        price : ordersInfo.price*ordersInfo.total,
                        status : 'pending',
                        action : 'pending'
                    });

                    try{
                        await newWardOrder.save();
                        res.send("order submited succesfully");
                    } catch(err){
                        console.log(err);
                        res.send("Internal server error");
                    }
                }
            }
        }
    } catch(err){
        console.log(err);
        res.send("Internalserver error");
    }
})

app.get('/wardpending' ,isAuthenticated, async(req, res)=>{
    const filterInfo = req.body;
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not logged in");
    } 
    try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("user not found");
        } else{
            const check = await wards.findOne({name : loginUser.dept});
            if(loginUser.role === 'admin' || loginUser.dept === 'kitchen'){
                const products = await wardOrders.find({action : 'pending',status : 'pending'});
                console.log(products);
                res.render('wardpendingorder',{
                    products : products
                });
            }else if(check){
                const products = await wardOrders.find({ward : loginUser.dept, status : 'pending'});
                res.render('wardpending',{
                    products : products
                });
            } else{
                res.send("Denied");
            }
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error");
    }
});

app.post('/deliverWardOrder', isAuthenticated,async(req, res)=>{
    const ordersInfo = req.body;
   // console.log(ordersInfo.id)
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("user not loged in");
    }
    if(!ordersInfo.id){
        return res.send("Invalid details");
    }
    try{
        const loginUser = await staffs.findById(loginUserId);
        if(loginUser){
            if(loginUser.dept === 'kitchen' || loginUser.role === 'admin'){
                 const products = await wardOrders.findById(ordersInfo.id);
                 products.status = 'delivered';
                 products.action = 'delivered';
                 const check = await products.save();
                 if(check){
                    res.send("Delivered succesfully");
                 } else{
                    res.send("Failed");
                 }
            } else{
                return res.send("Action denied");
            }
        } else{
            return res.send("User not found");
        }
    } catch(err){
        console.log(err);
        res.send("internal server error");
    }
})

app.get('/wardDelivered', isAuthenticated, async (req, res) => {
    const loginUserId = req.session.userId;
    if (!loginUserId) {
        return res.status(401).send('User not logged in');
    }
    try {
        const loginUser = await staffs.findById(loginUserId);
        if (!loginUser) {
            return res.status(404).send("User not found");
        }

        const check = await wards.findOne({ name: loginUser.dept });
        if (loginUser.dept === 'kitchen' || loginUser.role === 'admin') {
            const products = await wardOrders.find({ status: 'delivered' });
            if (products.length > 0) {
                return res.render('kitwardDelivered', {
                    products: products
                });
            } else {
                return res.render('kitwardDelivered', {
                    message: "No products found"
                });
            }
        } else if (check) {
            const products = await wardOrders.find({ status: 'delivered', ward: loginUser.dept });
            if (products.length > 0) {
                return res.render('wardDelivered', {
                    products: products
                });
            } else {
                return res.render('wardDelivered', {
                    message: "No products found"
                });
            }
        } else {
            return res.status(403).send("You do not have permission to view this page");
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send("Internal server error");
    }
});


app.post('/confirmwardDelivery', isAuthenticated, async(req, res)=>{
    const ordersInfo = req.body;
    const loginUserId = req.session.userId;
    if(!ordersInfo.id){
        return res.send('In valid details')
    }
    if(!loginUserId){
        return res.send("User not loged in");
    } 
      try{
        const loginUser = await staffs.findById(loginUserId);
        if(!loginUser){
            return res.send("User not found")
        } else{
            const check = await wards.findOne({name : loginUser.dept});

            if(!check){
                return res.send("Permition denied");
            } else{
                const products = await wardOrders.findById(ordersInfo.id);
                if(products){
                    products.status = 'complete';
                    products.action = 'confirmed';
                    const confirm = await products.save();
                    if(confirm){
                        return res.send("Succes");
                    } else{
                        return res.send("Failed");
                    }
                } else{
                    return res.send("product not found");
                }
            }
        }
      } catch(err){
        console.log(err);
        res.send("internal server error");
      }    
})


app.get('/wardCompletedOrders', isAuthenticated, async(req, res)=>{
    const loginUserId = req.session.userId;
    if(!loginUserId){
        return res.send("User not loged in");
    } 

    try{
        const loginUser = await staffs.findById(loginUserId);
        const check = await wards.findOne({name : loginUser.dept});
        if(!loginUser){
            return res.send("User not found");
        } else{
            if(loginUser.dept === 'kitchen' || loginUser.role === 'admin'){
                const products = await wardOrders.find({status : 'complete', action : 'confirmed'});
                if(products.length>0){
                    return res.render('wardCompletedOrders',{
                    products : products
                    })
                 } else{
                    res.send('wardCompletedOrders');
                 }
            } else if(check){
                 const products = await wardOrders.find({ward : loginUser.dept, status : 'complete', action : 'confirmed'});
                 if(products.length>0){
                    res.render('wardCompletedOrders',{
                    products : products
                    })
                 } else{
                    res.render('wardCompletedOrders',{
                        message : "No products found"
                        })
                 }
            }
        }
    } catch(err){
        console.log(err);
        res.send("Internal server error")
    }
})