import jwt = require("express-jwt");
export import passport = require('passport');
import passportHTTP = require('passport-http');
import * as user from './models/User';
import {User} from "./models/User";

// @ts-ignore
export let auth = jwt({algorithms: ['HS256'], secret: process.env.JWT_SECRET});

declare global {
    namespace Express {
        interface User {
            id: string,
            username: string,
            roles: string[],
            enabled: boolean,
        }
    }
}

passport.use(new passportHTTP.BasicStrategy(
    function (username, password, done) {
        console.log("New login attempt from " + username);
        user.getModel().findOne({username: username}, (err: any, user: User) => {
            if (err) {
                console.error(err)
                return done({statusCode: 500, error: true});
            }
            if (!user) {
                console.error("Login attempt with wrong username: " + username);
                // @ts-ignore
                return done(null, false, {status: 500, error: true, message: "Invalid username"});
            }
            if(user.enabled) {
                if (user.validatePassword(password)) {
                    return done(null, user);
                }
                console.error("User attempted to login with wrong password");
                // @ts-ignore
                return done(null, false, {status: 500, error: true, message: "Invalid password"});
            }else{
                console.error("Disabled user tried to login");
                // @ts-ignore
                return done(null, false, {status: 500, error: true, message: "User not enabled"});
            }
        })
    }
));
