var nodemailer = require('nodemailer');
var mymail = 'dnyongesa244@gmail.com';
var transport = nodemailer.createTransport({
    service : "gmail",
    auth : {
        user : mymail,
        password : 'loyn fzcx nqzn tbel'
    }
});

var mailOptions = {
    from : mymail,
    to : "dnyongesa244@gmail.com",
    subject : "Password verification",
    text : "Password verified"
}

transport.sendMail(mailOptionsm ,(err, info)=>{
    if(err){
        console.log(err);
    } else{
        console.log("email send");
    }
});