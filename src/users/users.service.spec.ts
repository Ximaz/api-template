import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './interfaces/user';
import { faker } from '@faker-js/faker';
import { PrismaService } from '../prisma/prisma.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Argon2Service } from '../argon2/argon2.service';

async function hashPassword(password: string) {
  return password + '-hashed';
}

async function verifyPassword(hash: string, password: string) {
  return hash === (await hashPassword(password));
}

function randomPassword() {
  return faker.internet.password({ length: 16, memorable: false });
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
  const argon2Service: Argon2Service = {
    hashPassword: jest.fn().mockImplementation(hashPassword),
    verifyPassword: jest.fn().mockImplementation(verifyPassword),
  };

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

  describe('getAll', () => {
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
    });
  });
});
