import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

export class ChangePasswordDto extends PickType(CreateUserDto, [
  'password',
] as const) {}
