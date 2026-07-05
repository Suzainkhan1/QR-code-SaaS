import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerMenu from './pages/CustomerMenu';
import StaffLogin from './pages/StaffLogin';
import StaffRegister from './pages/StaffRegister';
import StaffDashboard from './pages/StaffDashboard';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer Scan Routing */}
        <Route path="/table/:tableNumber" element={<CustomerMenu />} />

        {/* Staff Management Routing */}
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/staff/dashboard" element={<StaffDashboard />} />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/staff/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
