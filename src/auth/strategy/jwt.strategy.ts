import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { CryptoService } from 'src/crypto/crypto.service';
import { User } from 'src/users/user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly cryptoService: CryptoService) {
    super();
  }

  async authenticate(req: Request) {
    const authorization = req.headers['authorization'];
    if (undefined === authorization)
      return this.fail(HttpStatus.UNAUTHORIZED);

    const jweMatch = /^Bearer (.*)$/.exec(authorization);
    if (null === jweMatch || 2 !== jweMatch.length)
      return this.fail(HttpStatus.UNAUTHORIZED);
    const jwe = jweMatch[1];

    try {
      const payload = (await this.cryptoService.verifyJwe(jwe)) as Pick<
        User,
        'id'
      >;
      return this.success(payload);
    } catch (e) {
      return this.fail(HttpStatus.UNAUTHORIZED);
    }
  }
}
