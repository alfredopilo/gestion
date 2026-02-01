import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';

const Reports = () => {
  const { user, selectedInstitutionId } = useAuth();
  const [reportType, setReportType] = useState('grades');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [institution, setInstitution] = useState(null);
  
  // Filtros
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const subjectsInReport = useMemo(() => {
    if (!reportData?.grades) return [];

    const map = new Map();
    reportData.grades.forEach((row) => {
      const key = row.materiaId || row.materia;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          materiaId: row.materiaId || null,
          nombre: row.materia || 'Materia',
          registros: 0,
        });
      }

      const current = map.get(key);
      current.registros = (current.registros || 0) + 1;
      map.set(key, current);
    });

    return Array.from(map.values());
  }, [reportData]);

  const subjectSections = useMemo(() => {
    if (!reportData?.grades) return [];

    return subjectsInReport
      .map((subject) => {
        const subjectKey = subject.materiaId || subject.key || subject.nombre;
        let rows = reportData.grades.filter((row) => {
          const rowKey = row.materiaId || row.materia;
          return rowKey === subjectKey;
        });

        // Ordenar por apellido y luego nombre (alfabético ascendente)
        // El formato es "Apellido Nombre", extraer apellido (primera palabra) y nombre (resto)
        rows = [...rows].sort((a, b) => {
          const estudianteA = (a.estudiante || '').trim();
          const estudianteB = (b.estudiante || '').trim();
          
          const partesA = estudianteA.split(/\s+/);
          const partesB = estudianteB.split(/\s+/);
          
          // Apellido es la primera palabra
          const apellidoA = partesA.length > 0 ? partesA[0] : '';
          const apellidoB = partesB.length > 0 ? partesB[0] : '';
          
          // Comparar por apellido primero
          const comparacionApellido = apellidoA.toLowerCase().localeCompare(apellidoB.toLowerCase());
          if (comparacionApellido !== 0) {
            return comparacionApellido;
          }
          
          // Si los apellidos son iguales, comparar por nombre (resto de palabras)
          const nombreA = partesA.slice(1).join(' ').toLowerCase();
          const nombreB = partesB.slice(1).join(' ').toLowerCase();
          return nombreA.localeCompare(nombreB);
        });

        return {
          ...subject,
          rows,
        };
      })
      .filter((section) => section.rows.length > 0);
  }, [reportData, subjectsInReport]);

  // Para reporte de promedios
  const subjectsInAveragesReport = useMemo(() => {
    if (!reportData?.averages) return [];

    const map = new Map();
    reportData.averages.forEach((row) => {
      const key = row.materiaId || row.materia;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          materiaId: row.materiaId || null,
          nombre: row.materia || 'Materia',
          registros: 0,
        });
      }

      const current = map.get(key);
      current.registros = (current.registros || 0) + 1;
      map.set(key, current);
    });

    return Array.from(map.values());
  }, [reportData]);

  const averagesSubjectSections = useMemo(() => {
    if (!reportData?.averages) return [];

    return subjectsInAveragesReport
      .map((subject) => {
        const subjectKey = subject.materiaId || subject.key || subject.nombre;
        let rows = reportData.averages.filter((row) => {
          const rowKey = row.materiaId || row.materia;
          return rowKey === subjectKey;
        });

        // Ordenar por apellido y luego nombre (alfabético ascendente)
        // El formato es "Apellido Nombre", extraer apellido (primera palabra) y nombre (resto)
        rows = [...rows].sort((a, b) => {
          const estudianteA = (a.estudiante || '').trim();
          const estudianteB = (b.estudiante || '').trim();
          
          const partesA = estudianteA.split(/\s+/);
          const partesB = estudianteB.split(/\s+/);
          
          // Apellido es la primera palabra
          const apellidoA = partesA.length > 0 ? partesA[0] : '';
          const apellidoB = partesB.length > 0 ? partesB[0] : '';
          
          // Comparar por apellido primero
          const comparacionApellido = apellidoA.toLowerCase().localeCompare(apellidoB.toLowerCase());
          if (comparacionApellido !== 0) {
            return comparacionApellido;
          }
          
          // Si los apellidos son iguales, comparar por nombre (resto de palabras)
          const nombreA = partesA.slice(1).join(' ').toLowerCase();
          const nombreB = partesB.slice(1).join(' ').toLowerCase();
          return nombreA.localeCompare(nombreB);
        });

        return {
          ...subject,
          rows,
        };
      })
      .filter((section) => section.rows.length > 0);
  }, [reportData, subjectsInAveragesReport]);

  useEffect(() => {
    fetchInitialData();
    fetchInstitution();
  }, [selectedInstitutionId]);

  const fetchInstitution = async () => {
    try {
      // Obtener institución activa o seleccionada
      let institutionData = null;
      if (selectedInstitutionId) {
        const response = await api.get(`/institutions/${selectedInstitutionId}`);
        institutionData = response.data;
      } else {
        // Si no hay institución seleccionada, obtener la activa
        const response = await api.get('/institutions/active');
        institutionData = response.data;
      }
      setInstitution(institutionData);
    } catch (error) {
      console.error('Error al obtener institución:', error);
      // Intentar obtener institución activa como fallback
      try {
        const response = await api.get('/institutions/active');
        setInstitution(response.data);
      } catch (err) {
        console.error('Error al obtener institución activa:', err);
      }
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      fetchSubjects();
    } else {
      setSubjects([]);
    }
  }, [selectedCourse, selectedTeacher]);

  useEffect(() => {
    if (selectedTeacher && (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA')) {
      fetchTeacherCoursesAndSubjects(selectedTeacher);
      setSelectedCourse('');
      setSelectedSubject('');
    } else if (!selectedTeacher && (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA')) {
      // Si se deselecciona el docente, recargar todos los cursos
      const reloadCourses = async () => {
        try {
          const response = await api.get('/courses?limit=1000');
          setCourses(response.data.data || []);
        } catch (error) {
          console.error('Error al recargar cursos:', error);
        }
      };
      reloadCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher]);

  const fetchInitialData = async () => {
    try {
      const promises = [
        api.get('/courses?limit=1000'),
        api.get('/periods?limit=1000'),
      ];
      
      // Solo obtener docentes si es ADMIN o SECRETARIA
      if (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') {
        promises.push(api.get('/teachers?limit=1000'));
      }
      
      const results = await Promise.all(promises);
      setCourses(results[0].data.data || []);
      setPeriods(results[1].data.data || []);
      
      if (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') {
        setTeachers(results[2].data.data || []);
      }
      
      // Si es PROFESOR, establecer automáticamente su docenteId
      if (user?.rol === 'PROFESOR' && user?.teacher?.id) {
        setSelectedTeacher(user.teacher.id);
        // Filtrar cursos y materias del profesor
        await fetchTeacherCoursesAndSubjects(user.teacher.id);
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    }
  };

  const fetchTeacherCoursesAndSubjects = async (teacherId) => {
    try {
      const response = await api.get(`/assignments?docenteId=${teacherId}&limit=1000`);
      const assignments = response.data.data || [];
      
      // Obtener cursos únicos del profesor
      const teacherCourses = [...new Map(assignments.map(a => [a.curso.id, a.curso])).values()];
      setCourses(teacherCourses);
      
      // Si hay un curso seleccionado, actualizar materias
      if (selectedCourse) {
        const courseAssignments = assignments.filter(a => a.curso.id === selectedCourse);
        const subjectsList = [...new Map(courseAssignments.map(a => [a.materia.id, a.materia])).values()];
        setSubjects(subjectsList);
      }
    } catch (error) {
      console.error('Error al cargar cursos y materias del profesor:', error);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedCourse) return;
    try {
      let url = `/assignments?cursoId=${selectedCourse}`;
      if (selectedTeacher) {
        url += `&docenteId=${selectedTeacher}`;
      }
      const response = await api.get(url);
      const assignments = response.data.data || [];
      const subjectsList = [...new Map(assignments.map(a => [a.materia.id, a.materia])).values()];
      setSubjects(subjectsList);
    } catch (error) {
      console.error('Error al cargar materias:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedCourse) {
      toast.error('Debe seleccionar un curso');
      return;
    }

    setLoading(true);
    try {
      const params = {
        cursoId: selectedCourse,
        materiaId: selectedSubject || undefined,
        periodoId: selectedPeriod || undefined,
        docenteId: selectedTeacher || undefined,
        fechaDesde: dateFrom || undefined,
        fechaHasta: dateTo || undefined,
      };

      let endpoint = '';
      switch (reportType) {
        case 'grades':
          endpoint = '/reports/grades';
          break;
        case 'averages':
          endpoint = '/reports/averages';
          break;
        case 'attendance':
          endpoint = '/reports/attendance';
          break;
        case 'performance':
          endpoint = '/reports/performance';
          break;
        default:
          endpoint = '/reports/grades';
      }

      const response = await api.get(endpoint, { params });
      setReportData(response.data);
      toast.success('Reporte generado exitosamente');
    } catch (error) {
      console.error('Error al generar reporte:', error);
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!reportData) {
      toast.error('Debe generar un reporte primero');
      return;
    }

    try {
      // Asegurar que tenemos la información de la institución
      if (!institution) {
        await fetchInstitution();
      }
      
      switch (reportType) {
        case 'grades':
          await generateGradesPDF(reportData);
          break;
        case 'averages':
          await generateAveragesPDF(reportData);
          break;
        case 'attendance':
          await generateAttendancePDF(reportData);
          break;
        case 'performance':
          await generatePerformancePDF(reportData);
          break;
        default:
          toast.error('Tipo de reporte no válido');
      }
      toast.success('PDF descargado exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar PDF');
    }
  };

  const exportToExcel = async () => {
    if (!reportData) {
      toast.error('Debe generar un reporte primero');
      return;
    }

    try {
      let worksheet = null;
      let worksheetData = [];
      
      switch (reportType) {
        case 'grades':
          worksheet = generateGradesExcel(reportData);
          if (!worksheet) {
            toast.error('No hay datos para exportar');
            return;
          }
          break;
        case 'averages':
          worksheet = generateAveragesExcel(reportData);
          if (!worksheet) {
            toast.error('No hay datos para exportar');
            return;
          }
          break;
        case 'attendance':
          worksheetData = generateAttendanceExcel(reportData);
          break;
        case 'performance':
          worksheetData = generatePerformanceExcel(reportData);
          break;
      }

      const wb = XLSX.utils.book_new();
      const ws = worksheet || XLSX.utils.aoa_to_sheet(worksheetData);

      if (!worksheet) {
        const colWidths = worksheetData[0]
          ? worksheetData[0].map((_, colIndex) => {
              const maxLength = Math.max(
                ...worksheetData.map(row => {
                  const cellValue = row[colIndex];
                  return cellValue ? String(cellValue).length : 0;
                })
              );
              return { wch: Math.min(Math.max(maxLength, 10), 50) };
            })
          : [];
        ws['!cols'] = colWidths;
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
      XLSX.writeFile(wb, `reporte_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Excel descargado exitosamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Error al exportar Excel');
    }
  };

  const generateGradesExcel = (data) => {
    if (!data.grades || !data.periodsGrouped) return null;
    
    const columnTypes = ['identificacion', 'estudiante', 'materia'];
    const headerRow = ['Identificación', 'Estudiante', 'Materia'];
    
    data.periodsGrouped.forEach(periodGroup => {
      periodGroup.subPeriods.forEach(subPeriodGroup => {
        subPeriodGroup.columns.forEach(colKey => {
          const [, , insumo] = colKey.split('|');
          headerRow.push(insumo);
          columnTypes.push('insumo');
        });
        headerRow.push(`Prom. Sub ${subPeriodGroup.subPeriodoNombre}`);
        columnTypes.push('subAverage');
        headerRow.push(`Prom. Pond. Sub ${subPeriodGroup.subPeriodoNombre}`);
        columnTypes.push('subWeighted');
      });
      headerRow.push(`Prom. Período ${periodGroup.periodoNombre}`);
      columnTypes.push('periodAverage');
      headerRow.push(`Prom. Pond. Período ${periodGroup.periodoNombre}`);
      columnTypes.push('periodWeighted');
    });
    
    if (data.periodsGrouped.length > 1) {
      headerRow.push('Promedio General');
      columnTypes.push('generalAverage');
    }
    
    const totalColumns = headerRow.length;
    const worksheetData = [];
    const merges = [];
    const mergedRows = [];
    const headerRowsMeta = [];
    const dataRowIndices = [];
    const rowHeights = [];
    const includeGeneralAverage = data.periodsGrouped.length > 1;
    
    const addMergedRow = (value, type) => {
      const rowIndex = worksheetData.length;
      worksheetData.push([value]);
      merges.push({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: totalColumns - 1 },
      });
      mergedRows.push({ row: rowIndex, type });
      rowHeights[rowIndex] = { hpt: type === 'sectionTitle' ? 24 : type === 'reportTitle' ? 22 : 18 };
      return rowIndex;
    };
    
    if (institution) {
      addMergedRow(institution.nombre || 'Institución', 'institution');
      worksheetData.push([]);
    }
    
    addMergedRow('Reporte de Calificaciones', 'reportTitle');
    addMergedRow(`Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`, 'reportSubtitle');
    worksheetData.push([]);
    
    const subjectsMap = new Map();
    data.grades.forEach(row => {
      const key = row.materiaId || row.materia || `materia-${subjectsMap.size}`;
      if (!subjectsMap.has(key)) {
        subjectsMap.set(key, {
          key,
          nombre: row.materia || 'Materia',
          rows: [],
        });
      }
      subjectsMap.get(key).rows.push(row);
    });
    const subjectSections = Array.from(subjectsMap.values());
    
    subjectSections.forEach((section, index) => {
      // Filtrar periodsGrouped para esta materia (solo insumos con datos)
      const filteredPeriodsForSection = data.periodsGrouped.map(periodGroup => ({
        ...periodGroup,
        subPeriods: periodGroup.subPeriods.map(subPeriodGroup => {
          const filteredColumns = subPeriodGroup.columns.filter(colKey =>
            section.rows.some(row => row.calificaciones[colKey])
          );
          return {
            ...subPeriodGroup,
            columns: filteredColumns
          };
        }).filter(sp => sp.columns.length > 0)
      })).filter(p => p.subPeriods.length > 0);

      // Recalcular totalColumns para esta materia
      let sectionTotalColumns = 3; // Identificación, Estudiante, Materia
      filteredPeriodsForSection.forEach(periodGroup => {
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          sectionTotalColumns += subPeriodGroup.columns.length + 2; // insumos + 2 promedios sub
        });
        sectionTotalColumns += 2; // 2 promedios período
      });
      if (filteredPeriodsForSection.length > 1) {
        sectionTotalColumns += 1; // Promedio General
      }

      addMergedRow(`Materia ${index + 1} de ${subjectSections.length}: ${section.nombre}`, 'sectionTitle');
      addMergedRow(`Registros en esta materia: ${section.rows.length}`, 'sectionInfo');
      
      // Actualizar merges para esta sección
      const lastMergeIdx = merges.length - 1;
      merges[lastMergeIdx - 1].e.c = sectionTotalColumns - 1;
      merges[lastMergeIdx].e.c = sectionTotalColumns - 1;
      
      const headerRowStart = worksheetData.length;
      const headerRows = [
        Array(sectionTotalColumns).fill(''),
        Array(sectionTotalColumns).fill(''),
        Array(sectionTotalColumns).fill(''),
      ];
      
      ['Identificación', 'Estudiante', 'Materia'].forEach((label, idx) => {
        headerRows[0][idx] = label;
        merges.push({
          s: { r: headerRowStart, c: idx },
          e: { r: headerRowStart + 2, c: idx },
        });
      });
      
      let currentCol = 3;
      filteredPeriodsForSection.forEach(periodGroup => {
        const periodColCount =
          periodGroup.subPeriods.reduce((sum, sub) => sum + sub.columns.length + 2, 0) + 2;
        headerRows[0][currentCol] = periodGroup.periodoNombre;
        merges.push({
          s: { r: headerRowStart, c: currentCol },
          e: { r: headerRowStart, c: currentCol + periodColCount - 1 },
        });
        
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          const subColCount = subPeriodGroup.columns.length + 2;
          headerRows[1][currentCol] = subPeriodGroup.subPeriodoNombre;
          merges.push({
            s: { r: headerRowStart + 1, c: currentCol },
            e: { r: headerRowStart + 1, c: currentCol + subColCount - 1 },
          });
          
          subPeriodGroup.columns.forEach((colKey, idx) => {
            const [, , insumo] = colKey.split('|');
            headerRows[2][currentCol + idx] = insumo;
          });
          headerRows[2][currentCol + subPeriodGroup.columns.length] = 'Prom. Sub';
          headerRows[2][currentCol + subPeriodGroup.columns.length + 1] = 'Prom. Pond. Sub';
          currentCol += subColCount;
        });
        
        headerRows[2][currentCol] = 'Prom. Período';
        headerRows[2][currentCol + 1] = 'Prom. Pond. Período';
        currentCol += 2;
      });
      
      if (filteredPeriodsForSection.length > 1) {
        const generalColIndex = sectionTotalColumns - 1;
        headerRows[0][generalColIndex] = 'Promedio General';
        merges.push({
          s: { r: headerRowStart, c: generalColIndex },
          e: { r: headerRowStart + 2, c: generalColIndex },
        });
      }
      
      headerRows.forEach((row, offset) => {
        const rowIndex = worksheetData.length;
        worksheetData.push(row);
        headerRowsMeta.push({
          rowIndex,
          type: offset === 0 ? 'top' : offset === 1 ? 'middle' : 'bottom',
        });
        rowHeights[rowIndex] = { hpt: offset === 2 ? 30 : 22 };
      });
      
      section.rows.forEach(row => {
        const rowData = [row.identificacion, row.estudiante, row.materia];
        
        filteredPeriodsForSection.forEach(periodGroup => {
          periodGroup.subPeriods.forEach(subPeriodGroup => {
            subPeriodGroup.columns.forEach(colKey => {
              const calificacionData = row.calificaciones[colKey];
              if (calificacionData) {
                rowData.push(parseFloat(calificacionData.calificacion.toFixed(2)));
              } else {
                rowData.push('-');
              }
            });
            const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
            if (promedioSubPeriodo) {
              rowData.push(parseFloat(promedioSubPeriodo.promedio.toFixed(2)));
              rowData.push(parseFloat(promedioSubPeriodo.promedioPonderado.toFixed(2)));
            } else {
              rowData.push('-', '-');
            }
          });
          const periodoId = periodGroup.periodoId;
          let promedioPeriodo = null;
          if (periodoId && row.promediosPeriodo) {
            promedioPeriodo = row.promediosPeriodo[periodoId];
          }
          if (!promedioPeriodo && row.promediosPeriodo) {
            promedioPeriodo = Object.values(row.promediosPeriodo).find(
              p => p.nombre === periodGroup.periodoNombre
            );
          }
          if (promedioPeriodo) {
            rowData.push(parseFloat(promedioPeriodo.promedio.toFixed(2)));
            rowData.push(parseFloat(promedioPeriodo.promedioPonderado.toFixed(2)));
          } else {
            rowData.push('-', '-');
          }
        });
        
        if (filteredPeriodsForSection.length > 1) {
          rowData.push(
            row.promedioGeneral !== null && row.promedioGeneral !== undefined
              ? parseFloat(row.promedioGeneral.toFixed(2))
              : '-'
          );
        }
        
        const rowIndex = worksheetData.length;
        worksheetData.push(rowData);
        dataRowIndices.push(rowIndex);
        rowHeights[rowIndex] = { hpt: 22 };
      });
      
      worksheetData.push([]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;
    
    const columnWidthMap = {
      identificacion: 18,
      estudiante: 22,
      materia: 20,
      insumo: 14,
      subAverage: 13,
      subWeighted: 15,
      periodAverage: 13,
      periodWeighted: 15,
      generalAverage: 15,
    };
    ws['!cols'] = columnTypes.map(type => ({ wch: columnWidthMap[type] || 12 }));
    
    const borderStyle = {
      style: 'thin',
      color: { rgb: 'E5E7EB' },
    };
    const baseBorder = {
      top: borderStyle,
      bottom: borderStyle,
      left: borderStyle,
      right: borderStyle,
    };
    
    const columnStyleMap = {
      identificacion: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      estudiante: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      materia: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      insumo: { headerFill: 'F3F4F6', dataFill: 'FFFFFF', align: 'center' },
      subAverage: { headerFill: 'BFDBFE', dataFill: 'DBEAFE', align: 'center' },
      subWeighted: { headerFill: '93C5FD', dataFill: 'CFE1FF', align: 'center' },
      periodAverage: { headerFill: 'DDD6FE', dataFill: 'EDE9FE', align: 'center' },
      periodWeighted: { headerFill: 'C4B5FD', dataFill: 'DDD6FE', align: 'center' },
      generalAverage: { headerFill: 'FDE68A', dataFill: 'FEF3C7', align: 'center' },
    };
    
    const buildHeaderStyle = (type) => ({
      font: { bold: true, color: { rgb: '111827' }, sz: 10 },
      alignment: {
        horizontal: columnStyleMap[type]?.align || 'center',
        vertical: 'center',
        wrapText: true,
      },
      border: baseBorder,
      fill: {
        patternType: 'solid',
        fgColor: { rgb: columnStyleMap[type]?.headerFill || 'E5E7EB' },
      },
    });
    
    const buildDataStyle = (type, value) => {
      const baseStyle = {
        font: { color: { rgb: '111827' }, sz: 10 },
        alignment: {
          horizontal: columnStyleMap[type]?.align || 'center',
          vertical: 'center',
          wrapText: true,
        },
        border: baseBorder,
        fill: {
          patternType: 'solid',
          fgColor: { rgb: columnStyleMap[type]?.dataFill || 'FFFFFF' },
        },
      };
      
      const isScoreColumn = ['insumo', 'subAverage', 'subWeighted', 'periodAverage', 'periodWeighted', 'generalAverage'].includes(type);
      if (isScoreColumn && typeof value === 'number') {
        let color = '111827';
        if (value >= 7) color = '15803D';
        else if (value >= 5) color = 'B45309';
        else color = 'B91C1C';
        baseStyle.font = { ...baseStyle.font, bold: true, color: { rgb: color } };
      }
      
      return baseStyle;
    };
    
    const applyStyle = (rowIndex, colIndex, style) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!ws[address]) return;
      ws[address].s = style;
    };
    
    const topHeaderStyle = {
      font: { bold: true, sz: 11, color: { rgb: '111827' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: baseBorder,
      fill: { patternType: 'solid', fgColor: { rgb: 'D1D5DB' } },
    };
    
    const middleHeaderStyle = {
      font: { bold: true, sz: 10, color: { rgb: '111827' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: baseBorder,
      fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
    };
    
    headerRowsMeta.forEach(({ rowIndex, type }) => {
      if (type === 'bottom') {
        columnTypes.forEach((columnType, colIndex) => {
          applyStyle(rowIndex, colIndex, buildHeaderStyle(columnType));
        });
      } else {
        const style = type === 'top' ? topHeaderStyle : middleHeaderStyle;
        for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
          applyStyle(rowIndex, colIndex, style);
        }
      }
    });
    
    dataRowIndices.forEach(rowIndex => {
      columnTypes.forEach((type, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = ws[cellAddress];
        if (!cell) return;
        const numericValue = cell.t === 'n' ? cell.v : null;
        applyStyle(rowIndex, colIndex, buildDataStyle(type, numericValue));
      });
    });
    
    const mergedRowStyles = {
      institution: {
        font: { bold: true, sz: 14, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
      reportTitle: {
        font: { bold: true, sz: 13, color: { rgb: '111827' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      reportSubtitle: {
        font: { sz: 11, color: { rgb: '374151' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      sectionTitle: {
        font: { bold: true, sz: 12, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        border: baseBorder,
      },
      sectionInfo: {
        font: { sz: 10, color: { rgb: '4B5563' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
        border: baseBorder,
      },
    };
    
    mergedRows.forEach(({ row, type }) => {
      const address = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (!ws[address]) return;
      ws[address].s = mergedRowStyles[type] || {
        font: { bold: true },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    });
    
    return ws;
  };

  const generateAveragesExcel = (data) => {
    if (!data.averages || !data.periodsGrouped) return null;

    const columnTypes = ['identificacion', 'estudiante', 'materia'];
    const headerRow = ['Identificación', 'Estudiante', 'Materia'];

    data.periodsGrouped.forEach(periodGroup => {
      periodGroup.subPeriods.forEach(subPeriodGroup => {
        headerRow.push(`Prom. Sub ${subPeriodGroup.subPeriodoNombre}`);
        columnTypes.push('subAverage');
        headerRow.push(`Prom. Pond. Sub ${subPeriodGroup.subPeriodoNombre}`);
        columnTypes.push('subWeighted');
      });
      headerRow.push(`Prom. Período ${periodGroup.periodoNombre}`);
      columnTypes.push('periodAverage');
      headerRow.push(`Prom. Pond. Período ${periodGroup.periodoNombre}`);
      columnTypes.push('periodWeighted');
    });

    if (data.periodsGrouped.length > 1) {
      headerRow.push('Promedio General');
      columnTypes.push('generalAverage');
    }

    const totalColumns = headerRow.length;
    const worksheetData = [];
    const merges = [];
    const mergedRows = [];
    const headerRowIndices = [];
    const dataRowIndices = [];
    const rowHeights = [];

    const addMergedRow = (value, type) => {
      const rowIndex = worksheetData.length;
      worksheetData.push([value]);
      merges.push({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: totalColumns - 1 },
      });
      mergedRows.push({ row: rowIndex, type });
      rowHeights[rowIndex] = { hpt: type === 'sectionTitle' ? 24 : type === 'reportTitle' ? 22 : 18 };
      return rowIndex;
    };

    if (institution) {
      addMergedRow(institution.nombre || 'Institución', 'institution');
      worksheetData.push([]);
    }

    addMergedRow('Reporte de Promedios', 'reportTitle');
    addMergedRow(`Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`, 'reportSubtitle');
    worksheetData.push([]);

    const subjectsMap = new Map();
    data.averages.forEach(row => {
      const key = row.materiaId || row.materia || `materia-${subjectsMap.size}`;
      if (!subjectsMap.has(key)) {
        subjectsMap.set(key, {
          key,
          nombre: row.materia || 'Materia',
          rows: [],
        });
      }
      subjectsMap.get(key).rows.push(row);
    });
    const subjectSections = Array.from(subjectsMap.values());

    subjectSections.forEach((section, index) => {
      // Filtrar periodsGrouped para esta materia
      const filteredPeriodsForSection = data.periodsGrouped.map(periodGroup => ({
        ...periodGroup,
        subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
          section.rows.some(row => row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId])
        )
      })).filter(p => p.subPeriods.length > 0);

      // Recalcular totalColumns para esta materia
      let sectionTotalColumns = 3; // Identificación, Estudiante, Materia
      filteredPeriodsForSection.forEach(periodGroup => {
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          sectionTotalColumns += 2; // 2 promedios sub
        });
        sectionTotalColumns += 2; // 2 promedios período
      });
      if (filteredPeriodsForSection.length > 1) {
        sectionTotalColumns += 1; // Promedio General
      }

      addMergedRow(`Materia ${index + 1} de ${subjectSections.length}: ${section.nombre}`, 'sectionTitle');
      addMergedRow(`Registros en esta materia: ${section.rows.length}`, 'sectionInfo');

      // Actualizar merges para esta sección
      const lastMergeIdx = merges.length - 1;
      merges[lastMergeIdx - 1].e.c = sectionTotalColumns - 1;
      merges[lastMergeIdx].e.c = sectionTotalColumns - 1;

      const headerRowStart = worksheetData.length;
      const headerRows = [
        Array(sectionTotalColumns).fill(''),
        Array(sectionTotalColumns).fill(''),
        Array(sectionTotalColumns).fill(''),
      ];

      ['Identificación', 'Estudiante', 'Materia'].forEach((label, idx) => {
        headerRows[0][idx] = label;
        merges.push({
          s: { r: headerRowStart, c: idx },
          e: { r: headerRowStart + 2, c: idx },
        });
      });

      let currentCol = 3;
      filteredPeriodsForSection.forEach(periodGroup => {
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          headerRows[1][currentCol] = subPeriodGroup.subPeriodoNombre;
          merges.push({
            s: { r: headerRowStart + 1, c: currentCol },
            e: { r: headerRowStart + 1, c: currentCol + 1 },
          });
          headerRows[2][currentCol] = 'Prom. Sub';
          headerRows[2][currentCol + 1] = 'Prom. Pond. Sub';
          currentCol += 2;
        });
        headerRows[2][currentCol] = 'Prom. Período';
        headerRows[2][currentCol + 1] = 'Prom. Pond. Período';
        currentCol += 2;
      });

      if (filteredPeriodsForSection.length > 1) {
        const generalColIndex = sectionTotalColumns - 1;
        headerRows[0][generalColIndex] = 'Promedio General';
        merges.push({
          s: { r: headerRowStart, c: generalColIndex },
          e: { r: headerRowStart + 2, c: generalColIndex },
        });
      }

      headerRows.forEach((row, offset) => {
        const rowIndex = worksheetData.length;
        worksheetData.push(row);
        headerRowIndices.push(rowIndex);
        rowHeights[rowIndex] = { hpt: offset === 2 ? 30 : 22 };
      });

      section.rows.forEach(row => {
        const rowData = [row.identificacion, row.estudiante, row.materia];

        filteredPeriodsForSection.forEach(periodGroup => {
          periodGroup.subPeriods.forEach(subPeriodGroup => {
            const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
            if (promedioSubPeriodo) {
              rowData.push(parseFloat(promedioSubPeriodo.promedio.toFixed(2)));
              rowData.push(parseFloat(promedioSubPeriodo.promedioPonderado.toFixed(2)));
            } else {
              rowData.push('-', '-');
            }
          });
          const periodoId = periodGroup.periodoId;
          let promedioPeriodo = null;
          if (periodoId && row.promediosPeriodo) {
            promedioPeriodo = row.promediosPeriodo[periodoId];
          }
          if (!promedioPeriodo && row.promediosPeriodo) {
            promedioPeriodo = Object.values(row.promediosPeriodo).find(
              p => p.nombre === periodGroup.periodoNombre
            );
          }
          if (promedioPeriodo) {
            rowData.push(parseFloat(promedioPeriodo.promedio.toFixed(2)));
            rowData.push(parseFloat(promedioPeriodo.promedioPonderado.toFixed(2)));
          } else {
            rowData.push('-', '-');
          }
        });

        if (filteredPeriodsForSection.length > 1) {
          rowData.push(
            row.promedioGeneral !== null && row.promedioGeneral !== undefined
              ? parseFloat(row.promedioGeneral.toFixed(2))
              : '-'
          );
        }

        const rowIndex = worksheetData.length;
        worksheetData.push(rowData);
        dataRowIndices.push(rowIndex);
        rowHeights[rowIndex] = { hpt: 22 };
      });

      worksheetData.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;

    const columnWidthMap = {
      identificacion: 18,
      estudiante: 22,
      materia: 20,
      subAverage: 13,
      subWeighted: 15,
      periodAverage: 13,
      periodWeighted: 15,
      generalAverage: 15,
    };
    ws['!cols'] = columnTypes.map(type => ({ wch: columnWidthMap[type] || 12 }));

    const borderStyle = {
      style: 'thin',
      color: { rgb: 'E5E7EB' },
    };
    const baseBorder = {
      top: borderStyle,
      bottom: borderStyle,
      left: borderStyle,
      right: borderStyle,
    };

    const columnStyleMap = {
      identificacion: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      estudiante: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      materia: { headerFill: 'E5E7EB', dataFill: 'F9FAFB', align: 'left' },
      subAverage: { headerFill: 'BFDBFE', dataFill: 'DBEAFE', align: 'center' },
      subWeighted: { headerFill: '93C5FD', dataFill: 'CFE1FF', align: 'center' },
      periodAverage: { headerFill: 'DDD6FE', dataFill: 'EDE9FE', align: 'center' },
      periodWeighted: { headerFill: 'C4B5FD', dataFill: 'DDD6FE', align: 'center' },
      generalAverage: { headerFill: 'FDE68A', dataFill: 'FEF3C7', align: 'center' },
    };

    const buildHeaderStyle = (type) => ({
      font: { bold: true, color: { rgb: '111827' }, sz: 10 },
      alignment: {
        horizontal: columnStyleMap[type]?.align || 'center',
        vertical: 'center',
        wrapText: true,
      },
      border: baseBorder,
      fill: {
        patternType: 'solid',
        fgColor: { rgb: columnStyleMap[type]?.headerFill || 'E5E7EB' },
      },
    });

    const buildDataStyle = (type, value) => {
      const baseStyle = {
        font: { color: { rgb: '111827' }, sz: 10 },
        alignment: {
          horizontal: columnStyleMap[type]?.align || 'center',
          vertical: 'center',
          wrapText: true,
        },
        border: baseBorder,
        fill: {
          patternType: 'solid',
          fgColor: { rgb: columnStyleMap[type]?.dataFill || 'FFFFFF' },
        },
      };

      const isScoreColumn = ['subAverage', 'subWeighted', 'periodAverage', 'periodWeighted', 'generalAverage'].includes(type);
      if (isScoreColumn && typeof value === 'number') {
        let color = '111827';
        if (value >= 7) color = '15803D';
        else if (value >= 5) color = 'B45309';
        else color = 'B91C1C';
        baseStyle.font = { ...baseStyle.font, bold: true, color: { rgb: color } };
      }

      return baseStyle;
    };

    const applyStyle = (rowIndex, colIndex, style) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!ws[address]) return;
      ws[address].s = style;
    };

    headerRowIndices.forEach(rowIndex => {
      columnTypes.forEach((type, colIndex) => {
        applyStyle(rowIndex, colIndex, buildHeaderStyle(type));
      });
    });

    dataRowIndices.forEach(rowIndex => {
      columnTypes.forEach((type, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = ws[cellAddress];
        if (!cell) return;
        const numericValue = cell.t === 'n' ? cell.v : null;
        applyStyle(rowIndex, colIndex, buildDataStyle(type, numericValue));
      });
    });

    const mergedRowStyles = {
      institution: {
        font: { bold: true, sz: 14, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
      reportTitle: {
        font: { bold: true, sz: 13, color: { rgb: '111827' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      reportSubtitle: {
        font: { sz: 11, color: { rgb: '374151' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
      sectionTitle: {
        font: { bold: true, sz: 12, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        border: baseBorder,
      },
      sectionInfo: {
        font: { sz: 10, color: { rgb: '4B5563' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
        border: baseBorder,
      },
    };

    mergedRows.forEach(({ row, type }) => {
      const address = XLSX.utils.encode_cell({ r: row, c: 0 });
      if (!ws[address]) return;
      ws[address].s = mergedRowStyles[type] || {
        font: { bold: true },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    });

    return ws;
  };

  const generateAttendanceExcel = (data) => {
    const worksheetData = [];
    
    // Agregar cabecera con nombre de institución
    if (institution) {
      worksheetData.push([institution.nombre || 'Institución']);
      worksheetData.push([]);
    }
    worksheetData.push(['Reporte de Asistencia']);
    worksheetData.push([]);
    worksheetData.push(['Estudiante', 'Identificación', 'Fecha', 'Estado', 'Justificación']);
    if (data.attendance) {
      data.attendance.forEach(att => {
        worksheetData.push([
          att.estudiante,
          att.identificacion,
          att.fecha,
          att.estado,
          att.justificacion || ''
        ]);
      });
    }
    return worksheetData;
  };

  const generatePerformanceExcel = (data) => {
    const worksheetData = [];
    
    // Agregar cabecera con nombre de institución
    if (institution) {
      worksheetData.push([institution.nombre || 'Institución']);
      worksheetData.push([]);
    }
    worksheetData.push(['Reporte de Rendimiento']);
    worksheetData.push([]);
    worksheetData.push(['Estudiante', 'Identificación', 'Promedio General', 'Asistencia %', 'Estado']);
    if (data.performance) {
      data.performance.forEach(perf => {
        worksheetData.push([
          perf.estudiante,
          perf.identificacion,
          parseFloat(perf.promedio.toFixed(2)),
          `${perf.asistencia}%`,
          perf.estado
        ]);
      });
    }
    return worksheetData;
  };

  // Funciones para generar PDF
  const generateGradesPDF = async (data) => {
    if (!data.grades || !data.periodsGrouped) return;

    const doc = new jsPDF('landscape', undefined, 'a2');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14.18; // 0.5 cm
    const marginLeft = margin;
    const marginRight = margin;
    const marginTop = margin;
    const marginBottom = margin;
    const headerHeight = 46; // espacio reservado para cabecera institucional
    const headerBottomY = marginTop + headerHeight;
    const includeGeneralAverage = data.periodsGrouped.length > 1;

    const pagesWithHeader = new Set();
    const drawPageHeader = (pageNumber) => {
      if (pagesWithHeader.has(pageNumber)) return;

      doc.setPage(pageNumber);
      let yPos = marginTop;
      const titleX = marginLeft + (pageWidth - marginLeft - marginRight) / 2;

      if (institution) {
        const logoSize = 18;
        const logoWidth = 18;
        const logoSpacing = 5;

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
            }

            doc.addImage(imgData, imgFormat, marginLeft, yPos, logoWidth, logoSize);
          } catch (error) {
            console.error('Error al cargar logo para PDF:', error);
          }
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        const institutionX = institution.logo ? marginLeft + logoWidth + logoSpacing : titleX;
        doc.text(institution.nombre || 'Institución', institutionX, yPos + logoSize / 2 + 2, {
          align: institution.logo ? 'left' : 'center',
        });

        yPos += Math.max(logoSize, 18) + 4;
      }

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Reporte de Calificaciones', titleX, yPos, { align: 'center' });
      yPos += 9;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(
        `Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`,
        titleX,
        yPos,
        { align: 'center' }
      );

      pagesWithHeader.add(pageNumber);
    };

    drawPageHeader(1);

    let cursorY = headerBottomY + 8;
    const ensureSpace = (needed = 20) => {
      if (cursorY + needed > pageHeight - marginBottom) {
        doc.addPage();
        drawPageHeader(doc.getNumberOfPages());
        cursorY = headerBottomY + 8;
      }
    };

    const subjectsMap = new Map();
    data.grades.forEach((row) => {
      const key = row.materiaId || row.materia || `materia-${subjectsMap.size}`;
      if (!subjectsMap.has(key)) {
        subjectsMap.set(key, {
          key,
          nombre: row.materia || 'Materia',
          rows: [],
        });
      }
      subjectsMap.get(key).rows.push(row);
    });
    const subjectSections = Array.from(subjectsMap.values()).filter((section) => section.rows.length > 0);

    if (subjectSections.length === 0) {
      doc.setFontSize(12);
      doc.text('No existen calificaciones para los filtros seleccionados.', marginLeft, cursorY);
      doc.save(`reporte_calificaciones_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    const buildHeadRows = (periodGroup, showGeneralColumn) => {
      const headRows = [];
      const periodColumns =
        periodGroup.subPeriods.reduce((sum, sub) => sum + sub.columns.length + 2, 0) + 2; // + Prom periodo

      const firstRow = [
        { content: 'Identificación', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: 'Estudiante', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: 'Materia', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: periodGroup.periodoNombre, colSpan: periodColumns, styles: { fillColor: [156, 163, 175] } },
      ];

      if (showGeneralColumn) {
        firstRow.push({
          content: 'Prom. General',
          rowSpan: 3,
          styles: { fillColor: [253, 224, 71] },
        });
      }

      headRows.push(firstRow);

      const secondRow = periodGroup.subPeriods.map((subPeriodGroup) => ({
        content: subPeriodGroup.subPeriodoNombre,
        colSpan: subPeriodGroup.columns.length + 2,
        styles: { fillColor: [229, 231, 235] },
      }));
      secondRow.push({
        content: 'Promedio del período',
        colSpan: 2,
        styles: { fillColor: [229, 231, 235] },
      });
      headRows.push(secondRow);

      const thirdRow = [];
      periodGroup.subPeriods.forEach((subPeriodGroup) => {
        subPeriodGroup.columns.forEach((colKey) => {
          const [, , insumo] = colKey.split('|');
          thirdRow.push({ content: insumo, styles: { fillColor: [243, 244, 246] } });
        });
        thirdRow.push({ content: 'Prom. Sub', styles: { fillColor: [191, 219, 254] } });
        thirdRow.push({ content: 'Prom. Pond. Sub', styles: { fillColor: [191, 219, 254] } });
      });
      thirdRow.push({ content: 'Prom. Período', styles: { fillColor: [221, 214, 254] } });
      thirdRow.push({ content: 'Prom. Pond. Período', styles: { fillColor: [221, 214, 254] } });
      headRows.push(thirdRow);

      return headRows;
    };

    const buildBodyRow = (row, periodGroup, showGeneralColumn) => {
      const rowData = [row.identificacion || '-', row.estudiante || '-', row.materia || '-'];

      periodGroup.subPeriods.forEach((subPeriodGroup) => {
        subPeriodGroup.columns.forEach((colKey) => {
          const calificacionData = row.calificaciones[colKey];
          rowData.push(calificacionData ? Number(calificacionData.calificacion).toFixed(2) : '-');
        });
        const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
        rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedio.toFixed(2) : '-');
        rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedioPonderado.toFixed(2) : '-');
      });

      const periodoId = periodGroup.periodoId;
      let promedioPeriodo = null;
      if (periodoId && row.promediosPeriodo) {
        promedioPeriodo = row.promediosPeriodo[periodoId];
      }
      if (!promedioPeriodo && row.promediosPeriodo) {
        promedioPeriodo = Object.values(row.promediosPeriodo).find(
          (p) => p.nombre === periodGroup.periodoNombre
        );
      }
      rowData.push(promedioPeriodo ? promedioPeriodo.promedio.toFixed(2) : '-');
      rowData.push(promedioPeriodo ? promedioPeriodo.promedioPonderado.toFixed(2) : '-');

      if (showGeneralColumn) {
        rowData.push(
          row.promedioGeneral !== null && row.promedioGeneral !== undefined
            ? row.promedioGeneral.toFixed(2)
            : '-'
        );
      }

      return rowData;
    };

    subjectSections.forEach((section, sectionIndex) => {
      ensureSpace(20);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(
        `Materia ${sectionIndex + 1} de ${subjectSections.length}: ${section.nombre}`,
        marginLeft,
        cursorY
      );
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Registros en esta materia: ${section.rows.length}`, marginLeft, cursorY + 10);
      cursorY += 16;

      data.periodsGrouped.forEach((periodGroup, periodIdx) => {
        const showGeneralColumn = includeGeneralAverage && periodIdx === data.periodsGrouped.length - 1;
        const headRows = buildHeadRows(periodGroup, showGeneralColumn);
        const bodyRows = section.rows.map((row) => buildBodyRow(row, periodGroup, showGeneralColumn));

        const startY = Math.max(cursorY, headerBottomY + 4);
        autoTable(doc, {
          head: headRows,
          body: bodyRows,
          startY,
          styles: { fontSize: 7, cellPadding: 1.2, valign: 'middle', halign: 'center' },
          headStyles: { textColor: [17, 24, 39], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 32, halign: 'left' },
            1: { cellWidth: 36, halign: 'left' },
            2: { cellWidth: 40, halign: 'left' },
          },
          margin: {
            left: marginLeft,
            right: marginRight,
            top: headerBottomY,
            bottom: marginBottom,
          },
          didDrawPage: (tableData) => {
            drawPageHeader(tableData.pageNumber);
          },
        });

        cursorY = (doc.lastAutoTable?.finalY || startY) + 12;
      });
    });

    doc.save(`reporte_calificaciones_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateAveragesPDF = async (data) => {
    if (!data.averages || !data.periodsGrouped) return;

    const doc = new jsPDF('landscape', undefined, 'a2');
    
    // Márgenes de 0.5 cm
    const margin = 14.18;
    const marginLeft = margin;
    const marginRight = margin;
    const marginTop = margin;
    const marginBottom = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let cursorY = marginTop;

    // Logo y nombre de la institución
    if (institution) {
      const logoSize = 18;
      const logoWidth = 18;
      const logoSpacing = 5;
      
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
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const institutionX = institution.logo ? marginLeft + logoWidth + logoSpacing : marginLeft + contentWidth / 2;
      const textY = cursorY + (logoSize / 2) + 2;
      doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
      cursorY += Math.max(logoSize, 18) + 5;
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Promedios', marginLeft + contentWidth / 2, cursorY, { align: 'center' });
    cursorY += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`, marginLeft + contentWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;

    const subjectsMap = new Map();
    data.averages.forEach((row) => {
      const key = row.materiaId || row.materia || `materia-${subjectsMap.size}`;
      if (!subjectsMap.has(key)) {
        subjectsMap.set(key, {
          key,
          nombre: row.materia || 'Materia',
          rows: [],
        });
      }
      subjectsMap.get(key).rows.push(row);
    });
    const subjectSections = Array.from(subjectsMap.values()).filter((section) => section.rows.length > 0);

    if (subjectSections.length === 0) {
      doc.setFontSize(12);
      doc.text('No existen promedios para los filtros seleccionados.', marginLeft, cursorY);
      doc.save(`reporte_promedios_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    const buildHeadRows = (periodGroup, showGeneralColumn) => {
      const headRows = [];
      const periodColumns = periodGroup.subPeriods.reduce((sum, sub) => sum + 2, 0) + 2; // 2 promedios sub + 2 promedios período

      const firstRow = [
        { content: 'Identificación', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: 'Estudiante', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: 'Materia', rowSpan: 3, styles: { fillColor: [209, 213, 219] } },
        { content: periodGroup.periodoNombre, colSpan: periodColumns, styles: { fillColor: [156, 163, 175] } },
      ];

      if (showGeneralColumn) {
        firstRow.push({
          content: 'Prom. General',
          rowSpan: 3,
          styles: { fillColor: [253, 224, 71] },
        });
      }

      headRows.push(firstRow);

      const secondRow = periodGroup.subPeriods.map((subPeriodGroup) => ({
        content: subPeriodGroup.subPeriodoNombre,
        colSpan: 2,
        styles: { fillColor: [229, 231, 235] },
      }));
      secondRow.push({
        content: 'Promedio del período',
        colSpan: 2,
        styles: { fillColor: [229, 231, 235] },
      });
      headRows.push(secondRow);

      const thirdRow = [];
      periodGroup.subPeriods.forEach((subPeriodGroup) => {
        thirdRow.push({ content: 'Prom. Sub', styles: { fillColor: [191, 219, 254] } });
        thirdRow.push({ content: 'Prom. Pond. Sub', styles: { fillColor: [191, 219, 254] } });
      });
      thirdRow.push({ content: 'Prom. Período', styles: { fillColor: [221, 214, 254] } });
      thirdRow.push({ content: 'Prom. Pond. Período', styles: { fillColor: [221, 214, 254] } });
      headRows.push(thirdRow);

      return headRows;
    };

    const buildBodyRow = (row, periodGroup, showGeneralColumn) => {
      const rowData = [row.identificacion || '-', row.estudiante || '-', row.materia || '-'];

      periodGroup.subPeriods.forEach((subPeriodGroup) => {
        const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
        rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedio.toFixed(2) : '-');
        rowData.push(promedioSubPeriodo ? promedioSubPeriodo.promedioPonderado.toFixed(2) : '-');
      });

      const periodoId = periodGroup.periodoId;
      let promedioPeriodo = null;
      if (periodoId && row.promediosPeriodo) {
        promedioPeriodo = row.promediosPeriodo[periodoId];
      }
      if (!promedioPeriodo && row.promediosPeriodo) {
        promedioPeriodo = Object.values(row.promediosPeriodo).find(
          (p) => p.nombre === periodGroup.periodoNombre
        );
      }
      rowData.push(promedioPeriodo ? promedioPeriodo.promedio.toFixed(2) : '-');
      rowData.push(promedioPeriodo ? promedioPeriodo.promedioPonderado.toFixed(2) : '-');

      if (showGeneralColumn) {
        rowData.push(
          row.promedioGeneral !== null && row.promedioGeneral !== undefined
            ? row.promedioGeneral.toFixed(2)
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

    subjectSections.forEach((section, sectionIndex) => {
      ensureSpace(20);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(
        `Materia ${sectionIndex + 1} de ${subjectSections.length}: ${section.nombre}`,
        marginLeft,
        cursorY
      );
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Registros en esta materia: ${section.rows.length}`, marginLeft, cursorY + 5);
      cursorY += 12;

      // Filtrar periodsGrouped para esta materia
      const filteredPeriodsForSection = data.periodsGrouped.map(periodGroup => ({
        ...periodGroup,
        subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
          section.rows.some(row => row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId])
        )
      })).filter(p => p.subPeriods.length > 0);

      filteredPeriodsForSection.forEach((periodGroup, periodIdx) => {
        const showGeneralColumn = !selectedPeriod && filteredPeriodsForSection.length > 1;
        const headRows = buildHeadRows(periodGroup, showGeneralColumn);
        const bodyRows = section.rows.map((row) => buildBodyRow(row, periodGroup, showGeneralColumn));

        autoTable(doc, {
          head: headRows,
          body: bodyRows,
          startY: cursorY,
          margin: { left: marginLeft, right: marginRight, top: cursorY, bottom: marginBottom },
          styles: { fontSize: 7 },
          headStyles: { fontSize: 7, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 },
          },
        });

        cursorY = doc.lastAutoTable.finalY + 5;
        ensureSpace(15);
      });

      if (sectionIndex < subjectSections.length - 1) {
        cursorY += 10;
      }
    });

    doc.save(`reporte_promedios_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateAttendancePDF = async (data) => {
    if (!data.attendance) return;

    const doc = new jsPDF();
    
    // Márgenes de 0.5 cm (1 cm = 28.35 puntos, 0.5 cm = 14.175 puntos)
    const margin = 14.18; // 0.5 cm en puntos
    const marginLeft = margin;
    const marginRight = margin;
    const marginTop = margin;
    const marginBottom = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let yPos = marginTop;

    // Logo y nombre de la institución
    if (institution) {
      const logoSize = 18; // Tamaño del logo (18px de alto, proporcional al texto)
      const logoWidth = 18; // Ancho del logo
      const logoSpacing = 5; // Espacio entre logo y texto
      
      if (institution.logo) {
        try {
          let imgData = institution.logo;
          let imgFormat = 'PNG';
          
          // Detectar formato de imagen
          if (institution.logo.startsWith('data:image/')) {
            const matches = institution.logo.match(/data:image\/(\w+);base64,/);
            if (matches) {
              imgFormat = matches[1].toUpperCase();
              imgData = institution.logo;
            }
          } else if (institution.logo.startsWith('data:')) {
            imgData = institution.logo;
          }
          
          doc.addImage(imgData, imgFormat, 10, yPos, logoWidth, logoSize);
        } catch (error) {
          console.error('Error al cargar logo:', error);
        }
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const institutionX = institution.logo ? 10 + logoWidth + logoSpacing : 105;
      const textY = yPos + (logoSize / 2) + 2; // Centrar verticalmente con el logo
      doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
      yPos += Math.max(logoSize, 18) + 5; // Ajustar posición Y según el tamaño del logo o texto
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Asistencia', marginLeft + contentWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    const head = [['Estudiante', 'Identificación', 'Fecha', 'Estado', 'Justificación']];
    const body = data.attendance.map(att => [
      att.estudiante,
      att.identificacion,
      att.fecha,
      att.estado,
      att.justificacion || '-'
    ]);

    autoTable(doc, {
      head: head,
      body: body,
      startY: yPos,
      margin: { left: marginLeft, right: marginRight, top: yPos, bottom: marginBottom },
    });

    doc.save(`reporte_asistencia_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generatePerformancePDF = async (data) => {
    if (!data.performance) return;

    const doc = new jsPDF();
    
    // Márgenes de 0.5 cm (1 cm = 28.35 puntos, 0.5 cm = 14.175 puntos)
    const margin = 14.18; // 0.5 cm en puntos
    const marginLeft = margin;
    const marginRight = margin;
    const marginTop = margin;
    const marginBottom = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let yPos = marginTop;

    // Logo y nombre de la institución
    if (institution) {
      const logoSize = 18; // Tamaño del logo (18px de alto, proporcional al texto)
      const logoWidth = 18; // Ancho del logo
      const logoSpacing = 5; // Espacio entre logo y texto
      
      if (institution.logo) {
        try {
          let imgData = institution.logo;
          let imgFormat = 'PNG';
          
          // Detectar formato de imagen
          if (institution.logo.startsWith('data:image/')) {
            const matches = institution.logo.match(/data:image\/(\w+);base64,/);
            if (matches) {
              imgFormat = matches[1].toUpperCase();
              imgData = institution.logo;
            }
          } else if (institution.logo.startsWith('data:')) {
            imgData = institution.logo;
          }
          
          doc.addImage(imgData, imgFormat, 10, yPos, logoWidth, logoSize);
        } catch (error) {
          console.error('Error al cargar logo:', error);
        }
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const institutionX = institution.logo ? 10 + logoWidth + logoSpacing : 105;
      const textY = yPos + (logoSize / 2) + 2; // Centrar verticalmente con el logo
      doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
      yPos += Math.max(logoSize, 18) + 5; // Ajustar posición Y según el tamaño del logo o texto
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Rendimiento', marginLeft + contentWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    const head = [['Estudiante', 'Identificación', 'Promedio General', 'Asistencia %', 'Estado']];
    const body = data.performance.map(perf => [
      perf.estudiante,
      perf.identificacion,
      perf.promedio.toFixed(2),
      `${perf.asistencia}%`,
      perf.estado
    ]);

    autoTable(doc, {
      head: head,
      body: body,
      startY: yPos,
      margin: { left: marginLeft, right: marginRight, top: yPos, bottom: marginBottom },
    });

    doc.save(`reporte_rendimiento_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reportes</h1>
        <p className="text-gray-600">Genera reportes detallados de calificaciones, promedios y asistencia</p>
      </div>

      {/* Selector de tipo de reporte */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Tipo de Reporte</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { id: 'grades', name: 'Calificaciones', icon: '📊', desc: 'Detalle de todas las calificaciones' },
            { id: 'averages', name: 'Promedios', icon: '📈', desc: 'Promedios por estudiante y materia' },
            { id: 'attendance', name: 'Asistencia', icon: '✅', desc: 'Registro de asistencia de estudiantes' },
            { id: 'performance', name: 'Rendimiento', icon: '🎯', desc: 'Análisis completo de rendimiento' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === type.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <div className="text-3xl mb-2">{type.icon}</div>
              <div className="font-semibold text-gray-900">{type.name}</div>
              <div className="text-xs text-gray-600 mt-1">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro de Docente - Solo para ADMIN y SECRETARIA */}
          {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Docente
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => {
                  setSelectedTeacher(e.target.value);
                  setSelectedCourse('');
                  setSelectedSubject('');
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Todos los docentes</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.user?.nombre} {teacher.user?.apellido}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedSubject('');
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar curso</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.nombre} - {course.nivel} {course.paralelo || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materia
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedCourse}
            >
              <option value="">Todas las materias</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los períodos</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nombre} {period.activo && '(Activo)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading || !selectedCourse}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados del reporte */}
      {reportData && (
        <div className="space-y-6">
          {/* Botones de exportación */}
          <div className="bg-white shadow rounded-lg p-4 flex justify-end gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <span>📊</span> Exportar Excel
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <span>📄</span> Exportar PDF
            </button>
          </div>

          {/* Reporte de Calificaciones */}
          {reportType === 'grades' && reportData && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-2">Reporte de Calificaciones</h2>
              {reportData.grades && reportData.periodsGrouped ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Total de registros: <span className="font-semibold">{reportData.total || 0}</span> | Curso: <span className="font-semibold">{reportData.curso || 'N/A'}</span>
                    {subjectSections.length > 1 && (
                      <> | Materias mostradas: <span className="font-semibold">{subjectSections.length}</span></>
                    )}
                  </p>
                  {(!reportData.grades || reportData.grades.length === 0) ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg">No se encontraron calificaciones para los filtros seleccionados.</p>
                    </div>
                  ) : (
                    <>
                      {subjectSections.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-lg">No hay calificaciones para las materias seleccionadas.</p>
                        </div>
                      ) : (
                        subjectSections.map((section, sectionIndex) => {
                          // Filtrar periodsGrouped para mostrar solo insumos con datos en esta materia
                          const filteredPeriodsForSection = reportData.periodsGrouped.map(periodGroup => ({
                            ...periodGroup,
                            subPeriods: periodGroup.subPeriods.map(subPeriodGroup => {
                              // Filtrar columnas que tienen al menos una calificación en esta materia
                              const filteredColumns = subPeriodGroup.columns.filter(colKey =>
                                section.rows.some(row => row.calificaciones[colKey])
                              );
                              return {
                                ...subPeriodGroup,
                                columns: filteredColumns
                              };
                            }).filter(sp => sp.columns.length > 0) // Eliminar subperíodos sin columnas
                          })).filter(p => p.subPeriods.length > 0); // Eliminar períodos sin subperíodos

                          return (
                          <div key={section.key || sectionIndex} className="mb-10 last:mb-0">
                            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-xs uppercase text-gray-500">Materia {sectionIndex + 1} de {subjectSections.length}</p>
                              <p className="text-lg font-semibold text-gray-900">{section.nombre}</p>
                              <p className="text-xs text-gray-500">Registros en esta materia: {section.rows.length}</p>
                            </div>
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-20">
                    {/* Fila de encabezados de período */}
                    <tr>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-0 bg-gray-100 z-30 min-w-[140px] shadow-sm">
                        Identificación
                      </th>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[140px] bg-gray-100 z-30 min-w-[180px] shadow-sm">
                        Estudiante
                      </th>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[320px] bg-gray-100 z-30 min-w-[150px] shadow-sm">
                        Materia
                      </th>
                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => {
                        // Calcular el total de columnas para este período
                        // Para cada subperíodo: insumos + 2 columnas (promedio y promedio ponderado)
                        // Al final: 2 columnas (promedio y promedio ponderado del período)
                        const totalColumns = periodGroup.subPeriods.reduce((sum, subPeriod) => {
                          return sum + subPeriod.columns.length + 2; // Insumos + Promedio + Promedio Ponderado
                        }, 0) + 2; // + Promedio Período + Promedio Ponderado Período
                        return (
                          <th
                            key={periodIdx}
                            rowSpan="1"
                            colSpan={totalColumns}
                            className="px-3 py-2 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-200"
                          >
                            {periodGroup.periodoNombre}
                          </th>
                        );
                      })}
                      {/* Columna de Promedio General si hay múltiples períodos */}
                      {(!selectedPeriod || selectedPeriod === '') && filteredPeriodsForSection && filteredPeriodsForSection.length > 1 && (
                        <th
                          rowSpan="3"
                          className="px-3 py-3 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-300"
                        >
                          Promedio General
                        </th>
                      )}
                    </tr>
                    {/* Fila de encabezados de subperíodo */}
                    <tr>
                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
                        <React.Fragment key={`period-${periodIdx}`}>
                          {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => {
                            const insumoSpan = subPeriodGroup.columns.length + 2;
                            return (
                              <React.Fragment key={`${periodIdx}-${subPeriodIdx}`}>
                                <th
                                  colSpan={subPeriodGroup.columns.length}
                                  className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 bg-gray-100"
                                >
                                  {subPeriodGroup.subPeriodoNombre}
                                </th>
                                <th
                                  colSpan="2"
                                  className="px-3 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-gray-50"
                                >
                                  Promedios Subperíodo
                                </th>
                              </React.Fragment>
                            );
                          })}
                          <th
                            rowSpan="2"
                            colSpan="1"
                            className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-purple-50"
                            title="Promedio del período"
                          >
                            Prom. Período
                          </th>
                          <th
                            rowSpan="2"
                            colSpan="1"
                            className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-purple-100"
                            title={`Promedio ponderado del período (${periodGroup.periodoPonderacion}%)`}
                          >
                            Prom. Pond. Período
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                    <tr>
                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
                        <React.Fragment key={`period-header-${periodIdx}`}>
                          {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => (
                            <React.Fragment key={`subperiod-header-${periodIdx}-${subPeriodIdx}`}>
                              {subPeriodGroup.columns.map((colKey, idx) => {
                                const [periodo, subPeriodo, insumo] = colKey.split('|');
                                return (
                                  <th 
                                    key={`insumo-${colKey}-${idx}`}
                                    className="px-3 py-3 text-center border-r border-gray-300 bg-gray-50 min-w-[140px]"
                                    title={`Periodo: ${periodo}\nSubperíodo: ${subPeriodo}\nInsumo: ${insumo}`}
                                  >
                                    <div className="flex flex-col gap-1 text-gray-700">
                                      <span className="text-[11px] font-semibold leading-tight break-words">
                                        {subPeriodo} - {insumo}
                                      </span>
                                    </div>
                                  </th>
                                );
                              })}
                              <th
                                className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-50"
                              >
                                Prom. Sub
                              </th>
                              <th
                                className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-100"
                              >
                                Prom. Pond. Sub
                              </th>
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {section.rows.map((row, index) => (
                      <tr key={index} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-0 bg-white z-10 text-sm shadow-sm">
                          {row.identificacion}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[140px] bg-white z-10 font-medium text-sm shadow-sm">
                          {row.estudiante}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[320px] bg-white z-10 font-medium text-sm shadow-sm">
                          {row.materia}
                        </td>
                        {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
                          <React.Fragment key={`period-data-${periodIdx}`}>
                            {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => (
                              <React.Fragment key={`subperiod-data-${periodIdx}-${subPeriodIdx}`}>
                                {/* Columnas de insumos del subperíodo */}
                                {subPeriodGroup.columns.map((colKey, colIdx) => {
                                  const calificacionData = row.calificaciones[colKey];
                                  return (
                                    <td 
                                      key={`insumo-data-${colKey}-${colIdx}`}
                                      className="px-3 py-3 text-center border-r border-gray-300 align-middle"
                                      title={calificacionData?.observaciones ? `Observación: ${calificacionData.observaciones}\nFecha: ${calificacionData.fecha}` : ''}
                                    >
                                      {calificacionData ? (
                                        <div className="flex flex-col items-center justify-center gap-1">
                                          <span className={`font-bold text-base ${calificacionData.calificacion >= 7 ? 'text-green-600' : calificacionData.calificacion >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {calificacionData.calificacion.toFixed(2)}
                                          </span>
                                          {calificacionData.observaciones && (
                                            <span className="text-[10px] text-gray-500 cursor-help" title={calificacionData.observaciones}>
                                              📝
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300 text-sm">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                {/* Columnas de promedios por subperíodo - inmediatamente después de cada subperíodo */}
                                {(() => {
                                  const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
                                  return (
                                    <>
                                      <td
                                        className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-50"
                                      >
                                        {promedioSubPeriodo ? (
                                          <span className={`font-bold text-sm ${promedioSubPeriodo.promedio >= 7 ? 'text-green-600' : promedioSubPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {promedioSubPeriodo.promedio.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-gray-300 text-xs">-</span>
                                        )}
                                      </td>
                                      <td
                                        className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-100"
                                      >
                                        {promedioSubPeriodo ? (
                                          <span className={`font-bold text-sm ${promedioSubPeriodo.promedioPonderado >= 7 ? 'text-green-600' : promedioSubPeriodo.promedioPonderado >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {promedioSubPeriodo.promedioPonderado.toFixed(2)}
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
                            {/* Columnas de promedios del período */}
                            {(() => {
                              // Buscar el promedio del período usando el periodoId o el nombre del período
                              const periodoId = periodGroup.periodoId;
                              let promedioPeriodo = null;
                              
                              if (periodoId && row.promediosPeriodo) {
                                promedioPeriodo = row.promediosPeriodo[periodoId];
                              }
                              
                              // Si no se encuentra por ID, intentar buscar por nombre
                              if (!promedioPeriodo && row.promediosPeriodo) {
                                const periodoEncontrado = Object.values(row.promediosPeriodo).find(
                                  p => p.nombre === periodGroup.periodoNombre
                                );
                                if (periodoEncontrado) {
                                  promedioPeriodo = periodoEncontrado;
                                }
                              }
                              
                              return (
                                <>
                                  <td
                                    className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-50"
                                  >
                                    {promedioPeriodo ? (
                                      <span className={`font-bold text-sm ${promedioPeriodo.promedio >= 7 ? 'text-green-600' : promedioPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {promedioPeriodo.promedio.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 text-xs">-</span>
                                    )}
                                  </td>
                                  <td
                                    className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-100"
                                  >
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
                        {/* Columna de Promedio General si hay múltiples períodos */}
                        {(!selectedPeriod || selectedPeriod === '') && filteredPeriodsForSection && filteredPeriodsForSection.length > 1 && (
                          <td className="px-3 py-3 text-center border-r border-gray-300 align-middle bg-yellow-50">
                            {row.promedioGeneral !== null && row.promedioGeneral !== undefined ? (
                              <span className={`font-bold text-base ${row.promedioGeneral >= 7 ? 'text-green-600' : row.promedioGeneral >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {row.promedioGeneral.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-sm">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                            </div>
                          </div>
                          );
                        })
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No se pudo cargar el reporte. Por favor, intente nuevamente.</p>
                </div>
              )}
            </div>
          )}

          {/* Reporte de Promedios */}
          {reportType === 'averages' && reportData && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-2">Reporte de Promedios</h2>
              {reportData.averages && Array.isArray(reportData.periodsGrouped) ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Total de registros: <span className="font-semibold">{reportData.total || 0}</span> | Curso: <span className="font-semibold">{reportData.curso || 'N/A'}</span>
                    {averagesSubjectSections.length > 1 && <> | Materias mostradas: <span className="font-semibold">{averagesSubjectSections.length}</span></>}
                  </p>
                  {(!reportData.averages || reportData.averages.length === 0 || !reportData.periodsGrouped || reportData.periodsGrouped.length === 0) ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg">No se encontraron promedios para los filtros seleccionados.</p>
                    </div>
                  ) : (
                    <>
                      {averagesSubjectSections.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-lg">No hay promedios para las materias seleccionadas.</p>
                        </div>
                      ) : (
                        averagesSubjectSections.map((section, sectionIndex) => {
                          // Filtrar periodsGrouped para esta materia (solo subperíodos con datos)
                          const filteredPeriodsForSection = reportData.periodsGrouped.map(periodGroup => ({
                            ...periodGroup,
                            subPeriods: periodGroup.subPeriods.filter(subPeriodGroup =>
                              section.rows.some(row => row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId])
                            )
                          })).filter(p => p.subPeriods.length > 0);

                          return (
                            <div key={section.key || sectionIndex} className="mb-10 last:mb-0">
                              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <p className="text-xs uppercase text-gray-500">Materia {sectionIndex + 1} de {averagesSubjectSections.length}</p>
                                <p className="text-lg font-semibold text-gray-900">{section.nombre}</p>
                                <p className="text-xs text-gray-500">Registros en esta materia: {section.rows.length}</p>
                              </div>
                              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
                                <table className="min-w-full border-collapse">
                                  <thead className="bg-gray-100 sticky top-0 z-20">
                                    <tr>
                                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-0 bg-gray-100 z-30 min-w-[140px] shadow-sm">Identificación</th>
                                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[140px] bg-gray-100 z-30 min-w-[180px] shadow-sm">Estudiante</th>
                                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[320px] bg-gray-100 z-30 min-w-[150px] shadow-sm">Materia</th>
                                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => {
                                        const totalColumns = periodGroup.subPeriods.reduce((sum, subPeriod) => sum + 2, 0) + 2;
                                        return (
                                          <th key={periodIdx} rowSpan="1" colSpan={totalColumns} className="px-3 py-2 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-200">
                                            {periodGroup.periodoNombre}
                                          </th>
                                        );
                                      })}
                                      {(!selectedPeriod || selectedPeriod === '') && filteredPeriodsForSection && filteredPeriodsForSection.length > 1 && (
                                        <th rowSpan="3" className="px-3 py-3 text-center text-xs font-bold text-gray-800 uppercase border-r border-gray-300 bg-gray-300">Promedio General</th>
                                      )}
                                    </tr>
                                    <tr>
                                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
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
                                      {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
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
                                    {section.rows.map((row, index) => (
                                      <tr key={index} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-0 bg-white z-10 text-sm shadow-sm">{row.identificacion}</td>
                                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[140px] bg-white z-10 font-medium text-sm shadow-sm">{row.estudiante}</td>
                                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[320px] bg-white z-10 font-medium text-sm shadow-sm">{row.materia}</td>
                                        {filteredPeriodsForSection && filteredPeriodsForSection.map((periodGroup, periodIdx) => (
                                          <React.Fragment key={`period-data-${periodIdx}`}>
                                            {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => {
                                              const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
                                              return (
                                                <React.Fragment key={`subperiod-data-${periodIdx}-${subPeriodIdx}`}>
                                                  <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-50">
                                                    {promedioSubPeriodo ? (<span className={`font-bold text-sm ${promedioSubPeriodo.promedio >= 7 ? 'text-green-600' : promedioSubPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{promedioSubPeriodo.promedio.toFixed(2)}</span>) : (<span className="text-gray-300 text-xs">-</span>)}
                                                  </td>
                                                  <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-blue-100">
                                                    {promedioSubPeriodo ? (<span className={`font-bold text-sm ${promedioSubPeriodo.promedioPonderado >= 7 ? 'text-green-600' : promedioSubPeriodo.promedioPonderado >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{promedioSubPeriodo.promedioPonderado.toFixed(2)}</span>) : (<span className="text-gray-300 text-xs">-</span>)}
                                                  </td>
                                                </React.Fragment>
                                              );
                                            })}
                                            {(() => {
                                              const periodoId = periodGroup.periodoId;
                                              let promedioPeriodo = null;
                                              if (periodoId && row.promediosPeriodo) {
                                                promedioPeriodo = row.promediosPeriodo[periodoId];
                                              }
                                              if (!promedioPeriodo && row.promediosPeriodo) {
                                                const periodoEncontrado = Object.values(row.promediosPeriodo).find(
                                                  p => p.nombre === periodGroup.periodoNombre
                                                );
                                                if (periodoEncontrado) {
                                                  promedioPeriodo = periodoEncontrado;
                                                }
                                              }
                                              return (
                                                <>
                                                  <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-50">
                                                    {promedioPeriodo ? (<span className={`font-bold text-sm ${promedioPeriodo.promedio >= 7 ? 'text-green-600' : promedioPeriodo.promedio >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{promedioPeriodo.promedio.toFixed(2)}</span>) : (<span className="text-gray-300 text-xs">-</span>)}
                                                  </td>
                                                  <td className="px-2 py-3 text-center border-r border-gray-300 align-middle bg-purple-100">
                                                    {promedioPeriodo ? (<span className={`font-bold text-sm ${promedioPeriodo.promedioPonderado >= 7 ? 'text-green-600' : promedioPeriodo.promedioPonderado >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{promedioPeriodo.promedioPonderado.toFixed(2)}</span>) : (<span className="text-gray-300 text-xs">-</span>)}
                                                  </td>
                                                </>
                                              );
                                            })()}
                                          </React.Fragment>
                                        ))}
                                        {(!selectedPeriod || selectedPeriod === '') && filteredPeriodsForSection && filteredPeriodsForSection.length > 1 && (
                                          <td className="px-3 py-3 text-center border-r border-gray-300 align-middle bg-yellow-50">
                                            {row.promedioGeneral !== null && row.promedioGeneral !== undefined ? (<span className={`font-bold text-base ${row.promedioGeneral >= 7 ? 'text-green-600' : row.promedioGeneral >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{row.promedioGeneral.toFixed(2)}</span>) : (<span className="text-gray-300 text-sm">-</span>)}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No se pudo cargar el reporte. Por favor, intente nuevamente.</p>
                </div>
              )}

              {/* Gráfico de distribución de promedios */}
              {reportData.chartData && (
                <div className="bg-white shadow rounded-lg p-6 mt-6">
                  <h3 className="text-xl font-semibold mb-4">Distribución de Promedios</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="rango" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="cantidad" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Reporte de Rendimiento */}
          {reportType === 'performance' && reportData.performance && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Reporte de Rendimiento</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identificación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio General</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asistencia %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.performance.map((perf, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">{perf.estudiante}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{perf.identificacion}</td>
                          <td className={`px-6 py-4 whitespace-nowrap font-semibold ${perf.promedio >= 7 ? 'text-green-600' : 'text-red-600'}`}>
                            {perf.promedio.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{perf.asistencia}%</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${perf.estado === 'Excelente' ? 'bg-green-100 text-green-800' : perf.estado === 'Bueno' ? 'bg-blue-100 text-blue-800' : perf.estado === 'Regular' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {perf.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gráficos de rendimiento */}
              {reportData.chartData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Distribución por Estado</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reportData.chartData.estados}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.chartData.estados.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Evolución de Promedios</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.chartData.evolucion}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="promedio" stroke="#0088FE" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;

