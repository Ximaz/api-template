import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './interfaces/user';
import { faker } from '@faker-js/faker';
import { PrismaService } from '../prisma/prisma.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Argon2Service } from '../argon2/argon2.service';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

function randomPassword() {
  return faker.internet.password({ length: 16, memorable: false });
}

async function hashPassword(password: string) {
  return `${password}-hashed`;
}

function getGdprCompliantUser(user: User) {
  return {
    firstname: user.firstname,
    lastname: user.lastname,
    created_at: user.created_at,
  };
}

function getUserShort(user: User) {
  return {
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    last_connection: user.last_connection,
    created_at: user.created_at,
  };
}

function getUserForAuthentication(user: User) {
  return {
    id: user.id,
    hashed_password: user.hashed_password,
  };
}

async function makeFakeUser(
  isAdmin: boolean = false,
  hasLastConnection: boolean = false,
  isDeleted: boolean = false,
  password: string,
): Promise<User> {
  const firstname = faker.person.firstName();
  const lastname = faker.person.lastName();
  const email = faker.internet.email({
    firstName: firstname,
    lastName: lastname,
  });
  return {
    id: faker.string.uuid(),
    email,
    hashed_password: await hashPassword(password),
    firstname,
    lastname,
    is_admin: isAdmin,
    last_connection: [null, faker.date.anytime()][hasLastConnection ? 1 : 0],
    created_at: faker.date.birthdate(),
    updated_at: faker.date.birthdate(),
    deleted_at: [null, faker.date.birthdate()][isDeleted ? 1 : 0],
  };
}

async function makeDbUsers() {
  return [
    await makeFakeUser(false, false, false, randomPassword()),
    await makeFakeUser(false, false, true, randomPassword()),
    await makeFakeUser(false, true, false, randomPassword()),
    await makeFakeUser(true, false, false, randomPassword()),
    await makeFakeUser(false, true, true, randomPassword()),
    await makeFakeUser(true, true, false, randomPassword()),
    await makeFakeUser(true, false, true, randomPassword()),
    await makeFakeUser(true, true, true, randomPassword()),
  ];
}

