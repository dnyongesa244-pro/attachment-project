const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');

app.engine('hbs', exphbs.engine({
    extname : ".hbs",
    partialsDir : path.join(__dirname,"views",'partials'),
    layoutDir : path.join(__dirname,'views','layouts')
}));

app.set('view engine','hbs');
app.set('views',path.join(__dirname,'views'));;
app.use(express.json());
app.use(express.urlencoded({extended: true}));

//setting upp mongodb database connection
mongoose.connect('mongodb://localhost:27017/kitchen')
.then(()=>{
    console.log('database connected succesfully');
    app.listen(port,()=>{
        console.log(`server rinning on port ${port}`);
    });
})
.catch(err=>{
    console.log(err);
});

//defining the database schema
const personSchema = mongoose.Schema({
    fname : {
        type : String,
        required : true
    },
    sname : {
        type : String
    },
    lname : {
        type : String,
        required : true
    },
    username : {
        type : String,
        required : true
    },
    dept : {
        required : true,
        type : String
    },
    email : {
        required : true,
        type :String
    },
    phoneNo : {
        type : Number,
        required : true
    },
    role : {
        type : String,
        required : true
    },
    password : {
        type : String,
        required : true
    }
});

//definng the collection
const staff = mongoose.model('staff',personSchema);

//getting the addnewuser page
app.get('/addNew',(req, res)=>{
    res.render('addNew');
})

//posting the new user to the database
app.post('/addnew',async(req, res)=>{
    //getting the response from the addnew page form
    const personInfo = req.body;
    //cheking if all the required data have been recieved
    if(!personInfo.lname||!personInfo.lname||!personInfo.username||!personInfo.dept||!personInfo.email||!personInfo.password||!personInfo.phoneNo||!personInfo.role){
        res.send('please enter correct information');//sending response for incorect infotmation
        //res.render('addUser');
    } else{
        const check = await staff.findOne({username : personInfo.username},{email : personInfo.email});
        if(check.username===personInfo.username && check.email === personInfo.password){
            res.send(`user with username : ${check.username} and email: ${check.email} already exist`);
        } else if(check.username === personInfo.username){
            res.send(`username : ${check.username} already exist please try a differnd username`);
        } else if(check.email===personInfo.email){
            res.send(`user with email : ${check.email} already exist`);
        } else {
            const  newPerson = new staff({
                fname : personInfo.fname,
                sname : personInfo.sname,
                lname : personInfo.lname,
                username : personInfo.username,
                dept : personInfo.dept,
                email : personInfo.email,
                phoneNo : personInfo.phoneNo,
                role : personInfo.role,
                password : personInfo.password
            });

            try {
                await newPerson.save();
                res.send('New user created succesfully');
            } catch(err){
                console.log(err);
                res.send('an error occures  ');
                res.send(err);
            }try {
                await newPerson.save();
                res.send('New user created succesfully');
            } catch(err){
                console.log(err);
                res.send('an error occures  ');
                res.send(err);
            }
        }
    }
});
//displaying login form
app.get('/login',(req, res)=>{
    res.render('login');
});


//verifying login and open of home page
app.post('/login',async(req, res)=>{
    const personInfo = req.body;
    if(!personInfo.username||!personInfo.password){
        res.send('please enter the valid details');
    } else{
        try{
            const check = await staff.findOne({password : personInfo.password,username : personInfo.username});
            if(check && check.password=== personInfo.password && check.username === personInfo.username){
                res.render('home');
            } else{
                res.send('incorect username or password');
            }
        } catch(err){
            console.log(err);
            res.status(500).send('internal server error');
        }
    }
});
