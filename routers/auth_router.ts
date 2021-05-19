import express = require('express');
import jsonwebtoken = require('jsonwebtoken');
import {auth, passport} from '../utils/auth';
import * as user from '../models/User';
import {Role} from "../models/User";

export const authRouter = express.Router()

// Login endpoint: it makes use of passport middleware to authenticate the user and send back to the user the JWT token
authRouter.get("/login", passport.authenticate('basic', {session: false}), (req, res, next) => {
    if (!req.user) {
        return res.status(500).json({error: true, message: ""})
    }
    const token_data: Express.User = {
        id: req.user.id,
        username: req.user.username,
        roles: req.user.roles,
        enabled: req.user.enabled,
        last_password_change: req.user.last_password_change,
        registered_on: req.user.registered_on,
    };
    console.log("Login granted. Generating token");
    // @ts-ignore
    const token_signed = jsonwebtoken.sign(token_data, process.env.JWT_SECRET, {expiresIn: '1h'});

    return res.status(200).json({error: false, message: "", token: token_signed});
});


// Logout endpoint: TODO blacklist the user JWT token, so it can be reused
authRouter.get("/logout", auth, (req, res, next) => {
    if (!req.user) {
        return next({status: 500, error: true, message: "User not found"});
    }
    req.logOut();
    return res.status(200).json({error: false, message: ""});
})

// Register endpoint: create a new user, disabled by default
authRouter.post("/register", (req, res, next) => {
    if (!req.body.username) {
        return next({status: 500, error: true, message: "Missing username"});
    }

    if (!req.body.password) {
        return next({status: 500, error: true, message: "Missing password"});
    }

    if (req.body.username.length < 4 && req.body.username.length > 32) {
        return next({status: 500, error: true, message: "Username must be between 4 and 32 characters length"});
    }

    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(req.body.password)) {
        return next({
            status: 500,
            error: true,
            message: "Must contain at least one number and one uppercase and lowercase letter, and at least 8 or more characters"
        });
    }

    const u = user.newUser({username: req.body.username, enabled: false});
    u.setPassword(req.body.password);
    u.save().then((data) => {
        return res.status(200).json({error: false, message: "", id: data._id});
    }).catch((reason) => {
        if (reason.code === 11000)
            return next({statusCode: 500, error: true, message: "User already exists"});
        return next({status: 500, error: true, message: reason.message});
    })
});

// Register endpoint: create a new moderator
authRouter.post("/moderator/register", auth, (req, res, next) => {
    if (!req.user) {
        return next({status: 500, error: true, message: "Generic error occurred"});
    }

    if (!req.user.roles.includes(Role.MODERATOR) && !req.user.roles.includes(Role.ADMIN)) {
        return next({status: 403, error: true, message: "Unauthorized"});
    }

    if (!req.body.username) {
        return next({status: 500, error: true, message: "Missing username"});
    }

    if (!req.body.password) {
        return next({status: 500, error: true, message: "Missing password"});
    }

    if (req.body.username.length < 4 && req.body.username.length > 32) {
        return next({status: 500, error: true, message: "Username must be between 4 and 32 characters length"});
    }

    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(req.body.password)) {
        return next({
            status: 500,
            error: true,
            message: "Must contain at least one number and one uppercase and lowercase letter, and at least 8 or more characters"
        });
    }

    const u = user.newUser({username: req.body.username, enabled: false});
    u.setPassword(req.body.password);
    u.roles = [Role.MODERATOR];
    u.registered_on = u.last_password_change;
    u.enabled = true;
    u.save().then((data) => {
        return res.status(200).json({error: false, message: "", id: data._id});
    }).catch((reason) => {
        if (reason.code === 11000)
            return next({statusCode: 500, error: true, message: "User already exists"});
        return next({status: 500, error: true, message: reason.message});
    })
});


