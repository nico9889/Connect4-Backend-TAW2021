import mongoose = require('mongoose');
import {User} from "./User";
import {Coin} from "../routers/game_router";

export interface Game extends mongoose.Document{
    readonly _id: mongoose.Schema.Types.ObjectId,
    playerOne: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    playerOneName: string,
    playerTwo: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    playerTwoName: string,
    board: Coin[][],
    started: Date,
    ended: Date,
    winner: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    winnerName: string,
}

let gameSchema = new mongoose.Schema<Game>({
    playerOne: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    },
    playerOneName: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    playerTwo: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    },
    playerTwoName: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    board: {
      type: [[mongoose.SchemaTypes.Number]],
      required: false,
    },
    started: {
        type: mongoose.SchemaTypes.Date,
        required: true,
        default: new Date()
    },
    ended: {
        type: mongoose.SchemaTypes.Date,
        required: false,
    },
    winner: {
        type: mongoose.SchemaTypes.ObjectId,
        required: false
    },
    winnerName: {
        type: mongoose.SchemaTypes.String,
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
            playerOne: player1._id,
            playerOneName: player1.username,
            playerTwo: player2._id,
            playerTwoName: player2.username
        }
        return new _gamemodel(data);
    }
    throw new Error("Players must be different!");
}
