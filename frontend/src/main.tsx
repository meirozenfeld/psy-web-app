// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'

const router = createBrowserRouter([
  { path: '/', element: <Home /> },       // Home
  { path: '/login', element: <Login /> }, // Login
  { path: '/signup', element: <Signup /> } // Signup
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
