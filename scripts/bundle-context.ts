import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.vscode',
  '.idea',
  'coverage',
  'dist',
  'build',
  'scripts'
]);

const IGNORE_FILES = new Set([
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'project_context.txt',
  '.env',
  '.env.local',
  'next-env.d.ts'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.scss',
  '.md',
  '.yaml',
  '.yml',
  'Dockerfile',
  '.dockerignore',
  '.gitignore'
]);

const OUTPUT_FILE = 'project_context.txt';

// --- LOGIC ---

function shouldIgnore(entryPath: string, isDirectory: boolean): boolean {
  const name = path.basename(entryPath);

  if (isDirectory) {
    return IGNORE_DIRS.has(name);
  }

  if (IGNORE_FILES.has(name)) return true;

  const ext = path.extname(name);
  if (ext === '' && ALLOWED_EXTENSIONS.has(name)) return false;
  if (ext !== '' && !ALLOWED_EXTENSIONS.has(ext)) return true;

  return false;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      if (!shouldIgnore(fullPath, true)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (!shouldIgnore(fullPath, false)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function bundleProject() {
  const rootDir = process.cwd();
  console.log(`Bundling project context from: ${rootDir}`);

  const files = getAllFiles(rootDir);
  let outputContent = `# Project Snapshot: DataForge (Next.js)\n# Generated via scripts/bundle-context.ts\n# Date: ${new Date().toISOString()}\n${'-'.repeat(40)}\n\n`;

  let fileCount = 0;

  files.forEach((filePath) => {
    try {
      const relativePath = path.relative(rootDir, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      outputContent += `--- START FILE: ${relativePath} ---\n`;
      outputContent += content + '\n';
      outputContent += `--- END FILE: ${relativePath} ---\n\n`;

      console.log(`   Included: ${relativePath}`);
      fileCount++;
    } catch (e) {
      console.warn(`  Skipping binary or unreadable file: ${filePath}`);
    }
  });

  fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
  console.log(`\n Success! Bundled ${fileCount} files into '${OUTPUT_FILE}'`);
}

bundleProject();
