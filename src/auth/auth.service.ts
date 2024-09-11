import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Argon2Service } from 'src/argon2/argon2.service';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { User } from 'src/users/user.interface';
import { RegisterDto } from './dto/register.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CryptoService } from 'src/crypto/crypto.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly argon2Service: Argon2Service,
    private readonly cryptoService: CryptoService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ access_token: string }> {
    let user: Pick<User, 'id' | 'hashed_password'>;
    try {
      user = await this.usersService.findUniqueForAuthentication(
        registerDto.email,
      );
      throw new ForbiddenException('Email is already taken.');
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
    }

    if (8 > registerDto.password.length)
      throw new UnprocessableEntityException(
        'Password must be at least 8 characters long.',
      );
    const hashedPassword = await this.argon2Service.hashPassword(
      registerDto.password,
    );

    try {
      const { id } = await this.usersService.create({
        email: registerDto.email,
        hashed_password: hashedPassword,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
      });
      return { access_token: await this.cryptoService.forgeJwe({ id }) };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2002' === e.code)
        throw new ForbiddenException('Email is already taken.');
      throw e;
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.usersService.findUniqueForAuthentication(
      loginDto.email,
    );
    if (null === user) throw new UnauthorizedException('Invalid credentials.');

    const isPasswordMatching = await this.argon2Service.verifyPassword(
      user.hashed_password,
      loginDto.password,
    );
    if (!isPasswordMatching)
      throw new UnauthorizedException('Invalid credentials.');

    return { access_token: await this.cryptoService.forgeJwe({ id: user.id }) };
  }

  async me(payload: Pick<User, 'id'>) {
    return this.usersService.findUnique(payload.id);
  }
}
