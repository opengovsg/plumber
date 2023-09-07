import { lazy, Suspense } from 'react'
import { createRoutesFromElements, Route } from 'react-router-dom'
import Layout from 'components/Layout'
import PublicLayout from 'components/PublicLayout'
import * as URLS from 'config/urls'
import Application from 'pages/Application'
import Applications from 'pages/Applications'
import EditorRoutes from 'pages/Editor/routes'
import Execution from 'pages/Execution'
import Executions from 'pages/Executions'
import Flow from 'pages/Flow'
import Flows from 'pages/Flows'
import Login from 'pages/Login'
import SgidFailure from 'pages/SgidFailure'
import SgidRedirect from 'pages/SgidRedirect'

const Landing = lazy(() => import('pages/Landing'))

export default createRoutesFromElements(
  <Route path="/">
    <Route
      path={URLS.LOGIN_SGID_REDIRECT}
      element={
        <PublicLayout>
          <SgidRedirect />
        </PublicLayout>
      }
    />

    <Route
      path={URLS.LOGIN_SGID_FAILURE}
      element={
        <PublicLayout>
          <SgidFailure />
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
