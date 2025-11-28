import prisma from '../config/database.js';
import {
  createStudentProfileSectionSchema,
  updateStudentProfileSectionSchema,
  createStudentProfileFieldSchema,
  updateStudentProfileFieldSchema,
  updateStudentProfileValuesSchema,
} from '../utils/validators.js';
import { getInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';

const resolveInstitutionId = (req) =>
  getInstitutionFilter(req) ||
  req.user?.institucionId ||
  req.user?.accessibleInstitutionIds?.[0] ||
  null;

const formatFieldValueForResponse = (field, rawValue) => {
  if (rawValue === null || rawValue === undefined) return null;

  switch (field.tipo) {
    case 'NUMBER':
      return isNaN(Number(rawValue)) ? null : Number(rawValue);
    case 'DATE':
      return rawValue;
    case 'BOOLEAN':
      return rawValue === 'true' || rawValue === true;
    case 'MULTISELECT':
      try {
        if (Array.isArray(rawValue)) return rawValue;
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    case 'IMAGE':
      // Retornar el nombre del archivo (el frontend construirá la URL completa)
      if (typeof rawValue === 'string' && rawValue.length > 0) {
        // Si ya es una URL completa, extraer solo el nombre del archivo
        if (rawValue.includes('/images/')) {
          return rawValue.split('/images/')[1];
        }
        // Si es solo el nombre del archivo, retornarlo tal cual
        return rawValue;
      }
      return null;
    default:
      return rawValue;
  }
};

const normalizeValueForStorage = (field, value) => {
  if (value === null || value === undefined || value === '') {
    if (field.requerido) {
      throw new Error(`El campo "${field.etiqueta}" es requerido.`);
    }
    return null;
  }

  switch (field.tipo) {
    case 'NUMBER': {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`El campo "${field.etiqueta}" requiere un número válido.`);
      }
      return num.toString();
    }
    case 'DATE': {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error(`El campo "${field.etiqueta}" requiere una fecha válida.`);
      }
      return date.toISOString();
    }
    case 'BOOLEAN': {
      const boolValue = value === true || value === 'true';
      return boolValue ? 'true' : 'false';
    }
    case 'MULTISELECT': {
      const arr = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.length > 0
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
      if (field.requerido && arr.length === 0) {
        throw new Error(`El campo "${field.etiqueta}" requiere al menos una opción.`);
      }
      return arr.length ? JSON.stringify(arr) : null;
    }
    case 'IMAGE': {
      // Para imágenes, el valor es la ruta del archivo o URL
      if (typeof value !== 'string') {
        throw new Error(`El campo "${field.etiqueta}" requiere una imagen válida.`);
      }
      return value;
    }
    default:
      return value?.toString() ?? null;
  }
};

const attachValuesToSections = (sections) =>
  sections.map((section) => ({
    id: section.id,
    nombre: section.nombre,
    descripcion: section.descripcion,
    orden: section.orden,
    activo: section.activo,
    campos: section.campos.map((field) => {
      const valorCrudo = field.valores?.[0]?.valor ?? null;
      return {
        id: field.id,
        etiqueta: field.etiqueta,
        descripcion: field.descripcion,
        tipo: field.tipo,
        requerido: field.requerido,
        orden: field.orden,
        config: field.config || {},
        valor: formatFieldValueForResponse(field, valorCrudo),
        valorCrudo,
      };
    }),
  }));

