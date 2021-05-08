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
exports.auth_router = void 0;
var express = require("express");
var jsonwebtoken = require("jsonwebtoken");
var auth_1 = require("../auth");
var user = __importStar(require("../models/User"));
exports.auth_router = express.Router();
exports.auth_router.get("/login", auth_1.passport.authenticate('basic', { session: false }), function (req, res, next) {
    if (req.user) {
        var token_data = {
            id: req.user.id,
            username: req.user.username,
            roles: req.user.roles
        };
        console.log("Login granted. Generating token");
        // @ts-ignore
        var token_signed = jsonwebtoken.sign(token_data, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.status(200).json({ error: false, errormessage: "", token: token_signed });
    }
    else {
        return res.status(500).json({ error: true, errormessage: "" });
    }
});
exports.auth_router.post("/register", function (req, res, next) {
    if (req.body.username && req.body.password) {
        var u = user.newUser({ username: req.body.username, enabled: false });
        u.setPassword(req.body.password);
        u.save().then(function (data) {
            return res.status(200).json({ error: false, message: "", id: data._id });
        }).catch(function (reason) {
            if (reason.code === 11000)
                return next({ statusCode: 500, error: true, errormessage: "User already exists" });
            return next({ status: 500, error: true, message: reason.message });
        });
    }
    else {
        return next({ status: 500, error: true, message: "Missing username" });
    }
});
//# sourceMappingURL=auth_router.js.map