import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardProfesor from './pages/DashboardProfesor';
import DashboardEstudiante from './pages/DashboardEstudiante';
import DashboardRepresentante from './pages/DashboardRepresentante';
import Layout from './components/Layout';
import Users from './pages/Users';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Subjects from './pages/Subjects';
import SubjectAssignments from './pages/SubjectAssignments';
import Periods from './pages/Periods';
import Grades from './pages/Grades';
import GradeEntry from './pages/GradeEntry';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Profile from './pages/Profile';
import InstitutionSettings from './pages/InstitutionSettings';
import GeneralSettings from './pages/GeneralSettings';
import Insumos from './pages/Insumos';
import Reports from './pages/Reports';
import Schedule from './pages/Schedule';
import ReportCards from './pages/ReportCards';
import GradeScales from './pages/GradeScales';
import StudentProfileTemplate from './pages/StudentProfileTemplate';

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
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
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
            <Route path="courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="subjects" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><Subjects /></ProtectedRoute>} />
            <Route path="assignments" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><SubjectAssignments /></ProtectedRoute>} />
            <Route path="periods" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><Periods /></ProtectedRoute>} />
            <Route path="grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
            <Route path="grade-entry" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><GradeEntry /></ProtectedRoute>} />
            <Route path="insumos" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><Insumos /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><Reports /></ProtectedRoute>} />
            <Route path="report-cards" element={<ProtectedRoute requiredRole={['PROFESOR', 'ADMIN', 'SECRETARIA']}><ReportCards /></ProtectedRoute>} />
            <Route path="grade-scales" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><GradeScales /></ProtectedRoute>} />
            <Route path="student-profile-template" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><StudentProfileTemplate /></ProtectedRoute>} />
            <Route path="attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="general-settings" element={<ProtectedRoute requiredRole={['ADMIN', 'SECRETARIA']}><GeneralSettings /></ProtectedRoute>} />
            <Route path="institution-settings" element={<ProtectedRoute requiredRole={['ADMIN']}><InstitutionSettings /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
