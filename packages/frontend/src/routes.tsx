import { lazy, Suspense } from 'react'
import { createRoutesFromElements, Route } from 'react-router-dom'

import Layout from '@/components/Layout'
import PublicLayout from '@/components/PublicLayout'
import * as URLS from '@/config/urls'
import Application from '@/pages/Application'
import Applications from '@/pages/Applications'
import EditorRoutes from '@/pages/Editor/routes'
import Execution from '@/pages/Execution'
import Executions from '@/pages/Executions'
import Flow from '@/pages/Flow'
import Flows from '@/pages/Flows'
import Login from '@/pages/Login'
import SgidCallback from '@/pages/SgidCallback'
import TileLayout from '@/pages/Tile/layouts/TileLayout'
import Tiles from '@/pages/Tiles'
import Transfers from '@/pages/Transfers'
import TransfersLayout from '@/pages/Transfers/layouts/TransfersLayout'
import UnauthorizedTile from '@/pages/UnauthorizedTile'

const Landing = lazy(() => import('@/pages/Landing'))
const Tile = lazy(() => import('@/pages/Tile'))

export default createRoutesFromElements(
  <Route path="/">
    <Route
      path={URLS.LOGIN_SGID_REDIRECT}
      element={
        <PublicLayout>
          <SgidCallback />
        </PublicLayout>
      }
    />

    <Route
      path={URLS.EXECUTIONS}
      element={
        <Layout>
          <Executions />
        </Layout>
      }
    />

    <Route
      path={URLS.EXECUTION_PATTERN}
      element={
        <Layout>
          <Execution />
        </Layout>
      }
    />

    <Route
      path={URLS.FLOWS}
      element={
        <Layout>
          <Flows />
        </Layout>
      }
    />

    <Route
      path={URLS.FLOW_PATTERN}
      element={
        <Layout>
          <Flow />
        </Layout>
      }
    />

    <Route
      path={`${URLS.APPS}/*`}
      element={
        <Layout>
          <Applications />
        </Layout>
      }
    />

    <Route
      path={`${URLS.APP_PATTERN}/*`}
      element={
        <Layout>
          <Application />
        </Layout>
      }
    />

    <Route path={`${URLS.EDITOR}/*`} element={<EditorRoutes />} />

    <Route
      path={URLS.TILES}
      element={
        <Layout>
          <Tiles />
        </Layout>
      }
    />

    <Route path={URLS.UNAUTHORIZED_TILE} element={<UnauthorizedTile />} />

    <Route
      path={URLS.TILE_PATTERN}
      element={
        <TileLayout>
          <Tile />
        </TileLayout>
      }
    />

    <Route
      path={URLS.PUBLIC_TILE_PATTERN}
      element={
        <TileLayout publicLayout>
          <Tile />
        </TileLayout>
      }
    />

    <Route
      path={URLS.TRANSFERS}
      element={
        <TransfersLayout>
          <Transfers />
        </TransfersLayout>
      }
    />

    <Route
      path={URLS.LOGIN}
      element={
        <PublicLayout>
          <Login />
        </PublicLayout>
      }
    />

    <Route
      index
      element={
        <PublicLayout>
          <Suspense fallback={<></>}>
            <Landing />
          </Suspense>
        </PublicLayout>
      }
    />

    <Route
      element={
        <Layout>
          <div>404</div>
        </Layout>
      }
    />
  </Route>,
)
