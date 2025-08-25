// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding' // אם יש לך

const Placeholder = ({ title }: { title: string }) => (
  <div className="min-h-screen w-full bg-[radial-gradient(40rem_40rem_at_120%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(30rem_30rem_at_-10%_120%,rgba(99,102,241,0.10),transparent)] bg-slate-50 flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Coming soon…</p>
      <Link to="/" className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
        Back to Home
      </Link>
    </div>
  </div>
)

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/onboarding', element: <Onboarding /> }, 

  // Placeholder routes
  { path: '/clients', element: <Placeholder title="Clients" /> },
  { path: '/sessions', element: <Placeholder title="Sessions" /> },
  { path: '/calendar', element: <Placeholder title="Calendar" /> },
  { path: '/reports', element: <Placeholder title="Reports & Insights" /> },
  { path: '/payments', element: <Placeholder title="Payments" /> },
  { path: '/notes', element: <Placeholder title="Notes" /> },
  { path: '/profile', element: <Placeholder title="My Profile" /> },
  { path: '/settings', element: <Placeholder title="Settings" /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
