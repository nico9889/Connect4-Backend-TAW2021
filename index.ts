import http = require('http')

import mongoose = require('mongoose');

import express = require('express');
import cors = require('cors');

import {Role} from './models/User';
import * as user from './models/User';

import {userRouter} from './routers/user_router'
import {authRouter} from "./routers/auth_router";
import {NextFunction} from "express";
import {leaderboardRouter} from "./routers/leaderboard_router";
import {notificationsRouter} from "./routers/notifications_router";
import {friendRouter} from "./routers/friend_router";

let app = express();

// ExpressJS Middleware
app.use(cors());
app.use(express.json());

// Routers
app.use("/v1/", authRouter);
app.use("/v1/users", userRouter);
app.use("/v1/leaderboard", leaderboardRouter);
app.use("/v1/notifications", notificationsRouter);
app.use("/v1/friendship", friendRouter);

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
            server.listen(8080,"0.0.0.0", () => console.log("HTTP Server started on port 8080"));
        })
    .catch(
        (err) => {
            console.log("Error Occurred during initialization");
            console.log(err);
        }
    )

