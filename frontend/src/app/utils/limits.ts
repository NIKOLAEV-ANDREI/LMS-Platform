import { toast } from "sonner";

export const LIMITS = {
  userName: 30,
  email: 254,
  password: 128,
  passwordMin: 6,

  courseTitle: 120,
  courseDescription: 2000,
  courseAccessPasswordMin: 4,
  courseAccessPassword: 10,
  imageUrl: 2048,

  moduleTitle: 120,
  moduleDescription: 1500,

  lessonTitle: 150,
  lessonContent: 10000,
  videoUrl: 2048,
  lessonAttachmentsMaxCount: 5,
  lessonAttachmentMaxSize: 15 * 1024 * 1024,
  lessonSubmissionMaxSize: 20 * 1024 * 1024,
  lessonSubmissionNote: 1500,
  lessonReviewNote: 2000,

  questionText: 500,
  questionOption: 200,
};

const lastWarningByKey = new Map<string, number>();
const WARNING_THROTTLE_MS = 1200;

function warnLimit(label: string, max: number) {
  const key = `${label}:${max}`;
  const now = Date.now();
  const lastWarning = lastWarningByKey.get(key) ?? 0;
  if (now-lastWarning < WARNING_THROTTLE_MS) return;
  lastWarningByKey.set(key, now);
  toast.error(`Поле "${label}" поддерживает максимум ${max} символов`);
}

export function applyTextLimit(value: string, max: number, label: string): string {
  if (value.length <= max) return value;
  warnLimit(label, max);
  return value.slice(0, max);
}

export function countLabel(value: string, max: number) {
  return `${value.length}/${max}`;
}
