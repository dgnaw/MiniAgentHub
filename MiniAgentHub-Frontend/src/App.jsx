import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import useAuthStore from './store/authStore';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Setting';
import GroupManagement from './pages/GroupManagement';
import UserManagement from './pages/UserManagement';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
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
  );
}

export default App;