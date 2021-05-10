import express = require('express');
import {auth} from '../auth'
import {checkSentNotification, newNotification, Type} from "../models/Notification";
import * as user from '../models/User';
import {Friend} from "../models/User";

export let friendRouter = express.Router();

friendRouter.post("/:username", auth, (req, res, next) => {
    if (req.user) {
        // @ts-ignore Mongoose is casting automatically
        user.getModel().findOne({username:req.params.username}).then((receiver)=>{
            if(req.body.request==true && req.user !== undefined && receiver && receiver._id.toString() !== req.user.id){
                console.log("Sending notification");
                newNotification(Type.FRIEND_REQUEST, req.user, receiver, 10);
                console.log("Sending confirmation");
                return res.status(200).json({error:false, errormessage:""});
            }else{
                return next({status:500, error:true, errormessage:"Invalid request"});
            }
        }).catch((e)=>{
            console.error(e);
            return next({status:404, error:true, errormessage:"User not found"});
        })
    }
})

friendRouter.route("/")
    .get(auth, (req, res, next) => {
        if(req.user) {
            // @ts-ignore
            user.getModel().findOne({_id: req.user.id}).then((current_user) => {
                if(current_user){
                    user.getModel().find({
                        _id: {$in:
                                current_user.friends
                        }
                    }).then((friends) => {
                        let out: Friend[] = [];
                        friends.forEach((friend) => {
                            // FIXME: check if the user is online!
                            out.push({username:friend.username, online:false, avatar:friend.avatar});
                        })
                        return res.status(200).json(out);
                    }).catch((err) => {
                        console.error(err);
                        return next({status:500, error:true, errormessage:"Generic error occurred while retrieving friends"});
                    })
                }
            }).catch((err) => {
                console.error(err);
                return next({status:500, error:true, errormessage:"Generic error occurred while retrieving friends"});
            })
        }
    })
    .put(auth, (req, res, next)=> {
    //@ts-ignore
    if(req.user && req.body.notification.receiver === req.user.id && req.body.notification.sender !== req.body.notification.receiver){
        if(checkSentNotification(req.body.notification)){
            user.getModel().findOne({_id:req.body.notification.sender}).then((sender)=>{
                user.getModel().findOne({_id:req.body.notification.receiver}).then((receiver)=>{
                    if(sender && receiver) {
                        if(!sender.friends.includes(receiver._id) && !receiver.friends.includes(sender._id)) {
                            sender.friends.push(receiver._id);
                            receiver.friends.push(sender._id);
                            sender.save();
                            receiver.save();
                        }else{
                            return next({status:500, error:true, errormessage:"You are already friend!"})
                        }
                    }else{
                        return next({status:500, error:true, errormessage:"Invalid or expired request"});
                    }
                });
            });
        }else{
            return next({status:500, error:true, errormessage:"Invalid or expired request"});
        }
    }
})
