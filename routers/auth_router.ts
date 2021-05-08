import express = require('express');
import jsonwebtoken = require('jsonwebtoken');
import {passport} from '../auth';
import * as user from '../models/User';

export let auth_router = express.Router()

auth_router.get("/login", passport.authenticate('basic', {session: false}), (req, res, next) => {
    if (req.user) {
        let token_data = {
            id: req.user.id,
            username: req.user.username,
            roles: req.user.roles
        };
        console.log("Login granted. Generating token");
        // @ts-ignore
        let token_signed = jsonwebtoken.sign(token_data, process.env.JWT_SECRET, {expiresIn: '1h'});

        return res.status(200).json({error: false, errormessage: "", token: token_signed});
    } else {
        return res.status(500).json({error: true, errormessage: ""})
    }
});

auth_router.post("/register", (req, res, next) => {
    if(req.body.username && req.body.password ){
        let u = user.newUser({username: req.body.username, enabled: false});
        u.setPassword(req.body.password);
        u.save().then((data) => {
            return res.status(200).json({error: false, message: "", id: data._id});
        }).catch((reason) => {
            if (reason.code === 11000)
                return next({statusCode: 500, error: true, errormessage: "User already exists"});
            return next({status: 500, error: true, message: reason.message});
        })
    }else{
        return next({status: 500, error: true, message: "Missing username"});
    }
});

