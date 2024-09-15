import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserAuthentication, UserShort } from './interfaces/user';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UpdateUserDto } from './dto/update-user.dto';
import { Argon2Service } from '../argon2/argon2.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly argon2Service: Argon2Service,
  ) {}

  private static errorHandler(e: any) {
    if (e instanceof PrismaClientKnownRequestError) {
      if ('P2025' === e.code) return new NotFoundException('User not found.');
      if ('P2002' === e.code) {
        const field = e.message.split(/\s/).slice(-1)[0];
        return new ForbiddenException(
          `${field[0].toUpperCase() + field.slice(1).toLowerCase()} is already taken.`,
        );
      }
    }
    return e;
  }

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
        hashed_password: true,
      },
    });
  }

  findUniqueByIDForUpdate(
    id: string,
  ): Promise<Omit<UserShort, 'id'> & { hashed_password: string }> {
    return this.prismaService.users.findUnique({
      where: { id, deleted_at: null },
      select: {
        email: true,
        firstname: true,
        lastname: true,
        hashed_password: true,
      },
    });
  }

  async create(createUserDto: CreateUserDto) {
    if (!createUserDto.has_accepted_terms_and_conditions)
      throw new ForbiddenException('User must accept terms and conditions.');
    try {
      return await this.prismaService.users.create({
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
    } catch (e) {
      throw UsersService.errorHandler(e);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findUniqueByIDForUpdate(id);
    if (null === user) throw new NotFoundException('User not found.');

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

    try {
      return await this.prismaService.users.update({
        where: { id },
        data: updatedUser,
        select: {
          email: true,
          firstname: true,
          lastname: true,
          updated_at: true,
        },
      });
    } catch (e) {
      throw UsersService.errorHandler(e);
    }
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
      throw UsersService.errorHandler(e);
    }
  }

  async restore(id: string) {
    try {
      await this.prismaService.users.update({
        where: { id },
        data: { deleted_at: null },
      });
    } catch (e) {
      throw UsersService.errorHandler(e);
    }
  }
}
