import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Argon2Service } from '../argon2/argon2.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import {
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';

const users = [
  {
    id: '30613b7a-11a4-4864-a05b-2d7854b00e6e',
    email: 'Vivianne.Blanda@gmail.com',
    hashed_password: 'MygfvmlwZi3agN6X-hashed',
    firstname: 'Vivianne',
    lastname: 'Blanda',
    is_admin: false,
    last_connection: null,
    created_at: '1974-07-15T23:13:27.696Z',
    updated_at: '1971-02-12T01:22:06.614Z',
    deleted_at: null,
  },
  {
    id: '4efa9c4a-49da-432a-b806-b4d52b6fc765',
    email: 'Enola.Sipes97@hotmail.com',
    hashed_password: 'Ti7E99bVxlXxmIiy-hashed',
    firstname: 'Enola',
    lastname: 'Sipes',
    is_admin: false,
    last_connection: null,
    created_at: '1995-06-20T07:58:27.405Z',
    updated_at: '1973-02-22T13:40:33.840Z',
    deleted_at: '1946-01-16T09:12:49.529Z',
  },
  {
    id: '6104ad42-14c9-4a6b-a12b-7562f49ab4d0',
    email: 'Shayne_Dare@hotmail.com',
    hashed_password: 'liNBKOFz19SAcAeJ-hashed',
    firstname: 'Shayne',
    lastname: 'Dare',
    is_admin: false,
    last_connection: '2025-01-25T19:53:04.887Z',
    created_at: '1955-07-03T18:54:20.168Z',
    updated_at: '2004-02-09T00:16:02.931Z',
    deleted_at: null,
  },
  {
    id: 'dd9f2e0e-9eaf-442e-9c38-038af26ad2fc',
    email: 'Gretchen.Emard46@gmail.com',
    hashed_password: 'd4NpYSZXtFkSmPsv-hashed',
    firstname: 'Gretchen',
    lastname: 'Emard',
    is_admin: true,
    last_connection: null,
    created_at: '1949-07-30T00:15:07.021Z',
    updated_at: '1964-05-16T09:01:12.643Z',
    deleted_at: null,
  },
  {
    id: '9553b48a-6983-4783-ab44-14411bd4ed57',
    email: 'Orlo.Feest@hotmail.com',
    hashed_password: 'J5Vy6IrNLI9buRgS-hashed',
    firstname: 'Orlo',
    lastname: 'Feest',
    is_admin: false,
    last_connection: '2025-08-31T01:20:44.907Z',
    created_at: '1950-04-02T21:33:46.865Z',
    updated_at: '1948-04-28T05:29:42.045Z',
    deleted_at: '1955-02-25T22:47:26.291Z',
  },
  {
    id: 'd234318f-8f9e-4a15-af3d-f752f7e04b27',
    email: 'Zachary_Feil@gmail.com',
    hashed_password: 'FguCWpHgIzleQuhn-hashed',
    firstname: 'Zachary',
    lastname: 'Feil',
    is_admin: true,
    last_connection: '2024-05-18T06:50:24.750Z',
    created_at: '1972-01-11T19:04:01.657Z',
    updated_at: '2006-05-06T07:34:56.061Z',
    deleted_at: null,
  },
  {
    id: '43820a4e-77af-491f-84e3-94808395015b',
    email: 'Mason_Runte@hotmail.com',
    hashed_password: 'RdaOvJff2uWAetfP-hashed',
    firstname: 'Mason',
    lastname: 'Runte',
    is_admin: true,
    last_connection: null,
    created_at: '1955-07-10T01:34:21.619Z',
    updated_at: '1987-03-03T13:08:34.026Z',
    deleted_at: '1989-01-28T10:10:58.753Z',
  },
  {
    id: 'e72af15a-3d6b-4a04-8855-d06ced48e94b',
    email: 'Ken_Kuhic@gmail.com',
    hashed_password: 'yWHGF97ljT5Kgx4X-hashed',
    firstname: 'Ken',
    lastname: 'Kuhic',
    is_admin: true,
    last_connection: '2024-02-09T00:21:28.307Z',
    created_at: '1986-08-31T16:34:03.560Z',
    updated_at: '2006-07-31T08:22:01.381Z',
    deleted_at: '1984-11-16T15:14:41.361Z',
  },
];

