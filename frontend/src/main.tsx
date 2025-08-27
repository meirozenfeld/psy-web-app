// App entry: router setup (protected AppLayout + public routes)
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";

// Layout for protected routes (renders sidebar and <Outlet />)
import AppLayout from "./layouts/AppLayout";

// Protected pages rendered inside AppLayout via <Outlet />
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import Sessions from "./pages/Sessions";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Payments from "./pages/Payments";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ClientDetails from "./pages/ClientDetails";

// Public pages (no sidebar/layout)
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";

const router = createBrowserRouter([
  // Protected area (with sidebar via AppLayout)
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },       // "/"
      { path: "home", element: <Home /> },
      { path: "clients", element: <Clients /> },
      { path: "clients/:id", element: <ClientDetails /> },
      { path: "sessions", element: <Sessions /> },
      { path: "calendar", element: <Calendar /> },
      { path: "reports", element: <Reports /> },
      { path: "payments", element: <Payments /> },
      { path: "notes", element: <Notes /> },
      { path: "profile", element: <Profile /> },
      { path: "settings", element: <Settings /> },
    ],
  },

  // Public routes (no layout)
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/onboarding", element: <Onboarding /> },

  // Fallback
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
