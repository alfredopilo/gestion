import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const emptySectionForm = {
  nombre: '',
  descripcion: '',
  orden: 0,
};

const emptyFieldForm = {
  etiqueta: '',
  descripcion: '',
  tipo: 'TEXT',
  requerido: false,
  orden: 0,
  opcionesTexto: '',
};

const fieldTypeLabels = {
  TEXT: 'Texto',
  TEXTAREA: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  SELECT: 'Selección única',
  MULTISELECT: 'Selección múltiple',
  BOOLEAN: 'Sí / No',
  IMAGE: 'Imagen',
};

const StudentProfileTemplate = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [savingSection, setSavingSection] = useState(false);
  const [savingField, setSavingField] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/student-profile/sections');
      const data = response.data.data || [];
      setSections(data);
      if (data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(data[0].id);
      }
    } catch (error) {
      console.error('Error al cargar secciones:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSection = (sectionId) => {
    setSelectedSectionId(sectionId);
    setEditingFieldId(null);
    setFieldForm(emptyFieldForm);
  };

  const currentSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingSection(true);
      if (editingSectionId) {
        await api.put(`/student-profile/sections/${editingSectionId}`, sectionForm);
        toast.success('Sección actualizada');
      } else {
        await api.post('/student-profile/sections', sectionForm);
        toast.success('Sección creada');
      }
      setSectionForm({ ...emptySectionForm, orden: sections.length });
      setEditingSectionId(null);
      fetchSections();
    } catch (error) {
      console.error('Error al guardar sección:', error);
      toast.error(error.response?.data?.error || 'Error al guardar sección');
    } finally {
      setSavingSection(false);
    }
  };

  const handleEditSection = (section) => {
    setSectionForm({
      nombre: section.nombre,
      descripcion: section.descripcion ?? '',
      orden: section.orden ?? 0,
      activo: section.activo,
    });
    setEditingSectionId(section.id);
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('¿Eliminar esta sección y todos sus campos?')) return;
    try {
      await api.delete(`/student-profile/sections/${sectionId}`);
      toast.success('Sección eliminada');
      if (sectionId === selectedSectionId) {
        setSelectedSectionId(null);
      }
      fetchSections();
    } catch (error) {
      console.error('Error al eliminar sección:', error);
      toast.error('Error al eliminar sección');
    }
  };

  const parseOptionsFromText = (text) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.includes('|')) {
          const [label, value] = line.split('|');
          return { label: label.trim(), value: value.trim() };
        }
        return { label: line, value: line };
      });

  const formatOptionsToText = (options = []) =>
    options.map((opt) => `${opt.label} | ${opt.value}`).join('\n');

  const handleFieldSubmit = async (e) => {
    e.preventDefault();
    if (!currentSection) {
      toast.error('Selecciona una sección primero.');
      return;
    }
    try {
      setSavingField(true);
      const payload = {
        etiqueta: fieldForm.etiqueta,
        descripcion: fieldForm.descripcion,
        tipo: fieldForm.tipo,
        requerido: fieldForm.requerido,
        orden: fieldForm.orden,
        config: undefined,
      };

      if (['SELECT', 'MULTISELECT'].includes(fieldForm.tipo)) {
        const options = parseOptionsFromText(fieldForm.opcionesTexto);
        if (options.length === 0) {
          toast.error('Debe ingresar al menos una opción');
          setSavingField(false);
          return;
        }
        payload.config = { options };
      }

      if (editingFieldId) {
        await api.put(`/student-profile/fields/${editingFieldId}`, payload);
        toast.success('Campo actualizado');
      } else {
        await api.post(`/student-profile/sections/${currentSection.id}/fields`, payload);
        toast.success('Campo creado');
      }

      setFieldForm(emptyFieldForm);
      setEditingFieldId(null);
      fetchSections();
    } catch (error) {
      console.error('Error al guardar campo:', error);
      toast.error(error.response?.data?.error || 'Error al guardar campo');
    } finally {
      setSavingField(false);
    }
  };

  const handleEditField = (field, sectionId) => {
    setSelectedSectionId(sectionId);
    setEditingFieldId(field.id);
    setFieldForm({
      etiqueta: field.etiqueta,
      descripcion: field.descripcion ?? '',
      tipo: field.tipo,
      requerido: field.requerido,
      orden: field.orden ?? 0,
      opcionesTexto: formatOptionsToText(field.config?.options || []),
    });
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('¿Eliminar este campo?')) return;
    try {
      await api.delete(`/student-profile/fields/${fieldId}`);
      toast.success('Campo eliminado');
      fetchSections();
    } catch (error) {
      console.error('Error al eliminar campo:', error);
      toast.error('Error al eliminar campo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plantilla de Ficha del Estudiante</h1>
          <p className="text-sm text-gray-600 mt-1">
            Define secciones y campos personalizados que se aplicarán a todos los estudiantes.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Los cambios se reflejarán automáticamente en la ficha de cada estudiante.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-3"></div>
          <span className="text-gray-600">Cargando secciones...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Secciones</h2>
                <button
                  className="text-sm text-primary-600 hover:underline"
                  onClick={() => {
                    setEditingSectionId(null);
                    setSectionForm({ ...emptySectionForm, orden: sections.length });
                  }}
                >
                  Nueva sección
                </button>
              </div>
              {sections.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay secciones creadas todavía. Usa el formulario para crear la primera.
                </p>
              ) : (
                <div className="space-y-3">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        section.id === selectedSectionId
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 bg-white hover:border-primary-200'
                      }`}
                      onClick={() => handleSelectSection(section.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{section.nombre}</h3>
                          {section.descripcion && (
                            <p className="text-sm text-gray-500">{section.descripcion}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">Orden: {section.orden ?? 0}</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSection(section);
                            }}
                            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSection(section.id);
                            }}
                            className="px-3 py-1 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {section.campos?.length || 0} campo(s) configurados
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {editingSectionId ? 'Editar sección' : 'Nueva sección'}
              </h2>
              <form onSubmit={handleSectionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sectionForm.nombre}
                    onChange={(e) => setSectionForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    value={sectionForm.descripcion}
                    onChange={(e) =>
                      setSectionForm((prev) => ({ ...prev, descripcion: e.target.value }))
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Orden</label>
                  <input
                    type="number"
                    value={sectionForm.orden}
                    onChange={(e) =>
                      setSectionForm((prev) => ({ ...prev, orden: Number(e.target.value) }))
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={savingSection}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingSection
                      ? 'Guardando...'
                      : editingSectionId
                      ? 'Actualizar sección'
                      : 'Crear sección'}
                  </button>
                  {editingSectionId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectionId(null);
                        setSectionForm({ ...emptySectionForm, orden: sections.length });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Campos de la sección</h2>
                <p className="text-sm text-gray-500">
                  {currentSection
                    ? `Sección seleccionada: ${currentSection.nombre}`
                    : 'Selecciona una sección para administrar los campos.'}
                </p>
              </div>
              {currentSection && (
                <button
                  className="text-sm text-primary-600 hover:underline"
                  onClick={() => {
                    setEditingFieldId(null);
                    setFieldForm(emptyFieldForm);
                  }}
                >
                  Nuevo campo
                </button>
              )}
            </div>

            {!currentSection ? (
              <p className="text-sm text-gray-500">Selecciona una sección para comenzar.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {currentSection.campos?.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay campos en esta sección.</p>
                  ) : (
                    currentSection.campos.map((field) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800">{field.etiqueta}</p>
                            <p className="text-xs text-gray-500">
                              {fieldTypeLabels[field.tipo] || field.tipo} · Orden: {field.orden ?? 0}
                            </p>
                            {field.descripcion && (
                              <p className="text-sm text-gray-500 mt-1">{field.descripcion}</p>
                            )}
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button
                              onClick={() => handleEditField(field, currentSection.id)}
                              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="px-3 py-1 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {editingFieldId ? 'Editar campo' : 'Nuevo campo'}
                  </h3>
                  <form onSubmit={handleFieldSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Etiqueta <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fieldForm.etiqueta}
                        onChange={(e) => setFieldForm((prev) => ({ ...prev, etiqueta: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <textarea
                        value={fieldForm.descripcion}
                        onChange={(e) =>
                          setFieldForm((prev) => ({ ...prev, descripcion: e.target.value }))
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                        <select
                          value={fieldForm.tipo}
                          onChange={(e) => setFieldForm((prev) => ({ ...prev, tipo: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          {Object.entries(fieldTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Orden</label>
                        <input
                          type="number"
                          value={fieldForm.orden}
                          onChange={(e) =>
                            setFieldForm((prev) => ({ ...prev, orden: Number(e.target.value) }))
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="field-required"
                        type="checkbox"
                        checked={fieldForm.requerido}
                        onChange={(e) => setFieldForm((prev) => ({ ...prev, requerido: e.target.checked }))}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="field-required" className="ml-2 block text-sm text-gray-700">
                        Campo requerido
                      </label>
                    </div>

                    {['SELECT', 'MULTISELECT'].includes(fieldForm.tipo) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Opciones (una por línea, usa formato{' '}
                          <span className="font-mono">Etiqueta | Valor</span>)
                        </label>
                        <textarea
                          value={fieldForm.opcionesTexto}
                          onChange={(e) =>
                            setFieldForm((prev) => ({ ...prev, opcionesTexto: e.target.value }))
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          rows={4}
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={savingField || !currentSection}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      >
                        {savingField
                          ? 'Guardando...'
                          : editingFieldId
                          ? 'Actualizar campo'
                          : 'Crear campo'}
                      </button>
                      {editingFieldId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFieldId(null);
                            setFieldForm(emptyFieldForm);
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentProfileTemplate;

