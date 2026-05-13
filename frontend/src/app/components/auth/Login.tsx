import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.signin(email, password);
      if (result.success) {
        toast.success("Вход выполнен успешно");
        if (result.user.role === "student") navigate("/student/dashboard");
        else if (result.user.role === "teacher") navigate("/teacher/dashboard");
        else navigate("/admin/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lms-learning-background lms-auth-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary p-3">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Добро пожаловать</CardTitle>
          <CardDescription>Войдите в систему дистанционного обучения</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(event) => setEmail(applyTextLimit(event.target.value, LIMITS.email, "Email"))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="pr-10"
                  placeholder={`Минимум ${LIMITS.passwordMin} символов`}
                  value={password}
                  onChange={(event) => setPassword(applyTextLimit(event.target.value, LIMITS.password, "Пароль"))}
                  required
                  minLength={LIMITS.passwordMin}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Нет аккаунта? </span>
              <Link to="/register" className="text-primary hover:underline">
                Зарегистрироваться
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
