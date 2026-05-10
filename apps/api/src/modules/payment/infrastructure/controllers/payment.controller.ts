import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { PaymentService } from '../../application/payment.service';
import { MulticardCallbackIpGuard } from '../guards/multicard-callback-ip.guard';
import { CreatePaymentSchema, MulticardCallbackSchema } from '../../application/dto/payment.dto';
import type { CreatePaymentDto, MulticardCallbackDto } from '../../application/dto/payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  createPayment(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: CreatePaymentDto,
  ) {
    return this.paymentService.createInvoice(dto.orderId, userId);
  }

  @Post('callback')
  @Public()
  @UseGuards(MulticardCallbackIpGuard)
  @HttpCode(HttpStatus.OK)
  async processCallback(
    @Body(new ZodValidationPipe(MulticardCallbackSchema)) dto: MulticardCallbackDto,
  ) {
    await this.paymentService.processCallback({
      storeId: dto.store_id,
      invoiceId: dto.invoice_id,
      amount: dto.amount,
      uuid: dto.uuid,
      billingId: dto.billing_id,
      cardPan: dto.card_pan,
      receiptUrl: dto.receipt_url,
      sign: dto.sign,
    });
    return { success: true };
  }

  @Get('status/:id')
  getPaymentStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentService.getPaymentStatus(id, userId);
  }

  @Get('order/:orderId')
  async getPaymentByOrder(@Param('orderId') orderId: string) {
    const payment = await this.paymentService.getPaymentByOrder(orderId);
    return payment ?? null;
  }
}
