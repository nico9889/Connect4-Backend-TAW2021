import express from 'express';

import * as user from '../models/User';
import {auth, moderator} from "../utils/auth";

export const leaderboardRouter = express.Router();

interface LeaderBoardUser {
    username: string,
    ratio: number,
    victories: number,
    defeats: number
}

// Retrieve the top 10 users from the database
leaderboardRouter.get("/", auth, moderator, async (req, res, next) => {
    const leaderboard: LeaderBoardUser[] = [];
    try{
        const users = await user.getModel().find({}, {digest: 0, salt: 0});
        for (const user of users) {
            leaderboard.push({
                username: user.username,
                ratio: user.getRatio(),
                victories: user.victories,
                defeats: user.defeats
            })
        }
        leaderboard.sort((a, b) => {
            return b.ratio - a.ratio;
        })
        return res.status(200).json(leaderboard.slice(0, 9));
    }catch(e: any){
        console.error(e);
        return next({status: 500, error: true, message: ""});
    }
});
