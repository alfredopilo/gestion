import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissionsData = [
  // Permisos de Estudiantes
  { nombre: 'ver_estudiantes', descripcion: 'Ver lista de estudiantes', modulo: 'estudiantes', accion: 'ver' },
  { nombre: 'crear_estudiantes', descripcion: 'Crear nuevos estudiantes', modulo: 'estudiantes', accion: 'crear' },
  { nombre: 'editar_estudiantes', descripcion: 'Editar información de estudiantes', modulo: 'estudiantes', accion: 'editar' },
  { nombre: 'eliminar_estudiantes', descripcion: 'Eliminar estudiantes', modulo: 'estudiantes', accion: 'eliminar' },
  { nombre: 'exportar_estudiantes', descripcion: 'Exportar lista de estudiantes', modulo: 'estudiantes', accion: 'exportar' },
  
  // Permisos de Calificaciones
  { nombre: 'ver_calificaciones', descripcion: 'Ver calificaciones', modulo: 'calificaciones', accion: 'ver' },
  { nombre: 'editar_calificaciones', descripcion: 'Editar calificaciones', modulo: 'calificaciones', accion: 'editar' },
  { nombre: 'eliminar_calificaciones', descripcion: 'Eliminar calificaciones', modulo: 'calificaciones', accion: 'eliminar' },
  { nombre: 'exportar_calificaciones', descripcion: 'Exportar calificaciones', modulo: 'calificaciones', accion: 'exportar' },
  
  // Permisos de Cursos
  { nombre: 'ver_cursos', descripcion: 'Ver lista de cursos', modulo: 'cursos', accion: 'ver' },
  { nombre: 'crear_cursos', descripcion: 'Crear nuevos cursos', modulo: 'cursos', accion: 'crear' },
  { nombre: 'editar_cursos', descripcion: 'Editar información de cursos', modulo: 'cursos', accion: 'editar' },
  { nombre: 'eliminar_cursos', descripcion: 'Eliminar cursos', modulo: 'cursos', accion: 'eliminar' },
  
  // Permisos de Materias
  { nombre: 'ver_materias', descripcion: 'Ver lista de materias', modulo: 'materias', accion: 'ver' },
  { nombre: 'crear_materias', descripcion: 'Crear nuevas materias', modulo: 'materias', accion: 'crear' },
  { nombre: 'editar_materias', descripcion: 'Editar información de materias', modulo: 'materias', accion: 'editar' },
  { nombre: 'eliminar_materias', descripcion: 'Eliminar materias', modulo: 'materias', accion: 'eliminar' },
  
  // Permisos de Usuarios
  { nombre: 'ver_usuarios', descripcion: 'Ver lista de usuarios', modulo: 'usuarios', accion: 'ver' },
  { nombre: 'crear_usuarios', descripcion: 'Crear nuevos usuarios', modulo: 'usuarios', accion: 'crear' },
  { nombre: 'editar_usuarios', descripcion: 'Editar información de usuarios', modulo: 'usuarios', accion: 'editar' },
  { nombre: 'eliminar_usuarios', descripcion: 'Eliminar usuarios', modulo: 'usuarios', accion: 'eliminar' },
  
  // Permisos de Reportes
  { nombre: 'ver_reportes', descripcion: 'Ver reportes', modulo: 'reportes', accion: 'ver' },
  { nombre: 'exportar_reportes', descripcion: 'Exportar reportes', modulo: 'reportes', accion: 'exportar' },
  
  // Permisos de Configuración
  { nombre: 'ver_configuracion', descripcion: 'Ver configuración del sistema', modulo: 'configuracion', accion: 'ver' },
  { nombre: 'editar_configuracion', descripcion: 'Editar configuración del sistema', modulo: 'configuracion', accion: 'editar' },
  
  // Permisos de Pagos
  { nombre: 'ver_pagos', descripcion: 'Ver lista de pagos', modulo: 'pagos', accion: 'ver' },
  { nombre: 'crear_pagos', descripcion: 'Registrar nuevos pagos', modulo: 'pagos', accion: 'crear' },
  { nombre: 'editar_pagos', descripcion: 'Editar información de pagos', modulo: 'pagos', accion: 'editar' },
  { nombre: 'eliminar_pagos', descripcion: 'Eliminar registros de pagos', modulo: 'pagos', accion: 'eliminar' },
  
  // Permisos de Asistencia
  { nombre: 'ver_asistencia', descripcion: 'Ver registros de asistencia', modulo: 'asistencia', accion: 'ver' },
  { nombre: 'registrar_asistencia', descripcion: 'Registrar asistencia', modulo: 'asistencia', accion: 'crear' },
  { nombre: 'editar_asistencia', descripcion: 'Editar registros de asistencia', modulo: 'asistencia', accion: 'editar' },
  
  // Permisos de Horarios
  { nombre: 'ver_horarios', descripcion: 'Ver horarios', modulo: 'horarios', accion: 'ver' },
  { nombre: 'crear_horarios', descripcion: 'Crear horarios', modulo: 'horarios', accion: 'crear' },
  { nombre: 'editar_horarios', descripcion: 'Editar horarios', modulo: 'horarios', accion: 'editar' },
  { nombre: 'eliminar_horarios', descripcion: 'Eliminar horarios', modulo: 'horarios', accion: 'eliminar' },
  
  // Permisos de Insumos
  { nombre: 'ver_insumos', descripcion: 'Ver insumos académicos', modulo: 'insumos', accion: 'ver' },
  { nombre: 'crear_insumos', descripcion: 'Crear insumos académicos', modulo: 'insumos', accion: 'crear' },
  { nombre: 'editar_insumos', descripcion: 'Editar insumos académicos', modulo: 'insumos', accion: 'editar' },
  { nombre: 'eliminar_insumos', descripcion: 'Eliminar insumos académicos', modulo: 'insumos', accion: 'eliminar' },
  
  // Permisos de Períodos
  { nombre: 'ver_periodos', descripcion: 'Ver períodos lectivos', modulo: 'periodos', accion: 'ver' },
  { nombre: 'crear_periodos', descripcion: 'Crear períodos lectivos', modulo: 'periodos', accion: 'crear' },
  { nombre: 'editar_periodos', descripcion: 'Editar períodos lectivos', modulo: 'periodos', accion: 'editar' },
  { nombre: 'eliminar_periodos', descripcion: 'Eliminar períodos lectivos', modulo: 'periodos', accion: 'eliminar' },
];

