import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './interfaces/user';
import { faker } from '@faker-js/faker';
import { PrismaService } from '../prisma/prisma.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Argon2Service } from '../argon2/argon2.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ForbiddenException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

const argon2Service: Argon2Service = {
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

function randomPassword() {
  return faker.internet.password({ length: 16, memorable: false });
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
    email: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    hashed_password: user.hashed_password,
    deleted_at: user.deleted_at,
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
    hashed_password: await argon2Service.hashPassword(password),
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

  beforeEach(async () => {
    prismaService = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: Argon2Service, useValue: argon2Service },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
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
    it("should return the user by it's ID", async () => {
      const gdprCompliance = false;
      const dbUsers = await makeDbUsers();
      const filtered = dbUsers[0];
      const expected = [filtered].map(
        !gdprCompliance ? getUserShort : getGdprCompliantUser,
      )[0];
      prismaService.users.findUnique.mockResolvedValueOnce(expected as any);

      const user = await usersService.findUnique(filtered.id, gdprCompliance);
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          email: !gdprCompliance,
          firstname: true,
          lastname: true,
          last_connection: !gdprCompliance,
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

      const user = await usersService.findUniqueByIDForAuthentication(
        filtered.id,
      );
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          id: true,
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
      const user = await usersService.findUniqueByIDForAuthentication(
        filtered.id,
      );
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: filtered.id, deleted_at: null },
        select: {
          id: true,
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
      const user = await usersService.findUniqueByEmailForAuthentication(
        filtered.email,
      );
      expect(user).toStrictEqual(expected);
      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { email: filtered.email, deleted_at: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
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
          /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
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

      const prismaError = new PrismaClientKnownRequestError(
        'Email is already taken.',
        {
          code: 'P2002',
          clientVersion: 'NO_CLUE',
        },
      );
      prismaService.users.create.mockRejectedValueOnce(prismaError);
      expect(usersService.create(createUserDto)).rejects.toStrictEqual(
        prismaError,
      );
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
      expect(usersService.create(createUserDto)).rejects.toStrictEqual(
        nestException,
      );
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
          id: true,
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
          id: true,
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
          id: true,
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

      expect(usersService.update(invalidID, {} as any)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: invalidID, deleted_at: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (current password does not match, invalid credentials)', async () => {
      const user = await makeFakeUser(false, false, false, "BadPassword");
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: "NotMatchingPassword",
        firstname: "NewFirstname",
        lastname: "NewLastname"
      };
      expect(usersService.update(user.id, updateDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (new password is less than 8 characters)', async () => {
      const user = await makeFakeUser(false, false, false, "BadPassword");
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: "BadPassword",
        new_password: "<8chars"
      };
      expect(usersService.update(user.id, updateDto)).rejects.toThrow(
        UnprocessableEntityException,
      );

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
    it('should not update user (new password is the same as the current one)', async () => {
      const user = await makeFakeUser(false, false, false, "BadPassword");
      const foundUserForAuth = {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        hashed_password: user.hashed_password
      };
      prismaService.users.findUnique.mockResolvedValueOnce(
        foundUserForAuth as any,
      );

      const updateDto: UpdateUserDto = {
        current_password: "BadPassword",
        new_password: "BadPassword"
      };
      expect(usersService.update(user.id, updateDto)).rejects.toThrow(
        UnprocessableEntityException,
      );

      expect(prismaService.users.findUnique).toHaveBeenCalledWith({
        where: { id: user.id, deleted_at: null },
        select: {
          id: true,
          email: true,
          firstname: true,
          lastname: true,
          hashed_password: true,
        },
      });
    });
  });
});
