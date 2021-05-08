"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newGame = exports.getModel = exports.getSchema = void 0;
var mongoose = require("mongoose");
var gameSchema = new mongoose.Schema({
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
function getSchema() { return gameSchema; }
exports.getSchema = getSchema;
// Singleton pattern
var gameModel;
function getModel() {
    if (!gameModel) {
        gameModel = mongoose.model('Game', getSchema());
    }
    return gameModel;
}
exports.getModel = getModel;
function newGame(player1, player2) {
    var _gamemodel = getModel();
    if (player1 !== player2) {
        var data = {
            player_one: player1._id,
            player_two: player2._id
        };
        return new _gamemodel(data);
    }
    throw new Error("Players must be different!");
}
exports.newGame = newGame;
//# sourceMappingURL=Game.js.map