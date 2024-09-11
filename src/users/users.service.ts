import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserFull } from './user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { Argon2Service } from 'src/argon2/argon2.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly argon2Service: Argon2Service,
  ) {}

  async findMany() {
    return await this.prismaService.users.findMany({
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        created_at: true,
      },
    });
  }

  async findUnique(id: string) {
    const user = await this.prismaService.users.findUnique({
      where: { id },
      select: {
        email: true,
        firstname: true,
        lastname: true,
        last_connection: true,
        created_at: true,
      },
    });
    if (null === user)
      throw new NotFoundException('The requested user does not exist.');
    return user;
  }

  async findUniqueForAuthentication(email: string) {
    const user = await this.prismaService.users.findUnique({
      where: { email },
      select: {
        id: true,
        hashed_password: true,
      },
    });
    if (null === user)
      throw new NotFoundException('The requested user does not exist.');
    return user;
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
    const _user = await this.prismaService.users.findUnique({
      where: { id },
    });
    if (null === _user)
      throw new NotFoundException('The requested user does not exist.');

    if (
      8 > updateDto.current_password.length ||
      !(await this.argon2Service.verifyPassword(
        _user.hashed_password,
        updateDto.current_password,
      ))
    )
      throw new ForbiddenException('Bad credentials.');

    const updatedUser = {
      email: updateDto.email ?? _user.email,
      firstname: updateDto.firstname ?? _user.firstname,
      lastname: updateDto.lastname ?? _user.lastname,
      hashed_password: _user.hashed_password,
    };

    if (undefined !== updateDto.new_password)
      if (8 > updateDto.new_password.length)
        throw new UnprocessableEntityException(
          'Password must be at least 8 characters long.',
        );
      else
        updatedUser.hashed_password = await this.argon2Service.hashPassword(
          updateDto.new_password,
        );

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
