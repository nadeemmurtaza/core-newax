export function dashboardKeyValueBlocks(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) =>
    Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf(':');
          return index === -1
            ? [line.toLowerCase(), '']
            : [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
        }),
    ),
  );
}

export function dashboardJsonBlocks(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].flatMap((match) => {
    try {
      return [JSON.parse(match[1])];
    } catch {
      return [];
    }
  });
}

export function dashboardList(value) {
  return String(value ?? '')
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function dashboardPositiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
