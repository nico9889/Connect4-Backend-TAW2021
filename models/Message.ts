import mongoose = require('mongoose');

export interface Message extends mongoose.Document {
    readonly _id: mongoose.Types.ObjectId,
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


export function newMessage(sender: string, receiver: string, content: string) {
    const _model = getModel();
    return new _model({sender, receiver, content, date: new Date()});
}

