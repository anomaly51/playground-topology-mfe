import "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
    toHaveAttribute(name: string, value?: unknown): void;
    toHaveTextContent(value: string | RegExp): void;
  }
}
