import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { AppLayout } from '../components/AppLayout';
import { OrdersPage } from '../features/orders/OrdersPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { RiskPage } from '../features/risk/RiskPage';
import { MyWorkPage } from '../features/supervisor/MyWorkPage';

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
        element: <Navigate to="/orders" replace />,
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/orders" replace />,
  },
]);
