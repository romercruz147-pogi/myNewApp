#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '../node_modules');

// Fix expo-modules-core package.json main entry point
function fixExpoModulesCore() {
  const packageJsonPath = path.join(nodeModulesPath, 'expo-modules-core', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const updated = content.replace('"main": "src/index.ts"', '"main": "index.js"');
    if (content !== updated) {
      fs.writeFileSync(packageJsonPath, updated, 'utf-8');
      console.log('✓ Fixed expo-modules-core package.json');
    }
  }
}

// Fix missing .js extensions in imports
function fixImportExtensions(filePath) {
  if (!fs.existsSync(filePath) || !filePath.endsWith('.js')) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace relative imports without extensions
  let updated = content.replace(/from\s+['"](\.[^'"]+)['"];/g, (match, imported) => {
    // Skip if already has extension or is an external package
    if (imported.includes('.') || !imported.startsWith('.')) {
      return match;
    }
    changed = true;
    return `from '${imported}.js';`;
  });

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf-8');
    return true;
  }
  return false;
}

// Recursively fix all .js files in expo packages
function fixExpoPackages() {
  const expoPackages = [
    'expo-crypto',
    'expo-constants', 
    'expo-web-browser',
    'expo-auth-session'
  ];

  expoPackages.forEach(pkg => {
    const buildDir = path.join(nodeModulesPath, pkg, 'build');
    if (fs.existsSync(buildDir)) {
      const files = getAllJsFiles(buildDir);
      let fixedCount = 0;
      files.forEach(file => {
        if (fixImportExtensions(file)) {
          fixedCount++;
        }
      });
      if (fixedCount > 0) {
        console.log(`✓ Fixed ${fixedCount} files in ${pkg}/build`);
      }
    }
  });
}

// Get all .js files recursively
function getAllJsFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files = files.concat(getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

try {
  fixExpoModulesCore();
  fixExpoPackages();
  console.log('✓ All expo module fixes applied');
} catch (error) {
  console.error('Error fixing expo modules:', error.message);
  process.exit(1);
}
