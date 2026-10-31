import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readZipFileNames(buffer) {
  const names = [];
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) === 0x02014b50) {
      const nameLen = buffer.readUInt16LE(offset + 28);
      const extraLen = buffer.readUInt16LE(offset + 30);
      const commentLen = buffer.readUInt16LE(offset + 32);
      const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
      names.push(name);
      offset += 46 + nameLen + extraLen + commentLen;
    } else {
      offset++;
    }
  }
  return names;
}

test('credihire-extension.zip exists and contains valid Manifest V3 at root', () => {
  const zipPath = path.join(rootDir, 'public', 'downloads', 'credihire-extension.zip');
  assert.ok(fs.existsSync(zipPath), 'Extension ZIP package must exist at public/downloads/credihire-extension.zip');

  const buffer = fs.readFileSync(zipPath);
  assert.ok(buffer.length > 10000, `ZIP file size should be substantial (>10KB), got ${buffer.length} bytes`);

  const namelist = readZipFileNames(buffer);
  assert.ok(namelist.includes('manifest.json'), 'manifest.json missing at archive root');
  assert.ok(!namelist.some(n => n.includes('..') || n.startsWith('/')), 'Suspicious path traversal in zip');
  assert.ok(!namelist.some(n => n.includes('.git') || n.includes('.env') || n.includes('node_modules')), 'Dev artifacts leaked in zip');
  assert.ok(namelist.includes('background/service-worker.js'), 'service-worker missing');
  assert.ok(namelist.includes('content/content-script.js'), 'content-script missing');
  assert.ok(namelist.includes('popup/popup.html'), 'popup.html missing');
  assert.ok(namelist.includes('popup/popup.js'), 'popup.js missing');
  assert.ok(namelist.includes('options/options.html'), 'options.html missing');
  assert.ok(namelist.includes('lib/api-client.js'), 'api-client.js missing');
  assert.ok(namelist.includes('assets/icon128.png'), 'icon128 missing');
});

test('ExtensionGuide component contains required structure, benefits, and steps', () => {
  const guidePath = path.join(rootDir, 'src', 'components', 'ExtensionGuide.jsx');
  assert.ok(fs.existsSync(guidePath), 'ExtensionGuide.jsx must exist in src/components');

  const content = fs.readFileSync(guidePath, 'utf-8');

  // Verify export
  assert.ok(content.includes('export function ExtensionGuide') || content.includes('export default ExtensionGuide'), 'Exports ExtensionGuide');

  // Verify download link and target
  assert.ok(content.includes('/downloads/credihire-extension.zip'), 'Contains download link to ZIP');
  assert.ok(content.includes('download="credihire-extension.zip"'), 'Contains download attribute with filename');
  assert.ok(content.includes('Download for Chrome / Edge'), 'Contains button label "Download for Chrome / Edge"');

  // Verify 5 core benefits
  assert.ok(content.includes('Scan Suspicious Job Offers'), 'Benefit: Scan suspicious job text');
  assert.ok(content.includes('Right-Click Context Menu') || content.includes('Analyze selected text'), 'Benefit: Analyze selected text');
  assert.ok(content.includes('URL') || content.includes('Domain'), 'Benefit: Check suspicious URLs');
  assert.ok(content.includes('Evidence Grounding') || content.includes('Highlight'), 'Benefit: Highlight suspicious evidence');
  assert.ok(content.includes('Connects to Credihire Backend') || content.includes('backend'), 'Benefit: Connect to backend');

  // Verify 7 installation steps
  assert.ok(content.includes('Download the ZIP package'), 'Step 1: Download ZIP');
  assert.ok(content.includes('Extract the ZIP to a permanent folder'), 'Step 2: Extract ZIP');
  assert.ok(content.includes('chrome://extensions/') || content.includes('edge://extensions/'), 'Step 3: Open extensions page');
  assert.ok(content.includes('Developer Mode') || content.includes('Developer mode'), 'Step 4: Enable Developer Mode');
  assert.ok(content.includes('Load unpacked'), 'Step 5: Load unpacked');
  assert.ok(content.includes('manifest.json'), 'Step 6: Folder containing manifest.json');
  assert.ok(content.includes('Pin Credihire') || content.includes('Pin'), 'Step 7: Pin to toolbar');

  // Verify distribution notice
  assert.ok(content.includes('Chrome Web Store') && content.includes('Microsoft Edge Add-ons'), 'Contains manual distribution notice');

  // Verify accessibility
  assert.ok(content.includes('role="dialog"') && content.includes('aria-modal="true"'), 'Has dialog accessibility attributes');
  assert.ok(content.includes('onClose'), 'Handles onClose callback');
});

test('Navbar component renders Get Extension buttons on desktop and mobile', () => {
  const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.jsx');
  const content = fs.readFileSync(navbarPath, 'utf-8');

  // Verify imports Puzzle
  assert.ok(content.includes('Puzzle'), 'Imports Puzzle icon from lucide-react');

  // Verify props include onOpenExtensionGuide
  assert.ok(content.includes('onOpenExtensionGuide'), 'Receives onOpenExtensionGuide prop');

  // Verify desktop button
  assert.ok(content.includes('btn-get-extension'), 'Contains .btn-get-extension desktop button');
  assert.ok(content.includes('Get Extension'), 'Contains "Get Extension" label');

  // Verify mobile button
  assert.ok(content.includes('btn-get-extension-mobile'), 'Contains .btn-get-extension-mobile button');
  assert.ok(content.includes('Get Browser Extension'), 'Contains mobile button label');

  // Verify Sign In and Sign Up buttons are preserved
  assert.ok(content.includes('btn-auth-signin'), 'Preserves Sign In button');
  assert.ok(content.includes('Sign In'), 'Preserves Sign In text');
  assert.ok(content.includes('Sign Up'), 'Preserves Sign Up text');
});

test('App component integrates ExtensionGuide modal state and keyboard handling', () => {
  const appPath = path.join(rootDir, 'src', 'App.jsx');
  assert.ok(fs.existsSync(appPath), 'App.jsx must exist');
  const content = fs.readFileSync(appPath, 'utf-8');

  assert.ok(content.includes('ExtensionGuide'), 'Imports ExtensionGuide');
  assert.ok(content.includes('isExtensionGuideOpen'), 'Maintains isExtensionGuideOpen state');
  assert.ok(content.includes('setIsExtensionGuideOpen(false)'), 'Closes ExtensionGuide in closeAllModals');
  assert.ok(content.includes('onOpenExtensionGuide'), 'Passes onOpenExtensionGuide to Navbar');
});
