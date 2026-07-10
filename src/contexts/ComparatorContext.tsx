import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Product } from '../types';

interface ComparatorCtx {
  items: Product[];
  addItem: (p: Product) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  hasItem: (id: string) => boolean;
}

const Ctx = createContext<ComparatorCtx>({
  items: [], addItem: () => {}, removeItem: () => {}, clearItems: () => {}, hasItem: () => false,
});

export function ComparatorProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Product[]>(() => {
    try {
      const s = localStorage.getItem('s212_comparator');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('s212_comparator', JSON.stringify(items));
  }, [items]);

  function addItem(p: Product) {
    setItems((prev) => {
      if (prev.find((x) => x.id === p.id) || prev.length >= 4) return prev;
      return [...prev, p];
    });
  }
  function removeItem(id: string) { setItems((prev) => prev.filter((x) => x.id !== id)); }
  function clearItems() { setItems([]); }
  function hasItem(id: string) { return items.some((x) => x.id === id); }

  return <Ctx.Provider value={{ items, addItem, removeItem, clearItems, hasItem }}>{children}</Ctx.Provider>;
}

export function useComparator() { return useContext(Ctx); }
