import { useEffect } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { TrackerScreen } from "@/features/tracker/TrackerScreen"
import { UpdatesScreen } from "@/features/updates/UpdatesScreen"
import { AnnouncementDetailScreen } from "@/features/updates/AnnouncementDetailScreen"
import { PhotosScreen } from "@/features/photos/PhotosScreen"
import { GuideScreen } from "@/features/guide/GuideScreen"
import { AdminScreen } from "@/features/admin/AdminScreen"
import { DemoProvider } from "@/state/DemoProvider"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Lives inside the Router so it can read the location. */
function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <TrackerScreen /> },
          { path: "/updates", element: <UpdatesScreen /> },
          { path: "/updates/:id", element: <AnnouncementDetailScreen /> },
          { path: "/photos", element: <PhotosScreen /> },
          { path: "/guide", element: <GuideScreen /> },
          { path: "/admin", element: <AdminScreen /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <DemoProvider>
      <RouterProvider router={router} />
    </DemoProvider>
  )
}
