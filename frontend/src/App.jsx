import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Páginas cargadas inmediatamente (críticas)
import Login from './pages/Login';
import Layout from './components/Layout';
import Profile from './pages/Profile';

// Lazy loading de páginas pesadas
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin'));
const DashboardProfesor = lazy(() => import('./pages/DashboardProfesor'));
const DashboardEstudiante = lazy(() => import('./pages/DashboardEstudiante'));
const DashboardRepresentante = lazy(() => import('./pages/DashboardRepresentante'));
const Users = lazy(() => import('./pages/Users'));
const Students = lazy(() => import('./pages/Students'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const StudentDetailRepresentante = lazy(() => import('./pages/StudentDetailRepresentante'));
const AssociateStudents = lazy(() => import('./pages/AssociateStudents'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Subjects = lazy(() => import('./pages/Subjects'));
const SubjectAssignments = lazy(() => import('./pages/SubjectAssignments'));
const Periods = lazy(() => import('./pages/Periods'));
const Grades = lazy(() => import('./pages/Grades'));
const GradeEntry = lazy(() => import('./pages/GradeEntry'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Payments = lazy(() => import('./pages/Payments'));
const InstitutionSettings = lazy(() => import('./pages/InstitutionSettings'));
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'));
const Insumos = lazy(() => import('./pages/Insumos'));
const TaskReview = lazy(() => import('./pages/TaskReview'));
const Reports = lazy(() => import('./pages/Reports'));
const Schedule = lazy(() => import('./pages/Schedule'));
const ReportCards = lazy(() => import('./pages/ReportCards'));
const HistoricalReportCards = lazy(() => import('./pages/HistoricalReportCards'));
const GradeScales = lazy(() => import('./pages/GradeScales'));
const StudentProfileTemplate = lazy(() => import('./pages/StudentProfileTemplate'));
const Supplementary = lazy(() => import('./pages/Supplementary'));
const SchoolPromotion = lazy(() => import('./pages/SchoolPromotion'));
const DatabaseBackup = lazy(() => import('./pages/DatabaseBackup'));
const MisTareas = lazy(() => import('./pages/MisTareas'));
const PermissionManagement = lazy(() => import('./pages/PermissionManagement'));
const AccessLogs = lazy(() => import('./pages/AccessLogs'));
const EmailSettings = lazy(() => import('./pages/EmailSettings'));
const EnviarMensaje = lazy(() => import('./pages/EnviarMensaje'));
const MisMensajes = lazy(() => import('./pages/MisMensajes'));
const HistorialEnvios = lazy(() => import('./pages/HistorialEnvios'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
      <p className="text-gray-600 font-medium">Cargando...</p>
    </div>
  </div>
);

// Componente que renderiza el dashboard según el rol
function DashboardByRole() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.rol) {
    case 'ADMIN':
      return <DashboardAdmin />;
    case 'PROFESOR':
      return <DashboardProfesor />;
    case 'ESTUDIANTE':
      return <DashboardEstudiante />;
    case 'REPRESENTANTE':
      return <DashboardRepresentante />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard según rol */}
            <Route path="dashboard" element={<DashboardByRole />} />
            
            {/* Rutas compartidas */}
            <Route path="profile" element={<Profile />} />
            
            {/* Rutas de administración */}
            <Route path="users" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><Users /></ProtectedRoute>} />
            <Route path="students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="students/:id" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
            <Route path="representantes/students/:studentId" element={<ProtectedRoute requiredRole={['REPRESENTANTE']}><StudentDetailRepresentante /></ProtectedRoute>} />
            <Route path="associate-students" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><AssociateStudents /></ProtectedRoute>} />
            <Route path="courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="subjects" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><Subjects /></ProtectedRoute>} />
            <Route path="assignments" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><SubjectAssignments /></ProtectedRoute>} />
            <Route path="periods" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><Periods /></ProtectedRoute>} />
            <Route path="grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
            <Route path="grade-entry" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><GradeEntry /></ProtectedRoute>} />
            <Route path="insumos" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><Insumos /></ProtectedRoute>} />
            <Route path="insumos/:insumoId/entregas" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><TaskReview /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><Reports /></ProtectedRoute>} />
            <Route path="report-cards" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><ReportCards /></ProtectedRoute>} />
            <Route path="historical-report-cards" element={<ProtectedRoute><HistoricalReportCards /></ProtectedRoute>} />
            <Route path="grade-scales" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><GradeScales /></ProtectedRoute>} />
            <Route path="supplementary" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><Supplementary /></ProtectedRoute>} />
            <Route path="school-promotion" element={<ProtectedRoute requiredRole={['ADMIN']}><SchoolPromotion /></ProtectedRoute>} />
            <Route path="database-backup" element={<ProtectedRoute requiredRole={['ADMIN']}><DatabaseBackup /></ProtectedRoute>} />
            <Route path="student-profile-template" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><StudentProfileTemplate /></ProtectedRoute>} />
            <Route path="attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="mis-tareas" element={<ProtectedRoute requiredRole={['ESTUDIANTE']}><MisTareas /></ProtectedRoute>} />
            <Route path="general-settings" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><GeneralSettings /></ProtectedRoute>} />
            <Route path="institution-settings" element={<ProtectedRoute requiredRole={['ADMIN']}><InstitutionSettings /></ProtectedRoute>} />
            <Route path="email-settings" element={<ProtectedRoute requiredRole={['ADMIN']}><EmailSettings /></ProtectedRoute>} />
            <Route path="permission-management" element={<ProtectedRoute requiredRole={['ADMIN']}><PermissionManagement /></ProtectedRoute>} />
            <Route path="access-logs" element={<ProtectedRoute requiredRole={['ADMIN']}><AccessLogs /></ProtectedRoute>} />
            
            {/* Rutas de Mensajería */}
            <Route path="mensajes" element={<ProtectedRoute><MisMensajes /></ProtectedRoute>} />
            <Route path="mensajes/enviar" element={<ProtectedRoute requiredRole={['ADMIN', 'PROFESOR', 'SECRETARIA']}><EnviarMensaje /></ProtectedRoute>} />
            <Route path="mensajes/historial" element={<ProtectedRoute requiredRole={['ADMIN', 'PROFESOR', 'SECRETARIA']}><HistorialEnvios /></ProtectedRoute>} />
            </Route>
          </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
