const express = require("express");
const app = express();
const port = 3000;
app.listen(port, ()=>{
    console.log(`app listening on port : ${port}`);
});

/*Le packet dotenv nous permet de creer des variables d'environnement et ces variables nous permettent de cacher nos mots de passe avec .gitignore quand on deploie notre site sur github*/
const dotenv = require('dotenv').config()
//console.log(process.env) // remove this after you've confirmed it working

//Hashage de mot de passe : pour se faire, on utilise bcrypt
//const bcrypt = require('bcrypt');

//On va utiliser maintenant passport express-session passport-local-mongoose, il va nous permettre de hasher notre password et de gerer notre session
const passport = require('passport');
const session = require('express-session');
const passportLocalMongoose = require('passport-local-mongoose');

//Session
app.use(session({
    secret : "mysecret",
    resave : false,
    saveUninitialized : false
}));

//Passport
app.use(passport.session());
app.use(passport.initialize());

//Mongoose
const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://Vieux28:dL7W0xaL7fXRBHtg@cluster0.lxswl.mongodb.net/cooking?retryWrites=true&w=majority", {
            useNewUrlParser:true,useUnifiedTopology:true
    }, (err)=>{
        if(err){
            console.log(err);
        }else{
            console.log("successfully connected");
        }
    });

//Models
const User = require('./models/user');
const Reset = require('./models/reset');
const Receipe = require('./models/receipe');
const Favourite = require('./models/favourite');
const Ingredient = require('./models/ingredient');
const Schedule = require('./models/schedule');

//Passport-local-mongoose
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Le module EJS
const ejs = require("ejs");
app.set("view engine", "ejs");

//Public folder
app.use(express.static("public"));

//Body-parser
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended : false}));

//Le middleware methodOverride nous permet d'ecrire au dessus de notre methode post et pour l'initialiser, on fait :
const methodOverride = require("method-override");
app.use(methodOverride('_method'));

//Ce middleware connect-flash nous permet d'envoyer des messages à notre utilisateur pour lui montrer si il est connecte ou pas ...
const flash = require("connect-flash");
app.use(flash());
app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
})


const randToken = require('rand-token');
const nodemailer = require("nodemailer");
const user = require("./models/user");
const ingredient = require("./models/ingredient");
const receipe = require("./models/receipe");

app.get('/', (req,res)=>{
    res.render("index");
});

//accession a notre page signup.ejs et ouverture de compte pour notre utilisateur
app.get('/signup',function(req,res){
    res.render('signup');
});

app.post('/signup',(req,res)=>{
    //Avec la methode bcrypt signup et hashage de mot de passe
    /*const saltRounds = 10;
    bcrypt.hash(req.body.password, saltRounds, function(err,hash){
        const user = {
            username : req.body.username,
            password : hash
        }
        User.create(user, function (err) {
            if (err) {
                console.log(err);
            } else {
                res.render('signup');
            }
        });
    });*/

    //Avec la methode de passport-local-mongoose
    const newUser = new User ({
        username : req.body.username
    })
    User.register(newUser, req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.render('signup');
        }else{
            passport.authenticate('local')(req,res,()=>{
                res.redirect('index')
            });
        }
    });
});

//Accession a notre page login.ejs, connecter notre utilisateur et ouvrir sa session
app.get('/login',function (req,res) {
    res.render('login');
});
app.post('/login', (req,res)=>{
//Avec la methode bcrypt
    /*User.findOne({username : req.body.username}, (err,foundUser)=>{
        if(err){
            console.log(err);
        }else{
            /*if(foundUser){
                /*bcrypt.compare(req.body.password, foundUser.password, (err,result)=>{
                    if(result == true){
                        console.log("Super vous etes connectes!");
                        res.render('index');
                    }else{
                        console.log("Le mot de passe ne correspond pas!");
                        res.render('login');
                    }
                });
                    
                }else{
                    res.send("error le mot de passe ou le nom d'utilisateur n'existe pas !")
                }
            }
            
        });*/

        //Avec la methode passport, passport-local-mongoose
        const user = new User({
            username : req.body.username,
            password : req.body.password
        });
        req.login(user, function(err){
            if(err){
                console.log(err);
            }else{
                passport.authenticate('local')(req,res,function(){
                    req.flash("success", "Congratulations, you are connected !")
                    res.redirect('/dashboard')
                })
            }
        })
    });
app.get('/dashboard',isLoggedIn, (req,res)=>{
    //console.log(req.user);
    res.render("dashboard");
});

