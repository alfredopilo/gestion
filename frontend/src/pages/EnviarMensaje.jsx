import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const EnviarMensaje = () => {
  const { user } = useAuth();
  const [tipoEnvio, setTipoEnvio] = useState('individual');
  const [cursos, setCursos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedMateria, setSelectedMateria] = useState('');
  const [selectedEstudiantes, setSelectedEstudiantes] = useState([]);
  const [mensaje, setMensaje] = useState({
    asunto: '',
    cuerpo: ''
  });
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [destinatarioEmail, setDestinatarioEmail] = useState('representante');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCursos();
  }, []);

  useEffect(() => {
    if (selectedCurso) {
      fetchMaterias();
      if (tipoEnvio === 'curso') {
        fetchEstudiantesPorCurso();
      }
    }
  }, [selectedCurso, tipoEnvio]);

  useEffect(() => {
    if (selectedMateria && selectedCurso && tipoEnvio === 'materia') {
      fetchEstudiantesPorMateria();
    }
  }, [selectedMateria, selectedCurso, tipoEnvio]);

  const fetchCursos = async () => {
    try {
      const response = await api.get('/courses?limit=100');
      setCursos(response.data.data || []);
    } catch (error) {
      toast.error('Error al cargar cursos');
    }
  };

  const fetchMaterias = async () => {
    try {
      if (user?.rol === 'PROFESOR') {
        const response = await api.get('/teachers/my-assignments');
        const assignments = response.data.data || [];
        const courseAssignments = assignments.find(a => a.curso.id === selectedCurso);
        if (courseAssignments) {
          setMaterias(courseAssignments.materias || []);
        } else {
          setMaterias([]);
        }
      } else {
        const response = await api.get(`/assignments?cursoId=${selectedCurso}`);
        const assignments = response.data.data || [];
        const subjectsList = assignments.map(a => a.materia).filter(Boolean);
        setMaterias(subjectsList);
      }
    } catch (error) {
      toast.error('Error al cargar materias');
    }
  };

  const fetchEstudiantesPorCurso = async () => {
    try {
      const response = await api.get(`/mensajes/estudiantes/curso/${selectedCurso}`);
      setEstudiantes(response.data.data || []);
    } catch (error) {
      toast.error('Error al cargar estudiantes');
    }
  };

  const fetchEstudiantesPorMateria = async () => {
    try {
      const response = await api.get(`/mensajes/estudiantes/materia?cursoId=${selectedCurso}&materiaId=${selectedMateria}`);
      setEstudiantes(response.data.data || []);
    } catch (error) {
      toast.error('Error al cargar estudiantes');
    }
  };

  const handleEnviar = async () => {
    if (!mensaje.asunto || !mensaje.cuerpo) {
      toast.error('Complete el asunto y el cuerpo del mensaje');
      return;
    }

    let destinatarios = [];
    let tipoMensajeEnum = 'INDIVIDUAL';

    if (tipoEnvio === 'individual') {
      if (selectedEstudiantes.length === 0) {
        toast.error('Seleccione al menos un estudiante');
        return;
      }
      destinatarios = selectedEstudiantes;
    } else if (tipoEnvio === 'curso') {
      if (!selectedCurso) {
        toast.error('Seleccione un curso');
        return;
      }
      destinatarios = estudiantes.map(e => e.user.id);
      tipoMensajeEnum = 'MASIVO_CURSO';
    } else if (tipoEnvio === 'materia') {
      if (!selectedCurso || !selectedMateria) {
        toast.error('Seleccione curso y materia');
        return;
      }
      destinatarios = estudiantes.map(e => e.user.id);
      tipoMensajeEnum = 'MASIVO_MATERIA';
    }

    if (destinatarios.length === 0) {
      toast.error('No hay destinatarios seleccionados');
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/mensajes/enviar', {
        destinatarios,
        asunto: mensaje.asunto,
        cuerpo: mensaje.cuerpo,
        enviarEmail,
        destinatarioEmail,
        tipoMensaje: tipoMensajeEnum,
        cursoId: selectedCurso || null,
        materiaId: selectedMateria || null
      });

      toast.success(`${response.data.mensajesCreados} mensaje(s) enviado(s) exitosamente`);
      if (response.data.emailsEnviados > 0) {
        toast.success(`${response.data.emailsEnviados} correo(s) electrónico(s) enviado(s)`);
      }

      // Limpiar formulario
      setMensaje({ asunto: '', cuerpo: '' });
      setSelectedEstudiantes([]);
    } catch (error) {
      toast.error('Error al enviar mensajes');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Enviar Mensaje</h1>

      {/* Selector de tipo de envío */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Tipo de Envío</h2>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setTipoEnvio('individual');
              setSelectedEstudiantes([]);
            }}
            className={`px-4 py-2 rounded-md ${
              tipoEnvio === 'individual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => {
              setTipoEnvio('curso');
              setSelectedEstudiantes([]);
            }}
            className={`px-4 py-2 rounded-md ${
              tipoEnvio === 'curso'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Por Curso
          </button>
          <button
            type="button"
            onClick={() => {
              setTipoEnvio('materia');
              setSelectedEstudiantes([]);
            }}
            className={`px-4 py-2 rounded-md ${
              tipoEnvio === 'materia'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Por Materia
          </button>
        </div>
      </div>

      {/* Selección de destinatarios */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Destinatarios</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCurso}
              onChange={(e) => {
                setSelectedCurso(e.target.value);
                setSelectedMateria('');
                setEstudiantes([]);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar curso</option>
              {cursos.map(curso => (
                <option key={curso.id} value={curso.id}>
                  {curso.nombre} - {curso.nivel} {curso.paralelo || ''}
                </option>
              ))}
            </select>
          </div>

          {(tipoEnvio === 'materia') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Materia <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedMateria}
                onChange={(e) => setSelectedMateria(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                disabled={!selectedCurso}
                required
              >
                <option value="">Seleccionar materia</option>
                {materias.map(materia => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tipoEnvio === 'individual' && selectedCurso && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar estudiantes <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={fetchEstudiantesPorCurso}
                className="mb-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Cargar estudiantes del curso
              </button>
              <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                {estudiantes.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay estudiantes cargados</p>
                ) : (
                  estudiantes.map(est => (
                    <label key={est.id} className="flex items-center p-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedEstudiantes.includes(est.user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEstudiantes([...selectedEstudiantes, est.user.id]);
                          } else {
                            setSelectedEstudiantes(selectedEstudiantes.filter(id => id !== est.user.id));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {est.user.apellido} {est.user.nombre}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {(tipoEnvio === 'curso' || tipoEnvio === 'materia') && estudiantes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                Se enviará el mensaje a <strong>{estudiantes.length} estudiante(s)</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Formulario de mensaje */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Mensaje</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asunto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={mensaje.asunto}
              onChange={(e) => setMensaje({ ...mensaje, asunto: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Asunto del mensaje"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cuerpo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={mensaje.cuerpo}
              onChange={(e) => setMensaje({ ...mensaje, cuerpo: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={8}
              placeholder="Escriba su mensaje aquí..."
              required
            />
          </div>
        </div>
      </div>

      {/* Opciones de email */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Opciones de Notificación</h2>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enviarEmail}
                onChange={(e) => setEnviarEmail(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Enviar también por correo electrónico</span>
            </label>
          </div>

          {enviarEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destinatario del correo
              </label>
              <select
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="estudiante">Solo al estudiante</option>
                <option value="representante">Solo al representante/padre</option>
                <option value="ambos">Al estudiante y al representante</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleEnviar}
          disabled={sending}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Enviar Mensaje'}
        </button>
      </div>
    </div>
  );
};

export default EnviarMensaje;
