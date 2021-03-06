import express from 'express';
import {auth, moderator} from "../utils/auth";
import * as user from "../models/User";
import {Role} from "../models/User";
import {query, validationResult} from "express-validator";
import {sessionStore} from "../index";

export const users2Router = express.Router();

// Get all the users if the requesting user is a moderator, return only the friends' data otherwise
users2Router.get("/", auth, moderator,
    query('friends').optional().isBoolean(),
    async (req, res, next) => {
        if (!req.user) {
            console.error("Missing user");
            return next({status: 500, error: true, message: 'Generic error occurred'});
        }
        const result = validationResult(req);
        if (!result.isEmpty()) {
            if (!result.isEmpty()) {
                return next({status: 500, error: true, message: result.array({onlyFirstError: true}).pop()?.msg});
            }
        }
        if (user.checkRoles(req.user, [Role.MODERATOR, Role.ADMIN]) && !req.query?.friends) {
            try {
                const users = await user.getModel().find({}, {digest: 0, salt: 0, avatar: 0});
                return res.status(200).json(users);
            } catch (e: any) {
                console.error(e);
                return next({status: 500, error: true, message: 'Generic error occurred'});
            }
        } else {
            try {
                const currentUser = await user.getModel().findOne({_id: req.user.id}).populate('friends', '_id username victories defeats');
                if (!currentUser) {
                    return next({status: 404, error: true, message: 'User not found'});
                }
                const friends = [];
                for (const friend of currentUser.friends) {
                    friends.push({
                        _id: friend.id,
                        username: friend.username,
                        victories: friend.victories,
                        defeats: friend.defeats,
                        online: sessionStore.findSession(friend._id.toString())?.online,
                        game: sessionStore.findSession(friend._id.toString())?.game
                    })
                }
                if (!currentUser) {
                    return next({status: 500, error: true, message: 'Generic error occurred'});
                }
                return res.status(200).json(friends);
            } catch (e: any) {
                console.error(e);
                return next({status: 500, error: true, message: 'Generic error occurred'});
            }
        }
    });
