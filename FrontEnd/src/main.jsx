import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import MyMapInit from './MyMap.jsx'
import Detail from "./Detail.jsx";
import Princ from "./Princ.jsx"




createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      {/*<Route path="/" element={<Princ />} />*/}
      <Route path="/" element={<MyMapInit/>} />
      <Route path="/details/:id" element={<Detail />} />
    </Routes>
  </BrowserRouter>
)
