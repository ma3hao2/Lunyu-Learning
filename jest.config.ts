import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tarojs/taro$': '<rootDir>/tests/__mocks__/@tarojs/taro.ts',
    '^@tarojs/components$': '<rootDir>/tests/__mocks__/@tarojs/components.ts',
    '\\.(scss|css|sass|png|jpg|jpeg|gif|svg)$': '<rootDir>/tests/__mocks__/style.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        ...require('./tsconfig.json').compilerOptions,
        module: 'commonjs',
        target: 'es2019',
        jsx: 'react-jsx',
        esModuleInterop: true,
        noUnusedLocals: false,
        noUnusedParameters: false
      }
    }]
  },
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/data/versesLoader.ts',
    'src/data/dailyRecommend.ts',
    'src/hooks/**/*.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  verbose: true
};

export default config;
