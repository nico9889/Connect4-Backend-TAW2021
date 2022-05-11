import mongoose from 'mongoose';
import {User} from "./User";
import {Game} from "./Game";

export enum Type{
    Game = 'Game',
    User = 'User'
}

export interface Message extends mongoose.Document {
    readonly _id: mongoose.Types.ObjectId,
    sender: User | mongoose.Types.ObjectId,
    receiver: User | Game | mongoose.Types.ObjectId,
    onModel: Type,
    content: string,
    datetime: Date
}

let messageSchema = new mongoose.Schema<Message>({
    sender: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: 'User'
    },
    receiver: { type: mongoose.SchemaTypes.ObjectId,
        required: true,
        refPath: 'onModel'
    },
    onModel: {
        type: mongoose.SchemaTypes.String,
        required: true,
        enum: ['User','Game']
    },
    content: {
        type: mongoose.SchemaTypes.String,
        required: true
    },
    datetime: {
        type: mongoose.SchemaTypes.Date,
        required: true,
    }
});

export function getSchema() {
    return messageSchema;
}


// Singleton pattern
let messageModel: mongoose.Model<Message>;

export function getModel(): mongoose.Model<Message> {
    if (!messageModel) {
        messageModel = mongoose.model('Message', getSchema());
    }
    return messageModel;
}


export function newMessage(sender: string, receiver: string, onModel: Type, content: string) {
    const _model = getModel();
    return new _model({sender, receiver, onModel, content, datetime:new Date()});
}

