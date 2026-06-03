// ============================================================
// SEERA PLATFORM v4 - Global Response Transform Interceptor
// Wraps every successful response in a consistent envelope:
//   { success: true, data: <payload>, timestamp: <iso> }
// This matches the frontend api helpers (r.data.data) and the
// auth store (data.data.user / data.data.accessToken).
// If a handler already returns an envelope with `success`, it is
// passed through untouched.
// ============================================================
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(
      map((payload: any) => {
        // Pass through already-wrapped responses (e.g. isp-tracking controller)
        if (
          payload &&
          typeof payload === 'object' &&
          'success' in payload &&
          'data' in payload
        ) {
          return payload;
        }
        return {
          success: true,
          data: payload ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
