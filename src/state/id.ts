// Simple unique id generator for MVP (timestamp + random number)
export function uid() {
  return `${Date.now().toString(36)} - 
          ${Math.random().toString(36).slice(2, 7)}`;
}