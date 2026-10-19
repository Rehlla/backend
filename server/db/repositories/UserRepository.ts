import { BaseRepository } from './BaseRepository';
import { UserEntity, SessionEntity } from '../schema';
import { db } from '../database';

export class UserRepository extends BaseRepository<UserEntity> {
  constructor() {
    super(database => database.users);
  }

  public async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public async findActiveSession(token: string): Promise<SessionEntity | null> {
    const session = db.sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
    return session ? JSON.parse(JSON.stringify(session)) : null;
  }

  public async createSession(session: SessionEntity): Promise<SessionEntity> {
    db.sessions.push(session);
    db.saveToDisk();
    return session;
  }

  public async invalidateSession(token: string): Promise<boolean> {
    const idx = db.sessions.findIndex(s => s.token === token);
    if (idx >= 0) {
      db.sessions.splice(idx, 1);
      db.saveToDisk();
      return true;
    }
    return false;
  }
}

export const userRepository = new UserRepository();
