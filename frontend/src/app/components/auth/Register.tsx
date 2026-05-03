import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, GraduationCap, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < LIMITS.passwordMin) {
      toast.error(`Пароль должен содержать минимум ${LIMITS.passwordMin} символов`);
      return;
    }

    setLoading(true);
    try {
      const result = await api.signup(email, password, name, role);
      if (result.success) {
        toast.success("Регистрация успешна! Теперь войдите в систему");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lms-learning-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary p-3">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>Создайте аккаунт для начала обучения</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                type="text"
                placeholder="Иван Иванов"
                value={name}
                onChange={(event) => setName(applyTextLimit(event.target.value, LIMITS.userName, "Имя"))}
                required
              />
            </div>

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
              <Input
                id="password"
                type="password"
                placeholder={`Минимум ${LIMITS.passwordMin} символов`}
                value={password}
                onChange={(event) => setPassword(applyTextLimit(event.target.value, LIMITS.password, "Пароль"))}
                required
                minLength={LIMITS.passwordMin}
              />
            </div>

            <div className="space-y-3">
              <Label>Роль</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as "student" | "teacher")}> 
                <div className="flex cursor-pointer items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                  <RadioGroupItem value="student" id="student" />
                  <Label htmlFor="student" className="flex flex-1 cursor-pointer items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Студент</div>
                      <div className="text-xs text-muted-foreground">Проходите курсы и отслеживайте прогресс</div>
                    </div>
                  </Label>
                </div>
                <div className="flex cursor-pointer items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                  <RadioGroupItem value="teacher" id="teacher" />
                  <Label htmlFor="teacher" className="flex flex-1 cursor-pointer items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Учитель</div>
                      <div className="text-xs text-muted-foreground">Создавайте и управляйте курсами</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Уже есть аккаунт? </span>
              <Link to="/" className="text-primary hover:underline">
                Войти
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
