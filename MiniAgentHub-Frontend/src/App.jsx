import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import useAuthStore from './store/authStore';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Setting';
import GroupManagement from './pages/GroupManagement';
import UserManagement from './pages/UserManagement';
import SharedChat from './pages/SharedChat';
import { Toaster } from 'react-hot-toast';
import ChangePasswordModal from './components/ChangePasswordModal';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);

  return (
    <>
    <Toaster position="top-right" reverseOrder={false} />
    {isAuthenticated && mustChangePassword && <ChangePasswordModal isOpen={mustChangePassword} isForced={true} onClose={() => {}} />}
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
        />

        <Route 
          path="/shared/chat/:id" 
          element={<SharedChat />} 
        />

        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <Dashboard />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/chat/:id" 
          element={
            isAuthenticated ? (
              <Dashboard />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/settings" 
          element={
            isAuthenticated ? (
              <Settings />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/groups" 
          element={
            isAuthenticated ? (
              <GroupManagement />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/users" 
          element={
            isAuthenticated ? (
              <UserManagement />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>

    </BrowserRouter>
    </>
  );
}

export default App;