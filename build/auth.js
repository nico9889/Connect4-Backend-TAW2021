"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
var jwt = require("express-jwt");
exports.passport = require("passport");
var passportHTTP = require("passport-http");
var user = __importStar(require("./models/User"));
// @ts-ignore
exports.auth = jwt({ algorithms: ['HS256'], secret: process.env.JWT_SECRET });
exports.passport.use(new passportHTTP.BasicStrategy(function (username, password, done) {
    console.log("New login attempt from " + username);
    user.getModel().findOne({ username: username }, function (err, user) {
        if (err) {
            console.error(err);
            return done({ statusCode: 500, error: true });
        }
        if (!user) {
            console.error("Login attempt with wrong username: " + username);
            // @ts-ignore
            return done(null, false, { status: 500, error: true, message: "Invalid username" });
        }
        if (user.enabled) {
            if (user.validatePassword(password)) {
                return done(null, user);
            }
            console.error("User attempted to login with wrong password");
            // @ts-ignore
            return done(null, false, { status: 500, error: true, message: "Invalid password" });
        }
        else {
            console.error("Disabled user tried to login");
            // @ts-ignore
            return done(null, false, { status: 500, error: true, message: "User not enabled" });
        }
    });
}));
//# sourceMappingURL=auth.js.map