import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Mensajes en español para los errores que genera el propio framework. */
const FRAMEWORK_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados intentos. Espera un momento e inténtalo de nuevo',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'La petición es demasiado grande',
};

/** Da un formato uniforme (y en español) a todas las respuestas de error. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Error interno del servidor';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      message = translateFrameworkMessage(status, message, req);
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}

function translateFrameworkMessage(
  status: number,
  message: string | string[],
  req: Request,
): string | string[] {
  if (Array.isArray(message)) return message;
  if (status === 404 && message.startsWith('Cannot ')) {
    return `Ruta no encontrada: ${req.method} ${req.originalUrl}`;
  }
  // body-parser: JSON mal formado.
  if (status === 400 && /JSON|Unexpected token/i.test(message)) {
    return 'El cuerpo de la petición no es un JSON válido';
  }
  return FRAMEWORK_MESSAGES[status] ?? message;
}