//Deconnecter notre utilisateur et fermer sa session
app.get('/logout', function(req, res){
    
    req.logout(function(err) {
      if (err){
        return next(err);
    }
        req.flash("success", "Thank you, you are now logged out !")
        res.redirect('/login');
    });
  });

//Recuperation de mot de passe oublié
app.get('/forgot', function(req,res){
    res.render('forgot');
});

app.post('/forgot', function(req, res){
    User.findOne({username : req.body.username}, function(err, userFound){
        if(err){
            console.log(err);
            res.render('login');
        }else{
            const token = randToken.generate(16);
            Reset.create({
                username : userFound.username,
                resetPasswordToken : token,
                resetPasswordExpires : Date.now() + 3600000
            });
//Envoie de message a notre utilisateur pour reinitialiser son mot de passe
            const transporter = nodemailer.createTransport({
                service : 'gmail',
                host : 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth : {
                    user : 'appcooking90@gmail.com',
                    pass : process.env.PWD //Passport app : dxkhtcklriqevwoa
                }
            });
            const mailOptions = {
                from : 'appcooking90@gmail.com',
                to : req.body.username,
                subject: 'link to reset your password',
                text : 'Click on this link to reset your password : http://localhost:3000/reset/' + token
            }
            console.log('Le mail a été envoyé');

            transporter.sendMail(mailOptions, (err,response)=>{
                if(err){
                    console.log(err);
                }else{
                    req.flash("success", "An email has been sent to your mailbox. Please click on the link to change your password !")
                    res.redirect('/login')
                }
            });
        }
    })
});

app.get("/reset/:token", function(req,res){
    Reset.findOne({
        resetPasswordToken : req.params.token,
        resetPasswordExpires : {$gt: Date.now()}
    }, function(err, obj){
        if(err){
            console.log("token expired");
            res.redirect('/login');
        }else{
            res.render('reset', {token : req.params.token});
        }
    })
});

app.post("/reset/:token", function(req,res){
    Reset.findOne({
        resetPasswordToken : req.params.token,
        resetPasswordExpires : {$gt: Date.now()}
    }, function(err, obj){
        if(err){
            console.log("token expired");
            req.flash("error", "error : token expired try again !")
            res.redirect('/login');
        }else{
            if(req.body.password == req.body.password2){
                User.findOne({username: obj.username}, function(err,user){
                    if(err){
                        console.log(err);
                    }else{
                        user.setPassword(req.body.password, function(err){
                            if (err) {
                                console.log(err);
                            } else {
                                user.save();
                                const updatedReset = {
                                    resetPasswordToken : null,
                                    resetPasswordExpires : null
                                }
                                Reset.findOneAndUpdate({resetPasswordToken : req.params.token},updatedReset, function(err,obj1){
                                    if(err){
                                        console.log(err);
                                    }else{
                                        req.flash("success", "Your password is now updated, you can log in right now !")
                                        res.redirect('/login');
                                    }
                                });
                            }
                        })
                    }
                })
            }
        }
    })

})

//Route receipe
app.get("/dashboard/myreceipes",isLoggedIn, function(req,res){
    Receipe.find({
        user : req.user.id
    }, function(err,receipe){
        if (err) {
            console.log(err);
        } else {
            res.render("receipe", {receipe : receipe})
        }
    });
});

//Fonction pour ajouter une nouvelle recette
app.get("/dashboard/newreceipe", isLoggedIn, (req,res)=>{
    res.render("newreceipe");
});

app.post("/dashboard/newreceipe", function(req,res){
    const newReceipe = {
        name : req.body.receipe,
        image : req.body.logo,
        user : req.user.id
    }
    Receipe.create(newReceipe, function(err, newReceipe){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "New receipe added");
            res.redirect("/dashboard/myreceipes");
        }
    });
});

app.get("/dashboard/myreceipes/:id", (req,res)=>{
    Receipe.findOne({
        user: req.user.id,
        _id : req.params.id
    }, (err, receipeFound)=>{
        if (err) {
            console.log(err);
        } else {
            Ingredient.find({
                user: req.user.id,
                receipe : req.params.id
            },(err, ingredientFound)=>{
                if (err) {
                    console.log(err);
                } else {
                    res.render("ingredients", {ingredient: ingredientFound, receipe : receipeFound})
                }
            })
        }
    })
})

app.delete("/dashboard/myreceipes/:id", isLoggedIn, function(req,res){
    Receipe.deleteOne({_id : req.params.id}, function(err){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "Your receipe has been deleted !");
            res.redirect("/dashboard/myreceipes");
        }
    });
});

