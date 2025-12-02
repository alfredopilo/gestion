import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const GradeEntry = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [subPeriods, setSubPeriods] = useState([]);
  const [selectedSubPeriod, setSelectedSubPeriod] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({}); // { studentId: { insumoId: grade } }
  const [gradeInputs, setGradeInputs] = useState({}); // { studentId: { insumoId: { calificacion: '', observaciones: '' } } }
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchStudents();
      fetchSubjects();
    } else {
      setStudents([]);
      setSubjects([]);
      setSelectedSubject(null);
    }
  }, [selectedCourse]);

  useEffect(() => {
    // Refrescar estudiantes cuando cambia el período o la materia
    // Esto es importante para actualizar entre períodos supletorios y regulares
    if (selectedCourse && selectedPeriod && selectedSubject) {
      fetchStudents();
    }
  }, [selectedPeriod, selectedSubject]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchSubPeriods();
    } else {
      setSubPeriods([]);
      setSelectedSubPeriod(null);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    // Solo cargar insumos si todos los filtros están seleccionados
    if (selectedCourse && selectedSubject && selectedPeriod && selectedSubPeriod) {
      fetchInsumos();
      fetchGrades();
    } else {
      setInsumos([]);
      setGrades({});
      setGradeInputs({});
    }
  }, [selectedCourse, selectedSubject, selectedPeriod, selectedSubPeriod]);

  // Inicializar inputs cuando se cargan las calificaciones
  // Solo inicializar si no hay inputs existentes o si cambian los estudiantes/insumos
  useEffect(() => {
    if (students.length > 0 && insumos.length > 0) {
      setGradeInputs(prev => {
        const newInputs = { ...prev };
        let hasChanges = false;
        
        students.forEach(student => {
          if (!newInputs[student.id]) {
            newInputs[student.id] = {};
            hasChanges = true;
          }
          insumos.forEach(insumo => {
            // Solo inicializar si no existe el input o si hay una calificación guardada diferente
            const grade = grades[student.id]?.[insumo.id];
            const existingInput = newInputs[student.id]?.[insumo.id];
            
            // Si no hay input existente o si hay una calificación guardada que no coincide con el input
            if (!existingInput) {
              newInputs[student.id][insumo.id] = {
                calificacion: grade ? grade.calificacion.toString() : '',
                observaciones: grade?.observaciones || '',
              };
              hasChanges = true;
            } else if (grade) {
              // Solo actualizar si la calificación guardada es diferente del input actual
              // Esto evita sobrescribir valores que el usuario está escribiendo
              const savedCalificacion = grade.calificacion.toString();
              const currentCalificacion = existingInput.calificacion;
              
              // Solo actualizar si el input actual está vacío o coincide con el valor guardado anteriormente
              // Esto preserva los valores que el usuario está escribiendo
              if (currentCalificacion === '' || currentCalificacion === savedCalificacion) {
                newInputs[student.id][insumo.id] = {
                  calificacion: savedCalificacion,
                  observaciones: grade.observaciones || existingInput.observaciones || '',
                };
                hasChanges = true;
              }
            }
          });
        });
        
        return hasChanges ? newInputs : prev;
      });
    }
  }, [students, insumos, grades]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [coursesRes, periodsRes] = await Promise.all([
        api.get('/courses?limit=100'),
        api.get('/periods'),
      ]);

      setCourses(coursesRes.data.data || []);
      setPeriods(periodsRes.data.data || []);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedCourse) return;
    
    try {
      if (user?.rol === 'PROFESOR') {
        // Para profesores, obtener sus asignaciones
        const response = await api.get('/teachers/my-assignments');
        const assignments = response.data.data || [];
        const courseAssignments = assignments.find(a => a.curso.id === selectedCourse.id);
        if (courseAssignments) {
          setSubjects(courseAssignments.materias || []);
        } else {
          setSubjects([]);
        }
      } else {
        // Para admin/secretaria, obtener todas las asignaciones del curso
        const response = await api.get(`/assignments?cursoId=${selectedCourse.id}`);
        const assignments = response.data.data || [];
        const subjectsList = assignments.map(a => a.materia).filter(Boolean);
        setSubjects(subjectsList);
      }
    } catch (error) {
      console.error('Error al cargar materias:', error);
      toast.error('Error al cargar materias');
    }
  };

  const fetchSubPeriods = async () => {
    if (!selectedPeriod) return;
    
    try {
      const response = await api.get(`/sub-periods?periodoId=${selectedPeriod.id}`);
      const subPeriodsList = response.data.data || [];
      setSubPeriods(subPeriodsList.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    } catch (error) {
      console.error('Error al cargar subperíodos:', error);
      toast.error('Error al cargar subperíodos');
    }
  };

  const fetchInsumos = async () => {
    if (!selectedCourse || !selectedSubject || !selectedPeriod || !selectedSubPeriod) return;
    
    try {
      const response = await api.get(
        `/insumos?cursoId=${selectedCourse.id}&materiaId=${selectedSubject.id}&subPeriodoId=${selectedSubPeriod.id}&activo=true`
      );
      const insumosData = response.data.data || [];
      setInsumos(insumosData.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    } catch (error) {
      console.error('Error al cargar insumos:', error);
      toast.error('Error al cargar insumos');
    }
  };

  const fetchStudents = async () => {
    if (!selectedCourse) return;
    
    try {
      // Si el período es supletorio y hay materia seleccionada, filtrar estudiantes elegibles
      if (selectedPeriod?.esSupletorio && selectedSubject && selectedCourse?.anioLectivo?.id) {
        try {
          const response = await api.get('/supplementary/eligible-students', {
            params: {
              materiaId: selectedSubject.id,
              anioLectivoId: selectedCourse.anioLectivo.id,
              periodoId: selectedPeriod.id,
            },
          });
          
          const eligibleStudents = response.data.data || [];
          
          // Convertir a formato compatible con el resto del código
          const estudiantesList = eligibleStudents.map(item => ({
            id: item.estudiante.id,
            user: item.estudiante,
            grupo: item.curso,
            grupoId: item.curso.id,
          }));
          
          // Ordenar estudiantes alfabéticamente por apellido y nombre
          const estudiantesOrdenados = estudiantesList.sort((a, b) => {
            const apellidoA = (a.user?.apellido || '').toLowerCase();
            const apellidoB = (b.user?.apellido || '').toLowerCase();
            if (apellidoA !== apellidoB) {
              return apellidoA.localeCompare(apellidoB);
            }
            const nombreA = (a.user?.nombre || '').toLowerCase();
            const nombreB = (b.user?.nombre || '').toLowerCase();
            return nombreA.localeCompare(nombreB);
          });
          
          setStudents(estudiantesOrdenados);
          
          if (estudiantesOrdenados.length === 0) {
            toast('No hay estudiantes elegibles para supletorio en esta materia');
          } else {
            toast.success(`${estudiantesOrdenados.length} estudiante(s) elegible(s) para supletorio`);
          }
          
          return;
        } catch (supplementaryError) {
          console.error('Error al cargar estudiantes elegibles para supletorio:', supplementaryError);
          toast.error('Error al cargar estudiantes elegibles para supletorio');
          // Continuar con el método normal como fallback
        }
      }
      
      // Método normal: obtener todos los estudiantes del curso
      const response = await api.get(`/courses/${selectedCourse.id}`);
      const courseData = response.data;
      const estudiantesList = courseData.estudiantes || [];
      
      // Debug: verificar que los datos incluyan numeroIdentificacion
      console.log('Estudiantes recibidos:', estudiantesList.map(e => ({
        nombre: e.user?.nombre,
        apellido: e.user?.apellido,
        numeroIdentificacion: e.user?.numeroIdentificacion
      })));
      
      // Ordenar estudiantes alfabéticamente por apellido y nombre
      const estudiantesOrdenados = estudiantesList.sort((a, b) => {
        const apellidoA = (a.user?.apellido || '').toLowerCase();
        const apellidoB = (b.user?.apellido || '').toLowerCase();
        if (apellidoA !== apellidoB) {
          return apellidoA.localeCompare(apellidoB);
        }
        const nombreA = (a.user?.nombre || '').toLowerCase();
        const nombreB = (b.user?.nombre || '').toLowerCase();
        return nombreA.localeCompare(nombreB);
      });
      
      // Limpiar cualquier flag de supletorio que puedan tener los estudiantes anteriores
      estudiantesOrdenados.forEach(e => {
        delete e._isEligibleForSupplementary;
      });
      
      setStudents(estudiantesOrdenados);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    }
  };

  const fetchGrades = async () => {
    if (!selectedCourse || !selectedSubject || !selectedSubPeriod) return;

    try {
      const response = await api.get(
        `/grades?materiaId=${selectedSubject.id}&subPeriodoId=${selectedSubPeriod.id}`
      );
      const gradesList = response.data.data || [];
      
      // Organizar calificaciones por estudiante e insumo
      const gradesByStudent = {};
      gradesList.forEach(grade => {
        if (!gradesByStudent[grade.estudianteId]) {
          gradesByStudent[grade.estudianteId] = {};
        }
        if (grade.insumoId) {
          gradesByStudent[grade.estudianteId][grade.insumoId] = grade;
        }
      });
      
      setGrades(gradesByStudent);
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
    }
  };

  const [savingStatus, setSavingStatus] = useState({}); // { studentId-insumoId: 'saving' | 'saved' | 'error' }

  const handleGradeChange = (studentId, insumoId, field, value) => {
    // Validar que solo sean números decimales para calificaciones
    if (field === 'calificacion') {
      // Permitir: vacío, números enteros (incluyendo 10), punto decimal, y máximo 2 decimales
      // Permite escribir mientras se escribe: "7", "7.", "7.6", "7.65", "10", "10.", "10.5", etc.
      // Regex mejorado: permite números enteros hasta 10 y decimales con máximo 2 decimales
      // Permite: "", "0", "7", "10", "7.", "7.6", "7.65", "10.5", ".5", "0.5", etc.
      const decimalRegex = /^$|^(\d{1,2}(\.\d{0,2})?|\.\d{1,2})$/;
      
      // Si el valor no coincide con el patrón, no actualizar
      if (value !== '' && !decimalRegex.test(value)) {
        return;
      }
      
      // Validar rango solo cuando hay un número completo (no mientras se escribe "7." o ".")
      if (value !== '' && value !== '.' && !value.endsWith('.')) {
        const numValue = parseFloat(value);
        // Solo validar si es un número válido
        if (!isNaN(numValue)) {
          // Permitir 0 explícitamente
          if (numValue < 0) {
            return; // No permitir valores negativos
          }
          // Permitir hasta 10 (incluyendo 10.00)
          if (numValue > 10) {
            toast.error('La calificación no puede ser mayor a 10', { duration: 2000 });
            return;
          }
        }
      }
    }

    setGradeInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [insumoId]: {
          ...prev[studentId]?.[insumoId],
          [field]: value,
        },
      },
    }));

    // Si es calificación, guardar automáticamente después de 1 segundo sin cambios
    if (field === 'calificacion') {
      const key = `${studentId}-${insumoId}`;
      if (debounceTimer.current[key]) {
        clearTimeout(debounceTimer.current[key]);
      }

      debounceTimer.current[key] = setTimeout(() => {
        saveGrade(studentId, insumoId);
      }, 1000);
    } else if (field === 'observaciones') {
      // Para observaciones, guardar inmediatamente si hay una calificación guardada
      const grade = grades[studentId]?.[insumoId];
      if (grade) {
        const key = `${studentId}-${insumoId}`;
        if (debounceTimer.current[key]) {
          clearTimeout(debounceTimer.current[key]);
        }
        debounceTimer.current[key] = setTimeout(() => {
          saveGrade(studentId, insumoId);
        }, 500);
      }
    }
  };

  const saveGrade = async (studentId, insumoId) => {
    const inputData = gradeInputs[studentId]?.[insumoId];
    if (!inputData) return;

    const student = students.find(s => s.id === studentId);
    const insumo = insumos.find(i => i.id === insumoId);
    if (!student || !insumo || !selectedSubject || !selectedSubPeriod) return;

    const key = `${studentId}-${insumoId}`;
    
    // Validar y parsear calificación (permitir 0)
    const calificacionStr = inputData.calificacion?.trim() || '';
    
    // Si no hay calificación o es solo un punto, no guardar
    if (!calificacionStr || calificacionStr === '' || calificacionStr === '.') {
      setSavingStatus(prev => ({ ...prev, [key]: null }));
      return;
    }
    
    // Si termina en punto, no guardar aún (está escribiendo)
    if (calificacionStr.endsWith('.')) {
      setSavingStatus(prev => ({ ...prev, [key]: null }));
      return;
    }
    
    const calificacion = parseFloat(calificacionStr);
    
    if (isNaN(calificacion)) {
      setSavingStatus(prev => ({ ...prev, [key]: 'error' }));
      return;
    }
    
    // Permitir 0 explícitamente, validar rango 0-10
    if (calificacion < 0 || calificacion > 10) {
      setSavingStatus(prev => ({ ...prev, [key]: 'error' }));
      toast.error('La calificación debe estar entre 0 y 10');
      return;
    }

    setSavingStatus(prev => ({ ...prev, [key]: 'saving' }));

    try {
      // NO truncar/redondear las calificaciones individuales, mantener el valor exacto ingresado
      // Solo asegurar que no tenga más de 2 decimales (ya validado por el regex)
      // Si el usuario ingresa 8.20, se guarda como 8.20 exactamente
      const data = {
        estudianteId: studentId,
        materiaId: selectedSubject.id,
        insumoId: insumoId,
        subPeriodoId: selectedSubPeriod.id,
        calificacion: calificacion, // Valor exacto sin redondear
        observaciones: inputData.observaciones?.trim() || null,
      };

      const existingGrade = grades[studentId]?.[insumoId];
      let savedGrade;
      
      if (existingGrade && existingGrade.id && existingGrade.id !== 'temp') {
        const response = await api.put(`/grades/${existingGrade.id}`, data);
        savedGrade = response.data.grade || response.data;
      } else {
        const response = await api.post('/grades', data);
        savedGrade = response.data.grade || response.data;
      }
      
      setSavingStatus(prev => ({ ...prev, [key]: 'saved' }));
      
      // Actualizar el estado de grades localmente sin recargar todo
      // Esto evita borrar los valores que el usuario está escribiendo en otras celdas
      if (savedGrade) {
        setGrades(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [insumoId]: savedGrade,
          },
        }));
      }
      
      // Limpiar estado después de 2 segundos
      setTimeout(() => {
        setSavingStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[key];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Error al guardar calificación:', error);
      setSavingStatus(prev => ({ ...prev, [key]: 'error' }));
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar calificación';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleDeleteGrade = async (gradeId, studentId, insumoId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta calificación?')) return;

    try {
      await api.delete(`/grades/${gradeId}`);
      toast.success('Calificación eliminada exitosamente');
      
      // Limpiar inputs
      setGradeInputs(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [insumoId]: {
            calificacion: '',
            observaciones: '',
          },
        },
      }));
      
      fetchGrades();
    } catch (error) {
      console.error('Error al eliminar calificación:', error);
      toast.error('Error al eliminar calificación');
    }
  };

  const calculateStudentAverage = (studentId) => {
    // Obtener calificaciones de los inputs (incluye guardadas y no guardadas)
    const inputData = gradeInputs[studentId] || {};
    const gradeValues = [];
    const gradeStrings = []; // Mantener los valores como string para precisión
    
    // Recorrer todos los insumos y obtener las calificaciones que tienen valor
    insumos.forEach(insumo => {
      const input = inputData[insumo.id];
      if (input && input.calificacion && input.calificacion.trim() !== '') {
        const calificacionStr = input.calificacion.trim();
        // Permitir punto al final mientras se escribe (ej: "7.")
        if (!calificacionStr.endsWith('.')) {
          const calificacionNum = parseFloat(calificacionStr);
          if (!isNaN(calificacionNum) && calificacionNum >= 0 && calificacionNum <= 10) {
            gradeValues.push(calificacionNum);
            gradeStrings.push(calificacionStr); // Guardar el string original para precisión
          }
        }
      }
    });
    
    // Solo calcular promedio si hay al menos una calificación
    if (gradeValues.length === 0) return 0;
    
    // Si solo hay una calificación, devolverla directamente (evitar problemas de precisión)
    if (gradeValues.length === 1) {
      const singleGrade = parseFloat(gradeStrings[0]);
      // Asegurar que tenga 2 decimales
      return parseFloat(singleGrade.toFixed(2));
    }
    
    // Calcular suma usando los valores numéricos pero con precisión mejorada
    const sum = gradeValues.reduce((acc, g) => {
      // Multiplicar por 100 para trabajar con enteros y evitar problemas de precisión
      return acc + Math.round(g * 100);
    }, 0);
    
    // Calcular promedio truncado hacia abajo a 2 decimales
    // Dividir la suma por la cantidad y luego truncar
    const avgInCents = Math.floor(sum / gradeValues.length);
    const truncatedAvg = avgInCents / 100;
    
    // Asegurar que siempre tenga 2 decimales
    return parseFloat(truncatedAvg.toFixed(2));
  };

  // Funciones de importación masiva
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportGrades = async () => {
    if (!importData.trim()) {
      toast.error('Debe ingresar datos para importar');
      return;
    }

    setImporting(true);
    const lines = importData.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error('No hay datos para importar');
      setImporting(false);
      return;
    }

    // Formato esperado: cada línea es un estudiante con sus calificaciones separadas por tab o coma
    // Formato: Estudiante | Calif1 | Calif2 | ... | Observaciones (opcional)
    // O simplemente: Calif1 | Calif2 | ... (en orden de estudiantes)
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      // Si hay menos líneas que estudiantes, asumir que solo son calificaciones
      if (lines.length <= students.length) {
        // Formato simple: solo calificaciones en orden
        for (let i = 0; i < lines.length && i < students.length; i++) {
          const student = students[i];
          const values = lines[i].split(/[\t,;]/).map(v => v.trim());
          
          for (let j = 0; j < insumos.length && j < values.length; j++) {
            const insumo = insumos[j];
            const calificacionStr = values[j];
            
            if (calificacionStr && calificacionStr !== '') {
              const calificacion = parseFloat(calificacionStr);
              
              if (!isNaN(calificacion) && calificacion >= 0 && calificacion <= 10) {
                try {
                  const data = {
                    estudianteId: student.id,
                    materiaId: selectedSubject.id,
                    insumoId: insumo.id,
                    subPeriodoId: selectedSubPeriod.id,
                    calificacion: calificacion,
                    observaciones: null,
                  };

                  const existingGrade = grades[student.id]?.[insumo.id];
                  if (existingGrade) {
                    await api.put(`/grades/${existingGrade.id}`, data);
                  } else {
                    await api.post('/grades', data);
                  }
                  
                  successCount++;
                } catch (error) {
                  errorCount++;
                  errors.push(`${student.user?.nombre} ${student.user?.apellido} - ${insumo.nombre}: ${error.response?.data?.error || 'Error'}`);
                }
              } else {
                errorCount++;
                errors.push(`${student.user?.nombre} ${student.user?.apellido} - ${insumo.nombre}: Calificación inválida`);
              }
            }
          }
        }
      } else {
        // Formato con identificación/nombres de estudiantes
        for (const line of lines) {
          const parts = line.split(/[\t,;]/).map(p => p.trim());
          if (parts.length === 0) continue;
          
          const firstPart = parts[0];
          let student = null;
          let startIndex = 1; // Por defecto, asumir que la primera columna es nombre
          
          // Buscar por identificación primero
          const studentById = students.find(s => s.user?.numeroIdentificacion === firstPart);
          if (studentById) {
            student = studentById;
            startIndex = 2; // Si es identificación, las calificaciones empiezan en índice 2 (identificación, nombre, calificaciones...)
          } else {
            // Buscar por nombre completo
            const studentByName = students.find(s => {
              const fullName = `${s.user?.nombre || ''} ${s.user?.apellido || ''}`.trim();
              return fullName === firstPart || fullName.toLowerCase() === firstPart.toLowerCase();
            });
            if (studentByName) {
              student = studentByName;
              startIndex = 1; // Si es nombre, las calificaciones empiezan en índice 1 (nombre, calificaciones...)
            } else {
              // Buscar por nombre parcial
              const studentByPartialName = students.find(s => {
                const fullName = `${s.user?.nombre || ''} ${s.user?.apellido || ''}`.trim().toLowerCase();
                return fullName.includes(firstPart.toLowerCase()) || firstPart.toLowerCase().includes(fullName);
              });
              if (studentByPartialName) {
                student = studentByPartialName;
                startIndex = 1;
              }
            }
          }
          
          if (!student) {
            errorCount++;
            errors.push(`Estudiante no encontrado: ${firstPart}`);
            continue;
          }
          
          // Las calificaciones empiezan desde startIndex
          for (let j = startIndex; j < parts.length && (j - startIndex) < insumos.length; j++) {
            const insumo = insumos[j - startIndex];
            const calificacionStr = parts[j];
            
            if (calificacionStr && calificacionStr !== '') {
              const calificacion = parseFloat(calificacionStr);
              
              if (!isNaN(calificacion) && calificacion >= 0 && calificacion <= 10) {
                try {
                  const data = {
                    estudianteId: student.id,
                    materiaId: selectedSubject.id,
                    insumoId: insumo.id,
                    subPeriodoId: selectedSubPeriod.id,
                    calificacion: calificacion,
                    observaciones: null,
                  };

                  const existingGrade = grades[student.id]?.[insumo.id];
                  if (existingGrade) {
                    await api.put(`/grades/${existingGrade.id}`, data);
                  } else {
                    await api.post('/grades', data);
                  }
                  
                  successCount++;
                } catch (error) {
                  errorCount++;
                  errors.push(`${student.user?.nombre} ${student.user?.apellido} - ${insumo.nombre}: ${error.response?.data?.error || 'Error'}`);
                }
              } else {
                errorCount++;
                errors.push(`${student.user?.nombre} ${student.user?.apellido} - ${insumo.nombre}: Calificación inválida`);
              }
            }
          }
        }
      }

      // Recargar calificaciones
      await fetchGrades();
      
      // Mostrar resultados
      if (successCount > 0) {
        toast.success(`${successCount} calificación(es) importada(s) exitosamente`);
      }
      if (errorCount > 0) {
        console.error('Errores en importación:', errors);
        toast.error(`${errorCount} error(es) durante la importación. Ver consola para detalles.`);
      }
      
      setImportData('');
      setShowTemplateModal(false);
    } catch (error) {
      console.error('Error en importación:', error);
      toast.error('Error al importar calificaciones');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedCourse || !selectedSubject || !selectedPeriod || !selectedSubPeriod) {
      toast.error('Debe seleccionar todos los filtros');
      return;
    }

    let savedCount = 0;
    let errorCount = 0;
    const promises = [];

    // Guardar todas las calificaciones que tengan valor
    students.forEach(student => {
      insumos.forEach(insumo => {
        const input = gradeInputs[student.id]?.[insumo.id];
        if (input && input.calificacion && input.calificacion.trim() !== '') {
          const calificacion = parseFloat(input.calificacion);
          if (!isNaN(calificacion) && calificacion >= 0 && calificacion <= 10) {
            promises.push(
              (async () => {
                try {
                  const data = {
                    estudianteId: student.id,
                    materiaId: selectedSubject.id,
                    insumoId: insumo.id,
                    subPeriodoId: selectedSubPeriod.id,
                    calificacion: calificacion,
                    observaciones: input.observaciones || null,
                  };

                  const existingGrade = grades[student.id]?.[insumo.id];
                  // Solo hacer PUT si existe una calificación con un ID válido (no 'temp')
                  if (existingGrade && existingGrade.id && existingGrade.id !== 'temp') {
                    await api.put(`/grades/${existingGrade.id}`, data);
                  } else {
                    await api.post('/grades', data);
                  }
                  savedCount++;
                } catch (error) {
                  errorCount++;
                  console.error(`Error al guardar calificación para ${student.user?.nombre} ${student.user?.apellido} - ${insumo.nombre}:`, error);
                }
              })()
            );
          }
        }
      });
    });

    if (promises.length === 0) {
      toast('No hay calificaciones para guardar', { icon: 'ℹ️' });
      return;
    }

    // Mostrar indicador de guardado
    toast.loading(`Guardando ${promises.length} calificación(es)...`, { id: 'saving-all' });

    try {
      await Promise.all(promises);
      
      // Recargar calificaciones
      await fetchGrades();
      
      // Mostrar resultado
      toast.dismiss('saving-all');
      if (errorCount === 0) {
        toast.success(`${savedCount} calificación(es) guardada(s) exitosamente`);
      } else {
        toast.success(`${savedCount} calificación(es) guardada(s), ${errorCount} error(es)`);
      }
    } catch (error) {
      toast.dismiss('saving-all');
      console.error('Error al guardar calificaciones:', error);
      toast.error('Error al guardar algunas calificaciones');
    }
  };

  const generateImportTemplate = () => {
    // Generar plantilla de ejemplo
    let template = 'Formato 1: Solo calificaciones (una línea por estudiante, separadas por tab o coma)\n';
    template += 'Ejemplo:\n';
    template += '8.5\t9.0\t7.5\n';
    template += '9.0\t8.5\t8.0\n\n';
    template += 'Formato 2: Con identificación y nombre de estudiantes\n';
    template += 'Ejemplo:\n';
    students.slice(0, 3).forEach(student => {
      const identificacion = student.user?.numeroIdentificacion || '';
      template += `${identificacion}\t${student.user?.nombre} ${student.user?.apellido}\t8.5\t9.0\t7.5\n`;
    });
    template += '\nNota: Las columnas corresponden a: Identificación, Estudiante, y luego los insumos en orden:\n';
    insumos.forEach((insumo, index) => {
      template += `${index + 2}. ${insumo.nombre}\n`;
    });
    
    setImportData(template);
  };

  const downloadTemplate = () => {
    if (students.length === 0 || insumos.length === 0) {
      toast.error('No hay estudiantes o insumos para generar la plantilla');
      return;
    }

    // Crear encabezados CSV (Identificación primero)
    const headers = ['Identificación', 'Estudiante', ...insumos.map(i => i.nombre)];
    const rows = [headers];

    // Agregar filas de estudiantes
    students.forEach(student => {
      const nombreCompleto = `${student.user?.nombre || ''} ${student.user?.apellido || ''}`.trim();
      const identificacion = student.user?.numeroIdentificacion || '';
      const row = [identificacion, nombreCompleto, ...insumos.map(() => '')];
      rows.push(row);
    });

    // Convertir a CSV
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plantilla_calificaciones_${selectedSubject?.nombre || 'materia'}_${selectedSubPeriod?.nombre || 'subperiodo'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Plantilla descargada exitosamente');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar que sea un archivo de texto o CSV
    const validTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel'];
    const validExtensions = ['.txt', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const isValidType = validTypes.includes(file.type) || isValidExtension;

    if (!isValidType && !isValidExtension) {
      toast.error('Por favor seleccione un archivo de texto (.txt) o CSV (.csv)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setImportData(content);
      toast.success('Archivo cargado exitosamente');
    };
    reader.onerror = () => {
      toast.error('Error al leer el archivo');
    };
    reader.readAsText(file, 'UTF-8');

    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Ingreso de Calificaciones</h1>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find(c => c.id === e.target.value);
                setSelectedCourse(course || null);
                setSelectedSubject(null);
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
              Materia <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubject?.id || ''}
              onChange={(e) => {
                const subject = subjects.find(s => s.id === e.target.value);
                setSelectedSubject(subject || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedCourse}
              required
            >
              <option value="">Seleccionar materia</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPeriod?.id || ''}
              onChange={(e) => {
                const period = periods.find(p => p.id === e.target.value);
                setSelectedPeriod(period || null);
                setSelectedSubPeriod(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar período</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nombre} {period.activo && '(Activo)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subperíodo <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubPeriod?.id || ''}
              onChange={(e) => {
                const subPeriod = subPeriods.find(sp => sp.id === e.target.value);
                setSelectedSubPeriod(subPeriod || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedPeriod}
              required
            >
              <option value="">Seleccionar subperíodo</option>
              {subPeriods.map(subPeriod => (
                <option key={subPeriod.id} value={subPeriod.id}>
                  {subPeriod.nombre} ({subPeriod.ponderacion}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje cuando faltan selecciones */}
      {(!selectedCourse || !selectedSubject || !selectedPeriod || !selectedSubPeriod) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">
            <strong>Seleccione todos los filtros:</strong> Curso, Materia, Período y Subperíodo para ver y gestionar las calificaciones.
          </p>
        </div>
      )}

      {/* Tabla de estudiantes y calificaciones */}
      {selectedCourse && selectedSubject && selectedPeriod && selectedSubPeriod && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Calificaciones: {selectedSubject.nombre} - {selectedSubPeriod.nombre}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Período: {selectedPeriod.nombre} | Curso: {selectedCourse.nombre}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAll}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
              >
                Guardar Todo
              </button>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Descargar Plantilla
              </button>
              <button
                onClick={() => {
                  setShowTemplateModal(true);
                  generateImportTemplate();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                Importar Calificaciones
              </button>
            </div>
          </div>

          {insumos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hay insumos registrados para este subperíodo. Debe crear insumos primero.
            </div>
          ) : students.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hay estudiantes en este curso
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                      Identificación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-[120px] bg-gray-50 z-10 min-w-[200px]">
                      Estudiante
                    </th>
                    {insumos.map(insumo => (
                      <React.Fragment key={insumo.id}>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                          <div className="font-semibold">{insumo.nombre}</div>
                          {insumo.descripcion && (
                            <div className="text-xs text-gray-400 font-normal mt-1">{insumo.descripcion}</div>
                          )}
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[150px]">
                          Observaciones
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                      Promedio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    const studentGrades = grades[student.id] || {};
                    const average = calculateStudentAverage(student.id);
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                          <div className="text-sm font-medium text-gray-900">
                            {student.user?.numeroIdentificacion ? student.user.numeroIdentificacion : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap sticky left-[120px] bg-white z-10">
                          <div className="font-medium text-gray-900">
                            {student.user?.apellido} {student.user?.nombre}
                          </div>
                        </td>
                        {insumos.map(insumo => {
                          const input = gradeInputs[student.id]?.[insumo.id] || { calificacion: '', observaciones: '' };
                          const grade = studentGrades[insumo.id];
                          
                          return (
                            <React.Fragment key={insumo.id}>
                              <td className="px-4 py-2">
                                <div className="flex flex-col gap-1">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*\.?[0-9]{0,2}"
                                      value={input.calificacion}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        // Solo permitir números, punto decimal y máximo 2 decimales
                                        handleGradeChange(student.id, insumo.id, 'calificacion', value);
                                      }}
                                      onBlur={(e) => {
                                        // Validar y formatear al perder el foco
                                        const value = e.target.value.trim();
                                        if (value !== '' && value !== '.') {
                                          const numValue = parseFloat(value);
                                          if (!isNaN(numValue)) {
                                            // Asegurar que esté entre 0 y 10
                                            const clampedValue = Math.max(0, Math.min(10, numValue));
                                            // NO truncar el valor, mantener el valor exacto ingresado por el usuario
                                            // Solo formatear para visualización si es necesario
                                            let formattedValue;
                                            if (value.includes('.')) {
                                              // Si tenía punto decimal, mantener el valor exacto (máximo 2 decimales ya validado por regex)
                                              // No usar toFixed para no truncar, mantener el valor original
                                              const parts = value.split('.');
                                              if (parts[1] && parts[1].length > 2) {
                                                // Si tiene más de 2 decimales (no debería pasar por el regex), truncar solo para visualización
                                                formattedValue = clampedValue.toFixed(2);
                                              } else {
                                                // Mantener el valor exacto ingresado (ej: 8.20 se mantiene como 8.20)
                                                formattedValue = value;
                                              }
                                            } else {
                                              // Si no tenía punto decimal, mantener como entero
                                              formattedValue = clampedValue.toString();
                                            }
                                            handleGradeChange(student.id, insumo.id, 'calificacion', formattedValue);
                                          } else if (value === '.') {
                                            // Si solo hay un punto, limpiar el campo
                                            handleGradeChange(student.id, insumo.id, 'calificacion', '');
                                          }
                                        } else if (value === '.') {
                                          // Si solo hay un punto, limpiar el campo
                                          handleGradeChange(student.id, insumo.id, 'calificacion', '');
                                        }
                                      }}
                                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-center"
                                      placeholder="0.00"
                                    />
                                    {(() => {
                                      const key = `${student.id}-${insumo.id}`;
                                      const status = savingStatus[key];
                                      if (status === 'saving') {
                                        return <div className="absolute right-1 top-1 text-xs text-blue-500">●</div>;
                                      } else if (status === 'saved') {
                                        return <div className="absolute right-1 top-1 text-xs text-green-500">✓</div>;
                                      } else if (status === 'error') {
                                        return <div className="absolute right-1 top-1 text-xs text-red-500">✗</div>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  {grade && (
                                    <button
                                      onClick={() => handleDeleteGrade(grade.id, student.id, insumo.id)}
                                      className="text-xs text-red-600 hover:text-red-900"
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={input.observaciones}
                                  onChange={(e) => handleGradeChange(student.id, insumo.id, 'observaciones', e.target.value)}
                                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs"
                                  placeholder="Comentario..."
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`text-lg font-semibold ${average >= 7 ? 'text-green-600' : average > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {average > 0 ? average.toFixed(2) : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal para importar calificaciones masivamente */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Importar Calificaciones Masivamente</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Datos a importar <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv,text/plain,text/csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input-grades"
                    />
                    <label
                      htmlFor="file-input-grades"
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                    >
                      Seleccionar Archivo
                    </label>
                  </div>
                </div>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
                  rows={15}
                  placeholder="Pegue aquí las calificaciones o seleccione un archivo..."
                />
                <div className="mt-2 text-xs text-gray-600">
                  <p><strong>Formato 1:</strong> Solo calificaciones (una línea por estudiante, separadas por tab o coma)</p>
                  <p className="mt-1">Ejemplo: <code>8.5	9.0	7.5</code> (primera línea = primer estudiante, segunda línea = segundo estudiante, etc.)</p>
                  <p className="mt-2"><strong>Formato 2:</strong> Con identificación y nombre de estudiantes</p>
                  <p className="mt-1">Ejemplo: <code>1234567890	María González	8.5	9.0	7.5</code></p>
                  <p className="mt-2"><strong>Orden de columnas:</strong></p>
                  <ul className="list-disc list-inside ml-2">
                    <li>1. Identificación</li>
                    <li>2. Estudiante</li>
                    {insumos.map((insumo, index) => (
                      <li key={insumo.id}>{index + 3}. {insumo.nombre}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setImportData('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={importing}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportGrades}
                  disabled={importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {importing ? 'Importando...' : 'Importar Calificaciones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeEntry;
