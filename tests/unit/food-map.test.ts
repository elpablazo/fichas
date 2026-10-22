import { describe, expect, it } from 'vitest';
import { foodSprite } from '../../src/client/sprites/food-map';

describe('food sprites', () => {
  it('pick the specific food before the generic word inside it', () => {
    expect(foodSprite('1 tortilla de maíz')).toBe('tortilla');
    expect(foodSprite('1 tz papaya')).toBe('papaya');
    expect(foodSprite('½ papa cocida')).toBe('papa');
    expect(foodSprite('1 elote')).toBe('elote');
    expect(foodSprite('Sándwich de pollo')).toBe('sandwich');
    expect(foodSprite('Tacos al pastor')).toBe('taco');
    expect(foodSprite('2 cdta crema de cacahuate')).toBe('cacahuate');
    expect(foodSprite('⅓ aguacate')).toBe('aguacate');
    expect(foodSprite('1 vaso de agua')).toBe('agua');
    expect(foodSprite('1 tz leche')).toBe('leche');
    expect(foodSprite('Latte')).toBe('leche');
    expect(foodSprite('1 pan dulce')).toBe('pandulce');
    expect(foodSprite('2 reb pan de caja')).toBe('pan');
    expect(foodSprite('120 g pollo')).toBe('pollo');
    expect(foodSprite('1 jitomate')).toBe('jitomate');
  });

  it('falls back to null for foods without a drawing', () => {
    expect(foodSprite('kombucha')).toBeNull();
  });
});
