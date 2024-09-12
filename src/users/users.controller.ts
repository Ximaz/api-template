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
import { User } from './interfaces/user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findMany() {
    const users = await this.usersService.findMany();
    return { users };
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findUnique(@Param('id') id: string) {
    const user = await this.usersService.findUnique(id);
    if (null === user) throw new NotFoundException('User not found.');

    return { user };
  }

  @UseGuards(JwtGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Request() req: ExpressRequest) {
    const { id } = req.user as Pick<User, 'id'>
    const user = await this.usersService.findUnique(id, false);
    if (null === user) throw new NotFoundException('User not found.');

    return { user };
  }

  @UseGuards(JwtGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: ExpressRequest,
    @Body() updateDto: UpdateUserDto,
  ) {
    const { id } = req.user as Pick<User, 'id'>;
    const user = await this.usersService.update(id, updateDto);
    return { user };
  }

  @UseGuards(JwtGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: ExpressRequest): Promise<void> {
    const { id } = req.user as Pick<User, 'id'>;
    return await this.usersService.delete(id);
  }
}
