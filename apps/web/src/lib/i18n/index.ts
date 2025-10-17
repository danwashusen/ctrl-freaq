import docQuality from './doc-quality.json';

export const DOC_QUALITY_NAMESPACE = docQuality.namespace;

export type DocQualityMessages = typeof docQuality;

export type MessageFormatParams = Record<string, string | number>;

export const docQualityMessages: DocQualityMessages = docQuality;

export const formatDocQualityMessage = (template: string, params?: MessageFormatParams): string => {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((message, [key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    return message.replace(pattern, String(value));
  }, template);
};

export interface DocQualityTranslator {
  status: (key: keyof DocQualityMessages['status']) => string;
  helper: (key: keyof DocQualityMessages['helper'], params?: MessageFormatParams) => string;
  actions: (key: keyof DocQualityMessages['actions']) => string;
  links: (key: keyof DocQualityMessages['links']) => string;
  toast: (key: keyof DocQualityMessages['toast']) => string;
  aria: (key: keyof DocQualityMessages['aria'], params?: MessageFormatParams) => string;
}

export const createDocQualityTranslator = (
  messages: DocQualityMessages = docQualityMessages
): DocQualityTranslator => ({
  status: key => messages.status[key],
  helper: (key, params) => formatDocQualityMessage(messages.helper[key], params),
  actions: key => messages.actions[key],
  links: key => messages.links[key],
  toast: key => messages.toast[key],
  aria: (key, params) => formatDocQualityMessage(messages.aria[key], params),
});
