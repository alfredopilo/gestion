import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── Iconos inline ────────────────────────────────────────────────── */
const IconUserX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h11M18 8l4 4m0-4l-4 4" />
  </svg>
);

const IconClock = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconDocument = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const IconBell = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

/* ─── Definición de pestañas ─────────────────────────────────────── */
const TABS = [
  { id: 'sin-asistencia', label: 'Sin Asistencia',    icon: <IconUserX />,   color: 'red'   },
  { id: 'horas-faltantes', label: 'Horas Faltantes',  icon: <IconClock />,   color: 'amber' },
  { id: 'reporte-completo', label: 'Reporte Completo', icon: <IconDocument />, color: 'blue' },
];

const TAB_STYLES = {
  red: {
    active:   'border-red-500 text-red-700 bg-red-50',
    inactive: 'border-transparent text-gray-500 hover:text-red-600 hover:border-red-300',
    badge:    'bg-red-100 text-red-700',
    row:      'bg-red-50/60 hover:bg-red-100/40',
    header:   'bg-gradient-to-r from-red-50 to-rose-50 border-red-100',
    exportBtn:'bg-slate-700 hover:bg-slate-800 text-white',
    notifyBtn:'bg-red-600 hover:bg-red-700 text-white',
    kpi:      'border-red-400',
  },
  amber: {
    active:   'border-amber-500 text-amber-700 bg-amber-50',
    inactive: 'border-transparent text-gray-500 hover:text-amber-600 hover:border-amber-300',
    badge:    'bg-amber-100 text-amber-700',
    row:      'bg-amber-50/60 hover:bg-amber-100/40',
    header:   'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-100',
    exportBtn:'bg-slate-700 hover:bg-slate-800 text-white',
    notifyBtn:'bg-amber-600 hover:bg-amber-700 text-white',
    kpi:      'border-amber-400',
  },
  blue: {
    active:   'border-primary-500 text-primary-700 bg-primary-50',
    inactive: 'border-transparent text-gray-500 hover:text-primary-600 hover:border-primary-300',
    badge:    'bg-primary-100 text-primary-700',
    row:      'hover:bg-primary-50/30',
    header:   'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-100',
    exportBtn:'bg-slate-700 hover:bg-slate-800 text-white',
    notifyBtn:'bg-primary-600 hover:bg-primary-700 text-white',
    kpi:      'border-primary-400',
  },
};