// Definir permisos por rol basado en la lógica actual del sistema
const rolePermissionsMap = {
  ADMIN: 'all', // Admin tiene todos los permisos
  PROFESOR: [
    'ver_estudiantes', 'ver_cursos', 'ver_materias', 'ver_calificaciones',
    'editar_calificaciones', 'ver_asistencia', 'registrar_asistencia', 'editar_asistencia',
    'ver_horarios', 'ver_insumos', 'crear_insumos', 'editar_insumos', 'eliminar_insumos',
    'ver_reportes', 'exportar_reportes',
  ],
  ESTUDIANTE: [
    'ver_calificaciones', 'ver_horarios', 'ver_insumos', 'ver_asistencia',
  ],
  REPRESENTANTE: [
    'ver_estudiantes', 'ver_calificaciones', 'ver_asistencia', 'ver_pagos',
    'ver_horarios', 'ver_insumos',
  ],
  SECRETARIA: [
    'ver_estudiantes', 'crear_estudiantes', 'editar_estudiantes', 'exportar_estudiantes',
    'ver_cursos', 'crear_cursos', 'editar_cursos',
    'ver_materias', 'crear_materias', 'editar_materias',
    'ver_usuarios', 'crear_usuarios', 'editar_usuarios',
    'ver_pagos', 'crear_pagos', 'editar_pagos',
    'ver_asistencia', 'registrar_asistencia',
    'ver_periodos', 'crear_periodos', 'editar_periodos',
    'ver_horarios', 'crear_horarios', 'editar_horarios',
    'ver_reportes', 'exportar_reportes',
    'ver_configuracion', 'editar_configuracion',
  ],
};

async function seedPermissions() {
  console.log('🌱 Iniciando seed de permisos...');

  try {
    // 1. Crear permisos
    console.log('📝 Creando permisos...');
    for (const permission of permissionsData) {
      await prisma.permission.upsert({
        where: { nombre: permission.nombre },
        update: permission,
        create: permission,
      });
    }
    console.log(`✅ ${permissionsData.length} permisos creados/actualizados`);

    // 2. Asignar permisos a roles
    console.log('🔗 Asignando permisos a roles...');
    
    for (const [rol, permissions] of Object.entries(rolePermissionsMap)) {
      // Limpiar permisos existentes del rol
      await prisma.rolePermission.deleteMany({
        where: { rol },
      });

      // Si es 'all', asignar todos los permisos
      let permissionsToAssign = permissions;
      if (permissions === 'all') {
        const allPermissions = await prisma.permission.findMany({
          select: { id: true },
        });
        permissionsToAssign = allPermissions.map(p => p.id);
        
        // Crear asignaciones
        await prisma.rolePermission.createMany({
          data: permissionsToAssign.map(permissionId => ({
            rol,
            permissionId,
          })),
        });
        console.log(`  ✓ ${rol}: TODOS los permisos asignados`);
      } else {
        // Obtener IDs de los permisos por nombre
        const permissionRecords = await prisma.permission.findMany({
          where: {
            nombre: { in: permissions },
          },
          select: { id: true },
        });
        
        if (permissionRecords.length > 0) {
          await prisma.rolePermission.createMany({
            data: permissionRecords.map(p => ({
              rol,
              permissionId: p.id,
            })),
          });
        }
        console.log(`  ✓ ${rol}: ${permissionRecords.length} permisos asignados`);
      }
    }

    console.log('\n✨ Seed de permisos completado exitosamente!');
    
    // Mostrar resumen
    const totalPermissions = await prisma.permission.count();
    const totalRolePermissions = await prisma.rolePermission.count();
    console.log(`\n📊 Resumen:`);
    console.log(`   - Total de permisos: ${totalPermissions}`);
    console.log(`   - Total de asignaciones rol-permiso: ${totalRolePermissions}`);

  } catch (error) {
    console.error('❌ Error en seed de permisos:', error);
    throw error;
  }
}

// Ejecutar el seed
seedPermissions()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
