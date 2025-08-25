import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold text-sky-600">Tailwind v4 עובד 🎉</h1>
      <p className="mt-2 text-slate-600">אם זה כחול וגדול — הכל תקין.</p>
    </div>
  );

}

export default App
