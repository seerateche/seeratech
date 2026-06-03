// ============================================================
// SEERA PLATFORM v4 - Devices Controller
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { DevicesService } from './devices.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthTokenPayload, DeviceType, UserRole } from '@sira/shared';

export class CreateDeviceBody {
  @IsOptional() @IsString() companyId?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(DeviceType) type: DeviceType;
  @IsString() @IsNotEmpty() host: string;
  @IsInt() port: number;
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
  @IsOptional() @IsInt() apiPort?: number;
  @IsOptional() @IsBoolean() useVpn?: boolean;
  @IsOptional() @IsString() vpnIp?: string;
  @IsOptional() @IsString() description?: string;
}

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.devices.list(user);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  create(@CurrentUser() user: AuthTokenPayload, @Body() body: CreateDeviceBody) {
    return this.devices.create(user, body as any);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devices.remove(user, id);
  }

  @Post(':id/ping')
  ping(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devices.ping(user, id);
  }
}
