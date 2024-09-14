import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Argon2Service } from '../argon2/argon2.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { User, UserShort } from '../users/interfaces/user';
import { RegisterDto } from './dto/register.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly argon2Service: Argon2Service,
  ) {}

  async register(registerDto: RegisterDto): Promise<Pick<User, 'id'>> {
    if (8 > registerDto.password.length)
      throw new UnprocessableEntityException(
        'Password must be at least 8 characters long.',
      );
    const hashedPassword = await this.argon2Service.hashPassword(
      registerDto.password,
    );

    try {
      return await this.usersService.create({
        email: registerDto.email,
        hashed_password: hashedPassword,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        has_accepted_terms_and_conditions:
          registerDto.has_accepted_terms_and_conditions,
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2002' === e.code)
        throw new ForbiddenException('Email is already taken.');
      throw e;
    }
  }

  async login(loginDto: LoginDto): Promise<Pick<User, 'id'>> {
    if (8 > loginDto.password.length)
      throw new UnauthorizedException('Invalid credentials.');

    const user = await this.usersService.findUniqueByEmailForAuthentication(
      loginDto.email,
    );
    if (null === user) throw new UnauthorizedException('Invalid credentials.');

    const isPasswordMatching = await this.argon2Service.verifyPassword(
      user.hashed_password,
      loginDto.password,
    );
    if (!isPasswordMatching)
      throw new UnauthorizedException('Invalid credentials.');

    return {
      id: user.id,
    };
  }
}
