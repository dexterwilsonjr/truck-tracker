import { useEffect } from "react"
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
import { TrackerScreen } from "@/features/tracker/TrackerScreen"
import { UpdatesScreen } from "@/features/updates/UpdatesScreen"
import { AnnouncementDetailScreen } from "@/features/updates/AnnouncementDetailScreen"
import { PhotosScreen } from "@/features/photos/PhotosScreen"
import { GuideScreen } from "@/features/guide/GuideScreen"
import { AdminScreen } from "@/features/admin/AdminScreen"
import { OrganizerAdminScreen } from "@/features/admin/OrganizerAdminScreen"
import { RequireOrganizer } from "@/features/admin/RequireOrganizer"
import { DemoProvider } from "@/state/DemoProvider"
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
import { PlatformScreen } from "@/features/platform/PlatformScreen"
import { HomeRedirect } from "@/features/bands/HomeRedirect"
import { ModulePage } from "@/features/upsell/ModulePage"
import { ModuleUpsellRoute, UpsellScreen } from "@/features/upsell/UpsellScreen"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RootLayout() {
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
    <BandProvider>
      <LiveAppShell />
    </BandProvider>
  )
}

function BandIndexRedirect() {
  const { bandSlug } = useParams()
  return <Navigate to={`/${bandSlug ?? ""}`} replace />
}

const sharedAuth = [
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
  { index: true, element: <ModulePage module="truck_tracker" /> },
  { path: "updates", element: <ModulePage module="updates" /> },
  { path: "updates/:id", element: <ModulePage module="updates" /> },
  { path: "photos", element: <ModulePage module="photos" /> },
  { path: "library", element: <ModulePage module="photos" /> },
  { path: "guide", element: <ModulePage module="guide" /> },
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
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
