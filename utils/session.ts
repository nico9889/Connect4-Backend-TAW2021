export interface SessionStatus{
    online: boolean,
    game: string
}

export class InMemorySessionStore{
    private sessions: Map<string, SessionStatus>;
    constructor() {
        this.sessions = new Map();
    }

    findSession(id: string): SessionStatus | undefined{
        return this.sessions.get(id);
    }

    saveSession(id: string, online: SessionStatus): void {
        this.sessions.set(id, online);
    }
}
