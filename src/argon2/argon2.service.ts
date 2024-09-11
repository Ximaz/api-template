import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Argon2Service {
  generateSalt() {
    return randomBytes(16).toString('hex');
  }

  hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 12288,
      timeCost: 3,
      parallelism: 1,
    });
  }

  verifyPassword(hash: string, password: string) {
    return argon2.verify(hash, password);
  }
}
