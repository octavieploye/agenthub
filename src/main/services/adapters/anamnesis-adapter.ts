// src/main/services/adapters/anamnesis-adapter.ts

export interface IAnamnesisAdapter {
  onEventInserted(): void
  flush(): Promise<void>
}

export class NullAnamnesisAdapter implements IAnamnesisAdapter {
  onEventInserted(): void {
    // standalone mode — no Anamnesis connection
  }

  async flush(): Promise<void> {
    // standalone mode — nothing to flush
  }
}
