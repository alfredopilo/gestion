import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const EnviarMensaje = () => {
  const { user } = useAuth();
  const cancelledRef = useRef(false);
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
  const [enviarPorSistema, setEnviarPorSistema] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [destinatario, setDestinatario] = useState('estudiante');
  const [adjunto, setAdjunto] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;
    fetchCursos();
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    if (!selectedCurso) return;
    cancelledRef.current = false;
    fetchMaterias();
    if (tipoEnvio === 'curso') {
      fetchEstudiantesPorCurso();
    }
    return () => { cancelledRef.current = true; };
  }, [selectedCurso, tipoEnvio]);

  useEffect(() => {
    if (!selectedMateria || !selectedCurso || tipoEnvio !== 'materia') return;
    cancelledRef.current = false;
    fetchEstudiantesPorMateria();
    return () => { cancelledRef.current = true; };
  }, [selectedMateria, selectedCurso, tipoEnvio]);

  const fetchCursos = async () => {
    try {
      const response = await api.get('/courses?limit=100');
      if (!cancelledRef.current) setCursos(response.data.data || []);
    } catch (error) {
      if (!cancelledRef.current) toast.error('Error al cargar cursos');
    }
  };

  const fetchMaterias = async () => {
    try {
      if (user?.rol === 'PROFESOR') {
        const response = await api.get('/teachers/my-assignments');
        const assignments = response.data.data || [];
        const courseAssignments = assignments.find(a => a.curso.id === selectedCurso);
        if (!cancelledRef.current) {
          setMaterias(courseAssignments ? courseAssignments.materias || [] : []);
        }
      } else {
        const response = await api.get(`/assignments?cursoId=${selectedCurso}`);
        const assignments = response.data.data || [];
        const subjectsList = assignments.map(a => a.materia).filter(Boolean);
        if (!cancelledRef.current) setMaterias(subjectsList);
      }
    } catch (error) {
      if (!cancelledRef.current) toast.error('Error al cargar materias');
    }
  };

  const fetchEstudiantesPorCurso = async () => {
    try {
      const response = await api.get(`/mensajes/estudiantes/curso/${selectedCurso}`);
      if (!cancelledRef.current) setEstudiantes(response.data.data || []);
    } catch (error) {
      if (!cancelledRef.current) toast.error('Error al cargar estudiantes');
    }
  };

  const fetchEstudiantesPorMateria = async () => {
    try {
      const response = await api.get(`/mensajes/estudiantes/materia?cursoId=${selectedCurso}&materiaId=${selectedMateria}`);
      if (!cancelledRef.current) setEstudiantes(response.data.data || []);
    } catch (error) {
      if (!cancelledRef.current) toast.error('Error al cargar estudiantes');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (5 MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no debe superar los 5 MB');
        e.target.value = '';
        return;
      }
      setAdjunto(file);
    }
  };

  const calcularDestinatarios = (estudiantesList) => {
    const destinatarios = [];
    
    estudiantesList.forEach(est => {
      // Añadir estudiante si corresponde
      if (destinatario === 'estudiante' || destinatario === 'ambos') {
        const userId = est.user?.id ?? est.userId;
        if (userId) destinatarios.push(userId);
      }
      
      // Añadir representante: usar representanteUserId (backend), representante.user.id o representante.userId
      if (destinatario === 'representante' || destinatario === 'ambos') {
        const repUserId = est.representanteUserId
          ?? est.representante?.user?.id
          ?? est.representante?.userId;
        if (repUserId && !destinatarios.includes(repUserId)) {
          destinatarios.push(repUserId);
        }
      }
    });
    
    return destinatarios;
  };

  const handleEnviar = async () => {
    if (!mensaje.asunto || !mensaje.cuerpo) {
      toast.error('Complete el asunto y el cuerpo del mensaje');
      return;
    }

    if (!enviarPorSistema && !enviarEmail) {
      toast.error('Debe seleccionar al menos un canal de envío (sistema o email)');
      return;
    }

    let destinatarios = [];
    let tipoMensajeEnum = 'INDIVIDUAL';
    let estudiantesParaCalculo = [];

    if (tipoEnvio === 'individual') {
      if (selectedEstudiantes.length === 0) {
        toast.error('Seleccione al menos un estudiante');
        return;
      }
      estudiantesParaCalculo = estudiantes.filter(e =>
        selectedEstudiantes.some(id => String(id) === String(e.user?.id))
      );
      // Solo exigir lista cargada cuando necesitamos datos de representante
      if ((destinatario === 'representante' || destinatario === 'ambos') && estudiantesParaCalculo.length === 0) {
        toast.error('Cargue los estudiantes del curso con "Cargar estudiantes del curso" y seleccione al menos uno (con representante asociado)');
        return;
      }
    } else if (tipoEnvio === 'curso') {
      if (!selectedCurso) {
        toast.error('Seleccione un curso');
        return;
      }
      if (estudiantes.length === 0) {
        toast.error('Espere a que se listen los estudiantes del curso o seleccione otro curso');
        return;
      }
      estudiantesParaCalculo = estudiantes;
      tipoMensajeEnum = 'MASIVO_CURSO';
    } else if (tipoEnvio === 'materia') {
      if (!selectedCurso || !selectedMateria) {
        toast.error('Seleccione curso y materia');
        return;
      }
      if (estudiantes.length === 0) {
        toast.error('Espere a que se listen los estudiantes de la materia');
        return;
      }
      estudiantesParaCalculo = estudiantes;
      tipoMensajeEnum = 'MASIVO_MATERIA';
    }

    // Calcular destinatarios según opción: estudiante, representante o ambos
    if (tipoEnvio === 'individual' && destinatario === 'estudiante') {
      destinatarios = [...selectedEstudiantes];
    } else {
      destinatarios = calcularDestinatarios(estudiantesParaCalculo);
    }

    if (destinatarios.length === 0) {
      if (destinatario === 'representante') {
        toast.error('Ninguno de los estudiantes seleccionados tiene representante asociado. Asocie representantes en la sección correspondiente.');
      } else if (destinatario === 'ambos') {
        toast.error('Ninguno de los estudiantes tiene representante asociado o no hay estudiantes cargados.');
      } else {
        toast.error('No hay destinatarios válidos. Cargue estudiantes y seleccione al menos uno.');
      }
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('destinatarios', JSON.stringify(destinatarios));
      formData.append('asunto', mensaje.asunto);
      formData.append('cuerpo', mensaje.cuerpo);
      formData.append('enviarPorSistema', enviarPorSistema);
      formData.append('enviarEmail', enviarEmail);
      formData.append('destinatarioEmail', destinatario); // Usar el mismo destinatario para email
      formData.append('tipoMensaje', tipoMensajeEnum);
      formData.append('cursoId', selectedCurso || '');
      formData.append('materiaId', selectedMateria || '');
      
      if (adjunto) {
        formData.append('adjunto', adjunto);
      }

      const response = await api.post('/mensajes/enviar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(`${response.data.mensajesCreados} mensaje(s) enviado(s) exitosamente`);
      if (response.data.emailsEnviados > 0) {
        toast.success(`${response.data.emailsEnviados} correo(s) electrónico(s) enviado(s)`);
      }

      // Limpiar formulario
      setMensaje({ asunto: '', cuerpo: '' });
      setSelectedEstudiantes([]);
      setAdjunto(null);
      // Limpiar input file
      const fileInput = document.getElementById('adjunto-input');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al enviar mensajes');
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
                  [...estudiantes]
                    .sort((a, b) => {
                      const apA = (a.user?.apellido || '').toLowerCase();
                      const apB = (b.user?.apellido || '').toLowerCase();
                      if (apA !== apB) return apA.localeCompare(apB, 'es');
                      const nomA = (a.user?.nombre || '').toLowerCase();
                      const nomB = (b.user?.nombre || '').toLowerCase();
                      return nomA.localeCompare(nomB, 'es');
                    })
                    .map(est => (
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

          {/* Selector de destinatario: estudiante, representante o ambos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              A quién va dirigido <span className="text-red-500">*</span>
            </label>
            <select
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="estudiante">Solo al estudiante</option>
              <option value="representante">Solo al representante/padre</option>
              <option value="ambos">Al estudiante y al representante</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Esta opción define a quién se envía el mensaje (tanto en el sistema como por email si está activado)
            </p>
          </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo adjunto (opcional)
            </label>
            <input
              id="adjunto-input"
              type="file"
              onChange={handleFileChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo 5 MB. Formatos: PDF, DOC, DOCX, imágenes, Excel, ZIP, etc.
            </p>
            {adjunto && (
              <p className="text-sm text-green-600 mt-1">
                Archivo seleccionado: {adjunto.name} ({(adjunto.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Opciones de notificación */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Opciones de Notificación</h2>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enviarPorSistema}
                onChange={(e) => setEnviarPorSistema(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Enviar por mensaje del sistema (interno)</span>
            </label>
            <p className="text-xs text-gray-500 ml-6">
              El mensaje se guardará y será visible en "Mis Mensajes"
            </p>
          </div>

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
            <p className="text-xs text-gray-500 ml-6">
              Se enviará un correo electrónico al destinatario seleccionado
            </p>
            {(destinatario === 'representante' || destinatario === 'ambos') && !enviarEmail && (
              <p className="text-xs text-amber-600 ml-6 mt-1">
                Para que el representante/padre reciba una notificación inmediata por correo, active esta opción.
              </p>
            )}
          </div>

          {(!enviarPorSistema && !enviarEmail) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                Debe seleccionar al menos un canal de envío
              </p>
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
