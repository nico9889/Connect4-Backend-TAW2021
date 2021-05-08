import express = require('express');

import * as user from '../models/User';
import {auth} from '../auth'
import {Role} from "../models/User";
import * as mongoose from "mongoose";

export let user_router = express.Router();


user_router.get("/", auth, (req, res, next) => {
    user.getModel().find({}, {digest: 0, salt: 0})
        .then((users) => {
            if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
                return res.status(200).json(users);
            } else {
                return next({statusCode: 403, error: true, message: "You are not authorized to access this resource"});
            }
        })
        .catch((exception) => {
            console.log(exception);
            return next({statusCode: 500, error: true, message: ""});
        })
});


user_router.route("/:user_id")
    .put(auth, (req, res, next) => {
        if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
            user.getModel().updateOne({_id: new mongoose.Schema.Types.ObjectId(req.params.user_id)}, req.body)
                .then(() => {
                    return res.status(200).json({error: false, message: ""});
                })
                .catch((e) => {
                    console.error(e);
                    if (e.code === 11000) {
                        return next({statusCode: 500, error: true, message: "Username already exists"});
                    }
                    return next({statusCode: 500, error: true, message: "An error has occured"});
                });
        } else {
            // @ts-ignore
            let current = user.newUser(req.user);
            if (current._id === new mongoose.Schema.Types.ObjectId(req.params.user_id)) {
                user.getModel().updateOne({_id: new mongoose.Schema.Types.ObjectId(req.params.user_id)}, req.body)
                    .then(() => {
                        return res.status(200).json({error: false, message: ""});
                    })
                    .catch((e) => {
                        console.error(e);
                        return next({statusCode: 500, error: true, message: "An error has occured"});
                    });
            } else {
                return next({statusCode: 403, error: true, message: "You are not authorized to access this resource"});
            }
        }
    })
    .delete(auth, (req, res, next) => {
        user.getModel().findOne({_id:new mongoose.Schema.Types.ObjectId(req.params.user_id)}).then((target) => {
                if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
                    if (target && !target.hasRole(Role.ADMIN)) {    // We need to keep at least the administrators into the database
                        target.delete();
                        return res.status(200).json({error: false, message: ""});
                    }
                    return res.status(403).json({error: false, message: "You are not authorized to access this resource"});
                }else{
                    user.getModel().findOne({_id:new mongoose.Schema.Types.ObjectId(req.params.user_id)})
                        .then((current) => {
                            if (current && current._id === new mongoose.Schema.Types.ObjectId(req.params.user_id)) {
                                if(target && !target.hasRole(Role.ADMIN)){
                                    target.delete();
                                    return res.status(200).json({error: false, message: ""});
                                }
                            }
                            return next({statusCode: 403, error: true, message: "You are not authorized to access this resource"});
                        }).catch((e) => {
                            console.error(e);
                            return next({statusCode: 500, error: true, message: "An error has occured"});
                        });
                }
            }).catch((e) => {
                console.error(e);
                return next({statusCode: 500, error: true, message: "An error has occured"});
            });
    });