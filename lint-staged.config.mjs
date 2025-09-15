const filterSpecFiles = (files) => files.filter((file) => !file.startsWith('specs/'));

const quoteFiles = (files) => files.map((file) => `"${file.replace(/"/g, '\\"')}"`);

const runIfFiles = (files, commandsFactory) => {
  const filtered = filterSpecFiles(files);
  if (filtered.length === 0) {
    return [];
  }
  return commandsFactory(quoteFiles(filtered));
};

export default {
  '**/*.{ts,tsx,js,jsx}': (files) =>
    runIfFiles(files, (quotedFiles) => [
      `eslint --fix --cache ${quotedFiles.join(' ')}`,
      `prettier --write ${quotedFiles.join(' ')}`,
    ]),
  '**/*.{json,md,yml,yaml}': (files) =>
    runIfFiles(files, (quotedFiles) => [`prettier --write ${quotedFiles.join(' ')}`]),
  '**/package.json': (files) =>
    runIfFiles(files, (quotedFiles) => [`prettier --write ${quotedFiles.join(' ')}`]),
};
