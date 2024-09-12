import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserAuthentication } from './interfaces/user';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UpdateUserDto } from './dto/update-user.dto';
import { Argon2Service } from 'src/argon2/argon2.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly argon2Service: Argon2Service,
  ) {}

  findMany() {
    return this.prismaService.users.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
    });
  }

  findUnique(id: string, gdprCompliance: boolean = true) {
    return this.prismaService.users.findUnique({
      where: { id, deleted_at: null },
      select: {
        email: !gdprCompliance,
        firstname: true,
        lastname: true,
        last_connection: !gdprCompliance,
        created_at: true,
      },
    });
  }

  findUniqueByEmailForAuthentication(
    email: string,
  ): Promise<UserAuthentication> {
    return this.prismaService.users.findUnique({
      where: { email, deleted_at: null },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        hashed_password: true,
        deleted_at: true,
      },
    });
  }

  findUniqueByIDForAuthentication(id: string): Promise<UserAuthentication> {
    return this.prismaService.users.findUnique({
      where: { id, deleted_at: null },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        hashed_password: true,
        deleted_at: true,
      },
    });
  }

  create(createUserDto: CreateUserDto) {
    return this.prismaService.users.create({
      data: {
        email: createUserDto.email,
        hashed_password: createUserDto.hashed_password,
        firstname: createUserDto.firstname,
        lastname: createUserDto.lastname,
      },
      select: {
        id: true,
      },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserAuthentication> {
    const user = await this.findUniqueByIDForAuthentication(id);
    if (null === user)
      throw new NotFoundException('The requested user does not exist.');

    const isPasswordMatching = await this.argon2Service.verifyPassword(
      user.hashed_password,
      updateUserDto.current_password,
    );
    if (!isPasswordMatching)
      throw new UnauthorizedException('Invalid credentials.');

    const updatedUser = {
      email: updateUserDto.email ?? user.email,
      firstname: updateUserDto.firstname ?? user.firstname,
      lastname: updateUserDto.lastname ?? user.lastname,
      hashed_password: user.hashed_password,
    };

    if (undefined !== updateUserDto.new_password) {
      if (8 > updateUserDto.new_password.length)
        throw new UnprocessableEntityException(
          'Password must be at least 8 characters long.',
        );

      if (updateUserDto.new_password === updateUserDto.current_password)
        throw new UnprocessableEntityException(
          'The new password must be different.',
        );

      updatedUser.hashed_password = await this.argon2Service.hashPassword(
        updateUserDto.new_password,
      );
    }

    return await this.prismaService.users.update({
      where: { id },
      data: updatedUser,
    });
  }

  async delete(id: string, gdprCompliance: boolean = false): Promise<void> {
    try {
      if (gdprCompliance)
        await this.prismaService.users.delete({ where: { id } });
      else {
        await this.prismaService.users.update({
          where: { id, deleted_at: null },
          data: { deleted_at: new Date() },
        });
      }
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2025' === e.code)
        throw new NotFoundException('The requested item does not exist.');
      throw e;
    }
  }

  async restore(id: string) {
    try {
      await this.prismaService.users.update({
        where: { id },
        data: { deleted_at: null },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2025' === e.code)
        throw new NotFoundException('The requested item does not exist.');
      throw e;
    }
  }
}
