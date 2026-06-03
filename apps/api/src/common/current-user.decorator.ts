// ============================================================
// SEERA PLATFORM v4 - CurrentUser Param Decorator
// Extracts the JWT payload attached by JwtAuthGuard (request.user).
// Usage: someHandler(@CurrentUser() user: AuthTokenPayload) {}
//        someHandler(@CurrentUser('companyId') companyId: string) {}
// ============================================================
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthTokenPayload } from '@sira/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthTokenPayload | undefined = request.user;
    if (!user) return null;
    return data ? user[data] : user;
  },
);
