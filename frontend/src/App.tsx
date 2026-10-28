import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';

// cada área vira um pedaço de JavaScript separado: quem é investidor não baixa o admin, e vice-versa
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const admin = () => import('./pages/admin');
const AdminLayout = lazy(() => admin().then((m) => ({ default: m.AdminLayout })));
const ClientsPage = lazy(() => admin().then((m) => ({ default: m.ClientsPage })));
const DashboardPage = lazy(() => admin().then((m) => ({ default: m.DashboardPage })));
const EventosPage = lazy(() => admin().then((m) => ({ default: m.EventosPage })));
const ReturnsPage = lazy(() => admin().then((m) => ({ default: m.ReturnsPage })));
const MensagensPage = lazy(() => admin().then((m) => ({ default: m.MensagensPage })));
const AportesPage = lazy(() => admin().then((m) => ({ default: m.AportesPage })));
const RepassesPage = lazy(() => admin().then((m) => ({ default: m.RepassesPage })));
import ProtectedRoute from './components/ProtectedRoute';
import { clearSession } from './utils/api';
import { usePressao } from './hooks/usePressao';

function App() {
  // botões afundam no pointerdown, com mola, no site inteiro
  usePressao();

  const handleLogout = () => {
    clearSession();
    // reload completo no logout: zera todo o estado do React
    window.location.replace('/login');
  };

  return (
    <BrowserRouter>
      {/* enquanto um pedaço carrega: só o fundo do site, sem spinner piscando */}
      <Suspense fallback={<div className="min-h-[100svh] bg-ip-bg" />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard-cliente"
          element={
            <ProtectedRoute allowedRole="user">
              <ClientDashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="rendimentos" element={<ReturnsPage />} />
          <Route path="repasses" element={<RepassesPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="mensagens" element={<MensagensPage />} />
          <Route path="aportes" element={<AportesPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;