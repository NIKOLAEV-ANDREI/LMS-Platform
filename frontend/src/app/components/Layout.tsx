import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { api, User } from "../utils/api";
import { GraduationCap, Home, Search, User as UserIcon, LogOut, Users, FileCheck2, Menu } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function Layout({ children, fullWidth = false }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { user } = await api.getSession();
        setUser(user);
      } catch (error) {
        navigate('/');
      }
    };

    checkSession();
  }, [navigate]);

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getDashboardLink = () => {
    if (user.role === 'student') return '/student/dashboard';
    if (user.role === 'teacher') return '/teacher/dashboard';
    if (user.role === 'admin') return '/admin/dashboard';
    return '/';
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={getDashboardLink()} className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-semibold">LMS Platform</span>
            </Link>

            <nav className="hidden md:flex items-center gap-4">
              {user.role !== 'admin' && (
                <Link to={getDashboardLink()}>
                  <Button
                    variant={location.pathname.includes('dashboard') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Главная
                  </Button>
                </Link>
              )}

              {(user.role === 'student' || user.role === 'teacher') && (
                <Link to="/courses/search">
                  <Button
                    variant={location.pathname === '/courses/search' ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Поиск курсов
                  </Button>
                </Link>
              )}

              {user.role === 'admin' && (
                <Link to="/admin/dashboard">
                  <Button
                    variant={location.pathname.includes('admin') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Пользователи
                  </Button>
                </Link>
              )}

              {user.role === 'teacher' && (
                <Link to="/teacher/reviews">
                  <Button
                    variant={location.pathname === '/teacher/reviews' ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <FileCheck2 className="h-4 w-4" />
                    Проверка работ
                  </Button>
                </Link>
              )}

              <Link to="/profile">
                <Button
                  variant={location.pathname === '/profile' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  Профиль
                </Button>
              </Link>

              <Button onClick={() => setLogoutDialogOpen(true)} variant="ghost" size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Выход
              </Button>
            </nav>

            <div className="flex md:hidden items-center gap-2">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Открыть меню">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[86vw] max-w-[360px]">
                  <SheetHeader>
                    <SheetTitle>Меню</SheetTitle>
                    <SheetDescription>Навигация по платформе</SheetDescription>
                  </SheetHeader>

                  <div className="flex flex-col gap-2 px-4 pb-4">
                    {user.role !== 'admin' && (
                      <Link to={getDashboardLink()} onClick={() => setMobileNavOpen(false)}>
                        <Button
                          variant={location.pathname.includes('dashboard') ? 'default' : 'outline'}
                          className="w-full justify-start gap-2"
                        >
                          <Home className="h-4 w-4" />
                          Главная
                        </Button>
                      </Link>
                    )}

                    {(user.role === 'student' || user.role === 'teacher') && (
                      <Link to="/courses/search" onClick={() => setMobileNavOpen(false)}>
                        <Button
                          variant={location.pathname === '/courses/search' ? 'default' : 'outline'}
                          className="w-full justify-start gap-2"
                        >
                          <Search className="h-4 w-4" />
                          Поиск курсов
                        </Button>
                      </Link>
                    )}

                    {user.role === 'admin' && (
                      <Link to="/admin/dashboard" onClick={() => setMobileNavOpen(false)}>
                        <Button
                          variant={location.pathname.includes('admin') ? 'default' : 'outline'}
                          className="w-full justify-start gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Пользователи
                        </Button>
                      </Link>
                    )}

                    {user.role === 'teacher' && (
                      <Link to="/teacher/reviews" onClick={() => setMobileNavOpen(false)}>
                        <Button
                          variant={location.pathname === '/teacher/reviews' ? 'default' : 'outline'}
                          className="w-full justify-start gap-2"
                        >
                          <FileCheck2 className="h-4 w-4" />
                          Проверка работ
                        </Button>
                      </Link>
                    )}

                    <Link to="/profile" onClick={() => setMobileNavOpen(false)}>
                      <Button
                        variant={location.pathname === '/profile' ? 'default' : 'outline'}
                        className="w-full justify-start gap-2"
                      >
                        <UserIcon className="h-4 w-4" />
                        Профиль
                      </Button>
                    </Link>

                    <Button
                      onClick={() => {
                        setMobileNavOpen(false);
                        setLogoutDialogOpen(true);
                      }}
                      variant="outline"
                      className="w-full justify-start gap-2 text-destructive border-destructive/40 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Выход
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти из аккаунта?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы завершите текущую сессию и вернетесь на страницу входа.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Выйти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="lms-learning-background flex-1">
        <div className={fullWidth ? "w-full px-4 sm:px-6 lg:px-8 py-8" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
