import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { Argon2Module } from 'src/argon2/argon2.module';
import { UsersController } from './users.controller';

@Module({
    imports: [PrismaModule, Argon2Module],
    providers: [UsersService],
    exports: [UsersService],
    controllers: [UsersController]
})
export class UsersModule {}
