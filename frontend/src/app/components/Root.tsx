import { Outlet } from "react-router";
import { Toaster } from "./ui/sonner";

export default function Root() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      <Toaster />
    </div>
  );
}
