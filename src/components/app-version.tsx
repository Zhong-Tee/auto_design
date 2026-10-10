import { version } from "../../package.json";

export function AppVersion() {
  return (
    <span className="block text-xs font-normal leading-4 text-muted-foreground">
      เวอร์ชัน {version}
    </span>
  );
}
