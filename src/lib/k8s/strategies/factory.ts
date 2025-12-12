import { DatabaseStrategy } from './types';
import { PostgresStrategy } from './postgres';
import { RedisStrategy } from './redis';

export class StrategyFactory {
  /**
   * Returns the appropriate strategy implementation for the given database type.
   * @param type - The type string (e.g. 'postgres', 'redis')
   * @returns The strategy instance
   * @throws Error if the type is unknown
   */
  static getStrategy(type: string): DatabaseStrategy {
    switch (type) {
      case 'postgres':
        return new PostgresStrategy();
      case 'redis':
        return new RedisStrategy();
      default:
        throw new Error(`Unknown database type strategy: ${type}`);
    }
  }
}
