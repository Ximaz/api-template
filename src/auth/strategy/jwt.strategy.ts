import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { JwtService } from '../../jwt/jwt.service';
import { User } from 'src/users/interfaces/user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  private static extractBearerToken(req: Request): string | null {
    const authorization = req.headers['authorization'];
    if (undefined === authorization) return null;

    const [bearer, token] = authorization.split(/\s/, 2);
    if ('bearer' !== bearer.toLowerCase() || undefined === token) return null;

    return token;
  }

  async authenticate(req: Request) {
    const jwe = JwtStrategy.extractBearerToken(req);
    if (null === jwe) return this.fail(HttpStatus.UNAUTHORIZED);

    try {
      const payload = (await this.jwtService.verifyJwe(jwe)) as Pick<
        User,
        'id'
      >;
      return this.success(payload);
    } catch (e) {
      return this.fail(HttpStatus.UNAUTHORIZED);
    }
  }
}
