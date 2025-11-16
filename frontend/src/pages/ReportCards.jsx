import { useState, useEffect } from 'react';
import React from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const ReportCards = () => {
  const { user, selectedInstitutionId } = useAuth();
  const [cursos, setCursos] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [periodsGrouped, setPeriodsGrouped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedEstudiantes, setSelectedEstudiantes] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [institution, setInstitution] = useState(null);

  useEffect(() => {
    fetchCourses();
    fetchInstitution();
  }, [selectedInstitutionId]);

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

  useEffect(() => {
    if (selectedCurso) {
      fetchStudents();
    } else {
      setEstudiantes([]);
      setReportCards([]);
    }
  }, [selectedCurso]);

  useEffect(() => {
    if (selectAll && estudiantes.length > 0) {
      setSelectedEstudiantes(estudiantes.map(e => e.id));
    } else if (!selectAll) {
      setSelectedEstudiantes([]);
    }
  }, [selectAll, estudiantes]);

  const fetchCourses = async () => {
    try {
      if (user?.rol === 'PROFESOR') {
        // Para profesores, obtener solo sus cursos asignados
        const response = await api.get('/assignments?limit=100');
        const cursosUnicos = {};
        (response.data.data || []).forEach(assignment => {
          if (assignment.curso && !cursosUnicos[assignment.curso.id]) {
            cursosUnicos[assignment.curso.id] = assignment.curso;
          }
        });
        setCursos(Object.values(cursosUnicos));
      } else {
        const response = await api.get('/courses?limit=100');
        setCursos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar cursos:', error);
      toast.error('Error al cargar cursos');
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/courses/${selectedCurso}`);
      setEstudiantes(response.data.estudiantes || []);
      setSelectedEstudiantes([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    }
  };

  const generateReportCards = async () => {
    if (!selectedCurso) {
      toast.error('Debe seleccionar un curso');
      return;
    }

    if (selectedEstudiantes.length === 0) {
      toast.error('Debe seleccionar al menos un estudiante');
      return;
    }

    try {
      setLoading(true);
      const params = {
        cursoId: selectedCurso,
        estudianteIds: selectedEstudiantes,
      };

      const response = await api.get('/report-cards', { params });
      setReportCards(response.data.data || []);
      setPeriodsGrouped(response.data.periodsGrouped || []);
      
      if (response.data.data.length === 0) {
        toast.info('No se encontraron calificaciones para los estudiantes seleccionados');
      }
    } catch (error) {
      console.error('Error al generar boletines:', error);
      toast.error('Error al generar boletines');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (estudianteId) => {
    setSelectAll(false);
    if (selectedEstudiantes.includes(estudianteId)) {
      setSelectedEstudiantes(selectedEstudiantes.filter(id => id !== estudianteId));
    } else {
      setSelectedEstudiantes([...selectedEstudiantes, estudianteId]);
    }
  };

  const exportToPDF = (reportCard) => {
    try {
      // Usar A2 landscape como en el reporte de promedios
      const doc = new jsPDF('landscape', 'mm', 'a2');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5; // 0.5 cm = 5mm
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
      doc.text('BOLETÍN DE CALIFICACIONES', marginLeft + contentWidth / 2, cursorY, { align: 'center' });
      cursorY += 8;
      
      // Información del estudiante
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Estudiante: ${reportCard.estudiante.nombre} ${reportCard.estudiante.apellido}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Identificación: ${reportCard.estudiante.numeroIdentificacion}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Curso: ${reportCard.curso.nombre} - ${reportCard.curso.nivel} ${reportCard.curso.paralelo}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Período: ${reportCard.curso.periodo}`, marginLeft, cursorY);
      cursorY += 8;

      // Preparar datos: filtrar periodsGrouped para todas las materias
      const materias = reportCard.materias;
      const allSubPeriodIds = new Set();
      materias.forEach(materia => {
        Object.keys(materia.promediosSubPeriodo || {}).forEach(spId => allSubPeriodIds.add(spId));
      });
      
      const filteredPeriodsGrouped = periodsGrouped.map(periodGroup => ({
        ...periodGroup,
        subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
          allSubPeriodIds.has(subPeriodGroup.subPeriodoId)
        )
      })).filter(p => p.subPeriods.length > 0);
      
      const materiasConDatos = materias.filter(materia => {
        return filteredPeriodsGrouped.some(periodGroup =>
          periodGroup.subPeriods.some(subPeriodGroup =>
            materia.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId]
          )
        );
      });
      
      const showGeneralColumn = filteredPeriodsGrouped.length > 1;

      if (materiasConDatos.length === 0) {
        doc.setFontSize(12);
        doc.text('No se encontraron promedios para este estudiante.', marginLeft, cursorY);
        const fileName = `boletin_${reportCard.estudiante.numeroIdentificacion}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        return;
      }

      // Construir headers de múltiples niveles para TODOS los períodos
      const buildHeadRows = (showGeneralColumn) => {
        const headRows = [];
        
        // Primera fila: Materia + cada período como columna agrupada
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

        // Segunda fila: Subperíodos y promedios de período
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

        // Tercera fila: Nombres de columnas individuales
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

      const buildBodyRow = (materia, showGeneralColumn) => {
        const rowData = [materia.materia.nombre];

        filteredPeriodsGrouped.forEach((periodGroup) => {
          periodGroup.subPeriods.forEach((subPeriodGroup) => {
            const promedioSubPeriodo = materia.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
            rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedio.toFixed(2) : '-');
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
          rowData.push(promedioPeriodo ? promedioPeriodo.promedio.toFixed(2) : '-');
          rowData.push(promedioPeriodo ? promedioPeriodo.promedioPonderado.toFixed(2) : '-');
        });

        if (showGeneralColumn) {
          rowData.push(
            materia.promedioGeneral !== null && materia.promedioGeneral !== undefined
              ? materia.promedioGeneral.toFixed(2)
              : '-'
          );
        }

        return rowData;
      };

      const ensureSpace = (requiredSpace) => {
        if (cursorY + requiredSpace > pageHeight - marginBottom) {
          doc.addPage();
          cursorY = marginTop;
        }
      };

      // Generar UNA sola tabla con todos los períodos
      ensureSpace(30);
      
      const headRows = buildHeadRows(showGeneralColumn);
      const bodyRows = materiasConDatos.map((materia) => buildBodyRow(materia, showGeneralColumn));
      
      // Agregar fila de promedio general
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
          // Colorear última fila (promedio general)
          if (data.row.index === bodyRows.length - 1) {
            data.cell.styles.fillColor = [253, 224, 71];
            data.cell.styles.fontStyle = 'bold';
          }
          // Colorear valores según promedio
          if (data.column.index > 0 && data.row.index < bodyRows.length - 1) {
            const value = parseFloat(data.cell.text[0]);
            if (!isNaN(value)) {
              if (value >= 7) {
                data.cell.styles.textColor = [34, 197, 94]; // Verde
              } else if (value >= 5) {
                data.cell.styles.textColor = [234, 179, 8]; // Amarillo
              } else {
                data.cell.styles.textColor = [239, 68, 68]; // Rojo
              }
            }
          }
        },
      });

      cursorY = doc.lastAutoTable.finalY + 5;

      // Fecha de emisión
      ensureSpace(10);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy')}`, marginLeft, cursorY);
      
      // Guardar PDF
      const fileName = `boletin_${reportCard.estudiante.numeroIdentificacion}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
      }, index * 500); // Espaciar las descargas
    });
    
    toast.success(`Exportando ${reportCards.length} boletines...`);
  };

  const getGradeColor = (promedio) => {
    if (promedio === null) return 'text-gray-500';
    if (promedio >= 9) return 'text-green-600 font-bold';
    if (promedio >= 7) return 'text-blue-600';
    if (promedio >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Boletines de Calificaciones</h1>
        <p className="text-gray-600">Genera y consulta los boletines de calificaciones por estudiante</p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCurso}
              onChange={(e) => {
                setSelectedCurso(e.target.value);
                setReportCards([]);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar curso</option>
              {cursos.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.nombre} - {curso.nivel} {curso.paralelo || ''}
                </option>
              ))}
            </select>
          </div>

          {estudiantes.length > 0 && (
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Estudiantes
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => setSelectAll(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Seleccionar todos</span>
                </label>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {estudiantes.map((estudiante) => (
                  <label key={estudiante.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEstudiantes.includes(estudiante.id)}
                      onChange={() => toggleStudent(estudiante.id)}
                      className="mr-3"
                    />
                    <span className="text-sm">
                      {estudiante.user?.nombre} {estudiante.user?.apellido}
                      {estudiante.user?.numeroIdentificacion && (
                        <span className="text-gray-500 ml-2">({estudiante.user.numeroIdentificacion})</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedEstudiantes.length} de {estudiantes.length} estudiantes seleccionados
              </p>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={generateReportCards}
              disabled={loading || !selectedCurso || selectedEstudiantes.length === 0}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generando...' : 'Generar Boletines'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {reportCards.length > 0 && (
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

          {/* Boletines */}
          {reportCards.map((reportCard) => {
            const materias = reportCard.materias;
            
            // Filtrar periodsGrouped para todas las materias (solo subperíodos con datos)
            // Necesitamos un periodsGrouped que incluya todos los subperíodos que tienen datos en cualquier materia
            const allSubPeriodIds = new Set();
            materias.forEach(materia => {
              Object.keys(materia.promediosSubPeriodo || {}).forEach(spId => allSubPeriodIds.add(spId));
            });
            
            const filteredPeriodsGrouped = periodsGrouped.map(periodGroup => ({
              ...periodGroup,
              subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
                allSubPeriodIds.has(subPeriodGroup.subPeriodoId)
              )
            })).filter(p => p.subPeriods.length > 0);
            
            const materiasConDatos = materias.filter(materia => {
              return filteredPeriodsGrouped.some(periodGroup =>
                periodGroup.subPeriods.some(subPeriodGroup =>
                  materia.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId]
                )
              );
            });
            
            const showGeneralColumn = filteredPeriodsGrouped.length > 1;

            return (
              <div key={reportCard.estudiante.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {reportCard.estudiante.nombre} {reportCard.estudiante.apellido}
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Identificación: <span className="font-semibold">{reportCard.estudiante.numeroIdentificacion}</span> | 
                      Curso: <span className="font-semibold">{reportCard.curso.nombre} - {reportCard.curso.nivel} {reportCard.curso.paralelo}</span> | 
                      Período: <span className="font-semibold">{reportCard.curso.periodo}</span>
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
                    <p className="text-lg">No se encontraron promedios para este estudiante.</p>
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
                                        {promedioSubPeriodo ? (
                                          <span className={`font-bold text-sm ${promedioSubPeriodo.promedio >= 7 ? 'text-green-600' : promedioSubPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {promedioSubPeriodo.promedio.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 text-xs">-</span>
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
                                        {promedioPeriodo ? (
                                          <span className={`font-bold text-sm ${promedioPeriodo.promedio >= 7 ? 'text-green-600' : promedioPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {promedioPeriodo.promedio.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 text-xs">-</span>
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
                                {materia.promedioGeneral !== null && materia.promedioGeneral !== undefined ? (
                                  <span className={`font-bold text-base ${materia.promedioGeneral >= 7 ? 'text-green-600' : materia.promedioGeneral >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {materia.promedioGeneral.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-sm">-</span>
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
      )}
    </div>
  );
};

export default ReportCards;

