export function inBounds(span: [number, number], textLength: number): boolean {
  return span[0] >= 0 && span[1] <= textLength && span[0] <= span[1];
}

export function exact(text: string, span: [number, number], surface: string): boolean {
  return text.slice(span[0], span[1]) === surface;
}
