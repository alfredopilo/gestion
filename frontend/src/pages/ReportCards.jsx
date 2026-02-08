import { useState, useEffect } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';
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
  const [agruparPorTipoMateria, setAgruparPorTipoMateria] = useState(false);
  const [incluirAsistencia, setIncluirAsistencia] = useState(false);
  const [busquedaEstudiantes, setBusquedaEstudiantes] = useState('');

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
    setBusquedaEstudiantes('');
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
      const estudiantesData = response.data.estudiantes || [];
      
      // Ordenar estudiantes por apellido y luego por nombre (alfabético ascendente)
      const estudiantesOrdenados = [...estudiantesData].sort((a, b) => {
        const apellidoA = (a.user?.apellido || '').toLowerCase();
        const apellidoB = (b.user?.apellido || '').toLowerCase();
        if (apellidoA !== apellidoB) {
          return apellidoA.localeCompare(apellidoB);
        }
        const nombreA = (a.user?.nombre || '').toLowerCase();
        const nombreB = (b.user?.nombre || '').toLowerCase();
        return nombreA.localeCompare(nombreB);
      });
      
      setEstudiantes(estudiantesOrdenados);
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
        includeAttendance: incluirAsistencia ? 1 : 0,
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
      doc.text(`Estudiante: ${reportCard.estudiante.apellido} ${reportCard.estudiante.nombre}`, marginLeft, cursorY);
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
      
      // Si periodsGrouped está vacío pero hay materias con datos, construir desde las materias
      let filteredPeriodsGrouped = [];
      if (periodsGrouped.length === 0 && allSubPeriodIds.size > 0) {
        // Construir periodsGrouped desde los promediosSubPeriodo de las materias
        const periodMap = new Map();
        materias.forEach(materia => {
          Object.entries(materia.promediosSubPeriodo || {}).forEach(([subPeriodoId, data]) => {
            // Crear una estructura básica con la información disponible
            const periodoKey = 'default'; // Usar un período por defecto si no hay información
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
      } else if (periodsGrouped.length > 0) {
        filteredPeriodsGrouped = periodsGrouped.map(periodGroup => ({
          ...periodGroup,
          subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
            allSubPeriodIds.has(subPeriodGroup.subPeriodoId)
          )
        })).filter(p => p.subPeriods.length > 0);
      }
      
      // Verificar si hay materias con datos: si tiene promediosSubPeriodo, promediosPeriodo, o promedioGeneral
      const materiasConDatos = materias.filter(materia => {
        // Si tiene promediosSubPeriodo con al menos un elemento, tiene datos
        if (materia.promediosSubPeriodo && Object.keys(materia.promediosSubPeriodo).length > 0) {
          return true;
        }
        // Si tiene promediosPeriodo con al menos un elemento, tiene datos
        if (materia.promediosPeriodo && Object.keys(materia.promediosPeriodo).length > 0) {
          return true;
        }
        // Si tiene promedioGeneral, tiene datos
        if (materia.promedioGeneral !== null && materia.promedioGeneral !== undefined) {
          return true;
        }
        // Si tiene calificaciones, tiene datos
        if (materia.calificaciones && materia.calificaciones.length > 0) {
          return true;
        }
        return false;
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

      const materiasNoCualitativas = materiasConDatos.filter(m => !m.materia.cualitativa);
      const materiasCualitativas = materiasConDatos.filter(m => m.materia.cualitativa);
      const pdfBlocks = agruparPorTipoMateria
        ? [
            { materias: materiasNoCualitativas, showPromedioGeneral: materiasCualitativas.length === 0 },
            { materias: materiasCualitativas, showPromedioGeneral: true },
          ].filter(b => b.materias.length > 0)
        : [{ materias: materiasConDatos, showPromedioGeneral: true }];

      const headRows = buildHeadRows(showGeneralColumn);

      pdfBlocks.forEach((block) => {
        ensureSpace(30);
        let bodyRows = block.materias.map((materia) => buildBodyRow(materia, showGeneralColumn));
        if (block.showPromedioGeneral) {
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
        }

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
            if (block.showPromedioGeneral && data.row.index === bodyRows.length - 1) {
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
      });

      if (incluirAsistencia && reportCard.asistencia?.resumen) {
        const r = reportCard.asistencia.resumen;
        ensureSpace(25);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Resumen de asistencia', marginLeft, cursorY);
        cursorY += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Total días: ${r.total}  |  Asistencias: ${r.asistencias}  |  Faltas: ${r.faltas}  |  Justificadas: ${r.justificadas}  |  Tardes: ${r.tardes}  |  Porcentaje: ${r.porcentajeAsistencia}%`, marginLeft, cursorY);
        cursorY += 8;
      }

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

  const getNumericColorClass = (valor) => {
    if (valor === null || valor === undefined) return 'text-gray-500';
    if (valor >= 9) return 'text-green-600';
    if (valor >= 7) return 'text-blue-600';
    if (valor >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderAverageDisplay = (valor, equivalente) => {
    if (valor === null || valor === undefined) {
      return <span className="text-gray-300 text-xs">-</span>;
    }
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

  const formatAverageText = (valor, equivalente) => {
    if (valor === null || valor === undefined) return '-';
    const base = valor.toFixed(2);
    return equivalente ? `${equivalente} (${base})` : base;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Boletines de Calificaciones</h1>
          <p className="text-gray-600">Genera y consulta los boletines de calificaciones por estudiante</p>
        </div>
        <Link
          to="/historical-report-cards"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <span>📜</span> Boletines Históricos
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Filtros</h2>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 min-h-[44px]">
              <label className="text-sm font-medium text-gray-700 cursor-pointer whitespace-nowrap">Agrupar por Tipo de materia</label>
              <button
                type="button"
                role="switch"
                aria-checked={agruparPorTipoMateria}
                onClick={() => setAgruparPorTipoMateria((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex-shrink-0 ${agruparPorTipoMateria ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <span className="sr-only">Agrupar por tipo de materia</span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${agruparPorTipoMateria ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 min-h-[44px]">
              <label className="text-sm font-medium text-gray-700 cursor-pointer whitespace-nowrap">Incluir asistencia</label>
              <button
                type="button"
                role="switch"
                aria-checked={incluirAsistencia}
                onClick={() => setIncluirAsistencia((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex-shrink-0 ${incluirAsistencia ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <span className="sr-only">Incluir asistencia</span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${incluirAsistencia ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
            <button
              onClick={generateReportCards}
              disabled={loading || !selectedCurso || selectedEstudiantes.length === 0}
              className="min-h-[44px] px-5 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap"
            >
              {loading ? 'Generando...' : 'Generar Boletines'}
            </button>
          </div>
        </div>
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
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => setSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Seleccionar todos</span>
                </label>
              </div>
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido o identificación..."
                  value={busquedaEstudiantes}
                  onChange={(e) => setBusquedaEstudiantes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 shadow-inner">
                <ul className="divide-y divide-gray-200">
                  {estudiantes
                    .filter((est) => {
                      if (!busquedaEstudiantes.trim()) return true;
                      const q = busquedaEstudiantes.trim().toLowerCase();
                      const nombre = (est.user?.nombre || '').toLowerCase();
                      const apellido = (est.user?.apellido || '').toLowerCase();
                      const id = String(est.user?.numeroIdentificacion || '');
                      return nombre.includes(q) || apellido.includes(q) || id.includes(q);
                    })
                    .map((estudiante) => {
                      const nombreCompleto = `${estudiante.user?.apellido || ''} ${estudiante.user?.nombre || ''}`.trim();
                      const selected = selectedEstudiantes.includes(estudiante.id);
                      return (
                        <li key={estudiante.id}>
                          <label className="flex items-center gap-3 px-4 py-3 hover:bg-white cursor-pointer transition-colors border-l-4 border-transparent hover:border-primary-200 focus-within:bg-white focus-within:border-primary-400">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleStudent(estudiante.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 shrink-0"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-gray-900 truncate">{nombreCompleto || 'Sin nombre'}</span>
                              {estudiante.user?.numeroIdentificacion && (
                                <span className="block text-xs text-gray-500 mt-0.5">{estudiante.user.numeroIdentificacion}</span>
                              )}
                            </span>
                            {selected && (
                              <span className="shrink-0 text-primary-600" aria-hidden="true">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedEstudiantes.length} de {estudiantes.length} estudiantes seleccionados
              </p>
            </div>
          )}
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
            
            // Si periodsGrouped está vacío pero hay materias con datos, construir desde las materias
            let filteredPeriodsGrouped = periodsGrouped;
            if (periodsGrouped.length === 0 && allSubPeriodIds.size > 0) {
              // Construir periodsGrouped desde los promediosSubPeriodo de las materias
              const periodMap = new Map();
              materias.forEach(materia => {
                Object.entries(materia.promediosSubPeriodo || {}).forEach(([subPeriodoId, data]) => {
                  // Necesitamos obtener información del período desde las calificaciones o materias
                  // Por ahora, crear una estructura básica
                  if (!periodMap.has('default')) {
                    periodMap.set('default', {
                      periodoId: 'default',
                      periodoNombre: 'Período',
                      periodoOrden: 1,
                      periodoPonderacion: 100,
                      subPeriods: [],
                    });
                  }
                  const period = periodMap.get('default');
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
            } else {
              filteredPeriodsGrouped = periodsGrouped.map(periodGroup => ({
                ...periodGroup,
                subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
                  allSubPeriodIds.has(subPeriodGroup.subPeriodoId)
                )
              })).filter(p => p.subPeriods.length > 0);
            }
            
            // Verificar si hay materias con datos: si tiene promediosSubPeriodo, promediosPeriodo, o promedioGeneral
            const materiasConDatos = materias.filter(materia => {
              // Si tiene promediosSubPeriodo con al menos un elemento, tiene datos
              if (materia.promediosSubPeriodo && Object.keys(materia.promediosSubPeriodo).length > 0) {
                return true;
              }
              // Si tiene promediosPeriodo con al menos un elemento, tiene datos
              if (materia.promediosPeriodo && Object.keys(materia.promediosPeriodo).length > 0) {
                return true;
              }
              // Si tiene promedioGeneral, tiene datos
              if (materia.promedioGeneral !== null && materia.promedioGeneral !== undefined) {
                return true;
              }
              // Si tiene calificaciones, tiene datos
              if (materia.calificaciones && materia.calificaciones.length > 0) {
                return true;
              }
              return false;
            });

            const materiasNoCualitativas = materiasConDatos.filter(m => !m.materia.cualitativa);
            const materiasCualitativas = materiasConDatos.filter(m => m.materia.cualitativa);
            const tableBlocks = agruparPorTipoMateria
              ? [
                  { materias: materiasNoCualitativas, showPromedioGeneral: materiasCualitativas.length === 0 },
                  { materias: materiasCualitativas, showPromedioGeneral: true },
                ].filter(b => b.materias.length > 0)
              : [{ materias: materiasConDatos, showPromedioGeneral: true }];
            
            const showGeneralColumn = filteredPeriodsGrouped.length > 1;

            return (
              <div key={reportCard.estudiante.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {reportCard.estudiante.apellido} {reportCard.estudiante.nombre}
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
                  <>
                    {tableBlocks.map((block, blockIdx) => (
                      <div key={blockIdx} className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg mb-4">
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
                            {block.materias.map((materia, materiaIndex) => (
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
                            {block.showPromedioGeneral && (
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
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {incluirAsistencia && reportCard.asistencia?.resumen && (
                      <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Resumen de asistencia</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div><span className="text-gray-600">Total días:</span> <span className="font-semibold">{reportCard.asistencia.resumen.total}</span></div>
                          <div><span className="text-gray-600">Asistencias:</span> <span className="font-semibold text-green-600">{reportCard.asistencia.resumen.asistencias}</span></div>
                          <div><span className="text-gray-600">Faltas:</span> <span className="font-semibold text-red-600">{reportCard.asistencia.resumen.faltas}</span></div>
                          <div><span className="text-gray-600">Justificadas:</span> <span className="font-semibold">{reportCard.asistencia.resumen.justificadas}</span></div>
                          <div><span className="text-gray-600">Tardes:</span> <span className="font-semibold">{reportCard.asistencia.resumen.tardes}</span></div>
                          <div><span className="text-gray-600">Porcentaje:</span> <span className="font-semibold">{reportCard.asistencia.resumen.porcentajeAsistencia}%</span></div>
                        </div>
                      </div>
                    )}
                  </>
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

