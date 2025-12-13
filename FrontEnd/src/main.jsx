import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import MyMapInit from './MyMap.jsx'
import Detail from "./Detail.jsx";




createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MyMapInit/>} />
      <Route path="/details/:id" element={<Detail />} />
    </Routes>
  </BrowserRouter>
)
