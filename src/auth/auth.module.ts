import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { Argon2Module } from 'src/argon2/argon2.module';
import { UsersService } from 'src/users/users.service';
import { Argon2Service } from 'src/argon2/argon2.service';
import { CryptoModule } from 'src/crypto/crypto.module';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  imports: [
    CryptoModule,
    UsersModule,
    Argon2Module,
    PassportModule,
  ],
  providers: [AuthService, UsersService, Argon2Service, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
