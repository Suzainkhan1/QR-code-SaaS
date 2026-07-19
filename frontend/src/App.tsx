import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

const CustomerMenu = lazy(() => import('./pages/CustomerMenu'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));
const StaffRegister = lazy(() => import('./pages/StaffRegister'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-brand-accent p-4">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-accent mb-3"></div>
    <p className="text-xs font-semibold text-zinc-400">Loading...</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Customer Scan Routing */}
          <Route path="/table/:tableNumber" element={<CustomerMenu />} />

          {/* Staff Management Routing */}
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/register" element={<StaffRegister />} />
          <Route path="/staff/dashboard" element={<StaffDashboard />} />

          {/* Fallbacks */}
          <Route path="*" element={<Navigate to="/staff/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