//Ingredient Routes
app.get("/dashboard/myreceipes/:id/newingredient", function(req,res) {
    Receipe.findById({
        _id : req.params.id
    }, function(err,found){
        if (err) {
            console.log(err);
        } else {
            res.render("newingredient", {receipe : found});
        }
    })
})

app.post("/dashboard/myreceipes/:id", function(req, res){
    const newIngredient = {
        name : req.body.name,
        bestDish : req.body.dish,
        user : req.user.id,
        quantity : req.body.quantity,
        receipe : req.params.id
    }
    Ingredient.create(newIngredient, (err, newIngredient) => {
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "Your ingredient has been added !");
            res.redirect("/dashboard/myreceipes/"+ req.params.id);
        }
    })
})

//Supprimer un ingredient
app.delete("/dashboard/myreceipes/:id/:ingredientid", isLoggedIn, function(req,res){
    Ingredient.deleteOne({
        _id : req.params.ingredientid
    },function(err){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "Your ingredient has been deleted!");
            res.redirect("/dashboard/myreceipes/"+req.params.id)
        }
    });
});

//Modifier un ingredient
app.post("/dashboard/myreceipes/:id/:ingredientid/edit", isLoggedIn ,function(req,res){
    receipe.findOne({
        user : req.user.id,
        _id : req.params.id
    },function(err, receipeFound){
        if (err) {
            console.log(err);
        } else {
            Ingredient.findOne({
                _id : req.params.ingredientid,
                receipe : req.params.id
            }, function(err, ingredientFound){
                if (err) {
                    console.log(err);
                } else {
                    res.render("edit", {
                        ingredient : ingredientFound,
                        receipe : receipeFound
                    });
                }
            });
        }
    });
});

app.put("/dashboard/myreceipes/:id/:ingredientid", isLoggedIn, function(req,res){
    const ingredient_updated = {
        name : req.body.name,
        bestDish : req.body.dish,
        user : req.user.id,
        quantity : req.body.quantity,
        receipe : req.params.id
    }
    Ingredient.findByIdAndUpdate({_id : req.params.ingredientid}, ingredient_updated,
        function(err,updatedIngredient){
            if (err) {
                console.log(err);
            } else {
                req.flash("success", "successfully updated ingredient");
                res.redirect("/dashboard/myreceipes/" + req.params.id);
            }
        });
});

//Favorite Routes
app.get("/dashboard/favourites", isLoggedIn, function(req,res){
    Favourite.find({ user : req.user.id}, function(err, favourite){
        if (err) {
            console.log(err);
        } else {
            res.render("favourites", {favourite : favourite})
        }
    })
})

app.get("/dashboard/favourites/newfavourite", isLoggedIn, function(req,res){
    res.render("newfavourite")
});

app.post("/dashboard/favourites", isLoggedIn, function(req,res){
    const newFavourite = {
        image: req.body.image,
        title: req.body.title,
        description: req.body.description,
        user: req.user.id
    }
    Favourite.create(newFavourite, function(err, newFavourite){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "You just add a new  fav!");
            res.redirect("/dashboard/favourites");
        }
    });
});

app.delete("/dashboard/favourites/:id", isLoggedIn, function(req,res){
    Favourite.deleteOne({ _id : req.params.id},function(err){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "Your favourite has been deleted");
            res.redirect("/dashboard/favourites");
        }
    })
})

//Schedule Routes
app.get("/dashboard/schedule", isLoggedIn, function(req,res){
    Schedule.find({user : req.user.id}, function(err, schedule){
        if (err) {
            console.log(err);
        } else {
            res.render("schedule", {schedule : schedule});
        }
    });
});

app.get("/dashboard/schedule/newschedule", isLoggedIn, function(req,res){
    res.render("newSchedule");
});

app.post("/dashboard/schedule", function(req,res){
    const newSchedule = {
        receipeName : req.body.receipename,
        scheduleDate : req.body.scheduleDate,
        user : req.user.id,
        time : req.body.time
    }
    Schedule.create(newSchedule, function(err, newSchedule){
        if (err) {
            console.log(err);
        } else {
            req.flash("success", "You just added a new schedule !");
            res.redirect("/dashboard/schedule");
        }
    });
});

app.delete("/dashboard/schedule/:id", isLoggedIn, function(req,res){
    Schedule.deleteOne({_id : req.params.id}, function(err, schedule){
        if(err){
            console.log(err);
        }else{
            req.flash("success", "your schedule has been deleted")
            res.redirect("/dashboard/schedule")
        }
    })
})




//Fonction pour verifier si notre utilisateur est connecté ou pas
function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()){
        return next();
    }else{
        req.flash("error", "Please log in first");
        res.redirect("/login");
    }
}


