import { describe, expect, it } from 'vitest';

import {
  RequestServiceContainer,
  type ServiceContainer,
} from '../../../../src/core/service-locator';
import {
  registerDocumentWorkflowServices,
  registerRepositoryFactories,
} from '../../../../src/services/container';

function createContainer(): ServiceContainer {
  const container = new RequestServiceContainer();
  // Minimal stubs to satisfy repository factories
  container.register('database', {
    prepare() {
      throw new Error('prepare not implemented in test stub');
    },
  });
  container.register('logger', {
    child() {
      return this;
    },
    info() {},
    warn() {},
    error() {},
  });
  return container;
}

describe('document workflow service registrations', () => {
  it('registers discovery, provisioning, and export services on the container', () => {
    const container = createContainer();

    registerRepositoryFactories(container);
    registerDocumentWorkflowServices(container);

    expect(container.has('projectDocumentDiscoveryService')).toBe(true);
    expect(container.has('documentProvisioningService')).toBe(true);
    expect(container.has('documentExportService')).toBe(true);
  });
});
