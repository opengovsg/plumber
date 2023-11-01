import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

const Tile = lazy(() => import('pages/Tile'))
const Tiles = lazy(() => import('pages/Tiles'))

const TilesRoutes = () => (
  <Routes>
    <Route index element={<Tiles />} />
    <Route path="/:tableId" element={<Tile />} />
  </Routes>
)

export default TilesRoutes
