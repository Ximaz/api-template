import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @IsOptional()
  readonly email?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly new_password?: string;

  @IsString()
  @IsNotEmpty()
  @IsNotEmpty()
  readonly current_password: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly firstname?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly lastname?: string;
}
