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
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { Request as ExpressRequest } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { User } from './user.interface';

@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findMany() {
    return { users: await this.usersService.findMany() };
  }

  @UseGuards(JwtGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Request() req: ExpressRequest) {
    return { user: await this.authService.me(req.user as any) };
  }

  @UseGuards(JwtGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: ExpressRequest,
    @Body() updateDto: UpdateUserDto,
  ) {
    const { id } = req.user as any as Pick<User, 'id'>;
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
