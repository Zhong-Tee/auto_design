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

export function getPlaceholderHints(textBoxCount: number): string[] {
  const hints = Array.from(
    { length: textBoxCount },
    (_, i) => `{{text${i + 1}}}`
  );
  hints.push("{{image}}");
  return hints;
}
