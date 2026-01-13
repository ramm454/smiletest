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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import {
  RegisterUserDto,
  LoginUserDto,
  UpdateUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ResetPasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  SetupMFADto,
  VerifyMFADto,
  EnableMFADto,
  GenerateBackupCodesDto,
  CreateTagDto,
  AssignTagsDto,
  UserFilterDto,
  ConsentDto,
  ConsentHistoryDto,
  LinkAccountDto,
  UnlinkAccountDto,
  ExportUsersDto,
  ImportUsersDto,
  // Add GDPR-related DTOs
  DataSubjectRequestDto,
  DataPortabilityRequestDto,
  DataBreachReportDto,
  CookiePreferencesDto,
} from './dto/user.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceAuthGuard } from '../auth/guards/service-auth.guard';
import { CreateGuestDto, ConvertGuestDto, GuestLoginDto } from './dto/guest.dto';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly gdprService: any, // You'll need to inject your GDPR service
  ) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      database: await this.userService.checkDatabase(),
    };
  }

  // ============ SERVICE ENDPOINTS (Internal Service Calls) ============
  @Get(':id/validate')
  @UseGuards(ServiceAuthGuard)
  async validateUser(@Param('id') userId: string) {
    const user = await this.userService.getUser(userId);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      eligible: user.status === 'ACTIVE' && user.emailVerified,
      isGuest: user.isGuest,
      guestExpiresAt: user.guestExpiresAt,
      emailVerified: user.emailVerified,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profiles?.[0]
    };
  }

  // ============ PUBLIC ENDPOINTS ============
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

  // ============ GUEST ENDPOINTS ============
  @Post('guest/create')
  async createGuestSession(@Body() dto: CreateGuestDto) {
    return this.userService.createGuestSession(dto);
  }

  @Post('guest/convert')
  async convertGuestToUser(@Body() dto: ConvertGuestDto) {
    return this.userService.convertGuestToUser(dto.sessionId, dto);
  }

  @Get('guest/session/:sessionId')
  async getGuestSession(@Param('sessionId') sessionId: string) {
    return this.userService.getGuestSession(sessionId);
  }

  @Put('guest/preferences/:sessionId')
  async updateGuestPreferences(
    @Param('sessionId') sessionId: string,
    @Body() body: { preferences: any },
  ) {
    return this.userService.updateGuestPreferences(sessionId, body.preferences);
  }

  @Post('guest/cart/:sessionId')
  async saveGuestCart(
    @Param('sessionId') sessionId: string,
    @Body() body: { cartItems: any[] },
  ) {
    return this.userService.saveGuestCart(sessionId, body.cartItems);
  }

  @Post('guest/login')
  async guestLogin(@Body() dto: GuestLoginDto) {
    return this.userService.getGuestSession(dto.sessionId);
  }

  // ============ PROTECTED ENDPOINTS (Requires Auth) ============
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

  // ============ ADDRESS MANAGEMENT ============
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

  // ============ MFA ENDPOINTS ============
  @Post('mfa/setup')
  @UseGuards(AuthGuard)
  async setupMFA(
    @Headers('x-user-id') userId: string,
    @Body() dto: SetupMFADto,
  ) {
    return this.userService.setupMFA(userId, dto);
  }

  @Post('mfa/verify')
  @UseGuards(AuthGuard)
  async verifyMFA(
    @Headers('x-user-id') userId: string,
    @Body() dto: VerifyMFADto,
  ) {
    return this.userService.verifyMFA(userId, dto);
  }

  @Post('mfa/enable')
  @UseGuards(AuthGuard)
  async enableMFA(
    @Headers('x-user-id') userId: string,
    @Body() dto: EnableMFADto,
  ) {
    return this.userService.enableMFA(userId, dto);
  }

  @Post('mfa/backup-codes/generate')
  @UseGuards(AuthGuard)
  async generateBackupCodes(
    @Headers('x-user-id') userId: string,
    @Body() dto: GenerateBackupCodesDto,
  ) {
    return this.userService.generateBackupCodes(userId, dto);
  }

  // ============ CONSENT ENDPOINTS ============
  @Post('consent')
  @UseGuards(AuthGuard)
  async recordConsent(
    @Headers('x-user-id') userId: string,
    @Body() dto: ConsentDto,
    @Req() req: Request,
  ) {
    // Add IP and user agent if not provided
    if (!dto.ipAddress) dto.ipAddress = req.ip;
    if (!dto.userAgent) dto.userAgent = req.headers['user-agent'];
    
    return this.userService.recordConsent(userId, dto);
  }

  // ============ ACCOUNT LINKING ENDPOINTS ============
  @Post('accounts/link')
  @UseGuards(AuthGuard)
  async linkAccount(
    @Headers('x-user-id') userId: string,
    @Body() dto: LinkAccountDto,
  ) {
    return this.userService.linkAccount(userId, dto);
  }

  @Delete('accounts/unlink/:provider')
  @UseGuards(AuthGuard)
  async unlinkAccount(
    @Headers('x-user-id') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.userService.unlinkAccount(userId, provider);
  }

  @Get('accounts/linked')
  @UseGuards(AuthGuard)
  async getLinkedAccounts(@Headers('x-user-id') userId: string) {
    return this.userService.getLinkedAccounts(userId);
  }

  // ============ ACTIVITY FEED ENDPOINTS ============
  @Get('activity/feed')
  @UseGuards(AuthGuard)
  async getActivityFeed(
    @Headers('x-user-id') userId: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.userService.getActivityFeed(userId, limit, offset);
  }

  // ============ ADMIN ENDPOINTS (Requires Admin Role) ============
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
    @Headers('x-user-id') adminId: string,
  ) {
    return this.userService.updateUserStatus(id, body.status, adminId);
  }

  @Delete('admin/users/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteUser(
    @Param('id') id: string,
    @Headers('x-user-id') adminId: string,
  ) {
    return this.userService.deleteUser(id, adminId);
  }

  // ============ TAGGING ENDPOINTS ============
  @Post('admin/tags')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createTag(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.userService.createTag(dto, userId);
  }

  @Post('tags')
  @UseGuards(AuthGuard)
  async assignTags(
    @Headers('x-user-id') userId: string,
    @Body() dto: AssignTagsDto,
  ) {
    return this.userService.assignTags(userId, dto.tagIds);
  }

  @Get('admin/users/segment')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async segmentUsers(@Query() filters: UserFilterDto) {
    return this.userService.segmentUsers(filters);
  }

  @Get('admin/consent/history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getConsentHistory(@Query() filters: ConsentHistoryDto) {
    return this.userService.getConsentHistory(filters.userId, filters.consentType);
  }

  // ============ IMPORT/EXPORT ENDPOINTS ============
  @Post('admin/users/export')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async exportUsers(
    @Headers('x-user-id') adminId: string,
    @Body() dto: ExportUsersDto,
  ) {
    return this.userService.exportUsers(dto, adminId);
  }

  @Post('admin/users/import')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async importUsers(
    @Headers('x-user-id') adminId: string,
    @Body() dto: ImportUsersDto,
  ) {
    return this.userService.importUsers(dto, adminId);
  }

  // ============ GDPR & COMPLIANCE ENDPOINTS ============
  @Post('gdpr/request')
  @UseGuards(AuthGuard)
  async createGdprRequest(
    @Headers('x-user-id') userId: string,
    @Body() dto: DataSubjectRequestDto,
    @Req() req: Request,
  ) {
    // Add IP and user agent for audit
    dto.ipAddress = req.ip;
    dto.userAgent = req.headers['user-agent'];

    return this.gdprService.createDataSubjectRequest(userId, dto);
  }

  @Post('gdpr/request/:requestId/verify')
  async verifyGdprRequest(
    @Param('requestId') requestId: string,
    @Body() body: { verificationCode: string },
  ) {
    return this.gdprService.verifyDataSubjectRequest(requestId, body.verificationCode);
  }

  @Get('gdpr/data')
  @UseGuards(AuthGuard)
  async getGdprData(@Headers('x-user-id') userId: string) {
    return this.gdprService.getUserGdprData(userId);
  }

  @Post('gdpr/portability')
  @UseGuards(AuthGuard)
  async requestDataPortability(
    @Headers('x-user-id') userId: string,
    @Body() dto: DataPortabilityRequestDto,
  ) {
    return this.gdprService.requestDataPortability(userId, dto);
  }

  @Post('gdpr/consent/detailed')
  @UseGuards(AuthGuard)
  async recordDetailedConsent(
    @Headers('x-user-id') userId: string,
    @Body() dto: any, // IAB TCF consent object
    @Req() req: Request,
  ) {
    dto.ipAddress = req.ip;
    dto.userAgent = req.headers['user-agent'];

    return this.gdprService.recordDetailedConsent(userId, dto);
  }

  @Post('cookies/preferences')
  async recordCookiePreferences(
    @Body() dto: CookiePreferencesDto,
    @Req() req: Request,
    @Headers('x-user-id') userId?: string,
  ) {
    dto.ipAddress = req.ip;
    dto.userAgent = req.headers['user-agent'];

    return this.gdprService.recordCookiePreferences(userId, dto);
  }

  // Admin endpoints for GDPR compliance
  @Get('admin/gdpr/compliance-report')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'DPO') // Data Protection Officer role
  async getComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.gdprService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('admin/gdpr/breach')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'DPO')
  async reportDataBreach(
    @Body() dto: DataBreachReportDto,
    @Headers('x-user-id') reporterId: string,
  ) {
    return this.gdprService.reportDataBreach(dto, reporterId);
  }

  @Get('admin/gdpr/processing-activities')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'DPO')
  async getProcessingActivities() {
    return this.gdprService.getProcessingActivities();
  }

  // ============ TOKEN VALIDATION ENDPOINTS ============
  @Post('validate-token')
  async validateToken(@Body() body: { token: string }) {
    const result = await this.userService.validateToken(body.token);
    return { valid: !!result, user: result };
  }

  // ============ ADDITIONAL SERVICE ENDPOINTS ============
  @Get(':id')
  @UseGuards(ServiceAuthGuard)
  async getUserById(@Param('id') userId: string) {
    return this.userService.getUser(userId);
  }

  @Post('batch/validate')
  @UseGuards(ServiceAuthGuard)
  async batchValidateUsers(@Body() body: { userIds: string[] }) {
    const results = await Promise.all(
      body.userIds.map(async (userId) => {
        try {
          const user = await this.userService.getUser(userId);
          return {
            id: user.id,
            valid: true,
            status: user.status,
            emailVerified: user.emailVerified,
            isGuest: user.isGuest,
            guestExpiresAt: user.guestExpiresAt,
            eligible: user.status === 'ACTIVE' && user.emailVerified
          };
        } catch (error) {
          return {
            id: userId,
            valid: false,
            error: error.message
          };
        }
      })
    );
    
    return { results };
  }
}