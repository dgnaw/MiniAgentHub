import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import useAuthStore from './store/authStore';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Setting';

function App() {
  // Lấy trạng thái đăng nhập từ Zustand
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        {/* Route cho trang Đăng nhập */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
        />

        {/* Route cho trang Dashboard (Trang chủ) */}
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

        {/* Route để load lịch sử cuộc trò chuyện cũ */}
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

        {/* Route cho trang Cài đặt (Settings) */}
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;