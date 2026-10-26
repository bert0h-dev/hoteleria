# Plan de trabajo actual — Ajustes antes de la Fase 4

Revisión hecha al cerrar la Fase 3 (25 de octubre de 2026) sobre habitaciones,
tipos, tarifas, usuarios y configuración. Se trabaja **antes de seguir con las
siguientes fases**, porque varios puntos afectan el cálculo de precios que usarán
las reservas (Fase 5) y los cobros (Fase 7).

Cada bloque se propone y aprueba antes de implementarse, y se entrega en ramas y
PR separados.

---

## 🔴 Prioridad alta — afecta precios y reservas

### 1. Impuestos (IVA + ISH)
- [x] Configurar en el hotel el **IVA** (16 %) y el **ISH** (Impuesto Sobre
      Hospedaje estatal, 2 %–5 % según el estado).
- [x] Definir si los precios capturados **ya incluyen impuestos** o se suman
      encima (opción configurable).
- [x] Mostrar el desglose (subtotal, IVA, ISH, total) en tarifas y calculadora.

> **Decidido:** los precios **ya incluyen** IVA e ISH; el sistema solo los
> desglosa. Valores por defecto: IVA 16 %, ISH 3 % (configurables), niño hasta
> 12 años. Personas extra: por noche y por día; la semana cuenta como 7 noches;
> por horas sin cargo.

### 2. Personas extra
- [x] En el tipo de habitación: **ocupación incluida** en el precio (p. ej. 2).
- [x] Cargo por **adulto extra** y por **niño extra** por noche.
- [x] En la configuración: **edad máxima para considerarse niño**.

### 3. Tope de la tarifa por hora
- [x] Opción en la configuración: *si las horas cuestan más que el día
      completo, cobrar el día*. Con los valores actuales (15 % / 120 %), a partir
      de 8 horas la estancia por horas iguala o supera el día.

### 4. Mantenimiento con fechas
- [x] **Fecha estimada de fin** al pasar a Mantenimiento o Fuera de servicio,
      para que las reservas no vendan esa habitación en esas fechas.
      Obligatoria en Mantenimiento, opcional (indefinido) en Fuera de servicio;
      al vencer solo se marca como vencido.

### 5. Zona horaria editable
- [x] Permitir cambiar la **zona horaria** del hotel (ya existe el campo
      `timezone`). Clave para calcular entradas y salidas.

### 6. Mi perfil
- [x] Que cada usuario pueda **cambiar su propia contraseña** y ver sus datos.
- [x] Datos del empleado: **teléfono**, **número de empleado** y **fecha de
      ingreso** (opcionales). La dirección no se guarda (dato personal sensible
      que el sistema no necesita para operar).

---

## 🟡 Prioridad media — se integran en su fase

### Tarifas
- [x] **Temporadas y fines de semana:** precios distintos por fechas (Semana
      Santa, diciembre) o por día (viernes y sábado). → Fase 5
- [ ] **Precio manual por tipo:** sobrescribir una tarifa calculada (p. ej.
      la Suite por hora con precio fijo).
- [ ] **Salida tardía / entrada anticipada:** cargo por hora extra fuera del
      horario. → Fase 6

### Habitaciones
- [ ] **Tipo de limpieza:** de salida (completa) o de repaso (con huésped). → Fase 9
- [ ] **Inspección:** estado opcional *Por inspeccionar* entre Limpieza y
      Disponible. → Fase 9
- [ ] **Camas por tipo** (p. ej. "1 King", "2 matrimoniales").
- [ ] **Fotos del tipo de habitación** (útil si hay reservas en línea).
- [ ] **Ocupada bloqueada:** una habitación Ocupada solo sale de ese estado con
      el check-out, y después pasa automáticamente a Limpieza. → Fase 6

### Usuarios
- [ ] **Rol Gerente / Supervisor:** ve reportes y autoriza descuentos, sin
      administrar usuarios ni configuración.
- [ ] **Turnos del personal:** quién trabaja cada día; base para el corte de
      caja por turno y para asignar limpiezas. → Fase 7
- [ ] **Bitácora de auditoría:** quién cambió tarifas, precios o usuarios y
      cuándo. → Fase 7

### Configuración
- [ ] **Logo del hotel** para folios y pantalla de inicio de sesión.
- [ ] **Políticas:** depósito, cancelación, horario de silencio. → Fase 5
- [ ] **Serie y folio consecutivo** de comprobantes. → Fase 7

---

## 🔵 Técnico

- [ ] **Rama `dev` en Neon** para desarrollar sin tocar la base principal.
- [ ] **Regenerar la contraseña de Neon** antes de pasar a producción.
- [ ] **Pruebas automatizadas del frontend** (Vitest + Testing Library).
- [ ] **Despliegue:** definir dónde vivirá el sistema (Vercel, Railway, VPS…).

---

## Orden propuesto

1. PR de **ajustes de precios** (puntos 1, 2 y 3).
2. PR de **mantenimiento con fechas + zona horaria** (puntos 4 y 5).
3. PR de **Mi perfil** (punto 6).
4. Continuar con la **Fase 4 — Huéspedes**.
