// @ts-check
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

// 全局环境配置
const globals = {
  // Node.js 全局变量
  process: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  fetch: 'readonly',
  global: 'readonly', // 添加 global 变量支持

  // Jest 全局变量
  describe: 'readonly',
  test: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  jest: 'readonly',
  fail: 'readonly',
};

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // 基本代码质量规则
      'no-console': 'off', // 允许使用 console
      'no-useless-escape': 'warn', // 降级为警告
      'prefer-template': 'warn', // 优先使用模板字符串
      'no-var': 'error', // 不允许使用 var
      'prefer-const': 'warn', // 优先使用 const
      'no-param-reassign': 'warn', // 不建议修改参数

      // TypeScript 基本规则
      'no-unused-vars': 'off', // 使用理解 TypeScript 参数属性的扩展规则
      '@typescript-eslint/explicit-function-return-type': 'off', // 暂时关闭返回类型检查
      '@typescript-eslint/no-explicit-any': 'warn', // 警告使用 any 类型
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // 启用部分类型感知规则（需要 project 配置）
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',

      // 代码风格规则
      'arrow-body-style': 'off', // 关闭箭头函数体样式检查
      'prefer-arrow-callback': 'warn', // 优先使用箭头函数
      'object-shorthand': 'warn', // 优先使用对象简写
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/tests/**/*.ts',
      '**/utils/__tests__/**/*.ts',
    ],
    languageOptions: {
      globals: {
        ...globals,
        // 额外的测试全局变量
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        fail: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-undef': 'off', // 测试文件中关闭未定义变量检查
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '*.log',
      'jest.config.js',
      'commitlint.config.js',
      'src/tests/testFallbackLoader.js', // 特殊的测试文件
      'config/printConfigEnv.ts', // 配置文件，不在 TypeScript 项目中
    ],
  },
  // 处理脚本文件
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  // 全局类型声明文件特殊处理
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-var': 'off', // 允许在类型声明文件中使用 var
      'no-unused-vars': 'off', // 关闭未使用变量检查
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // 处理未使用变量的问题
  {
    files: ['**/src/**/*.ts'],
    rules: {
      // 使用 TypeScript 的规则而非 ESLint 原生规则
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          // 允许接口定义中的未使用变量
          args: 'none',
        },
      ],
    },
  },
  prettierConfig,
];
