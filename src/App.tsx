import { lazy, Suspense, useEffect } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useParams,
} from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { LiveAppShell } from "@/components/layout/LiveAppShell"
const TrackerScreen = lazy(() => import("@/features/tracker/TrackerScreen").then(m => ({ default: m.TrackerScreen })))
const UpdatesScreen = lazy(() => import("@/features/updates/UpdatesScreen").then(m => ({ default: m.UpdatesScreen })))
const AnnouncementDetailScreen = lazy(() => import("@/features/updates/AnnouncementDetailScreen").then(m => ({ default: m.AnnouncementDetailScreen })))
const PhotosScreen = lazy(() => import("@/features/photos/PhotosScreen").then(m => ({ default: m.PhotosScreen })))
const GuideScreen = lazy(() => import("@/features/guide/GuideScreen").then(m => ({ default: m.GuideScreen })))
const AdminScreen = lazy(() => import("@/features/admin/AdminScreen").then(m => ({ default: m.AdminScreen })))
const OrganizerAdminScreen = lazy(() => import("@/features/admin/OrganizerAdminScreen").then(m => ({ default: m.OrganizerAdminScreen })))
import { RequireOrganizer } from "@/features/admin/RequireOrganizer"
import { DemoProvider } from "@/state/DemoProvider"
import { ChangePasswordScreen } from "@/features/auth/ChangePasswordScreen"
import { useAuth } from "@/state/auth-context"
import { AuthProvider } from "@/state/AuthProvider"
import { BandProvider } from "@/state/BandProvider"
import { DemoBaseProvider } from "@/lib/demo-base"
import { isLiveApi } from "@/lib/live-api"
import { isReservedBandSlug } from "@/lib/paths"
import { LoginScreen } from "@/features/auth/LoginScreen"
import { RegisterScreen } from "@/features/auth/RegisterScreen"
import { ForgotScreen } from "@/features/auth/ForgotScreen"
import { ResetScreen } from "@/features/auth/ResetScreen"
import { AccountScreen } from "@/features/account/AccountScreen"
import { PrivacyScreen } from "@/features/legal/PrivacyScreen"
const PlatformScreen = lazy(() => import("@/features/platform/PlatformScreen").then(m => ({ default: m.PlatformScreen })))
import { HomeRedirect } from "@/features/bands/HomeRedirect"
import { ModulePage } from "@/features/upsell/ModulePage"
import { ModuleUpsellRoute, UpsellScreen } from "@/features/upsell/UpsellScreen"

const LiveTrackerScreen = lazy(() => import("@/features/tracker/LiveTrackerScreen").then(m => ({ default: m.LiveTrackerScreen })))
const FriendsScreen = lazy(() => import("@/features/friends/FriendsScreen").then(m => ({ default: m.FriendsScreen })))
const LiveContentScreen = lazy(() => import("@/features/content/LiveContentScreen").then(m => ({ default: m.LiveContentScreen })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RootLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (user?.mustResetPassword && pathname !== "/change-password") return <Navigate to="/change-password" replace />
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  )
}

function DemoLayout() {
  const { pathname } = useLocation()
  const base = pathname === "/demo" || pathname.startsWith("/demo/") ? "/demo" : ""
  return (
    <DemoBaseProvider base={base}>
      <DemoProvider>
        <AppShell />
      </DemoProvider>
    </DemoBaseProvider>
  )
}

function LiveBandLayout() {
  const { bandSlug } = useParams()
  if (bandSlug && isReservedBandSlug(bandSlug)) {
    return <Navigate to="/" replace />
  }
  return (
    <BandProvider key={bandSlug}>
      <LiveAppShell />
    </BandProvider>
  )
}

function BandIndexRedirect() {
  const { bandSlug } = useParams()
  return <Navigate to={`/${bandSlug ?? ""}`} replace />
}

const sharedAuth = [
  { path: "change-password", element: <ChangePasswordScreen /> },
  { path: "privacy", element: <PrivacyScreen /> },
  { path: "login", element: <LoginScreen /> },
  { path: "register", element: <RegisterScreen /> },
  { path: "forgot", element: <ForgotScreen /> },
  { path: "reset", element: <ResetScreen /> },
  { path: "platform", element: <PlatformScreen /> },
]

const demoPatron = [
  { index: true, element: <TrackerScreen /> },
  { path: "updates", element: <UpdatesScreen /> },
  { path: "updates/:id", element: <AnnouncementDetailScreen /> },
  { path: "photos", element: <PhotosScreen /> },
  { path: "library", element: <UpsellScreen module="photos" /> },
  { path: "guide", element: <GuideScreen /> },
  { path: "admin", element: <AdminScreen /> },
  { path: "account", element: <AccountScreen /> },
  { path: "upsell/:moduleCode", element: <ModuleUpsellRoute /> },
]

const liveBandPatron = [
  { index: true, element: <ModulePage module="truck_tracker"><LiveTrackerScreen /></ModulePage> },
  { path: "friends", element: <ModulePage module="friends"><FriendsScreen /></ModulePage> },
  { path: "updates", element: <ModulePage module="updates"><LiveContentScreen module="updates" /></ModulePage> },
  { path: "updates/:id", element: <ModulePage module="updates"><LiveContentScreen module="updates" /></ModulePage> },
  { path: "photos", element: <ModulePage module="photos" /> },
  { path: "library", element: <ModulePage module="photos" /> },
  { path: "guide", element: <ModulePage module="guide"><LiveContentScreen module="guide" /></ModulePage> },
  { path: "upsell/:moduleCode", element: <ModuleUpsellRoute /> },
  { path: "account", element: <AccountScreen /> },
  {
    path: "admin",
    element: (
      <RequireOrganizer>
        <OrganizerAdminScreen />
      </RequireOrganizer>
    ),
  },
  { path: "*", element: <BandIndexRedirect /> },
]

const router = createBrowserRouter(
  [
  {
    element: <RootLayout />,
    children: isLiveApi()
      ? [
          ...sharedAuth,
          { index: true, element: <HomeRedirect /> },
          {
            path: "demo",
            element: <DemoLayout />,
            children: [
              ...demoPatron,
              { path: "*", element: <Navigate to="/demo" replace /> },
            ],
          },
          {
            path: ":bandSlug",
            element: <LiveBandLayout />,
            children: liveBandPatron,
          },
        ]
      : [
          ...sharedAuth,
          {
            element: <DemoLayout />,
            children: [
              ...demoPatron,
              { path: "*", element: <Navigate to="/" replace /> },
            ],
          },
        ],
  },
  ],
  {
    basename: import.meta.env.BASE_URL.replace(/\/$/, "") || undefined,
  },
)

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="p-8 text-center">Loading…</div>}><RouterProvider router={router} /></Suspense>
    </AuthProvider>
  )
}
