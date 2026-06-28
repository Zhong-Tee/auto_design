export function resolveImageContentType(
  file: Pick<File, "type" | "name">
): string | null {
  const normalizedType =
    file.type === "image/jpg" ? "image/jpeg" : file.type;

  if (["image/png", "image/jpeg"].includes(normalizedType)) {
    return normalizedType;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  return null;
}
