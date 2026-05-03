interface CharCounterProps {
  value: string;
  max: number;
}

export default function CharCounter({ value, max }: CharCounterProps) {
  const ratio = value.length / max;
  const colorClass = ratio >= 1 ? "text-destructive" : ratio >= 0.85 ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className={`text-right text-xs ${colorClass}`}>
      {value.length}/{max}
    </div>
  );
}

