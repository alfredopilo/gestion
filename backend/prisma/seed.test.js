/**
 * Seed determinístico para pruebas E2E y API.
 * Crea: 5 usuarios (uno por rol) con cédulas fijas, 3 cursos, 10 estudiantes,
 * calificaciones/asistencia/pagos mínimos.
 * Ejecutar con: node prisma/seed.test.js (usar DATABASE_URL del entorno de test).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CREDENTIALS = {
  ADMIN: { cedula: '123456', password: 'admin123' },
  PROFESOR: { cedula: '234567', password: 'profesor123' },
  ESTUDIANTE: { cedula: '345678', password: 'estudiante123' },
  REPRESENTANTE: { cedula: '456789', password: 'representante123' },
  SECRETARIA: { cedula: '567890', password: 'secretaria123' },
};

async function cleanup() {
  const order = [
    'accessLog', 'rolePermission', 'mensaje', 'notification', 'tareaEntrega',
    'studentProfileValue', 'documento', 'grade', 'attendance', 'payment',
    'studentWithdrawal', 'enrollment', 'insumo', 'assignmentSchedule',
    'courseSubjectAssignment', 'student', 'course', 'nivel', 'subject', 'teacher',
    'representante', 'secretaria', 'userInstitution', 'user', 'subPeriod',
    'period', 'schoolYear', 'gradeScaleDetail', 'gradeScale', 'institution',
    'setting', 'studentProfileField', 'studentProfileSection', 'emailConfig', 'permission',
  ];
  for (const model of order) {
    try {
      const m = prisma[model];
      if (m?.deleteMany) await m.deleteMany({});
    } catch (e) {
      if (e.code !== 'P2021') throw e;
    }
  }
}

async function main() {
  console.log('🧹 Limpiando BD para tests...');
  await cleanup();

  const instId = randomUUID();
  const anioId = randomUUID();
  const periodId = randomUUID();
  const subPeriodIds = [randomUUID(), randomUUID()];

  await prisma.institution.create({
    data: {
      id: instId,
      nombre: 'Institución Test',
      codigo: 'IEE-TEST',
      activa: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.schoolYear.create({
    data: {
      id: anioId,
      institucionId: instId,
      ano: 2024,
      nombre: '2024-2025',
      fechaInicio: new Date('2024-09-01'),
      fechaFin: new Date('2025-07-15'),
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.period.create({
    data: {
      id: periodId,
      nombre: 'Q1',
      anioEscolar: '2024-2025',
      anioLectivoId: anioId,
      fechaInicio: new Date('2024-09-01'),
      fechaFin: new Date('2025-01-31'),
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.subPeriod.createMany({
    data: [
      { id: subPeriodIds[0], periodoId: periodId, nombre: 'P1', ponderacion: 50, orden: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: subPeriodIds[1], periodoId: periodId, nombre: 'P2', ponderacion: 50, orden: 2, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  const hashes = {
    admin: await bcrypt.hash(CREDENTIALS.ADMIN.password, 10),
    profesor: await bcrypt.hash(CREDENTIALS.PROFESOR.password, 10),
    estudiante: await bcrypt.hash(CREDENTIALS.ESTUDIANTE.password, 10),
    representante: await bcrypt.hash(CREDENTIALS.REPRESENTANTE.password, 10),
    secretaria: await bcrypt.hash(CREDENTIALS.SECRETARIA.password, 10),
  };

  const adminId = randomUUID();
  const profesorId = randomUUID();
  const estudianteUserId = randomUUID();
  const representanteUserId = randomUUID();
  const secretariaUserId = randomUUID();

  await prisma.user.createMany({
    data: [
      { id: adminId, nombre: 'Admin', apellido: 'Test', email: 'admin@test.edu', passwordHash: hashes.admin, rol: 'ADMIN', estado: 'ACTIVO', institucionId: instId, numeroIdentificacion: CREDENTIALS.ADMIN.cedula, createdAt: new Date(), updatedAt: new Date() },
      { id: profesorId, nombre: 'Profesor', apellido: 'Test', email: 'profesor@test.edu', passwordHash: hashes.profesor, rol: 'PROFESOR', estado: 'ACTIVO', institucionId: instId, numeroIdentificacion: CREDENTIALS.PROFESOR.cedula, createdAt: new Date(), updatedAt: new Date() },
      { id: estudianteUserId, nombre: 'Estudiante', apellido: 'Test', email: 'estudiante@test.edu', passwordHash: hashes.estudiante, rol: 'ESTUDIANTE', estado: 'ACTIVO', institucionId: instId, numeroIdentificacion: CREDENTIALS.ESTUDIANTE.cedula, createdAt: new Date(), updatedAt: new Date() },
      { id: representanteUserId, nombre: 'Representante', apellido: 'Test', email: 'representante@test.edu', passwordHash: hashes.representante, rol: 'REPRESENTANTE', estado: 'ACTIVO', institucionId: instId, numeroIdentificacion: CREDENTIALS.REPRESENTANTE.cedula, createdAt: new Date(), updatedAt: new Date() },
      { id: secretariaUserId, nombre: 'Secretaria', apellido: 'Test', email: 'secretaria@test.edu', passwordHash: hashes.secretaria, rol: 'SECRETARIA', estado: 'ACTIVO', institucionId: instId, numeroIdentificacion: CREDENTIALS.SECRETARIA.cedula, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  await prisma.userInstitution.createMany({
    data: [adminId, profesorId, estudianteUserId, representanteUserId, secretariaUserId].map(uid => ({ userId: uid, institucionId: instId })),
  });

  const teacherId = randomUUID();
  await prisma.teacher.create({
    data: {
      id: teacherId,
      userId: profesorId,
      especialidad: 'Matemáticas',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const repId = randomUUID();
  await prisma.representante.create({
    data: {
      id: repId,
      userId: representanteUserId,
      parentesco: 'Padre',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.secretaria.create({
    data: {
      id: randomUUID(),
      userId: secretariaUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const nivelIds = [randomUUID(), randomUUID(), randomUUID()];
  await prisma.nivel.createMany({
    data: [
      { id: nivelIds[0], institucionId: instId, nombreNivel: '1', numeroHorasClases: 40, createdAt: new Date(), updatedAt: new Date() },
      { id: nivelIds[1], institucionId: instId, nombreNivel: '2', numeroHorasClases: 40, createdAt: new Date(), updatedAt: new Date() },
      { id: nivelIds[2], institucionId: instId, nombreNivel: '3', numeroHorasClases: 40, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  const courseIds = [randomUUID(), randomUUID(), randomUUID()];
  await prisma.course.createMany({
    data: [
      { id: courseIds[0], nombre: 'Curso A', nivelId: nivelIds[0], anioLectivoId: anioId, periodoId: periodId, docenteId: teacherId, createdAt: new Date(), updatedAt: new Date() },
      { id: courseIds[1], nombre: 'Curso B', nivelId: nivelIds[1], anioLectivoId: anioId, periodoId: periodId, createdAt: new Date(), updatedAt: new Date() },
      { id: courseIds[2], nombre: 'Curso C', nivelId: nivelIds[2], anioLectivoId: anioId, periodoId: periodId, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  const subjectIds = [randomUUID(), randomUUID()];
  await prisma.subject.createMany({
    data: [
      { id: subjectIds[0], nombre: 'Matemáticas', codigo: 'MAT-T', institucionId: instId, anioLectivoId: anioId, createdAt: new Date(), updatedAt: new Date() },
      { id: subjectIds[1], nombre: 'Lengua', codigo: 'LEN-T', institucionId: instId, anioLectivoId: anioId, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  await prisma.courseSubjectAssignment.createMany({
    data: [
      { id: randomUUID(), materiaId: subjectIds[0], cursoId: courseIds[0], docenteId: teacherId, createdAt: new Date(), updatedAt: new Date() },
      { id: randomUUID(), materiaId: subjectIds[1], cursoId: courseIds[0], docenteId: teacherId, createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  // Usuario ESTUDIANTE (345678) tiene 1 Student; otros 9 estudiantes con sus propios users
  const studentUserIds = [estudianteUserId, ...Array.from({ length: 9 }, () => randomUUID())];
  for (let i = 1; i < 10; i++) {
    const uid = studentUserIds[i];
    const pw = await bcrypt.hash('estudiante123', 10);
    await prisma.user.create({
      data: {
        id: uid,
        nombre: `Estudiante`,
        apellido: `${i + 1}`,
        email: `est${i + 1}@test.edu`,
        passwordHash: pw,
        rol: 'ESTUDIANTE',
        estado: 'ACTIVO',
        institucionId: instId,
        numeroIdentificacion: `34600${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.userInstitution.create({ data: { userId: uid, institucionId: instId } });
  }

  const studentIds = [];
  for (let i = 0; i < 10; i++) {
    const s = await prisma.student.create({
      data: {
        userId: studentUserIds[i],
        representanteId: i < 3 ? repId : null,
        fechaNacimiento: new Date('2010-01-01'),
        grupoId: courseIds[0],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    studentIds.push(s.id);
  }

  await prisma.enrollment.createMany({
    data: studentIds.slice(0, 5).map((sid, i) => ({
      id: randomUUID(),
      studentId: sid,
      cursoId: courseIds[0],
      anioLectivoId: anioId,
      institucionId: instId,
      matricula: `MAT-${i + 1}`,
      fechaInicio: new Date('2024-09-01'),
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  });

  await prisma.grade.create({
    data: {
      id: randomUUID(),
      estudianteId: studentIds[0],
      materiaId: subjectIds[0],
      subPeriodoId: subPeriodIds[0],
      parcial: 'P1',
      calificacion: 8.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.attendance.createMany({
    data: [
      { id: randomUUID(), estudianteId: studentIds[0], cursoId: courseIds[0], materiaId: subjectIds[0], fecha: new Date(), estado: 'ASISTENCIA', createdAt: new Date(), updatedAt: new Date() },
      { id: randomUUID(), estudianteId: studentIds[1], cursoId: courseIds[0], materiaId: subjectIds[0], fecha: new Date(), estado: 'FALTA', createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  await prisma.payment.createMany({
    data: [
      { id: randomUUID(), estudianteId: studentIds[0], concepto: 'Matrícula', monto: 100, estado: 'PAGADO', createdAt: new Date(), updatedAt: new Date() },
      { id: randomUUID(), estudianteId: studentIds[1], concepto: 'Matrícula', monto: 100, estado: 'PENDIENTE', createdAt: new Date(), updatedAt: new Date() },
    ],
  });

  console.log('✅ Seed de test completado.');
  console.log('Credenciales: ADMIN 123456/admin123, PROFESOR 234567/profesor123, ESTUDIANTE 345678/estudiante123, REPRESENTANTE 456789/representante123, SECRETARIA 567890/secretaria123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
