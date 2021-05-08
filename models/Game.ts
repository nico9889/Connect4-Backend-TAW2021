import mongoose = require('mongoose');
import {User} from "./User";

export interface Game extends mongoose.Document{
    readonly _id: mongoose.Schema.Types.ObjectId,
    player_one: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    player_two: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    started: Date,
    winner: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
}

let gameSchema = new mongoose.Schema<Game>({
    player_one: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    },
    player_two: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    },
    started: {
        type: mongoose.SchemaTypes.Date,
        required: true,
        default: new Date()
    },
    winner: {
        type: mongoose.SchemaTypes.ObjectId,
        required: false
    }
});


export function getSchema() { return gameSchema;}


// Singleton pattern
let gameModel: mongoose.Model<Game>;
export function getModel() : mongoose.Model<Game> {
    if(!gameModel){
        gameModel = mongoose.model('Game', getSchema());
    }
    return gameModel;
}


export function newGame(player1: User, player2: User): Game{
    let _gamemodel = getModel();
    if(player1!==player2) {
        let data = {
            player_one: player1._id,
            player_two: player2._id
        }
        return new _gamemodel(data);
    }
    throw new Error("Players must be different!");
}