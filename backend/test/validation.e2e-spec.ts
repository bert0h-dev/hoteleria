import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

// Palabras típicas de los mensajes por defecto en inglés.
const ENGLISH = /\b(must|should|property|Cannot|failed|expected)\b/;

describe('Mensajes de error en español (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  const messagesOf = (body: { message: string | string[] }) =>
    ([] as string[]).concat(body.message);

  it('validación del body: un mensaje por campo y en español', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 123, password: 5, extra: true })
      .expect(400);

    const messages = messagesOf(res.body);
    expect(messages).toContain('El campo «extra» no está permitido');
    for (const m of messages) expect(m).not.toMatch(ENGLISH);
  });

  it('JSON mal formado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.message).toBe(
      'El cuerpo de la petición no es un JSON válido',
    );
  });

  it('ruta inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/no-existe')
      .expect(404);
    expect(res.body.message).toBe('Ruta no encontrada: GET /api/no-existe');
  });
});
