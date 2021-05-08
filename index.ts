import http = require('http')

import mongoose = require('mongoose');

import express = require('express');
import cors = require('cors');

import {Role} from './models/User';
import * as user from './models/User';

import {user_router} from './routers/user_router'
import {auth_router} from "./routers/auth_router";
import {NextFunction} from "express";

let app = express();

// ExpressJS Middleware
app.use(cors());
app.use(express.json());

// Routers
app.use("/v1/users", user_router);
app.use("/v1/", auth_router);

// Error handling middleware
// @ts-ignore
app.use((err: ServerError, req: Request, res: Response, next: NextFunction) => {
    console.log("Request error: " + JSON.stringify(err));
    console.log(err);
    let statusCode = err.status || 500;
    // @ts-ignore
    res.status(statusCode).json({statusCode: statusCode, error: true, message: err.message});
});

// Mongoose settings to avoid deprecation warning
mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);
mongoose.set('useCreateIndex', true);

// Mongoose initialization and server start
mongoose.connect('mongodb://127.0.0.1:27017/connect4-874273')
    .then(
        () => {
            console.log("Connected to MongoDB");
            return user.getModel().findOne({username: "admin"});
        }
    ).then(
    (doc) => {  // If we don't have any admin in the database we create one with a random password
        if (!doc) {
            console.log("Creating admin user");
            let u = user.newUser({
                username: "admin",
                enabled: true
            });
            u.setRole(Role.ADMIN);
            u.setRole(Role.MODERATOR);
            let r = Math.random().toString(36).substring(7);
            console.log("Administrator password: " + r + "\nChange it asap!");
            u.setPassword(r);
            return u.save();
        }
    })
    .then(      // Once database is initialized we start the HTTP server
        () => {
            let server = http.createServer(app);
            server.listen(8080, () => console.log("HTTP Server started on port 8080"));
        })
    .catch(
        (err) => {
            console.log("Error Occurred during initialization");
            console.log(err);
        }
    )

