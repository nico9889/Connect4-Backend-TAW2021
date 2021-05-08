"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModel = exports.getSchema = void 0;
var mongoose = require("mongoose");
var messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    receiver: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    content: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    datetime: {
        type: mongoose.SchemaTypes.Date,
        required: true,
        default: new Date()
    }
});
function getSchema() { return messageSchema; }
exports.getSchema = getSchema;
// Singleton pattern
var messageModel;
function getModel() {
    if (!messageModel) {
        messageModel = mongoose.model('User', getSchema());
    }
    return messageModel;
}
exports.getModel = getModel;
//# sourceMappingURL=Message.js.map