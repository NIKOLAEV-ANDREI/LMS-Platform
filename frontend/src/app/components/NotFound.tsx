import { Link } from "react-router";
import { Button } from "./ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">Страница не найдена</h2>
          <p className="text-muted-foreground">
            К сожалению, запрашиваемая страница не существует
          </p>
        </div>
        <Link to="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            На главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
