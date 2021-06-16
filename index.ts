// HTTP Server
import http = require('http')

// Mongoose
import mongoose = require('mongoose');

// Express
import express = require('express');
// Express Middleware
import cors = require('cors');

// Socket.io
import {Server} from 'socket.io';

// User model
import * as user from './models/User';

// Routers
import {userRouter} from './routers/user_router'
import {users2Router} from "./routers/users2_router";
import {authRouter} from "./routers/auth_router";
import {leaderboardRouter} from "./routers/leaderboard_router";
import {notificationsRouter} from "./routers/notifications_router";
import {friendRouter} from "./routers/friend_router";
import {messageRouter} from "./routers/message_route";
import {gameRouter, rankedQueue, scrimmageQueue} from "./routers/game_router";

// Socket.io authentication
import {authorize} from "@thream/socketio-jwt";
import {InMemorySessionStore} from './utils/session';

// Types needed by TypeScript (strict mode)
import {DefaultEventsMap} from 'socket.io/dist/typed-events';

// First time admin random password creation
import crypto = require('crypto');


// Socket.io server
export let io: Server<DefaultEventsMap, DefaultEventsMap>;
// Socket.io SessionMap
export const sessionStore = new InMemorySessionStore();

let app = express();

const hostname: string | undefined = undefined;
const port: number = 8080;

// ExpressJS Middleware
app.use(cors());
// @ts-ignore
app.use(express.json());

// Routers
app.use("/v1/", authRouter);
app.use("/v1/users", userRouter);
app.use("/v2/users", users2Router);
app.use("/v1/leaderboard", leaderboardRouter);
app.use("/v1/notifications", notificationsRouter);
app.use("/v1/friendship", friendRouter);
app.use("/v1/messages", messageRouter);
app.use("/v1/game", gameRouter);

// @ts-ignore
app.use((err, req, res, _) => {
    console.log(err);
    const statusCode = err.status || 500;
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
    (admin) => {  // If we don't have any admin in the database we create one with a random password
        if (!admin) {
            console.log("Creating admin user");
            let u = user.newUser({
                username: "admin",
                enabled: true
            });
            u.setRole(user.Role.ADMIN);
            u.setRole(user.Role.MODERATOR);
            let r = crypto.randomBytes(20).toString('hex');
            console.log("Administrator password: " + r + "\nChange it asap!");
            u.setPassword(r);
            return u.save();
        }
    })
    .then(      // Once database is initialized we start the HTTP server
        () => {
            // Creating new HTTP server
            let server = http.createServer(app);

            // Make HTTP server to listen on the specified port and hostname. If hostname is missing then it's listening
            // from every connection
            server.listen(port, (hostname) ? hostname : "0.0.0.0", () => console.log("HTTP Server started on port 8080"));

            // Creating new socket.io server. CORS options need to be specified from v3.0
            io = new Server(server, {
                cors: {
                    origin: (hostname) ? [hostname] : '*',
                }
            });


            // Configure Socket.io to authenticate the user with the token provided by ExpressJS-JWT
            io.use(authorize({
                algorithms: ['HS256'],
                // @ts-ignore
                secret: process.env.JWT_SECRET,
                onAuthentication: async decodedToken => {
                    return {
                        id: decodedToken.id,
                        username: decodedToken.username,
                        roles: decodedToken.roles,
                    }
                }
            }))

            // Once a user connect it will be put on a room with its on Unique ID as a name.
            // The server will send the user specific notification on this room.
            // All the friends already connected will be notified that a friend has connected/disconnected, and they
            // have to refresh the friends list
            io.on('connection', (socket => {
                sessionStore.saveSession(socket.user.id, {online: true, game: ''});
                console.log("User subscribed through socket: " + socket.user.username);
                socket.join(socket.user.id);

                // Check the user's friends and notify them if they are online
                user.getModel().findOne({_id: socket.user.id}, {friends: 1}).then((user) => {
                    if (user) {
                        for (let friend of user.friends) {
                            const response = [];
                            if (sessionStore.findSession(friend.toString())?.online) {
                                response.push(friend.toString());
                                socket.to(friend.toString()).emit('friend online', {id: socket.user.id});
                            }
                        }
                    }
                })

                socket.on('disconnect', (_) => {
                    if (socket.user) {
                        user.getModel().findOne({_id: socket.user.id}, {friends: 1}).then((user) => {
                            if (user) {
                                for (let friend of user.friends) {
                                    if (sessionStore.findSession(friend.toString())?.online) {
                                        socket.to(friend.toString()).emit('friend offline', {id: socket.user.id});
                                    }
                                }
                            }
                        })
                        // If the user disconnect we remove him from the queues and warn the user if it was in queue
                        if (rankedQueue.delete(socket.user.id) || scrimmageQueue.delete(socket.user.id)) {
                            io.emit("queue update");
                        }
                    }
                    sessionStore.saveSession(socket.user.id, {online: false, game: ''});
                })
            }));
        })
    .catch(
        (err) => {
            console.log("Error Occurred during initialization");
            console.log(err);
        }
    )
