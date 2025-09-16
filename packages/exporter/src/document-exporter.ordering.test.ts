import { describe, expect, it } from 'vitest';

import { DocumentExporter } from './index';

describe('DocumentExporter ordering', () => {
  it('orders exported sections based on template section hierarchy', async () => {
    const exporter = new DocumentExporter();
    const content = {
      system_overview: {
        tech_stack: 'React, Express',
        architecture_diagram: 'https://ctrl-freaq.dev/diagram.png',
      },
      introduction: 'Architecture overview',
      appendix: 'Out-of-order data',
    };

    const result = await exporter.export(content, {
      format: 'markdown',
      templateSections: [
        {
          id: 'introduction',
          title: 'Executive Summary',
          orderIndex: 0,
          required: true,
          type: 'markdown',
          guidance: null,
          fields: [],
          children: [],
        },
        {
          id: 'system_overview',
          title: 'System Overview',
          orderIndex: 1,
          required: true,
          type: 'object',
          guidance: null,
          fields: [],
          children: [
            {
              id: 'architecture_diagram',
              title: 'Architecture Diagram',
              orderIndex: 0,
              required: true,
              type: 'url',
              guidance: null,
              fields: [],
              children: [],
            },
            {
              id: 'tech_stack',
              title: 'Tech Stack',
              orderIndex: 1,
              required: true,
              type: 'markdown',
              guidance: null,
              fields: [],
              children: [],
            },
          ],
        },
      ],
    });

    expect(result.orderedSections?.map(section => section.id)).toEqual([
      'introduction',
      'system_overview',
    ]);
    expect(result.orderedSections?.[1]?.children?.map(child => child.id)).toEqual([
      'architecture_diagram',
      'tech_stack',
    ]);
  });
});
