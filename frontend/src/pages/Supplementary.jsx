import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Supplementary = () => {
  const { selectedInstitutionId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [supplementaryPeriods, setSupplementaryPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState(null);

  useEffect(() => {
    if (selectedInstitutionId) {
      fetchSchoolYears();
      fetchSupplementaryPeriods();
    }
  }, [selectedInstitutionId]);

  useEffect(() => {
    if (selectedSchoolYear) {
      fetchSupplementaryPeriods();
    }
  }, [selectedSchoolYear]);

  useEffect(() => {
    if (selectedPeriod && selectedSchoolYear) {
      fetchSubjects();
      setSelectedSubject(null);
      setEligibleStudents([]);
    }
  }, [selectedPeriod, selectedSchoolYear]);

  useEffect(() => {
    if (selectedPeriod && selectedSubject && selectedSchoolYear) {
      fetchEligibleStudents();
    } else {
      setEligibleStudents([]);
    }
  }, [selectedPeriod, selectedSubject, selectedSchoolYear]);

  const fetchSchoolYears = async () => {
    try {
      const response = await api.get('/school-years');
      const years = response.data.data || [];
      setSchoolYears(years);
      
      // Seleccionar automáticamente el año activo
      const activeYear = years.find(y => y.activo);
      if (activeYear) {
        setSelectedSchoolYear(activeYear.id);
      }
    } catch (error) {
      console.error('Error al cargar años lectivos:', error);
      toast.error('Error al cargar años lectivos');
    }
  };

  const fetchSupplementaryPeriods = async () => {
    try {
      setLoading(true);
      let url = '/periods?esSupletorio=true&activo=true';
      
      if (selectedSchoolYear) {
        url += `&anioLectivoId=${selectedSchoolYear}`;
      }
      
      const response = await api.get(url);
      const periods = response.data.data || [];
      
      if (selectedSchoolYear) {
        // Filtrar por año lectivo también
        const filteredPeriods = periods.filter(p => p.anioLectivoId === selectedSchoolYear);
        setSupplementaryPeriods(filteredPeriods);
        
        if (filteredPeriods.length > 0 && !selectedPeriod) {
          setSelectedPeriod(filteredPeriods[0].id);
        }
      } else {
        setSupplementaryPeriods(periods);
        if (periods.length > 0 && !selectedPeriod) {
          setSelectedPeriod(periods[0].id);
        }
      }
    } catch (error) {
      console.error('Error al cargar períodos supletorios:', error);
      toast.error('Error al cargar períodos supletorios');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedPeriod || !selectedSchoolYear) return;

    try {
      const period = supplementaryPeriods.find(p => p.id === selectedPeriod);
      if (!period?.anioLectivoId) return;

      const response = await api.get(`/subjects?anioLectivoId=${selectedSchoolYear}`);
      const subjectsList = response.data.data || [];
      setSubjects(subjectsList);
    } catch (error) {
      console.error('Error al cargar materias:', error);
      toast.error('Error al cargar materias');
    }
  };

  const fetchEligibleStudents = async () => {
    if (!selectedPeriod || !selectedSubject || !selectedSchoolYear) return;

    try {
      setLoadingStudents(true);
      const response = await api.get(
        `/supplementary/eligible-students?materiaId=${selectedSubject}&anioLectivoId=${selectedSchoolYear}&periodoId=${selectedPeriod}`
      );
      
      const students = response.data.data || [];
      setEligibleStudents(students);
      
      if (students.length === 0) {
        toast('No hay estudiantes elegibles para supletorio en esta materia');
      }
    } catch (error) {
      console.error('Error al cargar estudiantes elegibles:', error);
      toast.error('Error al cargar estudiantes elegibles');
      setEligibleStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleGoToGradeEntry = () => {
    if (selectedPeriod && selectedSubject) {
      // Navegar a la página de ingreso de calificaciones con los parámetros
      navigate(`/grade-entry?periodId=${selectedPeriod}&subjectId=${selectedSubject}`);
    }
  };

  const selectedPeriodData = supplementaryPeriods.find(p => p.id === selectedPeriod);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Estudiantes en Supletorio</h1>
        <p className="mt-2 text-sm text-gray-600">
          Visualiza y gestiona los estudiantes elegibles para períodos supletorios
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Año Lectivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Año Lectivo
            </label>
            <select
              value={selectedSchoolYear || ''}
              onChange={(e) => {
                setSelectedSchoolYear(e.target.value);
                setSelectedPeriod(null);
                setSelectedSubject(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Seleccionar año lectivo</option>
              {schoolYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.nombre} {year.activo && '(Activo)'}
                </option>
              ))}
            </select>
          </div>

          {/* Período Supletorio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Supletorio
            </label>
            <select
              value={selectedPeriod || ''}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setSelectedSubject(null);
              }}
              disabled={!selectedSchoolYear || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            >
              <option value="">Seleccionar período</option>
              {supplementaryPeriods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nombre} - {period.anioEscolar}
                </option>
              ))}
            </select>
          </div>

          {/* Materia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materia
            </label>
            <select
              value={selectedSubject || ''}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedPeriod || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            >
              <option value="">Seleccionar materia</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre} ({subject.codigo})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón para ir a ingresar calificaciones */}
        {selectedPeriod && selectedSubject && (
          <div className="mt-4">
            <button
              onClick={handleGoToGradeEntry}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Ingresar Calificaciones de Supletorio
            </button>
          </div>
        )}
      </div>

      {/* Lista de estudiantes elegibles */}
      {loadingStudents ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Cargando estudiantes elegibles...</p>
        </div>
      ) : eligibleStudents.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Estudiantes Elegibles ({eligibleStudents.length})
              </h2>
              {selectedPeriodData && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
                  {selectedPeriodData.nombre}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estudiante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promedio General
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promedio Mínimo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Períodos Bajos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {eligibleStudents.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.estudiante.apellido} {item.estudiante.nombre}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.estudiante.numeroIdentificacion}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.curso.nombre}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.curso.nivel} {item.curso.paralelo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${
                        item.promedioGeneral < (item.promedioMinimoPromedio || 7.0)
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {item.promedioGeneral.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.promedioMinimoPromedio || 7.0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {item.periodosBajos && item.periodosBajos.length > 0 ? (
                          <div className="space-y-1">
                            {item.periodosBajos.map((periodo, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800">
                                  {periodo.periodoNombre}: {periodo.promedio.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedPeriod && selectedSubject ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">No hay estudiantes elegibles para supletorio en esta materia.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">Selecciona un período supletorio y una materia para ver los estudiantes elegibles.</p>
        </div>
      )}
    </div>
  );
};

export default Supplementary;

