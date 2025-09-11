// Service Locator interfaces and factory types (no singletons)
export interface Logger {
  info: (o: any, msg?: string) => void;
  warn: (o: any, msg?: string) => void;
  error: (o: any, msg?: string) => void;
}

export interface DbHandle {
  // Placeholder DB handle (e.g., better-sqlite3 Database)
  connection: unknown;
}

// Repository interface stubs
export interface DocumentsRepo { /* add methods */ }
export interface SectionsRepo { /* add methods */ }
export interface AssumptionsRepo { /* add methods */ }
export interface KnowledgeRepo { /* add methods */ }
export interface TraceRepo { /* add methods */ }
export interface ProposalsRepo { /* add methods */ }
export interface ActivityRepo { /* add methods */ }

export interface AiClient { /* explain/suggest/propose APIs */ }

export interface Locator {
  requestId: string;
  logger: Logger;
  db(): DbHandle;
  repos(): {
    documents: DocumentsRepo;
    sections: SectionsRepo;
    assumptions: AssumptionsRepo;
    knowledge: KnowledgeRepo;
    trace: TraceRepo;
    proposals: ProposalsRepo;
    activity: ActivityRepo;
  };
  ai: (opts?: { model?: string; temperature?: number }) => AiClient;
  session: () => Promise<{ userId: string; email?: string }>;
}

export type AppFactories = {
  makeLogger: (ctx: { requestId: string }) => Logger;
  makeDb: () => DbHandle;
  makeRepos: (db: DbHandle) => Locator['repos'];
  makeAi: (ctx: { requestId: string }) => (opts?: { model?: string; temperature?: number }) => AiClient;
  getSession: () => Promise<{ userId: string; email?: string }>;
};

