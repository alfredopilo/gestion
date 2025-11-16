import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Schedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedDocente, setSelectedDocente] = useState('');
  const [cursos, setCursos] = useState([]);
  const [docentes, setDocentes] = useState([]);

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const horas = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    fetchSchedules();
    if (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') {
      fetchFilters();
    }
  }, [selectedCurso, selectedDocente]);

  const fetchFilters = async () => {
    try {
      const [cursosRes, docentesRes] = await Promise.all([
        api.get('/courses?limit=100'),
        api.get('/teachers?limit=100'),
      ]);
      setCursos(cursosRes.data.data || []);
      setDocentes(docentesRes.data.data || []);
    } catch (error) {
      console.error('Error al cargar filtros:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCurso) params.cursoId = selectedCurso;
      if (selectedDocente) params.docenteId = selectedDocente;

      const response = await api.get('/schedules', { params });
      setSchedules(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar horarios:', error);
      toast.error('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  // Generar colores únicos por materia
  const materiaColors = useMemo(() => {
    const colors = {};
    const colorPalette = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', textLight: 'text-blue-700' },
      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', textLight: 'text-green-700' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', textLight: 'text-purple-700' },
      { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', textLight: 'text-yellow-700' },
      { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', textLight: 'text-pink-700' },
      { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', textLight: 'text-indigo-700' },
      { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', textLight: 'text-red-700' },
      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', textLight: 'text-teal-700' },
      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', textLight: 'text-orange-700' },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', textLight: 'text-cyan-700' },
    ];
    
    const materiasUnicas = [...new Set(schedules.map(s => s.materia?.id).filter(Boolean))];
    materiasUnicas.forEach((materiaId, index) => {
      colors[materiaId] = colorPalette[index % colorPalette.length];
    });
    
    return colors;
  }, [schedules]);

  const getMateriaColor = (materiaId) => {
    return materiaColors[materiaId] || {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-900',
      textLight: 'text-gray-700',
    };
  };

  // Organizar horarios por día y hora
  const getScheduleForSlot = (dia, hora) => {
    return schedules.filter(s => s.diaSemana === dia && s.hora === hora);
  };

  const getTitle = () => {
    if (user?.rol === 'ESTUDIANTE') {
      return 'Mi Horario';
    } else if (user?.rol === 'PROFESOR') {
      return 'Mi Horario de Clases';
    } else {
      return 'Horarios';
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a3');
      
      // Título
      doc.setFontSize(18);
      doc.text(getTitle(), 14, 15);
      
      // Subtítulo con filtros si aplica
      doc.setFontSize(12);
      let subtitle = '';
      if (user?.rol === 'ESTUDIANTE') {
        subtitle = 'Horario de clases de tu curso';
      } else if (user?.rol === 'PROFESOR') {
        subtitle = 'Horario de tus clases asignadas';
      } else {
        subtitle = 'Visualiza y gestiona los horarios de todos los cursos';
        if (selectedCurso || selectedDocente) {
          const filters = [];
          if (selectedCurso) {
            const curso = cursos.find(c => c.id === selectedCurso);
            filters.push(`Curso: ${curso?.nombre || ''}`);
          }
          if (selectedDocente) {
            const docente = docentes.find(d => d.id === selectedDocente);
            filters.push(`Docente: ${docente?.user?.nombre || ''} ${docente?.user?.apellido || ''}`);
          }
          subtitle += ` - ${filters.join(', ')}`;
        }
      }
      doc.text(subtitle, 14, 22);
      
      // Preparar datos para la tabla
      const tableData = [];
      const tableColumns = ['Hora', ...diasSemana];
      
      horas.forEach((hora) => {
        const row = [`Hora ${hora}`];
        diasSemana.forEach((dia) => {
          const slotSchedules = getScheduleForSlot(dia, hora);
          if (slotSchedules.length > 0) {
            const cellContent = slotSchedules.map(s => {
              let content = s.materia?.nombre || '';
              if (s.materia?.codigo) content += ` (${s.materia.codigo})`;
              if (s.curso) content += `\n${s.curso.nombre} - ${s.curso.nivel} ${s.curso.paralelo}`;
              if (s.docente) content += `\nProf. ${s.docente.nombre} ${s.docente.apellido}`;
              return content;
            }).join('\n\n');
            row.push(cellContent);
          } else {
            row.push('-');
          }
        });
        tableData.push(row);
      });
      
      // Crear tabla
      autoTable(doc, {
        head: [tableColumns],
        body: tableData,
        startY: 28,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        margin: { top: 28 },
      });
      
      // Guardar PDF
      const fileName = `horario_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success('Horario exportado a PDF exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar horario a PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{getTitle()}</h1>
          <p className="text-gray-600 mt-2">
            {user?.rol === 'ESTUDIANTE' && 'Horario de clases de tu curso'}
            {user?.rol === 'PROFESOR' && 'Horario de tus clases asignadas'}
            {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && 'Visualiza y gestiona los horarios de todos los cursos'}
          </p>
        </div>
        <button
          onClick={exportToPDF}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar a PDF
        </button>
      </div>

      {/* Filtros para Admin/Secretaria */}
      {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Curso
              </label>
              <select
                value={selectedCurso}
                onChange={(e) => setSelectedCurso(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Todos los cursos</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nombre} - {curso.nivel} {curso.paralelo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Docente
              </label>
              <select
                value={selectedDocente}
                onChange={(e) => setSelectedDocente(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Todos los docentes</option>
                {docentes.map((docente) => (
                  <option key={docente.id} value={docente.id}>
                    {docente.user?.nombre} {docente.user?.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de horarios */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                  Hora
                </th>
                {diasSemana.map((dia) => (
                  <th key={dia} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {horas.map((hora) => (
                <tr key={hora}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50">
                    Hora {hora}
                  </td>
                  {diasSemana.map((dia) => {
                    const slotSchedules = getScheduleForSlot(dia, hora);
                    return (
                      <td key={dia} className="px-4 py-4 text-sm">
                        {slotSchedules.length > 0 ? (
                          <div className="space-y-2">
                            {slotSchedules.map((schedule) => {
                              const colors = getMateriaColor(schedule.materia?.id);
                              return (
                                <div
                                  key={schedule.id}
                                  className={`${colors.bg} ${colors.border} border rounded-md p-2`}
                                >
                                  <div className={`font-medium ${colors.text}`}>
                                    {schedule.materia?.nombre}
                                  </div>
                                  {schedule.materia?.codigo && (
                                    <div className={`text-xs ${colors.textLight}`}>
                                      {schedule.materia.codigo}
                                    </div>
                                  )}
                                  {schedule.curso && (
                                    <div className={`text-xs ${colors.textLight} mt-1`}>
                                      {schedule.curso.nombre} - {schedule.curso.nivel} {schedule.curso.paralelo}
                                    </div>
                                  )}
                                  {schedule.docente && (
                                    <div className={`text-xs ${colors.textLight} mt-1`}>
                                      Prof. {schedule.docente.nombre} {schedule.docente.apellido}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-center">-</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Información adicional */}
      {schedules.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <p className="text-yellow-800">
            {user?.rol === 'ESTUDIANTE' && 'No tienes horarios asignados aún.'}
            {user?.rol === 'PROFESOR' && 'No tienes clases asignadas en este momento.'}
            {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && 'No se encontraron horarios con los filtros seleccionados.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Schedule;

