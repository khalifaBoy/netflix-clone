"use client";
import { AuthProvider } from "./Authcontext";

export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
