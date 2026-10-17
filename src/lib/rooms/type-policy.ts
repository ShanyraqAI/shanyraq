/** Unit forms must never mutate the inherited category's shared values. */
export function inheritedTypeError(
  existing: { capacity: number; basePrice: number },
  requested: { capacity: number; basePrice: number },
): string | null {
  return existing.capacity !== requested.capacity || existing.basePrice !== requested.basePrice
    ? "Цена и вместимость наследуются от типа квартиры. Выберите существующий тип без изменения его параметров или создайте новый тип. Общий тариф меняется в разделе «Цены»."
    : null;
}
