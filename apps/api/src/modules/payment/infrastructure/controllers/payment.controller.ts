import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { PaymentService } from '../../application/payment.service';
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
  @HttpCode(HttpStatus.OK)
  async processCallback(
    @Body(new ZodValidationPipe(MulticardCallbackSchema)) dto: MulticardCallbackDto,
  ) {
    await this.paymentService.processCallback({
      invoiceId: dto.invoice_id,
      transactionId: dto.transaction_id,
      status: dto.status,
      amount: dto.amount,
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
  getPaymentByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentByOrder(orderId);
  }
}
