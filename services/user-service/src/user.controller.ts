import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../user.service';
import {
  RegisterUserDto,
  LoginUserDto,
  UpdateUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ResetPasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
} from '../dto/user.dto';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: await this.userService.checkDatabase(),
    };
  }

  // Public endpoints
  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return this.userService.register(registerUserDto);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.userService.login(loginUserDto);
  }

  @Post('refresh')
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.userService.refreshToken(body.refreshToken);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.userService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.userService.resetPassword(resetPasswordDto);
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return this.userService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerificationEmail(@Body() body: { email: string }) {
    return this.userService.resendVerificationEmail(body.email);
  }

  // Protected endpoints
  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@Headers('x-user-id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, updateProfileDto);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @Headers('x-user-id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(userId, changePasswordDto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Headers('x-user-id') userId: string,
    @Body() body: { sessionId?: string },
  ) {
    return this.userService.logout(userId, body.sessionId);
  }

  // Address management
  @Get('addresses')
  @UseGuards(AuthGuard)
  async getAddresses(@Headers('x-user-id') userId: string) {
    return this.userService.getAddresses(userId);
  }

  @Post('addresses')
  @UseGuards(AuthGuard)
  async createAddress(
    @Headers('x-user-id') userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.userService.createAddress(userId, createAddressDto);
  }

  @Put('addresses/:id')
  @UseGuards(AuthGuard)
  async updateAddress(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(userId, id, updateAddressDto);
  }

  @Delete('addresses/:id')
  @UseGuards(AuthGuard)
  async deleteAddress(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.userService.deleteAddress(userId, id);
  }

  // Admin endpoints
  @Get('admin/users')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listUsers(@Query() query: any) {
    return this.userService.listUsers(query);
  }

  @Get('admin/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUserStats() {
    return this.userService.getUserStats();
  }

  @Put('admin/users/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.userService.updateUserStatus(id, body.status);
  }

  // Validation endpoint for API Gateway
  @Post('validate-token')
  async validateToken(@Body() body: { token: string }) {
    const user = await this.userService.validateToken(body.token);
    return { valid: !!user, user };
  }
}