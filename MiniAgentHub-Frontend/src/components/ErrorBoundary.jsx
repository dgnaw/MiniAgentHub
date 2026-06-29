import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Lỗi được bắt bởi ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#131417] p-4 text-center">
          <div className="bg-white dark:bg-[#1e1f24] p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-200 dark:border-[#2a2b30] flex flex-col items-center">
            <div className="bg-red-100 dark:bg-red-500/20 text-red-500 p-4 rounded-full mb-6">
              <AlertTriangle size={48} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Đã có lỗi xảy ra!
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Thành phần giao diện này vừa gặp sự cố không mong muốn. Đừng lo lắng, dữ liệu của bạn vẫn an toàn.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-colors"
            >
              <RefreshCcw size={18} />
              Tải lại trang
            </button>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 text-left w-full bg-red-50 dark:bg-red-950/30 p-4 rounded-lg overflow-auto max-h-40">
                <p className="text-red-600 dark:text-red-400 font-mono text-xs font-semibold mb-1">Chi tiết lỗi (Chỉ hiện ở Dev):</p>
                <p className="text-red-500 dark:text-red-300 font-mono text-xs">{this.state.error.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
