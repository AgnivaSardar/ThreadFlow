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

const RoleGuard: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <RoleBasedIndexRedirect />;
  }

  return <>{children}</>;
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
        element: (
          <RoleGuard allowedRoles={['MERCHANDISER', 'ADMIN']}>
            <OrdersPage />
          </RoleGuard>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <RoleGuard allowedRoles={['MERCHANDISER', 'ADMIN']}>
            <OrderDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'risk',
        element: (
          <RoleGuard allowedRoles={['MERCHANDISER', 'ADMIN']}>
            <RiskPage />
          </RoleGuard>
        ),
      },
      {
        path: 'supervisor/my-work',
        element: (
          <RoleGuard allowedRoles={['SUPERVISOR', 'MERCHANDISER', 'ADMIN']}>
            <MyWorkPage />
          </RoleGuard>
        ),
      },
      {
        path: 'buyer-portal',
        element: (
          <RoleGuard allowedRoles={['BUYER', 'MERCHANDISER', 'ADMIN']}>
            <BuyerPortalPage />
          </RoleGuard>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RoleGuard allowedRoles={['MERCHANDISER', 'ADMIN']}>
            <OverviewPage />
          </RoleGuard>
        ),
      },
      {
        path: 'audit',
        element: (
          <RoleGuard allowedRoles={['MERCHANDISER', 'ADMIN']}>
            <AuditPage />
          </RoleGuard>
        ),
      },
      {
        path: 'reports',
        element: (
          <RoleGuard allowedRoles={['BUYER', 'MERCHANDISER', 'ADMIN']}>
            <ReportsPage />
          </RoleGuard>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <RoleBasedIndexRedirect />,
  },
]);
