import * as fs from "fs";
import * as path from "path";

interface CopyOptions {
  sourceFile: string;
  targetDir: string;
  recursive?: boolean;
  overwrite?: boolean;
  skipIdentical?: boolean;
  include?: string[];
  exclude?: string[];
  filePattern?: RegExp;
}

/**
 * Copies a file to all subdirectories in a target directory
 */
async function copyFileToSubdirs(options: CopyOptions): Promise<void> {
  const {
    sourceFile,
    targetDir,
    recursive = false,
    overwrite = true,
    skipIdentical = true,
    include = [],
    exclude = [],
    filePattern,
  } = options;

  const resolvedSourceFile = path.resolve(sourceFile);
  const resolvedTargetDir = path.resolve(targetDir);

  try {
    // Check if source file exists
    if (!fs.existsSync(resolvedSourceFile)) {
      console.error(`❌ Source file not found: ${resolvedSourceFile}`);
      return;
    }

    // Check if target directory exists
    if (!fs.existsSync(resolvedTargetDir)) {
      console.error(`❌ Target directory not found: ${resolvedTargetDir}`);
      return;
    }

    // Read the source file
    const fileContent = fs.readFileSync(resolvedSourceFile, "utf-8");
    const sourceFileName = path.basename(resolvedSourceFile);
    console.log(`📖 Read ${sourceFileName} from: ${resolvedSourceFile}`);

    // Get subdirectories
    const subdirs = getSubdirectories(
      resolvedTargetDir,
      recursive,
      include,
      exclude,
      filePattern
    );

    if (subdirs.length === 0) {
      console.log("⚠️  No matching subdirectories found");
      return;
    }

    console.log(
      `📂 Found subdirectories: ${subdirs
        .map((d) => path.relative(resolvedTargetDir, d))
        .join(", ")}`
    );

    let copiedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Copy to each subdirectory
    for (const subdir of subdirs) {
      const targetFile = path.join(subdir, sourceFileName);

      try {
        // Check if target file already exists
        if (fs.existsSync(targetFile)) {
          if (!overwrite) {
            console.log(
              `⏭️  Skipped ${path.relative(
                process.cwd(),
                targetFile
              )} (overwrite disabled)`
            );
            skippedCount++;
            continue;
          }

          if (skipIdentical) {
            const existingContent = fs.readFileSync(targetFile, "utf-8");

            // Skip if content is identical
            if (existingContent === fileContent) {
              console.log(
                `⏭️  Skipped ${path.relative(
                  process.cwd(),
                  targetFile
                )} (already up to date)`
              );
              skippedCount++;
              continue;
            }
          }
        }

        // Write the file
        fs.writeFileSync(targetFile, fileContent, "utf-8");
        console.log(
          `✅ Copied to: ${path.relative(process.cwd(), targetFile)}`
        );
        copiedCount++;
      } catch (error) {
        console.error(
          `❌ Failed to copy to ${path.relative(process.cwd(), targetFile)}:`,
          error
        );
        failedCount++;
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   • Copied: ${copiedCount} files`);
    console.log(`   • Skipped: ${skippedCount} files`);
    console.log(`   • Failed: ${failedCount} files`);
    console.log(`   • Total subdirectories: ${subdirs.length}`);
  } catch (error) {
    console.error("❌ Error during copy operation:", error);
    process.exit(1);
  }
}

/**
 * Get all subdirectories matching criteria
 */
function getSubdirectories(
  targetDir: string,
  recursive: boolean,
  include: string[],
  exclude: string[],
  filePattern?: RegExp
): string[] {
  const subdirs: string[] = [];

  function scanDirectory(dir: string, depth: number = 0) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(targetDir, fullPath);

        // Apply include filter
        if (
          include.length > 0 &&
          !include.some(
            (pattern) =>
              entry.name.includes(pattern) || relativePath.includes(pattern)
          )
        ) {
          continue;
        }

        // Apply exclude filter
        if (
          exclude.length > 0 &&
          exclude.some(
            (pattern) =>
              entry.name.includes(pattern) || relativePath.includes(pattern)
          )
        ) {
          continue;
        }

        // Apply file pattern filter
        if (filePattern && !filePattern.test(entry.name)) {
          continue;
        }

        subdirs.push(fullPath);

        // Recurse if enabled
        if (recursive) {
          scanDirectory(fullPath, depth + 1);
        }
      }
    }
  }

  scanDirectory(targetDir);
  return subdirs;
}

/**
 * Watch mode: Monitor source file for changes and auto-copy
 */
function watchFile(options: CopyOptions): void {
  const resolvedSourceFile = path.resolve(options.sourceFile);
  const sourceFileName = path.basename(resolvedSourceFile);

  console.log(`👀 Watching ${sourceFileName} for changes...`);
  console.log("   Press Ctrl+C to stop watching\n");

  // Initial copy
  copyFileToSubdirs(options);

  // Watch for changes
  fs.watchFile(resolvedSourceFile, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log(
        `\n🔄 ${sourceFileName} changed, copying to subdirectories...`
      );
      copyFileToSubdirs(options);
    }
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  options: CopyOptions;
  isWatchMode: boolean;
  showHelp: boolean;
} {
  const args = process.argv.slice(2);

  const isWatchMode = args.includes("--watch") || args.includes("-w");
  const showHelp = args.includes("--help") || args.includes("-h");

  // Default options for backwards compatibility
  let options: CopyOptions = {
    sourceFile: "public/globals.css",
    targetDir: "entrypoints",
    skipIdentical: true,
    overwrite: true,
  };

  // Parse custom options
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--source":
      case "-s":
        if (nextArg) options.sourceFile = nextArg;
        break;
      case "--target":
      case "-t":
        if (nextArg) options.targetDir = nextArg;
        break;
      case "--recursive":
      case "-r":
        options.recursive = true;
        break;
      case "--no-skip-identical":
        options.skipIdentical = false;
        break;
      case "--no-overwrite":
        options.overwrite = false;
        break;
      case "--include":
        if (nextArg) {
          options.include = nextArg.split(",").map((s) => s.trim());
        }
        break;
      case "--exclude":
        if (nextArg) {
          options.exclude = nextArg.split(",").map((s) => s.trim());
        }
        break;
      case "--pattern":
        if (nextArg) {
          options.filePattern = new RegExp(nextArg);
        }
        break;
    }
  }

  return { options, isWatchMode, showHelp };
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
📋 Generic File Copy Script

Usage:
  npx tsx copy-file.ts [options]

Options:
  -s, --source <path>         Source file to copy (default: public/globals.css)
  -t, --target <path>         Target directory (default: entrypoints)
  -r, --recursive             Include subdirectories recursively
  -w, --watch                 Watch for changes and auto-copy
  --include <patterns>        Include only directories matching patterns (comma-separated)
  --exclude <patterns>        Exclude directories matching patterns (comma-separated)
  --pattern <regex>           Only include directories matching regex pattern
  --no-skip-identical         Don't skip files with identical content
  --no-overwrite              Don't overwrite existing files
  -h, --help                  Show this help

Examples:
  # Copy globals.css to all entrypoint subdirectories
  npx tsx copy-file.ts

  # Copy a different file to a different location
  npx tsx copy-file.ts -s src/styles.css -t components

  # Copy recursively with exclusions
  npx tsx copy-file.ts -s config.json -t src -r --exclude node_modules,dist

  # Copy only to directories containing 'component' in the name
  npx tsx copy-file.ts -s types.d.ts -t src --include component

  # Watch mode for auto-copying
  npx tsx copy-file.ts --watch

  # Copy to directories matching a pattern
  npx tsx copy-file.ts -s .env.example -t . --pattern "^(api|web|mobile)$"
`);
}

// Main execution
function main(): void {
  const { options, isWatchMode, showHelp: helpRequested } = parseArgs();

  if (helpRequested) {
    showHelp();
    process.exit(0);
  }

  if (isWatchMode) {
    watchFile(options);
  } else {
    copyFileToSubdirs(options).then(() => {
      console.log("\n✨ Done!");
    });
  }
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

// Run the script
main();
