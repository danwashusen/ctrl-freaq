/**
 * @ctrl-freaq/qa - Quality assurance and validation library
 *
 * This package provides quality assurance and validation capabilities
 * for CTRL FreaQ documentation, including schema validation, content
 * quality checks, and compliance gates.
 */

// Core QA functionality exports
export * from './validators/index.js';
export * from './gates/index.js';
export * from './compliance/drafts.js';
export * from './audit/co-authoring.js';

// CLI exposed via dedicated entry point (see @ctrl-freaq/qa/cli) to avoid bundling Node-only dependencies in browser builds.

// Core types and interfaces
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}

export interface ValidationError {
  rule: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error';
}

export interface ValidationWarning {
  rule: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'warning';
}

export interface ValidationInfo {
  rule: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'info';
}

export interface QualityGate {
  name: string;
  description: string;
  rules: ValidationRule[];
  threshold: {
    errorLimit: number;
    warningLimit: number;
  };
}

// Placeholder implementation classes
export class DocumentValidator {
  private rules: Map<string, ValidationRule> = new Map();

  addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  async validate(_content: string, _rulesToRun?: string[]): Promise<ValidationResult> {
    // Placeholder implementation
    return {
      valid: true,
      errors: [],
      warnings: [],
      info: [
        {
          rule: 'placeholder',
          message: 'Validation functionality not yet implemented',
          severity: 'info',
        },
      ],
    };
  }
}

export class QualityGateRunner {
  private gates: Map<string, QualityGate> = new Map();

  registerGate(gate: QualityGate): void {
    this.gates.set(gate.name, gate);
  }

  async runGate(gateName: string, _content: string): Promise<ValidationResult> {
    const gate = this.gates.get(gateName);
    if (!gate) {
      throw new Error(`Quality gate '${gateName}' not found`);
    }

    // Placeholder implementation
    return {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
    };
  }

  listGates(): string[] {
    return Array.from(this.gates.keys());
  }
}

// Package metadata
export const packageInfo = {
  name: '@ctrl-freaq/qa',
  version: '0.1.0',
  description: 'Quality assurance and validation library for CTRL FreaQ documentation',
};
