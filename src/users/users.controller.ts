import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  Request,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { Request as ExpressRequest } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { User } from './interfaces/user';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findMany() {
    const users = await this.usersService.findMany();
    return { users: users };
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findUnique(@Param("id") id: string) {
    const user = await this.usersService.findUnique(id);
    if (null === user)
      throw new NotFoundException("User not found.");

    return { user: user };
  }

  @UseGuards(JwtGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Request() req: ExpressRequest) {
    const me = await this.authService.me(req.user as any);
    if (null === me)
      throw new NotFoundException("User not found.");

    return { user: me };
  }

  @UseGuards(JwtGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: ExpressRequest,
    @Body() updateDto: UpdateUserDto,
  ) {
    const { id } = req.user as Pick<User, 'id'>;
    return { user: await this.usersService.update(id, updateDto) };
  }

  @UseGuards(JwtGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: ExpressRequest): Promise<void> {
    const { id } = req.user as any as Pick<User, 'id'>;
    return await this.usersService.delete(id);
  }
}
