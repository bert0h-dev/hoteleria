import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Mensajes en español para las reglas de class-validator que no tengan un
 * mensaje propio en el DTO. Así ningún error de validación sale en inglés.
 */
const SPANISH_DEFAULTS: Record<string, (field: string) => string> = {
  whitelistValidation: (f) => `El campo «${f}» no está permitido`,
  isDefined: (f) => `El campo «${f}» es obligatorio`,
  isNotEmpty: (f) => `El campo «${f}» es obligatorio`,
  isString: (f) => `El campo «${f}» debe ser texto`,
  isEmail: (f) => `El campo «${f}» debe ser un correo válido`,
  isInt: (f) => `El campo «${f}» debe ser un número entero`,
  isNumber: (f) => `El campo «${f}» debe ser un número`,
  isBoolean: (f) => `El campo «${f}» debe ser verdadero o falso`,
  isEnum: (f) => `El valor de «${f}» no es válido`,
  isUuid: (f) => `El campo «${f}» debe ser un identificador válido`,
  isDate: (f) => `El campo «${f}» debe ser una fecha válida`,
  isDateString: (f) => `El campo «${f}» debe ser una fecha válida`,
  min: (f) => `El valor de «${f}» es menor al permitido`,
  max: (f) => `El valor de «${f}» es mayor al permitido`,
  minLength: (f) => `El campo «${f}» es demasiado corto`,
  maxLength: (f) => `El campo «${f}» es demasiado largo`,
};

// Los mensajes por defecto de class-validator están en inglés y siguen
// estos patrones; si un DTO trae su propio mensaje, se respeta.
const ENGLISH_DEFAULT = /^(property |each value in |.+ (must|should|has to) )/;

function translate(field: string, key: string, message: string): string {
  if (!ENGLISH_DEFAULT.test(message)) return message;
  return (
    SPANISH_DEFAULTS[key]?.(field) ?? `El valor de «${field}» no es válido`
  );
}

function collect(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([key, msg]) =>
      translate(field, key, msg),
    );
    return [...own, ...collect(error.children ?? [], field)];
  });
}

/** exceptionFactory para ValidationPipe con mensajes en español. */
export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException([...new Set(collect(errors))]);
}

/** ParseUUIDPipe con mensaje en español. */
export const ParseUuid = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('El identificador no es válido'),
});
