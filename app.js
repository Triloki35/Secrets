require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { Strategy } = require('passport-local');
const { authenticate } = require('passport');

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET_STRING,
    resave: false,
    saveUninitialized: true,
    cookie: {}
}));

app.use(passport.initialize());
app.use(passport.session());

// *****google Strategy************** 
// http://localhost:3000/auth/google/secrets "previously i used for local redirect"

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://secrets-kqdt.onrender.com/auth/google/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        user.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
            return cb(err, user);
        });
    }
));


// ********facebook Strategy *********
// http://localhost:3000/auth/facebook/secrets "previously i used for local redirect"

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://secrets-kqdt.onrender.com/auth/facebook/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        // console.log(profile);
        user.findOrCreate({ facebookId: profile.id, username: profile.displayName }, function (err, user) {
            return cb(err, user);
        });
    }
));


mongoose.connect("mongodb+srv://triloki35:" + process.env.DB_PASSWORD + "@cluster0.1fz6j.mongodb.net/userDB");

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    facebookId: String,
    // secrets: { type: [String], default: null } 
    secretArray: [{
        SingleSecret: String,
        like: { type: Number, default: 0 },
        dislike: { type: Number, default: 0 },
        comments: [{ type: [String], default: "No Comments" }]
    }]
});


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const user = mongoose.model('user', userSchema);

passport.use(user.createStrategy());

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username,
            picture: user.picture
        });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});


app.get("/", function (req, res) {
    res.render("home");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
        user.find({ "secretArray": { $ne: null } }, function (err, foundUsers) {
            // console.log(foundUsers);
            res.render("secrets", { FOUND_USERS: foundUsers });
        })
    }
    else {
        res.redirect("/login");
    }
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        console.log("enter");
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.get("/features", function (req, res) {
    res.render("features");
})

app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
})

app.get("/mysecret", function (req, res) {
    if (req.isAuthenticated()) {
        user.find({ username: req.user.username }, function (err, foundUsers) {
            // console.log(foundUsers[0].secretArray);
            res.render("mysecret", { FOUND_USERS: foundUsers });
        })
    }
    else {
        res.redirect("/login");
    }
})

app.post("/delete", function (req, res) {
    const selectedSecret = req.body.secretname;
    const CurrentUser = req.user.username;

    // console.log(selectedSecret);
    // console.log(CurrentUser);

    user.updateOne({ username: CurrentUser }, { "$pull": { "secretArray": { "SingleSecret": selectedSecret } } }, { safe: true, multi: true }, function (err, obj) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/mysecret")
        }
    });
})


//**** google authentication ****

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/secrets",
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });


//******facebook authentication */

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

app.post("/register", function (req, res) {

    user.register({ username: req.body.username, active: false }, req.body.password, function (err, user) {

        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets")
            })
        }

    });

});

app.post("/login", function (req, res) {

    const unkonown_user = new user({
        username: req.body.username,
        password: req.body.password
    })

    req.login(unkonown_user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    })
});


app.post("/submit", function (req, res) {
    const newSecret = req.body.secret;
    const newobj = {
        SingleSecret: req.body.secret,
        like: 0,
        dislike: 0,
        comments: ["No Comments"]
    }
    console.log(newobj);
    console.log(req.user.username);
    user.findOne({ username: req.user.username }, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            console.log(foundUser.secrets);
            // foundUser.secrets = newSecret;

            foundUser.secretArray.push(newobj);
            foundUser.save(function () {
                res.redirect("/secrets");
            });
        }
    })
})


// like dislike section

app.post("/reaction", function (req, res) {
    var flag1 = false;
    var flag2 = false;
    if (req.body.likebtn == 1) {
        var newLikeCnt = req.body.like;
        ++newLikeCnt;
        flag1 = true;
    }
    if (req.body.dislikebtn == 0) {
        var newDisLikeCnt = req.body.dislike;
        ++newDisLikeCnt;
        flag2 = true;
    }


    if (flag1) {
        user.updateOne(
            { 'username': req.body.username, 'secretArray.SingleSecret': req.body.selectedSecret },
            { '$set': { 'secretArray.$.like': newLikeCnt } }, function (err) {
                if (err)
                    console.log(err);
                else
                    res.redirect("/secrets")
            })
    }
    if (flag2) {
        user.updateOne(
            { 'username': req.body.username, 'secretArray.SingleSecret': req.body.selectedSecret },
            { '$set': { 'secretArray.$.dislike': newDisLikeCnt } }, function (err) {
                if (err)
                    console.log(err);
                else
                    res.redirect("/secrets")
            })
    }

})

app.listen(process.env.PORT || 3000, function () {
    console.log("server is running on port 3000.");
});
