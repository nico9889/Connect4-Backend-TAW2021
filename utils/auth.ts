import {expressjwt as jwt} from "express-jwt";
import passport from 'passport';
import passportHTTP from 'passport-http';
import * as user from '../models/User';
import {Role, User} from "../models/User";
import crypto from 'crypto';
import 'dotenv/config';

if(process.env.JWT_SECRET === undefined){
    console.error("Warning: missing JWT Token. Using a random generated one. All generated token will be invalid on next startup.");
}
export const token = process.env.JWT_SECRET ?? crypto.randomBytes(20).toString('hex');

export const auth = jwt({algorithms: ['HS256'], secret: token, requestProperty: 'user'});

// @ts-ignore
export const moderator = function (req, res, next) {
    if (req.user &&
        req.user.roles.includes(Role.MODERATOR) &&
        req.user.last_password_change === req.user.registered_on) {
        res.status(500).json({error: true, message: 'Change your password!'});
    }
    next();
}

// User information contained into JWT token
declare global {
    namespace Express {
        interface User {
            id: string,
            username: string,
            roles: string[],
            enabled: boolean,
            last_password_change: Date,
            registered_on: Date,
        }
    }
}

// Setting passport to use BasicHTTP Authentication to authenticate the users
passport.use(new passportHTTP.BasicStrategy(
    function (username, password, done) {
        console.log("New login attempt from " + username);
        user.getModel().findOne({username: username}, (err: any, user: User) => {
            if (err) {
                console.error(err)
                return done({status: 500, error: true});
            }
            if (!user) {
                console.error("Login attempt with wrong username: " + username);
                // @ts-ignore
                return done(null, false, {message: "Invalid username"});
            }
            if (user.enabled) {
                if (user.validatePassword(password)) {
                    return done(null, user);
                }
                console.error("User attempted to login with wrong password");
                return done({status: 401, error: true, message: "Invalid password"} );
            } else {
                console.error("Disabled user tried to login");
                return done({status: 500, error: true, message: "User not enabled"});
            }
        })
    }
));
