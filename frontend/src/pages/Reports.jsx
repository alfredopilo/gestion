import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
  }, [selectedCourse]);

  const fetchInitialData = async () => {
    try {
      const [coursesRes, periodsRes] = await Promise.all([
        api.get('/courses?limit=1000'),
        api.get('/periods?limit=1000'),
      ]);
      setCourses(coursesRes.data.data || []);
      setPeriods(periodsRes.data.data || []);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    }
  };

  const fetchSubjects = async () => {
    if (!selectedCourse) return;
    try {
      const response = await api.get(`/assignments?cursoId=${selectedCourse}`);
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
      let worksheetData = [];
      
      switch (reportType) {
        case 'grades':
          worksheetData = generateGradesExcel(reportData);
          break;
        case 'averages':
          worksheetData = generateAveragesExcel(reportData);
          break;
        case 'attendance':
          worksheetData = generateAttendanceExcel(reportData);
          break;
        case 'performance':
          worksheetData = generatePerformanceExcel(reportData);
          break;
      }

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Crear hoja de trabajo desde los datos
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Ajustar ancho de columnas
      const colWidths = worksheetData[0] ? worksheetData[0].map((_, colIndex) => {
        const maxLength = Math.max(...worksheetData.map(row => {
          const cellValue = row[colIndex];
          return cellValue ? String(cellValue).length : 0;
        }));
        return { wch: Math.min(Math.max(maxLength, 10), 50) };
      }) : [];
      ws['!cols'] = colWidths;
      
      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
      
      // Generar archivo Excel
      XLSX.writeFile(wb, `reporte_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Excel descargado exitosamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Error al exportar Excel');
    }
  };

  const generateGradesExcel = (data) => {
    if (!data.grades || !data.periodsGrouped) return [];
    
    const worksheetData = [];
    
    // Agregar cabecera con logo y nombre de institución
    if (institution) {
      worksheetData.push([institution.nombre || 'Institución']);
      worksheetData.push([]); // Fila vacía
    }
    
    // Título del reporte
    worksheetData.push(['Reporte de Calificaciones']);
    worksheetData.push([`Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`]);
    worksheetData.push([]); // Fila vacía
    
    // Construir encabezados con la estructura completa
    const headerRow = ['Estudiante', 'Identificación', 'Materia'];
    
    // Agregar columnas de insumos y promedios por período
    data.periodsGrouped.forEach(periodGroup => {
      periodGroup.subPeriods.forEach(subPeriodGroup => {
        // Columnas de insumos
        subPeriodGroup.columns.forEach(colKey => {
          const [periodo, subPeriodo, insumo] = colKey.split('|');
          headerRow.push(insumo);
        });
        // Promedio y Promedio Ponderado del subperíodo
        headerRow.push(`Prom. Sub ${subPeriodGroup.subPeriodoNombre}`);
        headerRow.push(`Prom. Pond. Sub ${subPeriodGroup.subPeriodoNombre}`);
      });
      // Promedio y Promedio Ponderado del período
      headerRow.push(`Prom. Período ${periodGroup.periodoNombre}`);
      headerRow.push(`Prom. Pond. Período ${periodGroup.periodoNombre}`);
    });
    
    // Promedio General si hay múltiples períodos
    if (data.periodsGrouped.length > 1) {
      headerRow.push('Promedio General');
    }
    
    worksheetData.push(headerRow);
    
    // Datos
    data.grades.forEach(row => {
      const rowData = [row.estudiante, row.identificacion, row.materia];
      
      // Agregar datos por período
      data.periodsGrouped.forEach(periodGroup => {
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          // Calificaciones de insumos
          subPeriodGroup.columns.forEach(colKey => {
            const calificacionData = row.calificaciones[colKey];
            if (calificacionData) {
              rowData.push(parseFloat(calificacionData.calificacion.toFixed(2)));
            } else {
              rowData.push('-');
            }
          });
          // Promedios del subperíodo
          const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
          if (promedioSubPeriodo) {
            rowData.push(parseFloat(promedioSubPeriodo.promedio.toFixed(2)));
            rowData.push(parseFloat(promedioSubPeriodo.promedioPonderado.toFixed(2)));
          } else {
            rowData.push('-', '-');
          }
        });
        // Promedios del período
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
      
      // Promedio General
      if (data.periodsGrouped.length > 1) {
        rowData.push(row.promedioGeneral !== null && row.promedioGeneral !== undefined ? parseFloat(row.promedioGeneral.toFixed(2)) : '-');
      }
      
      worksheetData.push(rowData);
    });
    
    return worksheetData;
  };

  const generateAveragesExcel = (data) => {
    const worksheetData = [];
    
    // Agregar cabecera con nombre de institución
    if (institution) {
      worksheetData.push([institution.nombre || 'Institución']);
      worksheetData.push([]);
    }
    worksheetData.push(['Reporte de Promedios']);
    worksheetData.push([]);
    worksheetData.push(['Estudiante', 'Identificación', 'Curso', 'Materia', 'Promedio', 'Estado']);
    if (data.averages) {
      data.averages.forEach(avg => {
        worksheetData.push([
          avg.estudiante,
          avg.identificacion,
          avg.curso,
          avg.materia,
          parseFloat(avg.promedio.toFixed(2)),
          avg.estado
        ]);
      });
    }
    return worksheetData;
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

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Márgenes de 0.5 cm (1 cm = 28.35 puntos, 0.5 cm = 14.175 puntos)
    const margin = 14.18; // 0.5 cm en puntos
    const marginLeft = margin;
    const marginRight = margin;
    const marginTop = margin;
    const marginBottom = margin;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentHeight = pageHeight - marginTop - marginBottom;
    
    let yPos = marginTop;

    // Logo y nombre de la institución
    if (institution) {
      const logoSize = 18; // Tamaño del logo (18px de alto, proporcional al texto)
      const logoWidth = 18; // Ancho del logo
      const logoSpacing = 5; // Espacio entre logo y texto
      
      // Agregar logo si existe
      if (institution.logo) {
        try {
          let imgData = institution.logo;
          let imgFormat = 'PNG';
          
          // Detectar formato de imagen
          if (institution.logo.startsWith('data:image/')) {
            // Es base64 con prefijo data URL
            const matches = institution.logo.match(/data:image\/(\w+);base64,/);
            if (matches) {
              imgFormat = matches[1].toUpperCase();
              imgData = institution.logo;
            }
          } else if (institution.logo.startsWith('data:')) {
            // Es base64 sin prefijo
            imgData = institution.logo;
          }
          
          // Agregar logo (tamaño proporcional al texto)
          doc.addImage(imgData, imgFormat, marginLeft, yPos, logoWidth, logoSize);
        } catch (error) {
          console.error('Error al cargar logo:', error);
        }
      }
      
      // Nombre de la institución
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const institutionX = institution.logo ? marginLeft + logoWidth + logoSpacing : marginLeft + contentWidth / 2;
      const textY = yPos + (logoSize / 2) + 2; // Centrar verticalmente con el logo
      doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
      yPos += Math.max(logoSize, 18) + 5; // Ajustar posición Y según el tamaño del logo o texto
    }

    // Título
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Calificaciones', marginLeft + contentWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Información del reporte
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total de registros: ${data.total || 0} | Curso: ${data.curso || 'N/A'}`, marginLeft + contentWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Construir encabezados planos (una sola fila con nombres descriptivos)
    const head = [];
    head.push('Estudiante');
    head.push('Identificación');
    head.push('Materia');
    
    // Agregar columnas con nombres descriptivos
    data.periodsGrouped.forEach(periodGroup => {
      periodGroup.subPeriods.forEach(subPeriodGroup => {
        // Columnas de insumos
        subPeriodGroup.columns.forEach(colKey => {
          const [periodo, subPeriodo, insumo] = colKey.split('|');
          head.push(`${insumo}\n(${subPeriodo})`);
        });
        // Promedios del subperíodo
        head.push(`Prom. Sub\n${subPeriodGroup.subPeriodoNombre}`);
        head.push(`Prom. Pond. Sub\n${subPeriodGroup.subPeriodoNombre}`);
      });
      // Promedios del período
      head.push(`Prom. ${periodGroup.periodoNombre}`);
      head.push(`Prom. Pond. ${periodGroup.periodoNombre}`);
    });
    
    // Promedio General
    if (data.periodsGrouped.length > 1) {
      head.push('Promedio General');
    }

    // Construir datos de la tabla
    const body = [];
    data.grades.forEach(row => {
      const rowData = [row.estudiante, row.identificacion, row.materia];
      
      data.periodsGrouped.forEach(periodGroup => {
        periodGroup.subPeriods.forEach(subPeriodGroup => {
          // Calificaciones de insumos
          subPeriodGroup.columns.forEach(colKey => {
            const calificacionData = row.calificaciones[colKey];
            rowData.push(calificacionData ? calificacionData.calificacion.toFixed(2) : '-');
          });
          // Promedios del subperíodo
          const promedioSubPeriodo = row.promediosSubPeriodo?.[subPeriodGroup.subPeriodoId];
          rowData.push(
            promedioSubPeriodo ? promedioSubPeriodo.promedio.toFixed(2) : '-',
            promedioSubPeriodo ? promedioSubPeriodo.promedioPonderado.toFixed(2) : '-'
          );
        });
        // Promedios del período
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
        rowData.push(
          promedioPeriodo ? promedioPeriodo.promedio.toFixed(2) : '-',
          promedioPeriodo ? promedioPeriodo.promedioPonderado.toFixed(2) : '-'
        );
      });
      
      // Promedio General
      if (data.periodsGrouped.length > 1) {
        rowData.push(row.promedioGeneral !== null && row.promedioGeneral !== undefined ? row.promedioGeneral.toFixed(2) : '-');
      }
      
      body.push(rowData);
    });

    // Generar tabla con autoTable
    autoTable(doc, {
      head: [head],
      body: body,
      startY: yPos,
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [156, 163, 175], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 45 },
      },
      margin: { left: marginLeft, right: marginRight, top: yPos, bottom: marginBottom },
      tableWidth: 'wrap',
    });

    // Guardar PDF
    doc.save(`reporte_calificaciones_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateAveragesPDF = async (data) => {
    if (!data.averages) return;

    const doc = new jsPDF();
    let yPos = 20;

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
          
          doc.addImage(imgData, imgFormat, marginLeft, yPos, logoWidth, logoSize);
        } catch (error) {
          console.error('Error al cargar logo:', error);
        }
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const institutionX = institution.logo ? marginLeft + logoWidth + logoSpacing : marginLeft + contentWidth / 2;
      const textY = yPos + (logoSize / 2) + 2; // Centrar verticalmente con el logo
      doc.text(institution.nombre || 'Institución', institutionX, textY, { align: institution.logo ? 'left' : 'center' });
      yPos += Math.max(logoSize, 18) + 5; // Ajustar posición Y según el tamaño del logo o texto
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Promedios', marginLeft + contentWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    const head = [['Estudiante', 'Identificación', 'Curso', 'Materia', 'Promedio', 'Estado']];
    const body = data.averages.map(avg => [
      avg.estudiante,
      avg.identificacion,
      avg.curso,
      avg.materia,
      avg.promedio.toFixed(2),
      avg.estado
    ]);

    autoTable(doc, {
      head: head,
      body: body,
      startY: yPos,
      margin: { left: marginLeft, right: marginRight, top: yPos, bottom: marginBottom },
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
              {reportData.grades && reportData.columns && reportData.periodsGrouped ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Total de registros: <span className="font-semibold">{reportData.total || 0}</span> | Curso: <span className="font-semibold">{reportData.curso || 'N/A'}</span>
                  </p>
                  {reportData.grades.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg">No se encontraron calificaciones para los filtros seleccionados.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-20">
                    {/* Fila de encabezados de período */}
                    <tr>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-0 bg-gray-100 z-30 min-w-[180px] shadow-sm">
                        Estudiante
                      </th>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[180px] bg-gray-100 z-30 min-w-[120px] shadow-sm">
                        Identificación
                      </th>
                      <th rowSpan="3" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 sticky left-[300px] bg-gray-100 z-30 min-w-[150px] shadow-sm">
                        Materia
                      </th>
                      {reportData.periodsGrouped && reportData.periodsGrouped.map((periodGroup, periodIdx) => {
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
                      {(!selectedPeriod || selectedPeriod === '') && reportData.periodsGrouped && reportData.periodsGrouped.length > 1 && (
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
                      {reportData.periodsGrouped && reportData.periodsGrouped.map((periodGroup, periodIdx) => (
                        <React.Fragment key={`period-${periodIdx}`}>
                          {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => (
                            <React.Fragment key={`${periodIdx}-${subPeriodIdx}`}>
                              <th
                                rowSpan="2"
                                colSpan={subPeriodGroup.columns.length}
                                className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 bg-gray-100"
                              >
                                {subPeriodGroup.subPeriodoNombre}
                              </th>
                              {/* Columnas de promedios por subperíodo - inmediatamente después de cada subperíodo */}
                              <th
                                rowSpan="2"
                                colSpan="1"
                                className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-50"
                                title="Promedio del subperíodo"
                              >
                                Prom. Sub
                              </th>
                              <th
                                rowSpan="2"
                                colSpan="1"
                                className="px-2 py-2 text-center text-[10px] font-semibold text-gray-700 uppercase border-r border-gray-300 bg-blue-100"
                                title={`Promedio ponderado del subperíodo (${subPeriodGroup.subPeriodoPonderacion}%)`}
                              >
                                Prom. Pond. Sub
                              </th>
                            </React.Fragment>
                          ))}
                          {/* Columnas de promedios del período */}
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
                    {/* Fila de encabezados de insumo */}
                    <tr>
                      {reportData.periodsGrouped && reportData.periodsGrouped.map((periodGroup, periodIdx) => (
                        <React.Fragment key={`period-header-${periodIdx}`}>
                          {periodGroup.subPeriods.map((subPeriodGroup, subPeriodIdx) => (
                            <React.Fragment key={`subperiod-header-${periodIdx}-${subPeriodIdx}`}>
                              {/* Columnas de insumos del subperíodo */}
                              {subPeriodGroup.columns.map((colKey, idx) => {
                                const [periodo, subPeriodo, insumo] = colKey.split('|');
                                return (
                                  <th 
                                    key={`insumo-${colKey}-${idx}`}
                                    className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase border-r border-gray-300 bg-gray-50 min-w-[120px]"
                                    title={`Periodo: ${periodo}\nSubperíodo: ${subPeriodo}\nInsumo: ${insumo}`}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] text-gray-500 italic break-words">{insumo}</span>
                                    </div>
                                  </th>
                                );
                              })}
                              {/* No necesitamos generar encabezados para promedios de subperíodo aquí porque tienen rowSpan="2" */}
                            </React.Fragment>
                          ))}
                          {/* No necesitamos generar encabezados para promedios del período aquí porque tienen rowSpan="2" */}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {reportData.grades.map((row, index) => (
                      <tr key={index} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-0 bg-white z-10 font-medium text-sm shadow-sm">
                          {row.estudiante}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[180px] bg-white z-10 text-sm shadow-sm">
                          {row.identificacion}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300 sticky left-[300px] bg-white z-10 font-medium text-sm shadow-sm">
                          {row.materia}
                        </td>
                        {reportData.periodsGrouped && reportData.periodsGrouped.map((periodGroup, periodIdx) => (
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
                        {(!selectedPeriod || selectedPeriod === '') && reportData.periodsGrouped && reportData.periodsGrouped.length > 1 && (
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
          {reportType === 'averages' && reportData.averages && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Reporte de Promedios</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identificación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materia</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.averages.map((avg, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">{avg.estudiante}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{avg.identificacion}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{avg.curso}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{avg.materia}</td>
                          <td className={`px-6 py-4 whitespace-nowrap font-semibold ${avg.promedio >= 7 ? 'text-green-600' : 'text-red-600'}`}>
                            {avg.promedio.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${avg.estado === 'Aprobado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {avg.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gráfico de distribución de promedios */}
              {reportData.chartData && (
                <div className="bg-white shadow rounded-lg p-6">
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

