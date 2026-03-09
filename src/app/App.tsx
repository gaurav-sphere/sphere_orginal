import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import { GuestProvider } from "../contexts/GuestContext";

export default function App() {
  return (
    <GuestProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </GuestProvider>
  );
}
