import { Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserFull, UserShort } from './interfaces/user';
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
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
    });
  }

  findUnique(id: string, grdp: boolean = true) {
    return this.prismaService.users.findUnique({
      where: { id },
      select: {
        email: !grdp,
        firstname: true,
        lastname: true,
        last_connection: !grdp,
        created_at: true,
      },
    });
  }

  findUniqueByEmailForAuthentication(
    email: string,
  ): Promise<UserShort & { hashed_password: string }> {
    return this.prismaService.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        hashed_password: true,
      },
    });
  }

  findUniqueByIDForAuthentication(
    id: string,
  ): Promise<UserShort & { hashed_password: string }> {
    return this.prismaService.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        hashed_password: true,
      },
    });
  }

  create(createDto: CreateUserDto) {
    return this.prismaService.users.create({
      data: {
        email: createDto.email,
        hashed_password: createDto.hashed_password,
        firstname: createDto.firstname,
        lastname: createDto.lastname,
      },
      select: {
        id: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateUserDto): Promise<UserFull> {
    const user = await this.findUniqueByIDForAuthentication(id);
    if (null === user)
      throw new NotFoundException('The requested user does not exist.');

    const isPasswordMatching = await this.argon2Service.verifyPassword(
      user.hashed_password,
      updateDto.current_password,
    );
    if (!isPasswordMatching)
      throw new UnauthorizedException('Invalid credentials.');

    const updatedUser = {
      email: updateDto.email ?? user.email,
      firstname: updateDto.firstname ?? user.firstname,
      lastname: updateDto.lastname ?? user.lastname,
      hashed_password: user.hashed_password,
    };

    if (undefined !== updateDto.new_password) {
      if (8 > updateDto.new_password.length)
        throw new UnprocessableEntityException(
          'Password must be at least 8 characters long.',
        );

      if (updateDto.new_password === updateDto.current_password)
        throw new UnprocessableEntityException(
          'The new password must be different.',
        );

      updatedUser.hashed_password = await this.argon2Service.hashPassword(updateDto.new_password);
    }

    return await this.prismaService.users.update({
      where: { id },
      data: updatedUser,
    });
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prismaService.users.delete({ where: { id } });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2025' === e.code)
        throw new NotFoundException('The requested item does not exist.');
      throw e;
    }
  }
}
