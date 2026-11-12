// Minimal surface used here; Node 22.13+ provides the runtime implementation.
declare module "node:sqlite" {
  type Value = string | number | bigint | Uint8Array | null;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: Value[]): Record<string, Value> | undefined;
      all(...params: Value[]): Record<string, Value>[];
      run(...params: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    };
    close(): void;
  }
}
