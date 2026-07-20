import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import useAuthStore from './store/authStore';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Setting';
import GroupManagement from './pages/GroupManagement';
import UserManagement from './pages/UserManagement';
import SharedChat from './pages/SharedChat';
import { Toaster } from 'react-hot-toast';
import ChangePasswordModal from './components/modals/ChangePasswordModal';
import ErrorBoundary from './components/common/ErrorBoundary';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);

  return (
    <ErrorBoundary>
      <Toaster position="top-right" reverseOrder={false} />
      {isAuthenticated && mustChangePassword && <ChangePasswordModal isOpen={mustChangePassword} isForced={true} onClose={() => { }} />}
      
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route path="/shared/chat/:id" element={<SharedChat />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat/:id" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><GroupManagement /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;