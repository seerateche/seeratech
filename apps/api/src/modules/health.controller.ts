import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint for Railway/Docker' })
  check() {
    // Return a simple string or object. 
    // The global prefix 'api/v1' will make this accessible at /api/v1/health
    return "OK";
  }
}
