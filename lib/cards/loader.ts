import cardsData from '@/data/cards.json';
import { CardsData, CreditCard } from '@/lib/types';

export function loadCards(): CreditCard[] {
  const data = cardsData as CardsData;
  return data.cards;
}

export function getCardsData(): CardsData {
  return cardsData as CardsData;
}
