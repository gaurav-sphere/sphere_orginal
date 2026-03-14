import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import { GuestProvider } from "../contexts/GuestContext";
import { ThemeProvider } from "../contexts/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <GuestProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </GuestProvider>
    </ThemeProvider>
  );
}
