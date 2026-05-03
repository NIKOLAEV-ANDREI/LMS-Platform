import { useEffect, useMemo, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { getCroppedSquareDataUrl } from "../../utils/avatar";

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onApply: (avatarDataUrl: string) => Promise<void>;
}

export default function AvatarCropDialog({
  open,
  imageSrc,
  onCancel,
  onApply,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageSrc]);

  const canApply = useMemo(() => Boolean(imageSrc && croppedAreaPixels), [imageSrc, croppedAreaPixels]);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const avatarDataUrl = await getCroppedSquareDataUrl(imageSrc, {
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      });
      await onApply(avatarDataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onCancel() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Обрезка аватарки</DialogTitle>
          <DialogDescription>
            Выделите квадратную область. После сохранения изображение будет автоматически приведено к квадрату.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-80 w-full overflow-hidden rounded-md bg-black/70">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                onZoomChange={setZoom}
                objectFit="contain"
                minZoom={1}
                maxZoom={3}
                zoomSpeed={0.15}
              />
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Масштаб</div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} disabled={!canApply || saving}>
            {saving ? "Сохранение..." : "Применить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

