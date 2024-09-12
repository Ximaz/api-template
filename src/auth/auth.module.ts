import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { Argon2Module } from 'src/argon2/argon2.module';
import { JwtModule } from 'src/jwt/jwt.module';
import { JwtStrategy } from './strategy/jwt.strategy';
import { Argon2Service } from 'src/argon2/argon2.service';

@Module({
  imports: [
    JwtModule,
    UsersModule,
    Argon2Module,
    PassportModule,
  ],
  providers: [AuthService, JwtStrategy, Argon2Service],
  controllers: [AuthController],
})
export class AuthModule {}
