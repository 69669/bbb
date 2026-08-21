// 构建后JS混淆脚本
// 使用 javascript-obfuscator 对 out/_next/static 下的JS文件进行混淆
// 注意：使用中等混淆级别，确保不破坏功能

const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const OUT_DIR = path.join(__dirname, "..", "out");
const STATIC_DIR = path.join(OUT_DIR, "_next", "static");

// 混淆配置（中等级别，确保不破坏功能）
const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  controlFlowFlatteningThreshold: 0,
  deadCodeInjection: false,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: "variable",
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

// 递归获取所有JS文件
function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(filePath));
    } else if (file.endsWith(".js") && !file.endsWith(".min.js")) {
      results.push(filePath);
    }
  }
  return results;
}

// 主函数
function main() {
  if (!fs.existsSync(STATIC_DIR)) {
    console.log("未找到 out/_next/static 目录，请先运行 npm run build");
    process.exit(1);
  }

  const jsFiles = getAllJsFiles(STATIC_DIR);
  console.log(`找到 ${jsFiles.length} 个JS文件，开始混淆...`);

  let success = 0;
  let failed = 0;

  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, "utf8");
      if (code.length < 100) continue;

      const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
      fs.writeFileSync(file, result.getObfuscatedCode());
      success++;
      console.log(`  ✓ ${path.relative(OUT_DIR, file)}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${path.relative(OUT_DIR, file)}: ${e.message}`);
    }
  }

  console.log(`\n混淆完成：成功 ${success} 个，失败 ${failed} 个`);
}

main();
