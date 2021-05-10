import {User} from "./User";

export enum Type {
    ERROR,
    FRIEND_REQUEST,
    GAME_INVITE
}

class Notification {
    type: Type;
    sender: string;
    senderUsername: string;
    receiver: string;
    expiry: Date;

    constructor(type: Type, senderUser: Express.User, receiverUser: User, expiry: number) {
        this.type = type;
        this.sender = senderUser.id;
        this.senderUsername = senderUser.username;
        this.receiver = receiverUser.id;
        this.expiry = new Date(Date.now() + expiry * 60000);
    }
}

function equals(not1: Notification, not2: Notification): boolean{
    return new Date(not1.expiry).getTime() === new Date(not2.expiry).getTime() && not1.sender === not2.sender && not1.receiver === not2.receiver && not1.type === not2.type;
}

let notifications: Notification[] = [];
let sentNotifications: Notification[] = [];

export function newNotification(type: Type, senderUser: Express.User, receiverUser: User, expiry: number): void {
    notifications.push(new Notification(type, senderUser, receiverUser, expiry));
}

export function getNotifications(user: Express.User): Notification[] {
    notifications = notifications.filter((notification) => {
        return notification.expiry.getDate() < Date.now()
    });
    let out = notifications.filter((notification) => {
        return notification.receiver === user.id
    });
    out.forEach((notification) => {
        sentNotifications.push(notification);
    });
    notifications = notifications.filter((notification) => {
        return notification.receiver !== user.id
    })
    return out;
}

export function checkSentNotification(notification: Notification): boolean {
    let result = sentNotifications.find((not) => {
        return equals(not, notification);
    });
    console.log(result);
    sentNotifications.filter((not) => {
        return new Date(notification.expiry).getDate() < Date.now() || !equals(not, notification);
    })
    console.log(sentNotifications);
    return result !== undefined && new Date(notification.expiry).getDate() < Date.now();
}

