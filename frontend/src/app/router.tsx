import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { AppLayout } from '../components/AppLayout';
import { OrdersPage } from '../features/orders/OrdersPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { RiskPage } from '../features/risk/RiskPage';
import { MyWorkPage } from '../features/supervisor/MyWorkPage';
import { BuyerPortalPage } from '../features/buyer/BuyerPortalPage';
import { OverviewPage } from '../features/dashboard/OverviewPage';
import { AuditPage } from '../features/audit/AuditPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { useAuthStore } from '../features/auth/authStore';

const RoleBasedIndexRedirect: React.FC = () => {
  const { user } = useAuthStore();
  if (user?.role === 'BUYER') {
    return <Navigate to="/buyer-portal" replace />;
  }
  if (user?.role === 'SUPERVISOR') {
    return <Navigate to="/supervisor/my-work" replace />;
  }
  return <Navigate to="/orders" replace />;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <RoleBasedIndexRedirect />,
      },
      {
        path: 'orders',
        element: <OrdersPage />,
      },
      {
        path: 'orders/:id',
        element: <OrderDetailPage />,
      },
      {
        path: 'risk',
        element: <RiskPage />,
      },
      {
        path: 'supervisor/my-work',
        element: <MyWorkPage />,
      },
      {
        path: 'buyer-portal',
        element: <BuyerPortalPage />,
      },
      {
        path: 'dashboard',
        element: <OverviewPage />,
      },
      {
        path: 'audit',
        element: <AuditPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <RoleBasedIndexRedirect />,
  },
]);
