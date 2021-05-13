import http = require('http')

import mongoose = require('mongoose');

import {Server} from 'socket.io';
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
import {DefaultEventsMap} from 'socket.io/dist/typed-events';
import {Socket} from "socket.io/dist/socket";
import {authorize} from "@thream/socketio-jwt";
import {InMemorySessionStore} from './utils/session';
import {messageRouter} from "./routers/message_route";
import {gameRouter} from "./routers/game_router";

export let io: Server<DefaultEventsMap, DefaultEventsMap>;
export const sessionStore = new InMemorySessionStore();

let app = express();

const hostname: string | undefined = undefined;
const port: number = 8080;

// ExpressJS Middleware
app.use(cors());
app.use(express.json());

// Routers
app.use("/v1/", authRouter);
app.use("/v1/users", userRouter);
app.use("/v1/leaderboard", leaderboardRouter);
app.use("/v1/notifications", notificationsRouter);
app.use("/v1/friendship", friendRouter);
app.use("/v1/messages", messageRouter);
app.use("/v1/game", gameRouter);

// Error handling middleware
// @ts-ignore
app.use((err: ServerError, req: Request, res: Response, next: NextFunction) => {
    console.log("Request error: " + JSON.stringify(err));
    console.log(err);
    let statusCode = err.status || 500;
    // @ts-ignore
    res.status(statusCode).json({statusCode: statusCode, error: true, message: err.message});
});

// This interface is needed to avoid TypeScript Type Error because of the missing properties on Socket Type
interface AuthSocket extends Socket {
    sessionID?: string,
    userID?: string,
}

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
            server.listen(port, "0.0.0.0", () => console.log("HTTP Server started on port 8080"));
            io = new Server(server, {
                cors: {
                    origin: hostname || '*',
                }
            });

            io.use(authorize({
                algorithms: ['HS256'],
                // @ts-ignore
                secret: process.env.JWT_SECRET,
                onAuthentication: async decodedToken => {
                    return {
                        id: decodedToken.id,
                        username : decodedToken.username,
                        roles: decodedToken.roles,
                    }
                }
            }))

            io.on('connection', (socket => {
                sessionStore.saveSession(socket.user.id, true);
                io.emit('broadcast','users');
                socket.join(socket.user.id);
                user.getModel().findOne({_id: socket.user.id}).then((user) => {
                    if(user){
                        for(let friend of user.friends){
                            if(sessionStore.findSession(friend.toString())){
                                socket.to(friend.toString()).emit('friend update');
                            }
                        }
                    }
                })
                socket.on('disconnect', (listener) => {
                    if(socket.user) {
                        user.getModel().findOne({_id: socket.user.id}).then((user) => {
                            if (user) {
                                for (let friend of user.friends) {
                                    if (sessionStore.findSession(friend.toString())) {
                                        socket.to(friend.toString()).emit('friend update');
                                    }
                                }
                            }
                        })
                    }
                    sessionStore.saveSession(socket.user.id, false);
                })
            }));

            if (!hostname) {
                console.log("Hostname is undefined. Using CORS Origin = '*'.")
            }
        })
    .catch(
        (err) => {
            console.log("Error Occurred during initialization");
            console.log(err);
        }
    )
