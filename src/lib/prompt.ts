export function fillPromptTemplate(
  template: string,
  texts: string[]
): string {
  let result = template;

  texts.forEach((text, index) => {
    const placeholder = new RegExp(`\\{\\{text${index + 1}\\}\\}`, "g");
    result = result.replace(placeholder, text);
  });

  return result;
}

export function getTextPromptTag(position: number): string {
  return `{{text${position}}}`;
}

// คีย์ตัวแปรใช้ได้เฉพาะ a-z A-Z 0-9 _ เพื่อให้ปลอดภัยกับ regex และ {{key}}
export function sanitizeVariableKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "");
}

// เติมค่าตัวแปรแบบตั้งชื่อเอง เช่น {{suite}} -> ค่าที่ผู้ใช้กรอก
export function fillNamedPlaceholders(
  template: string,
  values: Record<string, string>
): string {
  let result = template;

  for (const [rawKey, value] of Object.entries(values)) {
    const key = sanitizeVariableKey(rawKey);
    if (!key) continue;
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(placeholder, value);
  }

  return result;
}

export function getPlaceholderHints(textBoxCount: number): string[] {
  const hints = Array.from(
    { length: textBoxCount },
    (_, i) => `{{text${i + 1}}}`
  );
  hints.push("{{image}}");
  return hints;
}
