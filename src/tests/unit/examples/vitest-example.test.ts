/**
 * Vitest 示例测试文件
 * 展示 Vitest 的一些独特功能和优势
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeVector } from '../../../utils/vectorUtils.js';

// 使用 Vitest 的 describe.concurrent 可以并行运行测试套件
describe.concurrent('Vitest 高级特性演示', () => {
  // 演示 Vitest 的快照测试
  test('向量归一化函数应该正确工作', () => {
    const vector = [3, 4, 0];
    const normalized = normalizeVector(vector);

    // 使用 toMatchSnapshot 进行快照测试
    expect(normalized).toMatchSnapshot();

    // 也可以使用传统断言
    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);
    expect(normalized[2]).toBeCloseTo(0);

    // 验证向量长度为 1
    const magnitude = Math.sqrt(
      normalized.reduce((sum: number, val: number) => sum + val * val, 0),
    );
    expect(magnitude).toBeCloseTo(1);
  });

  // 演示 Vitest 的模拟和间谍功能
  test('使用 vi.spyOn 监控函数调用', () => {
    // 创建一个对象和方法
    const mathUtils = {
      add: (a: number, b: number) => a + b,
      multiply: (a: number, b: number) => a * b,
    };

    // 使用 vi.spyOn 监控方法调用
    const addSpy = vi.spyOn(mathUtils, 'add');
    const multiplySpy = vi.spyOn(mathUtils, 'multiply');

    // 调用方法
    mathUtils.add(2, 3);
    mathUtils.multiply(4, 5);

    // 验证调用
    expect(addSpy).toHaveBeenCalledWith(2, 3);
    expect(multiplySpy).toHaveBeenCalledWith(4, 5);
    expect(addSpy).toHaveBeenCalledOnce();
  });

  // 演示 Vitest 的模拟定时器功能
  test('使用 vi.useFakeTimers 测试异步代码', async () => {
    vi.useFakeTimers();

    let value = 0;

    // 创建一个延迟执行的函数
    const delayedIncrement = () => {
      setTimeout(() => {
        value++;
      }, 1000);
    };

    // 调用函数
    delayedIncrement();

    // 验证初始值
    expect(value).toBe(0);

    // 快进时间
    await vi.advanceTimersByTimeAsync(1000);

    // 验证更新后的值
    expect(value).toBe(1);

    // 恢复真实定时器
    vi.useRealTimers();
  });

  // 演示 Vitest 的 test.each 功能
  test.each([
    { input: [1, 2], expected: [0.4472, 0.8944] },
    { input: [5, 0], expected: [1, 0] },
    { input: [0, 0], expected: [0, 0] },
  ])('向量归一化 $input -> $expected', ({ input, expected }) => {
    const normalized = normalizeVector(input);

    // 使用 toBeCloseTo 进行浮点数比较
    normalized.forEach((value: number, index: number) => {
      if (expected[index] !== 0) {
        expect(value).toBeCloseTo(expected[index], 4);
      } else {
        expect(value).toBe(0);
      }
    });
  });
});

// 演示 Vitest 的测试套件隔离
describe('隔离的测试套件', () => {
  let counter = 0;

  beforeEach(() => {
    counter++;
  });

  test('计数器应该为 1', () => {
    expect(counter).toBe(1);
  });

  test('计数器应该为 2', () => {
    expect(counter).toBe(2);
  });

  test('计数器应该为 3', () => {
    expect(counter).toBe(3);
  });
});
