import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes required Pi SDK configuration files in targetDir from templates.
 * NEVER overwrites existing files.
 *
 * @param {string} [customTargetDir]
 * @returns {{ modelsCreated: boolean, authCreated: boolean, targetDir: string }}
 */
export function ensurePiConfig(customTargetDir) {
  const targetDir = customTargetDir || path.resolve(__dirname, '.pi');
  const templateDir = path.resolve(__dirname, 'templates');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[setup-config] Created directory: ${targetDir}`);
  }

  const modelsDst = path.join(targetDir, 'models.json');
  const modelsSrc = path.join(templateDir, 'models.json.example');
  let modelsCreated = false;

  if (fs.existsSync(modelsDst)) {
    console.log(`[setup-config] Preserving existing: ${modelsDst}`);
  } else {
    if (fs.existsSync(modelsSrc)) {
      fs.copyFileSync(modelsSrc, modelsDst);
      console.log(`[setup-config] Initialized ${modelsDst} from template.`);
      modelsCreated = true;
    } else {
      console.warn(`[setup-config] Template not found: ${modelsSrc}`);
    }
  }

  const authDst = path.join(targetDir, 'auth.json');
  const authSrc = path.join(templateDir, 'auth.json.example');
  let authCreated = false;

  if (fs.existsSync(authDst)) {
    console.log(`[setup-config] Preserving existing: ${authDst}`);
  } else {
    if (fs.existsSync(authSrc)) {
      fs.copyFileSync(authSrc, authDst);
      console.log(`[setup-config] Initialized ${authDst} from template.`);
      authCreated = true;
    } else {
      fs.writeFileSync(authDst, '{}\n', 'utf8');
      console.log(`[setup-config] Created default empty ${authDst}.`);
      authCreated = true;
    }
  }

  return { modelsCreated, authCreated, targetDir };
}

// Direct CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const customArg = process.argv[2];
  ensurePiConfig(customArg);
  console.log('[setup-config] Pi SDK configuration ready.');
}
