import mongoose = require('mongoose');
import {User} from "./User";

export interface Message extends mongoose.Document {
    readonly _id: mongoose.Schema.Types.ObjectId,
    sender: string,
    receiver: string,
    content: string,
    datetime: Date
}

let messageSchema = new mongoose.Schema<Message>({
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

export function getSchema() { return messageSchema;}


// Singleton pattern
let messageModel: mongoose.Model<Message>;
export function getModel() : mongoose.Model<Message> {
    if(!messageModel){
        messageModel = mongoose.model('User', getSchema());
    }
    return messageModel;
}