describe('AuthService', () => {
  let authService: AuthService;
  let argon2Service: Argon2Service;
  let usersService: Partial<UsersService>;

  beforeEach(async () => {
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
    usersService = {
      findUniqueByEmailForAuthentication: jest
        .fn()
        .mockImplementation((email: string) =>
          Promise.resolve(
            users
              .filter(
                (user) => null === user.deleted_at && email === user.email,
              )
              .map((user) => ({
                id: user.id,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                hashed_password: user.hashed_password,
              }))[0] || null,
          ),
        ),
      create: jest
        .fn()
        .mockImplementation((createUserDto: CreateUserDto) =>
          createUserDto.has_accepted_terms_and_conditions
            ? undefined ===
              users.find((user) => createUserDto.email === user.email)
              ? Promise.resolve({ id: randomUUID() })
              : Promise.reject(
                  new ForbiddenException('Email is already taken.'),
                )
            : Promise.reject(
                new ForbiddenException(
                  'User must accept terms and conditions.',
                ),
              ),
        ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: Argon2Service, useValue: argon2Service },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Register a new user', () => {
    it('should create the user', async () => {
      const registerDto: RegisterDto = {
        email: 'email.is.not.used@example.com',
        password: 'password',
        firstname: 'John',
        lastname: 'DOE',
        has_accepted_terms_and_conditions: true,
      };

      expect(await authService.register(registerDto)).toStrictEqual({
        id: expect.stringMatching(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        ),
      });
      expect(argon2Service.hashPassword).toHaveBeenCalledWith(
        registerDto.password,
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        hashed_password: `${registerDto.password}-hashed`,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        has_accepted_terms_and_conditions: true,
      });
    });

    it('should not create the user (password is less than 8 bytes)', async () => {
      const registerDto: RegisterDto = {
        email: 'email.is.not.used@example.com',
        password: 'badpswd',
        firstname: 'John',
        lastname: 'DOE',
        has_accepted_terms_and_conditions: true,
      };

      try {
        await authService.register(registerDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new UnprocessableEntityException(
            'Password must be at least 8 characters long.',
          ),
        );
      }
      expect(argon2Service.hashPassword).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });
    it('should not create the user (email is already taken)', async () => {
      const registerDto: RegisterDto = {
        email: users[0].email,
        password: 'password',
        firstname: 'John',
        lastname: 'DOE',
        has_accepted_terms_and_conditions: true,
      };

      try {
        await authService.register(registerDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new ForbiddenException('Email is already taken.'),
        );
      }

      expect(argon2Service.hashPassword).toHaveBeenCalledWith(
        registerDto.password,
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        hashed_password: `${registerDto.password}-hashed`,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        has_accepted_terms_and_conditions: true,
      });
    });

    it('should not create the user (terms and conditions were rejected)', async () => {
      const registerDto: RegisterDto = {
        email: 'email.is.not.used@example.com',
        password: 'password',
        firstname: 'John',
        lastname: 'DOE',
        has_accepted_terms_and_conditions: false,
      };

      try {
        await authService.register(registerDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new ForbiddenException('User must accept terms and conditions.'),
        );
      }

      expect(argon2Service.hashPassword).toHaveBeenCalledWith(
        registerDto.password,
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        hashed_password: `${registerDto.password}-hashed`,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        has_accepted_terms_and_conditions:
          registerDto.has_accepted_terms_and_conditions,
      });
    });
  });

  describe('Login', () => {
    it('should return the current user', async () => {
      const user = users[0];
      const loginDto: LoginDto = {
        email: user.email,
        password: user.hashed_password.replace('-hashed', ''),
      };

      expect(await authService.login(loginDto)).toStrictEqual({
        id: expect.stringMatching(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
        ),
      });
      expect(
        usersService.findUniqueByEmailForAuthentication,
      ).toHaveBeenCalledWith(loginDto.email);

      expect(argon2Service.verifyPassword).toHaveBeenCalledWith(
        user.hashed_password,
        loginDto.password,
      );
    });

    it('should not return a user (password is less than 8 bytes)', async () => {
      const user = users[0];
      const loginDto: LoginDto = {
        email: user.email,
        password: 'badpswd',
      };

      try {
        await authService.login(loginDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new UnauthorizedException('Invalid credentials.'),
        );
      }
      expect(
        usersService.findUniqueByEmailForAuthentication,
      ).not.toHaveBeenCalled();
      expect(argon2Service.verifyPassword).not.toHaveBeenCalled();
    });

    it('should not return a user (user does not exist)', async () => {
      const loginDto: LoginDto = {
        email: 'invalid.email@example.com',
        password: 'password',
      };

      try {
        await authService.login(loginDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new UnauthorizedException('Invalid credentials.'),
        );
      }
      expect(
        usersService.findUniqueByEmailForAuthentication,
      ).toHaveBeenCalledWith(loginDto.email);
      expect(argon2Service.verifyPassword).not.toHaveBeenCalled();
    });

    it('should not return a user (password do not match)', async () => {
      const user = users[0];
      const loginDto: LoginDto = {
        email: user.email,
        password: 'invalid password',
      };

      try {
        await authService.login(loginDto);
      } catch (e) {
        expect(e).toStrictEqual(
          new UnauthorizedException('Invalid credentials.'),
        );
      }
      expect(
        usersService.findUniqueByEmailForAuthentication,
      ).toHaveBeenCalledWith(loginDto.email);
      expect(argon2Service.verifyPassword).toHaveBeenCalledWith(
        user.hashed_password,
        loginDto.password,
      );
    });
  });
});
