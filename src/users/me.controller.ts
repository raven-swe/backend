import { Body, Controller, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dtos/change-password.dto';

@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Put('/password')
  // TODO: enable after merging login functionality
  // @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    // @Request() req -- enable after merging login functionality
  ) {
    // const userId = req.user.id;
    const userId = BigInt(18); // temporary userId for testing
    return this.usersService.changePassword(userId, changePasswordDto);
  }
}