export const getSections = async (req, res, next) => {
  try {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) {
      return res.json({ data: [] });
    }

    const sections = await prisma.studentProfileSection.findMany({
      where: { institucionId: institutionId },
      orderBy: { orden: 'asc' },
      include: {
        campos: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    res.json({ data: sections });
  } catch (error) {
    next(error);
  }
};

export const createSection = async (req, res, next) => {
  try {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución para crear la sección.',
      });
    }

    const data = createStudentProfileSectionSchema.parse(req.body);

    const nextOrder =
      data.orden ??
      (await prisma.studentProfileSection.count({
        where: { institucionId: institutionId },
      }));

    const section = await prisma.studentProfileSection.create({
      data: {
        ...data,
        orden: nextOrder,
        institucionId: institutionId,
      },
    });

    res.status(201).json({
      message: 'Sección creada correctamente.',
      section,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateStudentProfileSectionSchema.parse(req.body);
    const institutionId = resolveInstitutionId(req);

    const section = await prisma.studentProfileSection.findUnique({
      where: { id },
      select: { institucionId: true },
    });

    if (!section || section.institucionId !== institutionId) {
      return res.status(404).json({ error: 'Sección no encontrada.' });
    }

    const updated = await prisma.studentProfileSection.update({
      where: { id },
      data,
    });

    res.json({
      message: 'Sección actualizada correctamente.',
      section: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = resolveInstitutionId(req);

    const section = await prisma.studentProfileSection.findUnique({
      where: { id },
      select: { institucionId: true },
    });

    if (!section || section.institucionId !== institutionId) {
      return res.status(404).json({ error: 'Sección no encontrada.' });
    }

    await prisma.studentProfileSection.delete({
      where: { id },
    });

    res.json({ message: 'Sección eliminada correctamente.' });
  } catch (error) {
    next(error);
  }
};

export const createField = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const data = createStudentProfileFieldSchema.parse(req.body);
    const institutionId = resolveInstitutionId(req);

    const section = await prisma.studentProfileSection.findUnique({
      where: { id: sectionId },
      select: { institucionId: true },
    });

    if (!section || section.institucionId !== institutionId) {
      return res.status(404).json({ error: 'Sección no encontrada.' });
    }

    const nextOrder =
      data.orden ??
      (await prisma.studentProfileField.count({
        where: { sectionId },
      }));

    const field = await prisma.studentProfileField.create({
      data: {
        ...data,
        orden: nextOrder,
        sectionId,
      },
    });

    res.status(201).json({
      message: 'Campo creado correctamente.',
      field,
    });
  } catch (error) {
    next(error);
  }
};

export const updateField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateStudentProfileFieldSchema.parse(req.body);
    const institutionId = resolveInstitutionId(req);

    const field = await prisma.studentProfileField.findUnique({
      where: { id },
      select: {
        section: {
          select: { institucionId: true },
        },
      },
    });

    if (!field || field.section.institucionId !== institutionId) {
      return res.status(404).json({ error: 'Campo no encontrado.' });
    }

    const updated = await prisma.studentProfileField.update({
      where: { id },
      data,
    });

    res.json({
      message: 'Campo actualizado correctamente.',
      field: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = resolveInstitutionId(req);

    const field = await prisma.studentProfileField.findUnique({
      where: { id },
      select: {
        section: {
          select: { institucionId: true },
        },
      },
    });

    if (!field || field.section.institucionId !== institutionId) {
      return res.status(404).json({ error: 'Campo no encontrado.' });
    }

    await prisma.studentProfileField.delete({
      where: { id },
    });

    res.json({ message: 'Campo eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
};

export const getStudentProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const institutionId = resolveInstitutionId(req);

    if (!institutionId) {
      return res.json({ sections: [] });
    }

    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const sections = await prisma.studentProfileSection.findMany({
      where: {
        institucionId: institutionId,
        activo: true,
      },
      orderBy: { orden: 'asc' },
      include: {
        campos: {
          orderBy: { orden: 'asc' },
          include: {
            valores: {
              where: { studentId },
            },
          },
        },
      },
    });

    res.json({
      sections: attachValuesToSections(sections),
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudentProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const payload = updateStudentProfileValuesSchema.parse(req.body);
    const institutionId = resolveInstitutionId(req);

    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución.',
      });
    }

    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const fieldIds = payload.values.map((item) => item.fieldId);
    const fields = await prisma.studentProfileField.findMany({
      where: {
        id: { in: fieldIds },
        section: {
          institucionId: institutionId,
        },
      },
      include: {
        section: true,
      },
    });

    const fieldMap = new Map(fields.map((field) => [field.id, field]));

    const operations = [];
    for (const item of payload.values) {
      const field = fieldMap.get(item.fieldId);
      if (!field) {
        continue;
      }

      const valor = normalizeValueForStorage(field, item.value ?? null);

      if (valor === null) {
        operations.push(
          prisma.studentProfileValue.deleteMany({
            where: {
              studentId,
              fieldId: field.id,
            },
          })
        );
      } else {
        operations.push(
          prisma.studentProfileValue.upsert({
            where: {
              studentId_fieldId: {
                studentId,
                fieldId: field.id,
              },
            },
            update: {
              valor,
            },
            create: {
              studentId,
              fieldId: field.id,
              valor,
            },
          })
        );
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    res.json({
      message: 'Ficha del estudiante actualizada correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    // Retornar el nombre del archivo para que el frontend lo use
    res.json({
      filename: req.file.filename,
      url: `/api/v1/student-profile/images/${req.file.filename}`,
    });
  } catch (error) {
    next(error);
  }
};

