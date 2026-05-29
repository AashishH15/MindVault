export type MockInvoker = (command: string, payload?: Record<string, unknown>) => Promise<unknown>;

let mockInvoker: MockInvoker | null = null;

export function getMockInvoker() {
  return mockInvoker;
}

export function setMockInvoker(invoker: MockInvoker | null) {
  mockInvoker = invoker;
}
