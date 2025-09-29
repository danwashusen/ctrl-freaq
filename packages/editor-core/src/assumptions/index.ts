/**
 * Placeholder assumption-session helpers.
 * These exports will be replaced with real implementations once tests drive the API shape.
 */

export interface AssumptionSessionContext {
  sessionId: string;
  sectionId: string;
}

export const createAssumptionSessionContext = (
  _context: AssumptionSessionContext
): AssumptionSessionContext => {
  throw new Error('Assumption session context factory not implemented');
};

export const resolveAssumptionPrompt = async (): Promise<never> => {
  throw new Error('resolveAssumptionPrompt not implemented');
};
