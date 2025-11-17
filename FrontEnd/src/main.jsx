import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import App from './Exemple.jsx'
import MyMap from './MyMap.jsx'
import MyMap_test from './MyMap_test.jsx'
import Detail from "./Detail.jsx";
import Princ from "./Princ.jsx"




createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Princ />} />
      <Route path="/carte" element={<MyMap_test />} />
      <Route path="/details/:id" element={<Detail />} />
    </Routes>
  </BrowserRouter>
)
