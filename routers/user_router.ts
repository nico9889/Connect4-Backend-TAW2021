import express = require('express');

import * as user from '../models/User';
import {auth} from '../utils/auth'
import {Role} from "../models/User";
import {io} from "../index";

export let userRouter = express.Router();

// Get all the users
userRouter.get("/", auth, (req, res, next) => {
    user.getModel().find({}, {digest: 0, salt: 0})
        .then((users) => {
            if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
                return res.status(200).json(users);
            } else {
                return next({status: 403, error: true, message: "You are not authorized to access this resource"});
            }
        })
        .catch((exception) => {
            console.error(exception);
            return next({status: 500, error: true, message: ""});
        })
});


// @ts-ignore
function updateUser(id: string, data: any, req, res, next) {
    // @ts-ignore Mongoose can do the correct cast by itself
    user.getModel().updateOne({_id: id}, data)
        .then(() => {
            if (data.oldPassword && data.newPassword && /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(data.newPassword)) {
                // @ts-ignore
                user.getModel().findOne({_id: req.params.user_id}).then((u) => {
                    if (u) {
                        if(u.validatePassword(data.oldPassword)) {
                            u.setPassword(data.newPassword);
                            u.save();
                            return res.status(200).json({error: false, message: ""});
                        }else{
                            return next({status: 500, error: true, message: "Invalid old password"});
                        }

                    } else {
                        return next({status: 500, error: true, message: "An error has occured"});
                    }
                })
            } else {
                return next({status: 500, error: true, message: "Must contain at least one number and one uppercase and lowercase letter, and at least 8 or more characters"});
            }
        })
        .catch((e) => {
            console.error(e);
            if (e.code === 11000) {
                return next({status: 500, error: true, message: "Username already exists"});
            }
            return next({status: 500, error: true, message: "An error has occured"});
        });
}

interface UpdateUserData {
    enabled?: string,
    avatar?: string,
    oldPassword?: string,
    newPassword?: string
}


userRouter.route("/:user_id")
    // Get the requested user
    .get(auth, (req, res, next)=> {
        if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
            // @ts-ignore
            user.getModel().findOne({_id:req.params.user_id}, {digest: 0, salt: 0}).then((user)=>{
                if(user){
                    return res.status(200).json(user);
                }else{
                    return next({status:404, error: true, message:"User not found"});
                }
            }).catch((e) => {
                console.error(e);
                return next({status:404, error: true, message:"User not found"});
            });
        }else{
            if(req.user && req.user.id === req.params.user_id){
                // @ts-ignore
                user.getModel().findOne({_id:req.params.user_id}, {digest: 0, salt: 0}).then((user)=>{
                    if(user){
                        return res.status(200).json(user);
                    }else{
                        return next({status:404, error: true, message:"User not found"});
                    }
                })
            }else{
                return next({status:403, error: true, message:"You are not authorized to access this resourc"});
            }
        }
    })
    // Update a user FIXME: remove username update since this should invalidate JWT
    .put(auth, (req, res, next) => {
        // Incoming parameters need to be filtered before inserting into the database to avoid unwanted changes (like digest or salt)
        let update: UpdateUserData = {};
        if (req.body.enabled !== undefined && req.body.enabled !== null) {
            update.enabled = req.body.enabled;
        }
        if (req.body.avatar) {
            update.avatar = req.body.avatar;
        }
        if (req.body.oldPassword) {
            update.oldPassword = req.body.oldPassword;
        }
        if (req.body.newPassword) {
            update.newPassword = req.body.newPassword;
        }
        if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
            return updateUser(req.params.user_id, update, req, res, next);
        } else {
            if(req.user) {
                if (req.user.id === req.params.user_id) {
                    return updateUser(req.params.user_id, update, req, res, next);
                } else {
                    return next({
                        status: 403,
                        error: true,
                        message: "You are not authorized to access this resource"
                    });
                }
            }
        }
    })
    // Delete a user FIXME: when a user it should be removed from friends
    .delete(auth, (req, res, next) => {
        // @ts-ignore Mongoose can do the correct cast by itself
        user.getModel().findOne({_id: req.params.user_id}).then((target) => {
            if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN])) {
                if (target && !target.hasRole(Role.ADMIN)) {    // We need to keep at least the administrators into the database
                    target.delete();
                    return res.status(200).json({error: false, message: ""});
                }else {
                    return res.status(403).json({
                        error: false,
                        message: "You are not authorized to access this resource"
                    });
                }
            } else {
                if (req.user && req.user.id === req.params.user_id) {
                    if (target && !target.hasRole(Role.ADMIN)) {
                        target.delete();
                        return res.status(200).json({error: false, message: ""});
                    }
                }else {
                    return next({
                        status: 403,
                        error: true,
                        message: "You are not authorized to access this resource"
                    });
                }
            }
        }).catch((e) => {
            console.error(e);
            return next({status: 500, error: true, message: "An error has occured"});
        });
    });
