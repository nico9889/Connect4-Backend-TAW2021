let notifications: Notification[] = [];

export function newNotification(type: Type, senderUser: Express.User, receiverUser: Express.User, expiry: number): void{
    notifications.push(new Notification(type, senderUser, receiverUser, expiry));
}

export function getNotifications(user: Express.User): Notification[]{
    notifications = notifications.filter((notification) => {return notification.expiry.getDate() < Date.now()});
    let out = notifications.filter((notification)=>{return notification.receiver === user.id});
    notifications = notifications.filter((notification)=>{return notification.receiver !== user.id})
    return out;
}

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

    constructor(type: Type, senderUser: Express.User, receiverUser: Express.User, expiry: number) {
        this.type = type;
        this.sender = senderUser.id;
        this.senderUsername = senderUser.username;
        this.receiver = receiverUser.id;
        this.expiry = new Date(Date.now() + expiry * 60000);
    }
}
