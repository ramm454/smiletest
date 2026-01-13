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
import { GroupBookingService } from '../services/group-booking.service';
import {
  CreateGroupBookingDto,
  UpdateGroupBookingDto,
  AddGroupMemberDto,
} from '../dto/group-booking.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('group-bookings')
export class GroupBookingController {
  constructor(private readonly groupBookingService: GroupBookingService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() createGroupBookingDto: CreateGroupBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    createGroupBookingDto.userId = userId;
    return this.groupBookingService.createGroupBooking(createGroupBookingDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(
    @Query() query: any,
    @Headers('x-user-id') userId: string,
  ) {
    return this.groupBookingService.listGroupBookings(userId, query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string) {
    return this.groupBookingService.getGroupBooking(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateGroupBookingDto: UpdateGroupBookingDto,
  ) {
    return this.groupBookingService.updateGroupBooking(id, updateGroupBookingDto);
  }

  @Post(':id/members')
  @UseGuards(AuthGuard)
  async addMember(
    @Param('id') id: string,
    @Body() addMemberDto: AddGroupMemberDto,
  ) {
    return this.groupBookingService.addGroupMember(id, addMemberDto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(AuthGuard)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupBookingService.removeGroupMember(id, memberId);
  }

  @Post('invitation/:token/confirm')
  async confirmInvitation(
    @Param('token') token: string,
    @Body() body: { userId?: string },
  ) {
    return this.groupBookingService.confirmGroupMember(token, body.userId);
  }

  @Get(':id/payment-link')
  @UseGuards(AuthGuard)
  async getPaymentLink(
    @Param('id') id: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.groupBookingService.generatePaymentLink(id, memberId);
  }

  @Post(':id/payment')
  @UseGuards(AuthGuard)
  async processPayment(
    @Param('id') id: string,
    @Body() paymentData: any,
  ) {
    return this.groupBookingService.processGroupPayment(id, paymentData);
  }

  @Post(':id/send-reminders')
  @UseGuards(AuthGuard)
  async sendReminders(@Param('id') id: string) {
    return this.groupBookingService.sendReminderEmails(id);
  }

  @Get(':id/summary')
  @UseGuards(AuthGuard)
  async getSummary(@Param('id') id: string) {
    const groupBooking = await this.groupBookingService.getGroupBooking(id);
    
    const summary = {
      totalMembers: groupBooking.members.length,
      confirmedMembers: groupBooking.members.filter(m => m.status === 'CONFIRMED').length,
      pendingMembers: groupBooking.members.filter(m => m.status === 'INVITED').length,
      totalAmount: groupBooking.totalAmount,
      amountPaid: groupBooking.amountPaid,
      amountDue: groupBooking.amountDue,
      paymentProgress: (groupBooking.amountPaid / groupBooking.totalAmount) * 100,
    };

    return summary;
  }

  @Get('user/:userId/active')
  @UseGuards(AuthGuard)
  async getUserActiveGroups(@Param('userId') userId: string) {
    return this.groupBookingService.getUserActiveGroupBookings(userId);
  }
}