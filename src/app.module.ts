import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { Argon2Service } from './argon2/argon2.service';
import { AuthModule } from './auth/auth.module';
import { Argon2Module } from './argon2/argon2.module';
import { AuthService } from './auth/auth.service';
import { CryptoService } from './crypto/crypto.service';
import { CryptoModule } from './crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CryptoModule,
    Argon2Module,
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AuthService, Argon2Service, CryptoService],
})
export class AppModule {}
