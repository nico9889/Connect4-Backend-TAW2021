import mongoose from 'mongoose';
import {User} from "./User";
import {Coin} from "../routers/game_router";

export interface Game extends mongoose.Document {
    readonly _id: mongoose.Types.ObjectId,
    playerOne: User | mongoose.Types.ObjectId,
    playerTwo: User | mongoose.Types.ObjectId,
    board: Coin[][],
    moves: number[],
    started: Date,
    ended: Date,
    winner: User | mongoose.Types.ObjectId | undefined,
}

let gameSchema = new mongoose.Schema<Game>({
    playerOne: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: 'User'
    },
    playerTwo: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: 'User'
    },
    board: {
        type: [[mongoose.SchemaTypes.Number]],
        required: false,
    },
    moves: {
        type: [mongoose.SchemaTypes.Number],
        required: false,
        default: []
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
        required: false,
        ref: 'User'
    },
});


export function getSchema() {
    return gameSchema;
}


// Singleton pattern
let gameModel: mongoose.Model<Game>;

export function getModel(): mongoose.Model<Game> {
    if (!gameModel) {
        gameModel = mongoose.model('Game', getSchema());
    }
    return gameModel;
}


export function newGame(player1: User, player2: User): Game {
    const _gamemodel = getModel();
    if (player1._id !== player2._id) {
        let data = {
            playerOne: player1,
            playerTwo: player2,
        }
        return new _gamemodel(data);
    }
    throw new Error("Players must be different!");
}