describe('UsersService', () => {
  let usersService: UsersService;
  let prismaService: DeepMockProxy<PrismaClient>;

  let argon2Service: Argon2Service;

  beforeEach(async () => {
    prismaService = mockDeep<PrismaClient>();
    argon2Service = {
      hashPassword: jest
        .fn()
        .mockImplementation((password: string) =>
          Promise.resolve(password + '-hashed'),
        ),
      verifyPassword: jest
        .fn()
        .mockImplementation(
          async (hash: string, password: string) =>
            hash === (await argon2Service.hashPassword(password)),
        ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: Argon2Service, useValue: argon2Service },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  describe('findMany', () => {
    it('should return the list of users', async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers.filter((user) => null === user.deleted_at);
      const expected = filtered.map((user) => ({
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
      }));
      prismaService.users.findMany.mockResolvedValueOnce(expected as any);

      const users = await usersService.findMany();
      expect(users).toStrictEqual(expected);
      expect(prismaService.users.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        select: {
          id: true,
          firstname: true,
          lastname: true,
        },
      });
    });
  });

  describe('findUnique', () => {
    it("should return the full user by it's ID", async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(getUserShort)[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUnique(filtered.id, false);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          last_connection: true,
          created_at: true,
        },
      });
    });

    it("should return the partial user by it's ID", async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(getGdprCompliantUser)[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUnique(filtered.id, true);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: false,
          firstname: true,
          lastname: true,
          last_connection: false,
          created_at: true,
        },
      });
    });

    it("should return the partial user by it's ID (default GDPR value)", async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(getGdprCompliantUser)[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUnique(filtered.id);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: false,
          firstname: true,
          lastname: true,
          last_connection: false,
          created_at: true,
        },
      });
    });

    it('should return null for deleted users', async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers.find((user) => null !== user.deleted_at);
      const expected = null;
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUnique(filtered.id, false);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          last_connection: true,
          created_at: true,
        },
      });
    });
  });

  describe("find user for authentication by it's ID", () => {
    it("should return the user by it's ID", async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(getUserForAuthentication)[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUniqueByIDForUpdate(filtered.id);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });

    it('should return null for deleted users', async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers.find((user) => null !== user.deleted_at);
      const expected = null;
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);
      const user = await usersService.findUniqueByIDForUpdate(filtered.id);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
  });

  describe("find user for authentication by it's email", () => {
    it("should return the user by it's email", async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(getUserForAuthentication)[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUniqueByEmailForAuthentication(
        filtered.email,
      );
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { email: filtered.email, deleted_at: null },
        select: {
          id: true,
          hashed_password: true,
        },
      });
    });

    it('should return null for deleted users', async () => {
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers.find((user) => null !== user.deleted_at);
      const expected = null;
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);
      const user = await usersService.findUniqueByEmailForAuthentication(
        filtered.email,
      );
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { email: filtered.email, deleted_at: null },
        select: {
          id: true,
          hashed_password: true,
        },
      });
    });
  });

  describe('User creation', () => {
    it('should create a user', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const expected = {
        id: expect.stringMatching(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        ),
      };
      const createUserDto: CreateUserDto = {
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
        has_accepted_terms_and_conditions: true,
      };
      prismaService.users.create.mockResolvedValueOnce(expected as any);

      const result = await usersService.create(createUserDto);
      expect(result).toStrictEqual(expected);
      expect(prismaService.users.create).toHaveBeenCalledWith({
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
    });

    it('should not create the user (email taken)', async () => {
      const dbUsers = await makeDbUsers();
      const user = dbUsers[0];
      const createUserDto: CreateUserDto = {
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
        has_accepted_terms_and_conditions: true,
      };

      prismaService.users.create.mockRejectedValueOnce(
        new PrismaClientKnownRequestError(
          'Unique constraint failed on the email',
          { code: 'P2002', clientVersion: 'NO_CLUE' },
        ),
      );
      try {
        await usersService.create(createUserDto);
        fail();
      } catch (e) {
        expect(e).toStrictEqual(
          new ForbiddenException('Email is already taken.'),
        );
      }
    });

    it('should not create the user (did not accept terms and conditions)', async () => {
      const dbUsers = await makeDbUsers();
      const user = dbUsers[0];
      const createUserDto: CreateUserDto = {
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
        has_accepted_terms_and_conditions: false,
      };

      const nestException = new ForbiddenException(
        'User must accept terms and conditions.',
      );
      prismaService.users.create.mockRejectedValueOnce(nestException);
      try {
        await usersService.create(createUserDto);
        fail();
      } catch (e) {
        expect(e).toStrictEqual(nestException);
      }
    });
  });

  describe('User update', () => {
    it("should update all user's attributes", async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const updateUserDto: UpdateUserDto = {
        current_password: 'BadPassword',
        email: 'NewEmail',
        new_password: 'NewPassword',
        firstname: 'NotTheSameFirstname',
        lastname: 'NotTheSameLastname',
      };

      const updatedUser = {
        email: updateUserDto.email ?? user.email,
        firstname: updateUserDto.firstname ?? user.firstname,
        lastname: updateUserDto.lastname ?? user.lastname,
        hashed_password: updateUserDto.new_password
          ? await argon2Service.hashPassword(updateUserDto.new_password)
          : user.hashed_password,
      };

      const prismaUpdateResult = {
        email: updatedUser.email,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        updated_at: expect.any(Date),
      };

      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      prismaService.users.update.mockResolvedValueOnce(
        prismaUpdateResult as any,
      );

      const updateResult = await usersService.update(user.id, updateUserDto);
      expect(updateResult).toStrictEqual(prismaUpdateResult);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });

      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: updatedUser,
        select: {
          email: true,
          firstname: true,
          lastname: true,
          updated_at: true,
        },
      });
    });
    it("should update partial user's attributes", async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const updateUserDto: UpdateUserDto = {
        current_password: 'BadPassword',
        email: user.email,
        new_password: 'NewPassword',
        firstname: 'NotTheSameFirstname',
        lastname: 'NotTheSameLastname',
      };

      const updatedUser = {
        email: user.email, // must not have been updated
        firstname: updateUserDto.firstname ?? user.firstname,
        lastname: updateUserDto.lastname ?? user.lastname,
        hashed_password: updateUserDto.new_password
          ? await argon2Service.hashPassword(updateUserDto.new_password)
          : user.hashed_password,
      };

      const prismaUpdateResult = {
        email: updatedUser.email,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        updated_at: expect.any(Date),
      };

      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      prismaService.users.update.mockResolvedValueOnce(
        prismaUpdateResult as any,
      );

      const updateResult = await usersService.update(user.id, updateUserDto);
      expect(updateResult).toStrictEqual(prismaUpdateResult);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });

      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: updatedUser,
        select: {
          email: true,
          firstname: true,
          lastname: true,
          updated_at: true,
        },
      });
    });

    it("should update no user's attribute", async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const updateUserDto: UpdateUserDto = {
        current_password: 'BadPassword',
      };

      const updatedUser = {
        email: user.email, // must not have been updated
        firstname: updateUserDto.firstname ?? user.firstname,
        lastname: updateUserDto.lastname ?? user.lastname,
        hashed_password: updateUserDto.new_password
          ? await argon2Service.hashPassword(updateUserDto.new_password)
          : user.hashed_password,
      };

      const prismaUpdateResult = {
        email: updatedUser.email,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        updated_at: expect.any(Date),
      };

      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      prismaService.users.update.mockResolvedValueOnce(
        prismaUpdateResult as any,
      );

      const updateResult = await usersService.update(user.id, updateUserDto);
      expect(updateResult).toStrictEqual(prismaUpdateResult);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: updatedUser,
        select: {
          email: true,
          firstname: true,
          lastname: true,
          updated_at: true,
        },
      });
    });
    it('should not update user (not found)', async () => {
      const invalidID = 'definitely not a valid user ID';
      const foundUserForAuth = null;
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      try {
        await usersService.update(invalidID, {} as any);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
      }

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: invalidID, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (current password does not match, invalid credentials)', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: 'NotMatchingPassword',
        firstname: 'NewFirstname',
        lastname: 'NewLastname',
      };

      try {
        await usersService.update(user.id, updateDto);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
      }

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (new password is less than 8 characters)', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: 'BadPassword',
        new_password: '<8chars',
      };

      try {
        await usersService.update(user.id, updateDto);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(UnprocessableEntityException);
      }

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (new password is the same as the current one)', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password,
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: 'BadPassword',
        new_password: 'BadPassword',
      };

      try {
        await usersService.update(user.id, updateDto);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(UnprocessableEntityException);
      }

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
  });

  describe('User deletion', () => {
    it('should delete the user partially', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');

      const result = await usersService.delete(user.id, false);
      expect(result).toBe(void 0);
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
      });
    });
    it('should delete the user partially (default GDPR value)', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');

      const result = await usersService.delete(user.id);
      expect(result).toBe(void 0);
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
      });
    });
    it('should delete the user completely', async () => {
      const user = await makeFakeUser(false, false, false, 'BadPassword');

      const result = await usersService.delete(user.id, true);
      expect(result).toBe(void 0);
      expect(prismaService.users.delete).toHaveBeenCalledWith({
        where: { id: user.id },
      });
    });
    it('should throw an error (user not found)', async () => {
      const invalidID = "surely it's an invalid ID";

      prismaService.users.update.mockRejectedValueOnce(
        new PrismaClientKnownRequestError('User not found', {
          code: 'P2025',
          clientVersion: 'NO_CLUE',
        }),
      );

      try {
        await usersService.delete(invalidID, false);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
      }

      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: invalidID, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
      });

      prismaService.users.delete.mockRejectedValueOnce(
        new PrismaClientKnownRequestError('User not found', {
          code: 'P2025',
          clientVersion: 'NO_CLUE',
        }),
      );

      try {
        await usersService.delete(invalidID, true);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
      }

      expect(prismaService.users.delete).toHaveBeenCalledWith({
        where: { id: invalidID },
      });
    });
  });

  describe('User restore', () => {
    it('should restore a deleted user', async () => {
      const user = await makeFakeUser(false, false, true, 'BadPassword');

      prismaService.users.update.mockResolvedValue({} as any);
      const result = await usersService.restore(user.id);
      expect(result).toBe(void 0);
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { deleted_at: null },
      });
    });

    it('should throw an error (user not found)', async () => {
      const invalidID = 'bad user ID';

      prismaService.users.update.mockRejectedValueOnce(
        new PrismaClientKnownRequestError('User not found', {
          code: 'P2025',
          clientVersion: 'NO_CLUE',
        }),
      );
      try {
        await usersService.restore(invalidID);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundException);
      }
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { id: invalidID },
        data: { deleted_at: null },
      });
    });
  });

  describe('error handler', () => {
    it('should return an error which is not P2025', async () => {
      prismaService.users.findUnique.mockResolvedValueOnce(
        await makeFakeUser(false, false, false, 'password'),
      );
      prismaService.users.update.mockRejectedValueOnce(
        new PrismaClientKnownRequestError('Unexpected error', {
          code: 'P1000',
          clientVersion: 'NO_CLUE',
        }),
      );
      try {
        await usersService.update('id', { current_password: 'password' });
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(PrismaClientKnownRequestError);
      }
    });
  });
});
