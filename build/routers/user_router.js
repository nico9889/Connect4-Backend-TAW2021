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
exports.user_router = void 0;
var express = require("express");
var user = __importStar(require("../models/User"));
var auth_1 = require("../auth");
var User_1 = require("../models/User");
var mongoose = __importStar(require("mongoose"));
exports.user_router = express.Router();
exports.user_router.get("/", auth_1.auth, function (req, res, next) {
    user.getModel().find({}, { digest: 0, salt: 0 })
        .then(function (users) {
        if (user.checkRoles(req.user, [User_1.Role.MODERATOR, User_1.Role.ADMIN])) {
            return res.status(200).json(users);
        }
        else {
            return next({ statusCode: 403, error: true, message: "You are not authorized to access this resource" });
        }
    })
        .catch(function (exception) {
        console.log(exception);
        return next({ statusCode: 500, error: true, message: "" });
    });
});
exports.user_router.route("/:user_id")
    .put(auth_1.auth, function (req, res, next) {
    if (user.checkRoles(req.user, [User_1.Role.MODERATOR, User_1.Role.ADMIN])) {
        user.getModel().updateOne({ _id: new mongoose.Schema.Types.ObjectId(req.params.user_id) }, req.body)
            .then(function () {
            return res.status(200).json({ error: false, message: "" });
        })
            .catch(function (e) {
            console.error(e);
            if (e.code === 11000) {
                return next({ statusCode: 500, error: true, message: "Username already exists" });
            }
            return next({ statusCode: 500, error: true, message: "An error has occured" });
        });
    }
    else {
        // @ts-ignore
        var u = user.newUser(req.user);
        if (u._id === new mongoose.Schema.Types.ObjectId(req.params.user_id)) {
            user.getModel().updateOne({ _id: new mongoose.Schema.Types.ObjectId(req.params.user_id) }, req.body)
                .then(function () {
                return res.status(200).json({ error: false, message: "" });
            })
                .catch(function (e) {
                console.error(e);
                return next({ statusCode: 500, error: true, message: "An error has occured" });
            });
        }
        else {
            return next({ statusCode: 403, error: true, message: "You are not authorized to access this resource" });
        }
    }
})
    .delete(auth_1.auth, function (req, res, next) {
    // @ts-ignore
    user.getModel().findOne({ _id: req.params.user_id }).then(function (target) {
        if (user.checkRoles(req.user, [User_1.Role.MODERATOR, User_1.Role.ADMIN])) {
            console.log("TARGET: " + target);
            if (target && !target.hasRole(User_1.Role.ADMIN)) {
                target.delete();
                return res.status(200).json({ error: false, message: "" });
            }
            return res.status(403).json({ error: false, message: "You are not authorized to access this resource" });
        }
        else {
            // @ts-ignore
            user.getModel().findOne({ _id: req.params.user_id })
                .then(function (u) {
                if (u && u._id === new mongoose.Schema.Types.ObjectId(req.params.user_id)) {
                    if (target && !target.hasRole(User_1.Role.ADMIN)) {
                        target.delete();
                        return res.status(200).json({ error: false, message: "" });
                    }
                }
                return next({ statusCode: 403, error: true, message: "You are not authorized to access this resource" });
            }).catch(function (e) {
                console.error(e);
                return next({ statusCode: 500, error: true, message: "An error has occured" });
            });
        }
    }).catch(function (e) {
        console.error(e);
        return next({ statusCode: 500, error: true, message: "An error has occured" });
    });
});
//# sourceMappingURL=user_router.js.map