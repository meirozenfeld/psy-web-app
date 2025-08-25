import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Upload from './pages/Upload'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 flex gap-4 items-center">
          <h1 className="text-xl font-semibold">Psy App</h1>
          <nav className="flex gap-3 text-sm">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'font-semibold' : ''}>Home</NavLink>
            <NavLink to="/upload" className={({ isActive }) => isActive ? 'font-semibold' : ''}>Upload</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/', element: <AppLayout />, children: [
      { index: true, element: <Home /> },
      { path: 'upload', element: <Upload /> },
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