/* ─── Componente principal ───────────────────────────────────────── */
const Inspection = () => {
  const [courses, setCourses]       = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [notifying, setNotifying]   = useState(false);
  const [activeTab, setActiveTab]   = useState('sin-asistencia');
  const [mode, setMode]             = useState('day');
  const [fecha, setFecha]           = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaDesde, setFechaDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [cursoId, setCursoId]       = useState('');

  useEffect(() => {
    api.get('/courses?limit=200')
      .then((res) => setCourses(res.data.data || []))
      .catch(() => toast.error('Error al cargar cursos'));
  }, []);

  /* ── Construir query params ─────────────────────────── */
  const buildParams = () => {
    const params = new URLSearchParams();
    if (mode === 'day') params.set('fecha', fecha);
    else {
      params.set('fechaDesde', fechaDesde);
      params.set('fechaHasta', fechaHasta);
    }
    if (cursoId) params.set('cursoId', cursoId);
    return params;
  };

  /* ── Generar reporte ────────────────────────────────── */
  const fetchReport = async () => {
    if (mode === 'day' && !fecha) return toast.error('Seleccione una fecha');
    if (mode === 'range' && (!fechaDesde || !fechaHasta)) return toast.error('Seleccione rango de fechas');
    if (mode === 'range' && fechaDesde > fechaHasta) return toast.error('La fecha inicial debe ser anterior a la final');
    try {
      setLoading(true);
      const res = await api.get(`/reports/inspection?${buildParams()}`);
      setReportData(res.data);
      // Activar la primera pestaña con datos
      if (res.data.alertasSinAsistencia?.length) setActiveTab('sin-asistencia');
      else if (res.data.alertasHorasFaltantes?.length) setActiveTab('horas-faltantes');
      else setActiveTab('reporte-completo');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar reporte');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  /* ── Notificar a padres ─────────────────────────────── */
  const handleNotify = async () => {
    const sinA = reportData?.resumen?.totalAlertasSinAsistencia || 0;
    const horas = reportData?.resumen?.totalAlertasHorasFaltantes || 0;
    if (!reportData || (sinA === 0 && horas === 0)) return toast.error('No hay alertas para notificar');
    try {
      setNotifying(true);
      const res = await api.post(`/reports/inspection/notify?${buildParams()}`);
      toast.success(
        `Notificaciones enviadas: ${res.data.notificationsCreated || 0} notif., ${res.data.emailsSent || 0} emails`
      );
      if (res.data.errors?.length) toast.error(`Algunos envíos fallaron: ${res.data.errors.length}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar notificaciones');
    } finally {
      setNotifying(false);
    }
  };

  /* ── Exportar PDF de una pestaña ────────────────────── */
  const exportTabToPDF = (tabId) => {
    if (!reportData) return toast.error('Genere el reporte primero');
    try {
      const doc  = new jsPDF('landscape', 'mm', 'a4');
      const subtitle = mode === 'day' ? `Fecha: ${fecha}` : `Rango: ${fechaDesde} — ${fechaHasta}`;
      const cursNombre = cursoId ? (courses.find(c => c.id === cursoId)?.nombre || cursoId) : 'Todos';

      const addHeader = (title) => {
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text('Reporte de Inspección — ' + title, 14, 14);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, 14, 20);
        doc.text(`Curso: ${cursNombre}`, 14, 25);
      };

      if (tabId === 'sin-asistencia') {
        addHeader('Sin Asistencia Todo el Día');
        autoTable(doc, {
          head: [['Fecha', 'Curso', 'Estudiante', 'Identificación']],
          body: (reportData.alertasSinAsistencia || []).map(a => [
            a.fecha, a.cursoNombre, a.estudianteNombre, a.numeroIdentificacion || '—'
          ]),
          startY: 30,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [239, 68, 68] },
          alternateRowStyles: { fillColor: [255, 241, 242] },
        });
        doc.save(`inspeccion_sin_asistencia_${fecha || fechaHasta}.pdf`);

      } else if (tabId === 'horas-faltantes') {
        addHeader('Horas Faltantes');
        autoTable(doc, {
          head: [['Fecha', 'Curso', 'Estudiante', 'Hrs. Esperadas', 'Registradas', 'Faltantes']],
          body: (reportData.alertasHorasFaltantes || []).map(a => [
            a.fecha, a.cursoNombre, a.estudianteNombre, a.horasEsperadas, a.horasRegistradas, a.horasFaltantes
          ]),
          startY: 30,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [245, 158, 11] },
          alternateRowStyles: { fillColor: [255, 251, 235] },
        });
        doc.save(`inspeccion_horas_faltantes_${fecha || fechaHasta}.pdf`);

      } else {
        // Reporte completo
        addHeader('Reporte Completo');
        let y = 30;
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`Total estudiantes: ${reportData.resumen?.totalEstudiantes ?? 0}   |   Sin asistencia: ${reportData.resumen?.totalAlertasSinAsistencia ?? 0}   |   Horas faltantes: ${reportData.resumen?.totalAlertasHorasFaltantes ?? 0}`, 14, y);
        y += 8;

        if (reportData.alertasSinAsistencia?.length) {
          doc.setFontSize(10);
          doc.setTextColor(220, 38, 38);
          doc.text('Sin Asistencia Todo el Día', 14, y);
          y += 4;
          autoTable(doc, {
            head: [['Fecha', 'Curso', 'Estudiante', 'Identificación']],
            body: reportData.alertasSinAsistencia.map(a => [
              a.fecha, a.cursoNombre, a.estudianteNombre, a.numeroIdentificacion || '—'
            ]),
            startY: y,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [239, 68, 68] },
            alternateRowStyles: { fillColor: [255, 241, 242] },
          });
          y = doc.lastAutoTable.finalY + 10;
        }

        if (reportData.alertasHorasFaltantes?.length && y < 180) {
          doc.setFontSize(10);
          doc.setTextColor(180, 83, 9);
          doc.text('Horas Faltantes', 14, y);
          y += 4;
          autoTable(doc, {
            head: [['Fecha', 'Curso', 'Estudiante', 'Hrs. Esperadas', 'Registradas', 'Faltantes']],
            body: reportData.alertasHorasFaltantes.map(a => [
              a.fecha, a.cursoNombre, a.estudianteNombre, a.horasEsperadas, a.horasRegistradas, a.horasFaltantes
            ]),
            startY: y,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [245, 158, 11] },
            alternateRowStyles: { fillColor: [255, 251, 235] },
          });
        }
        doc.save(`inspeccion_reporte_completo_${fecha || fechaHasta}.pdf`);
      }

      toast.success('Reporte exportado a PDF');
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar PDF');
    }
  };

  /* ── Contadores por pestaña ─────────────────────────── */
  const tabCount = {
    'sin-asistencia':  reportData?.alertasSinAsistencia?.length  ?? 0,
    'horas-faltantes': reportData?.alertasHorasFaltantes?.length ?? 0,
    'reporte-completo': (reportData?.alertasSinAsistencia?.length ?? 0) + (reportData?.alertasHorasFaltantes?.length ?? 0),
  };

  const hasAlerts = reportData &&
    ((reportData.resumen?.totalAlertasSinAsistencia || 0) > 0 ||
     (reportData.resumen?.totalAlertasHorasFaltantes || 0) > 0);

  /* ── Botones de acción (por pestaña) ────────────────── */
  const TabActions = ({ tabId }) => {
    const tab   = TABS.find(t => t.id === tabId);
    const st    = TAB_STYLES[tab.color];
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => exportTabToPDF(tabId)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] ${st.exportBtn}`}
        >
          <IconDownload />
          Exportar PDF
        </button>
        <button
          onClick={handleNotify}
          disabled={notifying || !hasAlerts}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${st.notifyBtn}`}
        >
          <IconBell />
          {notifying ? 'Enviando...' : 'Notificar padres'}
        </button>
      </div>
    );
  };

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="p-6 space-y-6">

      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Módulo de Inspección</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitoreo y alertas de asistencia estudiantil</p>
      </div>

      {/* Panel de filtros */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Filtros de búsqueda</h2>
        </div>
        <div className="card-body space-y-4">
          {/* Modo */}
          <div className="flex gap-6">
            {[['day', 'Por día'], ['range', 'Por rango de fechas']].map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === val}
                  onChange={() => setMode(val)}
                  className="text-primary-600 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">{lbl}</span>
              </label>
            ))}
          </div>

          {/* Campos de fecha + curso + botón */}
          <div className="flex flex-wrap gap-4 items-end">
            {mode === 'day' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input-field w-auto"
                />
              </div>
            )}
            {mode === 'range' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="input-field w-auto"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="input-field w-auto"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Curso</label>
              <select
                value={cursoId}
                onChange={(e) => setCursoId(e.target.value)}
                className="input-field min-w-[200px]"
              >
                <option value="">Todos los cursos</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.nivel?.nombreNivel ? ` (${c.nivel.nombreNivel})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generando...
                </span>
              ) : 'Generar reporte'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {reportData && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 border-l-4 border-blue-400">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total estudiantes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {reportData.indicadores?.totalEstudiantes ?? reportData.resumen?.totalEstudiantes ?? 0}
              </p>
              {reportData.indicadores?.totalDias && (
                <p className="text-xs text-gray-400 mt-0.5">{reportData.indicadores.totalDias} día(s) evaluado(s)</p>
              )}
            </div>
            <div className="card p-5 border-l-4 border-red-400">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sin asistencia</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {reportData.resumen?.totalAlertasSinAsistencia ?? 0}
              </p>
              {reportData.indicadores?.porcentajeSinAsistencia != null && (
                <p className="text-xs text-gray-400 mt-0.5">{reportData.indicadores.porcentajeSinAsistencia}% del total</p>
              )}
            </div>
            <div className="card p-5 border-l-4 border-amber-400">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horas faltantes</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">
                {reportData.resumen?.totalAlertasHorasFaltantes ?? 0}
              </p>
              {reportData.indicadores?.porcentajeConHorasFaltantes != null && (
                <p className="text-xs text-gray-400 mt-0.5">{reportData.indicadores.porcentajeConHorasFaltantes}% del total</p>
              )}
            </div>
          </div>

          {/* Pestañas */}
          <div className="card overflow-visible">
            {/* Barra de pestañas */}
            <div className="border-b border-gray-200 bg-white rounded-t-xl">
              <nav className="flex overflow-x-auto" aria-label="Pestañas">
                {TABS.map((tab) => {
                  const st      = TAB_STYLES[tab.color];
                  const isActive = activeTab === tab.id;
                  const count   = tabCount[tab.id];
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-medium
                        border-b-2 transition-all duration-150 focus:outline-none whitespace-nowrap
                        ${isActive ? st.active : st.inactive}
                      `}
                    >
                      {tab.icon}
                      {tab.label}
                      {count > 0 && (
                        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${st.badge}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Panel: Sin Asistencia */}
            {activeTab === 'sin-asistencia' && (
              <div>
                <div className={`flex items-center justify-between px-5 py-3 border-b ${TAB_STYLES.red.header}`}>
                  <div>
                    <h3 className="font-semibold text-gray-800">Estudiantes sin asistencia todo el día</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{tabCount['sin-asistencia']} registro(s) encontrado(s)</p>
                  </div>
                  <TabActions tabId="sin-asistencia" />
                </div>
                {reportData.alertasSinAsistencia?.length > 0 ? (
                  <div className="table-container rounded-none border-0">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Curso</th>
                          <th>Estudiante</th>
                          <th>Identificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.alertasSinAsistencia.map((a, i) => (
                          <tr key={`sin-${i}`} className={TAB_STYLES.red.row}>
                            <td>{a.fecha}</td>
                            <td>{a.cursoNombre}</td>
                            <td className="font-medium">{a.estudianteNombre}</td>
                            <td className="text-gray-500">{a.numeroIdentificacion || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="empty-state-title text-green-700">Sin alertas</p>
                    <p className="empty-state-description">No hay estudiantes sin asistencia en el período seleccionado.</p>
                  </div>
                )}
              </div>
            )}

            {/* Panel: Horas Faltantes */}
            {activeTab === 'horas-faltantes' && (
              <div>
                <div className={`flex items-center justify-between px-5 py-3 border-b ${TAB_STYLES.amber.header}`}>
                  <div>
                    <h3 className="font-semibold text-gray-800">Estudiantes con horas faltantes</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{tabCount['horas-faltantes']} registro(s) encontrado(s)</p>
                  </div>
                  <TabActions tabId="horas-faltantes" />
                </div>
                {reportData.alertasHorasFaltantes?.length > 0 ? (
                  <div className="table-container rounded-none border-0">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Curso</th>
                          <th>Estudiante</th>
                          <th className="text-center">Hrs. Esperadas</th>
                          <th className="text-center">Registradas</th>
                          <th className="text-center">Faltantes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.alertasHorasFaltantes.map((a, i) => (
                          <tr key={`horas-${i}`} className={TAB_STYLES.amber.row}>
                            <td>{a.fecha}</td>
                            <td>{a.cursoNombre}</td>
                            <td className="font-medium">{a.estudianteNombre}</td>
                            <td className="text-center">{a.horasEsperadas}</td>
                            <td className="text-center">{a.horasRegistradas}</td>
                            <td className="text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                                {a.horasFaltantes}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="empty-state-title text-green-700">Sin alertas</p>
                    <p className="empty-state-description">No hay horas faltantes registradas en el período seleccionado.</p>
                  </div>
                )}
              </div>
            )}

            {/* Panel: Reporte Completo */}
            {activeTab === 'reporte-completo' && (
              <div>
                <div className={`flex items-center justify-between px-5 py-3 border-b ${TAB_STYLES.blue.header}`}>
                  <div>
                    <h3 className="font-semibold text-gray-800">Reporte completo de alertas</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Vista consolidada de todas las alertas</p>
                  </div>
                  <TabActions tabId="reporte-completo" />
                </div>

                {!hasAlerts ? (
                  <div className="empty-state">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="empty-state-title text-green-700">Sin alertas</p>
                    <p className="empty-state-description">No hay alertas para el período seleccionado. ¡Todo en orden!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {/* Sección Sin Asistencia */}
                    {reportData.alertasSinAsistencia?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-100">
                          <IconUserX />
                          <span className="text-sm font-semibold text-red-700">Sin Asistencia Todo el Día</span>
                          <span className="ml-auto text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {reportData.alertasSinAsistencia.length}
                          </span>
                        </div>
                        <div className="table-container rounded-none border-0">
                          <table className="modern-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Curso</th>
                                <th>Estudiante</th>
                                <th>Identificación</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.alertasSinAsistencia.map((a, i) => (
                                <tr key={`r-sin-${i}`} className={TAB_STYLES.red.row}>
                                  <td>{a.fecha}</td>
                                  <td>{a.cursoNombre}</td>
                                  <td className="font-medium">{a.estudianteNombre}</td>
                                  <td className="text-gray-500">{a.numeroIdentificacion || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Sección Horas Faltantes */}
                    {reportData.alertasHorasFaltantes?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100">
                          <IconClock />
                          <span className="text-sm font-semibold text-amber-700">Horas Faltantes</span>
                          <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {reportData.alertasHorasFaltantes.length}
                          </span>
                        </div>
                        <div className="table-container rounded-none border-0">
                          <table className="modern-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Curso</th>
                                <th>Estudiante</th>
                                <th className="text-center">Hrs. Esperadas</th>
                                <th className="text-center">Registradas</th>
                                <th className="text-center">Faltantes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.alertasHorasFaltantes.map((a, i) => (
                                <tr key={`r-horas-${i}`} className={TAB_STYLES.amber.row}>
                                  <td>{a.fecha}</td>
                                  <td>{a.cursoNombre}</td>
                                  <td className="font-medium">{a.estudianteNombre}</td>
                                  <td className="text-center">{a.horasEsperadas}</td>
                                  <td className="text-center">{a.horasRegistradas}</td>
                                  <td className="text-center">
                                    <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                                      {a.horasFaltantes}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Inspection;
