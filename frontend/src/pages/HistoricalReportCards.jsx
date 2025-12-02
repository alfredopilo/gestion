import { useState, useEffect } from 'react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const HistoricalReportCards = () => {
  const { user, selectedInstitutionId } = useAuth();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSchoolYears, setLoadingSchoolYears] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');
  const [institution, setInstitution] = useState(null);
  const [showAllYears, setShowAllYears] = useState(false);

  useEffect(() => {
    fetchInstitution();
    
    // Verificar si hay estudianteId en los parámetros de la URL
    const estudianteIdFromUrl = searchParams.get('estudianteId');
    if (estudianteIdFromUrl) {
      setSelectedStudentId(estudianteIdFromUrl);
    } else if (user?.rol === 'ESTUDIANTE' && user?.student?.id) {
      // Si es ESTUDIANTE, establecer el estudiante actual automáticamente
      setSelectedStudentId(user.student.id);
    }
  }, [selectedInstitutionId, user, searchParams]);

  useEffect(() => {
    // Cargar estudiantes si es ADMIN o SECRETARIA
    if ((user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && selectedInstitutionId) {
      fetchStudents();
    }
    
    // Si es ESTUDIANTE y tiene student.id, agregar a la lista de estudiantes para mostrar nombre
    if (user?.rol === 'ESTUDIANTE' && user?.student) {
      setStudents([user.student]);
    }
  }, [selectedInstitutionId, user?.rol, user?.student]);

  useEffect(() => {
    // Cargar años lectivos cuando se selecciona un estudiante
    if (selectedStudentId) {
      fetchSchoolYears();
    } else {
      setSchoolYears([]);
      setSelectedSchoolYearId('');
    }
  }, [selectedStudentId]);

  useEffect(() => {
    // Resetear año lectivo cuando cambia el checkbox
    if (showAllYears) {
      setSelectedSchoolYearId('');
    }
  }, [showAllYears]);

  const fetchInstitution = async () => {
    try {
      let institutionData = null;
      if (selectedInstitutionId) {
        const response = await api.get(`/institutions/${selectedInstitutionId}`);
        institutionData = response.data;
      } else {
        const response = await api.get('/institutions/active');
        institutionData = response.data;
      }
      setInstitution(institutionData);
    } catch (error) {
      console.error('Error al obtener institución:', error);
      try {
        const response = await api.get('/institutions/active');
        setInstitution(response.data);
      } catch (err) {
        console.error('Error al obtener institución activa:', err);
      }
    }
  };

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const response = await api.get('/students?includeRetired=true&limit=1000');
      const studentsData = response.data.data || [];
      
      // Ordenar estudiantes por apellido y nombre
      const studentsSorted = [...studentsData].sort((a, b) => {
        const apellidoA = (a.user?.apellido || '').toLowerCase();
        const apellidoB = (b.user?.apellido || '').toLowerCase();
        if (apellidoA !== apellidoB) {
          return apellidoA.localeCompare(apellidoB);
        }
        const nombreA = (a.user?.nombre || '').toLowerCase();
        const nombreB = (b.user?.nombre || '').toLowerCase();
        return nombreA.localeCompare(nombreB);
      });
      
      setStudents(studentsSorted);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchSchoolYears = async () => {
    try {
      setLoadingSchoolYears(true);
      const response = await api.get(`/students/${selectedStudentId}/school-years`);
      const schoolYearsData = response.data.data || [];
      setSchoolYears(schoolYearsData);
      
      if (schoolYearsData.length === 0) {
        toast('Este estudiante no tiene años lectivos registrados');
      }
    } catch (error) {
      console.error('Error al cargar años lectivos:', error);
      toast.error(error.response?.data?.error || 'Error al cargar años lectivos');
      setSchoolYears([]);
    } finally {
      setLoadingSchoolYears(false);
    }
  };

  const generateHistoricalReportCards = async () => {
    if (!selectedStudentId) {
      toast.error('Debe seleccionar un estudiante');
      return;
    }

    try {
      setLoading(true);
      const params = {
        estudianteId: selectedStudentId,
      };

      // Si no se selecciona "Todos", agregar filtro de año lectivo
      if (!showAllYears && selectedSchoolYearId) {
        params.anioLectivoId = selectedSchoolYearId;
      }

      // Agregar timestamp para evitar caché (solo en los parámetros, sin header)
      const paramsWithCacheBuster = {
        ...params,
        _t: new Date().getTime(),
      };
      
      const response = await api.get('/report-cards/historical', { 
        params: paramsWithCacheBuster,
      });
      
      console.log('[HistoricalReportCards Frontend] Respuesta del backend:', {
        dataLength: response.data.data?.length || 0,
        data: response.data.data,
        total: response.data.total,
      });
      
      setReportCards(response.data.data || []);
      
      if (response.data.data.length === 0) {
        toast('No se encontraron boletines para los criterios seleccionados');
        console.warn('[HistoricalReportCards Frontend] No se encontraron boletines. Verifica los logs del backend.');
      } else {
        toast.success(`Se encontraron ${response.data.data.length} boletín(es)`);
      }
    } catch (error) {
      console.error('Error al generar boletines históricos:', error);
      toast.error(error.response?.data?.error || 'Error al generar boletines históricos');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (reportCard) => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a2');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5;
      const marginLeft = margin;
      const marginRight = margin;
      const marginTop = margin;
      const marginBottom = margin;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      let cursorY = marginTop;

      // Logo e institución
      if (institution) {
        const logoSize = 15;
        const logoWidth = logoSize;
        const logoSpacing = 3;
        
        if (institution.logo) {
          try {
            let imgData = institution.logo;
            let imgFormat = 'PNG';
            
            if (institution.logo.startsWith('data:image/')) {
              const matches = institution.logo.match(/data:image\/(\w+);base64,/);
              if (matches) {
                imgFormat = matches[1].toUpperCase();
                imgData = institution.logo;
              }
            } else if (institution.logo.startsWith('data:')) {
              imgData = institution.logo;
            }
            
            doc.addImage(imgData, imgFormat, marginLeft, cursorY, logoWidth, logoSize);
          } catch (error) {
            console.error('Error al cargar logo:', error);
          }
        }
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const institutionX = institution.logo ? marginLeft + logoWidth + logoSpacing : marginLeft + contentWidth / 2;
        const textY = cursorY + (logoSize / 2) + 2;
        doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
        cursorY += Math.max(logoSize, 18) + 5;
      }

      // Título
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('BOLETÍN HISTÓRICO DE CALIFICACIONES', marginLeft + contentWidth / 2, cursorY, { align: 'center' });
      cursorY += 8;
      
      // Información del estudiante
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Estudiante: ${reportCard.estudiante.apellido} ${reportCard.estudiante.nombre}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Identificación: ${reportCard.estudiante.numeroIdentificacion}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Curso: ${reportCard.curso.nombre} - ${reportCard.curso.nivel} ${reportCard.curso.paralelo || ''}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Año Lectivo: ${reportCard.anioLectivo?.nombre || reportCard.anioLectivo?.ano || '-'}`, marginLeft, cursorY);
      cursorY += 5;
      if (reportCard.curso.periodo && reportCard.curso.periodo !== '-') {
        doc.text(`Período: ${reportCard.curso.periodo}`, marginLeft, cursorY);
        cursorY += 5;
      }
      cursorY += 8;

      // Usar periodsGrouped del reportCard si está disponible
      const periodsGrouped = reportCard.periodsGrouped || [];
      const materias = reportCard.materias || [];

      // Filtrar periodsGrouped para materias con datos
      const allSubPeriodIds = new Set();
      materias.forEach(materia => {
        Object.keys(materia.promediosSubPeriodo || {}).forEach(spId => allSubPeriodIds.add(spId));
      });
      
      let filteredPeriodsGrouped = periodsGrouped.map(periodGroup => ({
        ...periodGroup,
        subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
          allSubPeriodIds.has(subPeriodGroup.subPeriodoId)
        )
      })).filter(p => p.subPeriods.length > 0);

      // Si no hay periodsGrouped pero hay datos en materias, construir desde las materias
      if (filteredPeriodsGrouped.length === 0 && allSubPeriodIds.size > 0) {
        const periodMap = new Map();
        materias.forEach(materia => {
          Object.entries(materia.promediosSubPeriodo || {}).forEach(([subPeriodoId, data]) => {
            const periodoKey = 'default';
            if (!periodMap.has(periodoKey)) {
              periodMap.set(periodoKey, {
                periodoId: periodoKey,
                periodoNombre: 'Período',
                periodoOrden: 1,
                periodoPonderacion: 100,
                subPeriods: [],
              });
            }
            const period = periodMap.get(periodoKey);
            if (!period.subPeriods.find(sp => sp.subPeriodoId === subPeriodoId)) {
              period.subPeriods.push({
                subPeriodoId: subPeriodoId,
                subPeriodoNombre: data.subPeriodoNombre || 'Subperíodo',
                subPeriodoOrden: 1,
                subPeriodoPonderacion: data.ponderacion || 0,
              });
            }
          });
        });
        filteredPeriodsGrouped = Array.from(periodMap.values());
      }
      
      const materiasConDatos = materias.filter(materia => {
        if (materia.promediosSubPeriodo && Object.keys(materia.promediosSubPeriodo).length > 0) {
          return true;
        }
        if (materia.promediosPeriodo && Object.keys(materia.promediosPeriodo).length > 0) {
          return true;
        }
        if (materia.promedioGeneral !== null && materia.promedioGeneral !== undefined) {
          return true;
        }
        if (materia.calificaciones && materia.calificaciones.length > 0) {
          return true;
        }
        return false;
      });
      
      const showGeneralColumn = filteredPeriodsGrouped.length > 1;

      if (materiasConDatos.length === 0) {
        doc.setFontSize(12);
        doc.text('No se encontraron promedios para este estudiante en este año lectivo.', marginLeft, cursorY);
        const fileName = `boletin_historico_${reportCard.estudiante.numeroIdentificacion}_${reportCard.anioLectivo?.ano || 'historico'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        return;
      }

      // Construir headers de múltiples niveles
      const buildHeadRows = (showGeneralColumn) => {
        const headRows = [];
        
        const firstRow = [
          { content: 'Materia', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        ];
        
        filteredPeriodsGrouped.forEach((periodGroup) => {
          const periodColumns = periodGroup.subPeriods.reduce((sum, sub) => sum + 2, 0) + 2;
          firstRow.push({
            content: periodGroup.periodoNombre,
            colSpan: periodColumns,
            styles: { fillColor: [156, 163, 175] },
          });
        });

        if (showGeneralColumn) {
          firstRow.push({
            content: 'Prom. General',
            rowSpan: 3,
            styles: { fillColor: [253, 224, 71] },
          });
        }

        headRows.push(firstRow);

        const secondRow = [];
        filteredPeriodsGrouped.forEach((periodGroup) => {
          periodGroup.subPeriods.forEach((subPeriodGroup) => {
            secondRow.push({
              content: subPeriodGroup.subPeriodoNombre,
              colSpan: 2,
              styles: { fillColor: [229, 231, 235] },
            });
          });
          secondRow.push({
            content: 'Promedio del período',
            colSpan: 2,
            styles: { fillColor: [229, 231, 235] },
          });
        });
        headRows.push(secondRow);

        const thirdRow = [];
        filteredPeriodsGrouped.forEach((periodGroup) => {
          periodGroup.subPeriods.forEach((subPeriodGroup) => {
            thirdRow.push({ content: 'Prom. Sub', styles: { fillColor: [191, 219, 254] } });
            thirdRow.push({ content: 'Prom. Pond. Sub', styles: { fillColor: [191, 219, 254] } });
          });
          thirdRow.push({ content: 'Prom. Período', styles: { fillColor: [221, 214, 254] } });
          thirdRow.push({ content: 'Prom. Pond. Período', styles: { fillColor: [221, 214, 254] } });
        });
        headRows.push(thirdRow);

        return headRows;
      };

      const formatAverageText = (valor, equivalente) => {
        if (valor === null || valor === undefined) return '-';
        const base = valor.toFixed(2);
        return equivalente ? `${equivalente} (${base})` : base;
      };

      const buildBodyRow = (materia, showGeneralColumn) => {
        const rowData = [materia.materia.nombre];

        filteredPeriodsGrouped.forEach((periodGroup) => {
          periodGroup.subPeriods.forEach((subPeriodGroup) => {
            const promedioSubPeriodo = materia.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
            const promedioSubText = promedioSubPeriodo 
              ? formatAverageText(promedioSubPeriodo.promedio, promedioSubPeriodo.equivalente)
              : '-';
            rowData.push(promedioSubText);
            rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedioPonderado.toFixed(2) : '-');
          });

          const periodoId = periodGroup.periodoId;
          let promedioPeriodo = null;
          if (periodoId && materia.promediosPeriodo) {
            promedioPeriodo = materia.promediosPeriodo[periodoId];
          }
          if (!promedioPeriodo && materia.promediosPeriodo) {
            promedioPeriodo = Object.values(materia.promediosPeriodo).find(
              (p) => p.periodoNombre === periodGroup.periodoNombre
            );
          }
          const promedioPeriodoText = promedioPeriodo 
            ? formatAverageText(promedioPeriodo.promedio, promedioPeriodo.equivalente)
            : '-';
          rowData.push(promedioPeriodoText);
          rowData.push(promedioPeriodo ? promedioPeriodo.promedioPonderado.toFixed(2) : '-');
        });

        if (showGeneralColumn) {
          const promedioGeneralText = materia.promedioGeneral !== null && materia.promedioGeneral !== undefined
            ? formatAverageText(materia.promedioGeneral, materia.equivalenteGeneral)
            : '-';
          rowData.push(promedioGeneralText);
        }

        return rowData;
      };

      const ensureSpace = (requiredSpace) => {
        if (cursorY + requiredSpace > pageHeight - marginBottom) {
          doc.addPage();
          cursorY = marginTop;
        }
      };

      ensureSpace(30);
      
      const headRows = buildHeadRows(showGeneralColumn);
      const bodyRows = materiasConDatos.map((materia) => buildBodyRow(materia, showGeneralColumn));
      
      const promedioGeneralRow = ['PROMEDIO GENERAL'];
      filteredPeriodsGrouped.forEach((periodGroup) => {
        periodGroup.subPeriods.forEach(() => {
          promedioGeneralRow.push('-', '-');
        });
        promedioGeneralRow.push('-', '-');
      });
      if (showGeneralColumn) {
        promedioGeneralRow.push(
          reportCard.promedioGeneral !== null && reportCard.promedioGeneral !== undefined
            ? reportCard.promedioGeneral.toFixed(2)
            : '-'
        );
      }
      bodyRows.push(promedioGeneralRow);

      autoTable(doc, {
        head: headRows,
        body: bodyRows,
        startY: cursorY,
        margin: { left: marginLeft, right: marginRight },
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: {
          fillColor: [156, 163, 175],
          textColor: 0,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        didParseCell: (data) => {
          if (data.row.index === bodyRows.length - 1) {
            data.cell.styles.fillColor = [253, 224, 71];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index > 0 && data.row.index < bodyRows.length - 1) {
            const value = parseFloat(data.cell.text[0]);
            if (!isNaN(value)) {
              if (value >= 7) {
                data.cell.styles.textColor = [34, 197, 94];
              } else if (value >= 5) {
                data.cell.styles.textColor = [234, 179, 8];
              } else {
                data.cell.styles.textColor = [239, 68, 68];
              }
            }
          }
        },
      });

      cursorY = doc.lastAutoTable.finalY + 5;

      ensureSpace(10);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy')}`, marginLeft, cursorY);
      
      const fileName = `boletin_historico_${reportCard.estudiante.numeroIdentificacion}_${reportCard.anioLectivo?.ano || 'historico'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('Boletín exportado a PDF exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar boletín');
    }
  };

  const exportAllToPDF = () => {
    if (reportCards.length === 0) {
      toast.error('No hay boletines para exportar');
      return;
    }

    reportCards.forEach((reportCard, index) => {
      setTimeout(() => {
        exportToPDF(reportCard);
      }, index * 500);
    });
    
    toast.success(`Exportando ${reportCards.length} boletines...`);
  };

  const renderAverageDisplay = (valor, equivalente) => {
    if (valor === null || valor === undefined) {
      return <span className="text-gray-300 text-xs">-</span>;
    }
    const getNumericColorClass = (valor) => {
      if (valor === null || valor === undefined) return 'text-gray-500';
      if (valor >= 9) return 'text-green-600';
      if (valor >= 7) return 'text-blue-600';
      if (valor >= 5) return 'text-yellow-600';
      return 'text-red-600';
    };
    const colorClass = getNumericColorClass(valor);
    if (equivalente) {
      return (
        <div className="flex flex-col items-center leading-tight">
          <span className={`text-sm font-bold ${colorClass}`}>{equivalente}</span>
          <span className="text-xs text-gray-600">({valor.toFixed(2)})</span>
        </div>
      );
    }
    return (
      <span className={`font-bold text-sm ${colorClass}`}>
        {valor.toFixed(2)}
      </span>
    );
  };

  // Agrupar reportCards por año lectivo
  const reportCardsBySchoolYear = {};
  reportCards.forEach(reportCard => {
    const anioLectivoKey = reportCard.anioLectivo?.id || 'unknown';
    if (!reportCardsBySchoolYear[anioLectivoKey]) {
      reportCardsBySchoolYear[anioLectivoKey] = {
        anioLectivo: reportCard.anioLectivo,
        reportCards: [],
      };
    }
    reportCardsBySchoolYear[anioLectivoKey].reportCards.push(reportCard);
  });

  // Determinar si mostrar selector de estudiante
  const showStudentSelector = user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Boletines Históricos de Calificaciones</h1>
        <p className="text-gray-600">Consulta boletines de calificaciones del año lectivo actual y años anteriores</p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showStudentSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estudiante <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setReportCards([]);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={loadingStudents}
              >
                <option value="">Seleccionar estudiante</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.user?.apellido} {student.user?.nombre}
                    {student.user?.numeroIdentificacion ? ` (${student.user.numeroIdentificacion})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!showStudentSelector && selectedStudentId && (
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong>Estudiante:</strong>{' '}
                {students.find(s => s.id === selectedStudentId)?.user?.apellido}{' '}
                {students.find(s => s.id === selectedStudentId)?.user?.nombre}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Año Lectivo
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showAllYears}
                  onChange={(e) => {
                    setShowAllYears(e.target.checked);
                    setSelectedSchoolYearId('');
                    setReportCards([]);
                  }}
                  className="mr-2"
                  disabled={!selectedStudentId || loadingSchoolYears}
                />
                <span className="text-sm text-gray-600">Todos los años lectivos</span>
              </label>
              <select
                value={selectedSchoolYearId}
                onChange={(e) => {
                  setSelectedSchoolYearId(e.target.value);
                  setShowAllYears(false);
                  setReportCards([]);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                disabled={showAllYears || !selectedStudentId || loadingSchoolYears}
              >
                <option value="">Seleccionar año lectivo</option>
                {schoolYears.map((schoolYear) => (
                  <option key={schoolYear.id} value={schoolYear.id}>
                    {schoolYear.nombre} ({schoolYear.ano})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={generateHistoricalReportCards}
              disabled={loading || !selectedStudentId || loadingStudents || loadingSchoolYears}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generando...' : 'Generar Boletines'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados - Agrupados por año lectivo */}
      {Object.keys(reportCardsBySchoolYear).length > 0 && (
        <div className="space-y-6">
          {/* Botones de exportación */}
          <div className="bg-white shadow rounded-lg p-4 flex justify-end gap-3">
            <button
              onClick={exportAllToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <span>📄</span> Exportar Todos a PDF
            </button>
          </div>

          {/* Boletines agrupados por año lectivo */}
          {Object.values(reportCardsBySchoolYear).map(({ anioLectivo, reportCards: yearReportCards }) => (
            <div key={anioLectivo?.id || 'unknown'} className="space-y-4">
              {/* Encabezado del año lectivo */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h2 className="text-xl font-bold text-blue-900">
                  {anioLectivo?.nombre || 'Año Lectivo Desconocido'} ({anioLectivo?.ano || 'N/A'})
                </h2>
                {anioLectivo?.fechaInicio && anioLectivo?.fechaFin && (
                  <p className="text-sm text-blue-700 mt-1">
                    {format(new Date(anioLectivo.fechaInicio), 'dd/MM/yyyy')} - {format(new Date(anioLectivo.fechaFin), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>

              {/* Boletines del año lectivo */}
              {yearReportCards.map((reportCard, index) => {
                const materias = reportCard.materias || [];
                const periodsGrouped = reportCard.periodsGrouped || [];
                
                // Log para depuración
                console.log(`[HistoricalReportCards Frontend] ReportCard ${index}:`, {
                  curso: reportCard.curso?.nombre,
                  anioLectivo: reportCard.anioLectivo?.nombre,
                  periodsGroupedLength: periodsGrouped.length,
                  periodsGrouped: periodsGrouped,
                  materiasLength: materias.length,
                });
                
                const allSubPeriodIds = new Set();
                materias.forEach(materia => {
                  Object.keys(materia.promediosSubPeriodo || {}).forEach(spId => allSubPeriodIds.add(spId));
                });
                
                // Usar directamente los períodos que vienen del backend sin filtrar
                // El backend ya incluye todos los períodos del año lectivo
                let filteredPeriodsGrouped = periodsGrouped || [];
                
                // Solo si NO hay períodos del backend Y hay calificaciones, construir desde las calificaciones
                if (filteredPeriodsGrouped.length === 0 && allSubPeriodIds.size > 0) {
                  console.log('[HistoricalReportCards Frontend] No hay períodos del backend, construyendo desde calificaciones');
                  // Fallback: construir desde promediosSubPeriodo si no hay periodsGrouped
                  const periodMap = new Map();
                  materias.forEach(materia => {
                    Object.entries(materia.promediosSubPeriodo || {}).forEach(([subPeriodoId, data]) => {
                      const periodoKey = 'default';
                      if (!periodMap.has(periodoKey)) {
                        periodMap.set(periodoKey, {
                          periodoId: periodoKey,
                          periodoNombre: 'Período',
                          periodoOrden: 1,
                          periodoPonderacion: 100,
                          subPeriods: [],
                        });
                      }
                      const period = periodMap.get(periodoKey);
                      if (!period.subPeriods.find(sp => sp.subPeriodoId === subPeriodoId)) {
                        period.subPeriods.push({
                          subPeriodoId: subPeriodoId,
                          subPeriodoNombre: data.subPeriodoNombre || 'Subperíodo',
                          subPeriodoOrden: 1,
                          subPeriodoPonderacion: data.ponderacion || 0,
                        });
                      }
                    });
                  });
                  filteredPeriodsGrouped = Array.from(periodMap.values());
                }
                
                console.log(`[HistoricalReportCards Frontend] Períodos finales para mostrar: ${filteredPeriodsGrouped.length}`, filteredPeriodsGrouped);
                
                const materiasConDatos = materias.filter(materia => {
                  if (materia.promediosSubPeriodo && Object.keys(materia.promediosSubPeriodo).length > 0) {
                    return true;
                  }
                  if (materia.promediosPeriodo && Object.keys(materia.promediosPeriodo).length > 0) {
                    return true;
                  }
                  if (materia.promedioGeneral !== null && materia.promedioGeneral !== undefined) {
                    return true;
                  }
                  if (materia.calificaciones && materia.calificaciones.length > 0) {
                    return true;
                  }
                  return false;
                });
                
                const showGeneralColumn = filteredPeriodsGrouped.length > 1;

                return (
                  <div key={`${reportCard.curso.id}-${index}`} className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-2">
                          {reportCard.curso.nombre} - {reportCard.curso.nivel} {reportCard.curso.paralelo || ''}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {reportCard.curso.periodo && reportCard.curso.periodo !== '-' && (
                            <>Período: <span className="font-semibold">{reportCard.curso.periodo}</span> | </>
                          )}
                          Matrícula: <span className="font-semibold">{reportCard.estudiante.numeroIdentificacion}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => exportToPDF(reportCard)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                      >
                        <span>📄</span> Exportar PDF
                      </button>
                    </div>

                    {materiasConDatos.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-lg">No se encontraron promedios para este curso.</p>
                      </div>
                    ) : filteredPeriodsGrouped.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-lg">No se encontraron períodos configurados para este año lectivo.</p>
                        <p className="text-sm mt-2">Por favor, verifica que el año lectivo tenga períodos configurados.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
                        <table className="min-w-full border-collapse">
                          <thead className="bg-gray-100 sticky top-0 z-20">
                            <tr>
                              <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-0 bg-gray-100 z-30 min-w-[150px] shadow-sm">Materia</th>
                              {filteredPeriodsGrouped && filteredPeriodsGrouped.map((periodGroup, periodIdx) => {
                                const totalColumns = periodGroup.subPeriods.reduce((sum, subPeriod) => sum + 2, 0) + 2;
                                return (
                                  <th key={periodIdx} rowSpan="1" colSpan={totalColumns} className="px-3 py-2 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-200">
                                    {periodGroup.periodoNombre}
                                  </th>
                                );
                              })}
                              {showGeneralColumn && (
                                <th rowSpan="3" className="px-3 py-3 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-300">Promedio General</th>
                              )}
                            </tr>
                            <tr>
                              {filteredPeriodsGrouped && filteredPeriodsGrouped.map((periodGroup, periodIdx) => (
                                <React.Fragment key={`period-${periodIdx}`}>
                                  {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => {
                                    return (
                                      <React.Fragment key={`${periodIdx}-${subPeriodIdx}`}>
                                        <th colSpan="2" className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 bg-gray-100">
                                          {subPeriodGroup.subPeriodoNombre}
                                        </th>
                                      </React.Fragment>
                                    );
                                  })}
                                  <th rowSpan="2" colSpan="1" className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-purple-50" title="Promedio del período">Prom. Período</th>
                                  <th rowSpan="2" colSpan="1" className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-purple-100" title={`Promedio ponderado del período (${periodGroup.periodoPonderacion}%)`}>Prom. Pond. Período</th>
                                </React.Fragment>
                              ))}
                            </tr>
                            <tr>
                              {filteredPeriodsGrouped && filteredPeriodsGrouped.map((periodGroup, periodIdx) => (
                                <React.Fragment key={`period-header-${periodIdx}`}>
                                  {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => (
                                    <React.Fragment key={`subperiod-header-${periodIdx}-${subPeriodIdx}`}>
                                      <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-50">Prom. Sub</th>
                                      <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-100">Prom. Pond. Sub</th>
                                    </React.Fragment>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {materiasConDatos.map((materia, materiaIndex) => (
                              <tr key={materia.materia.id} className={`hover:bg-blue-50 transition-colors ${materiaIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-0 bg-white z-10 font-medium text-sm shadow-sm">{materia.materia.nombre}</td>
                                {filteredPeriodsGrouped && filteredPeriodsGrouped.map((periodGroup, periodIdx) => (
                                  <React.Fragment key={`period-data-${periodIdx}`}>
                                    {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => {
                                      const promedioSubPeriodo = materia.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
                                      return (
                                        <React.Fragment key={`subperiod-data-${periodIdx}-${subPeriodIdx}`}>
                                          <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-50">
                                            {renderAverageDisplay(
                                              promedioSubPeriodo?.promedio ?? null,
                                              promedioSubPeriodo?.equivalente
                                            )}
                                          </td>
                                          <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-100">
                                            {promedioSubPeriodo ? (
                                              <span className={`font-bold text-sm ${promedioSubPeriodo.promedioPonderado >= 7 ? 'text-green-600' : promedioSubPeriodo.promedioPonderado >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {promedioSubPeriodo.promedioPonderado.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-gray-300 text-xs">-</span>
                                            )}
                                          </td>
                                        </React.Fragment>
                                      );
                                    })}
                                    {(() => {
                                      const periodoId = periodGroup.periodoId;
                                      let promedioPeriodo = null;
                                      if (periodoId && materia.promediosPeriodo) {
                                        promedioPeriodo = materia.promediosPeriodo[periodoId];
                                      }
                                      if (!promedioPeriodo && materia.promediosPeriodo) {
                                        const periodoEncontrado = Object.values(materia.promediosPeriodo).find(
                                          p => p.periodoNombre === periodGroup.periodoNombre
                                        );
                                        if (periodoEncontrado) {
                                          promedioPeriodo = periodoEncontrado;
                                        }
                                      }
                                      return (
                                        <>
                                          <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-50">
                                            {renderAverageDisplay(
                                              promedioPeriodo?.promedio ?? null,
                                              promedioPeriodo?.equivalente
                                            )}
                                          </td>
                                          <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-100">
                                            {promedioPeriodo ? (
                                              <span className={`font-bold text-sm ${promedioPeriodo.promedioPonderado >= 7 ? 'text-green-600' : promedioPeriodo.promedioPonderado >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {promedioPeriodo.promedioPonderado.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-gray-300 text-xs">-</span>
                                            )}
                                          </td>
                                        </>
                                      );
                                    })()}
                                  </React.Fragment>
                                ))}
                                {showGeneralColumn && (
                                  <td className="px-3 py-3 text-center border-r border-gray-300 align-middle bg-yellow-50">
                                    {renderAverageDisplay(
                                      materia.promedioGeneral,
                                      materia.equivalenteGeneral
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                            {/* Fila de promedio general del estudiante */}
                            <tr className="bg-yellow-50 font-bold">
                              <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-0 bg-yellow-50 z-10 text-sm shadow-sm">PROMEDIO GENERAL</td>
                              {filteredPeriodsGrouped && filteredPeriodsGrouped.map((periodGroup, periodIdx) => {
                                const totalColumns = periodGroup.subPeriods.reduce((sum, subPeriod) => sum + 2, 0) + 2;
                                return (
                                  <React.Fragment key={`period-empty-${periodIdx}`}>
                                    {Array.from({ length: totalColumns }).map((_, idx) => (
                                      <td key={idx} className="px-2 py-3 text-center border-r border-gray-300 bg-yellow-50">-</td>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                              {showGeneralColumn && (
                                <td className="px-3 py-3 text-center border-r border-gray-300 align-middle bg-yellow-100">
                                  {reportCard.promedioGeneral !== null && reportCard.promedioGeneral !== undefined ? (
                                    <span className={`font-bold text-base ${reportCard.promedioGeneral >= 7 ? 'text-green-600' : reportCard.promedioGeneral >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                      {reportCard.promedioGeneral.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-sm">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoricalReportCards;

