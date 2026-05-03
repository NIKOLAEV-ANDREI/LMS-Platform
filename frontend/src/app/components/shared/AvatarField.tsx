import { ChangeEvent, useRef, useState } from "react";
import { Camera, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import AvatarCropDialog from "./AvatarCropDialog";
import { readFileAsDataUrl } from "../../utils/avatar";

interface AvatarFieldProps {
  name: string;
  avatarUrl?: string;
  disabled?: boolean;
  onAvatarChange: (avatarDataUrl: string) => Promise<void>;
  onAvatarRemove: () => Promise<void>;
}

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export default function AvatarField({
  name,
  avatarUrl,
  disabled = false,
  onAvatarChange,
  onAvatarRemove,
}: AvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openPicker = () => {
    if (disabled || saving) return;
    inputRef.current?.click();
  };

  const onFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Можно загрузить только изображение");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Файл слишком большой (максимум 10MB)");
      return;
    }
    try {
      const source = await readFileAsDataUrl(file);
      setCropSource(source);
    } catch (error: any) {
      toast.error(error.message || "Не удалось открыть изображение");
    }
  };

  const applyCroppedAvatar = async (avatarDataUrl: string) => {
    setSaving(true);
    try {
      await onAvatarChange(avatarDataUrl);
      toast.success("Аватарка обновлена");
      setCropSource(null);
    } catch (error: any) {
      toast.error(error.message || "Не удалось обновить аватарку");
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async () => {
    if (disabled || saving) return;
    if (!window.confirm("Удалить фотографию профиля?")) return;
    setSaving(true);
    try {
      await onAvatarRemove();
      toast.success("Аватарка удалена");
    } catch (error: any) {
      toast.error(error.message || "Не удалось удалить аватарку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="group relative">
          <Avatar className="size-24 border border-border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-muted">
              <User className="h-10 w-10 text-gray-400" />
            </AvatarFallback>
          </Avatar>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled || saving}
                className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center rounded-full opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 disabled:cursor-not-allowed"
                aria-label="Изменить фотографию профиля"
              >
                <span className="rounded-full bg-black/45 p-2 text-white backdrop-blur-[1px]">
                  <Camera className="h-7 w-7" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2">
              <DropdownMenuItem onSelect={openPicker} className="py-2 text-base">
                Изменить фотографию
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={removeAvatar}
                variant="destructive"
                disabled={!avatarUrl}
                className="py-2 text-base"
              >
                Удалить фото
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />

      <AvatarCropDialog
        open={Boolean(cropSource)}
        imageSrc={cropSource}
        onCancel={() => {
          if (!saving) setCropSource(null);
        }}
        onApply={applyCroppedAvatar}
      />
    </div>
  );
}
