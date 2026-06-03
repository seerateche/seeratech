// ============================================================
// SEERA PLATFORM v4 - Vouchers Controller
// ============================================================
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload, UserRole } from '@sira/shared';

export class GenerateVouchersBody {
  @IsString() @IsNotEmpty() deviceId: string;
  @IsOptional() @IsString() companyId?: string;
  @IsString() @IsNotEmpty() profileName: string;
  @IsInt() @Min(1) count: number;
  @IsOptional() @IsString() prefix?: string;
  @IsOptional() @IsString() comment?: string;
  @IsString() @IsNotEmpty() batchName: string;
}

@ApiTags('vouchers')
@ApiBearerAuth()
@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.vouchers.list(user);
  }

  @Get('batches')
  batches(@CurrentUser() user: AuthTokenPayload) {
    return this.vouchers.listBatches(user);
  }

  @Post('generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  generate(
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: GenerateVouchersBody,
  ) {
    return this.vouchers.generate(user, body as any);
  }

  @Post('sync/:deviceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  sync(
    @CurrentUser() user: AuthTokenPayload,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.vouchers.syncFromDevice(user, deviceId);
  }

  @Get('export-pdf')
  async exportPdf(
    @CurrentUser() user: AuthTokenPayload,
    @Query('batchId') batchId: string | undefined,
    @Res() res: Response,
  ) {
    const pdf = await this.vouchers.exportPdf(user, batchId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="vouchers.pdf"');
    res.send(pdf);
  }
}
