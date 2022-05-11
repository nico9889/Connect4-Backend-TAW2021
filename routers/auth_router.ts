import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
import passport from 'passport';
import {auth, moderator, token} from '../utils/auth';
import * as user from '../models/User';
import {Role} from "../models/User";
import {body, validationResult} from "express-validator";

export const authRouter = express.Router()

// Login endpoint: it makes use of passport middleware to authenticate the user and send back to the user the JWT token
authRouter.get("/login", passport.authenticate('basic', {session: false}), (req, res) => {
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
    const token_signed = jsonwebtoken.sign(token_data, token, {expiresIn: '1h'});

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
authRouter.post("/register",
    body('username', 'Missing or invalid username. Username must be alphanumeric, minimum 2 and maximum 32 characters length.').exists()
        .isAlphanumeric().isLength({min: 4, max: 32}),
    body('password', "Password must contain at least 8 characters, 1 uppercase, 1 lowercase and 1 number").exists()
        .isStrongPassword({
            minLength: 8,
            minUppercase: 1,
            minLowercase: 1,
            minNumbers: 1,
            minSymbols: 0
        }),
    (req, res, next) => {
        const result = validationResult(req);
        if (!result.isEmpty()) {
            const messages = [];
            for (let val of result.array()) {
                messages.push(val.msg);
            }
            console.error(result.array())
            return next({status: 403, error: true, message: messages})
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
authRouter.post("/moderator/register", auth,
    moderator,
    body('username', 'Missing or invalid username. Username must be alphanumeric, minimum 2 and maximum 32 characters length.').exists()
        .isAlphanumeric().isLength({min: 4, max: 32}),
    body('password', "Password must contain at least 8 characters, 1 uppercase, 1 lowercase and 1 number").exists()
        .isStrongPassword({
            minLength: 8,
            minUppercase: 1,
            minLowercase: 1,
            minNumbers: 1,
            minSymbols: 0
        }),
    (req, res, next) => {
        if (!req.user) {
            return next({status: 500, error: true, message: "Generic error occurred"});
        }

        if (!req.user.roles.includes(Role.MODERATOR)) {
            return next({status: 403, error: true, message: "Unauthorized"});
        }

        const result = validationResult(req);
        if (!result.isEmpty()) {
            const messages = [];
            for (let val of result.array()) {
                messages.push(val.msg);
            }
            console.error(result.array())
            return next({status: 403, error: true, message: messages})
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


