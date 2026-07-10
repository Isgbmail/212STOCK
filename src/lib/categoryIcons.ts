import type { LucideIcon } from 'lucide-react';
import {
  Droplets, Leaf, Snowflake, Archive, Sparkles, Wrench, Box,
  FileText, Utensils, Package, ShoppingBag, Layers,
} from 'lucide-react';

interface CatStyle {
  Icon: LucideIcon;
  bg: string;
  color: string;
}

const STYLES: Record<string, CatStyle> = {
  'Boissons':                   { Icon: Droplets,    bg: '#EBF8FF', color: '#2B6CB0' },
  'Épicerie sèche':             { Icon: Layers,      bg: '#FFFFF0', color: '#744210' },
  'Produits laitiers':          { Icon: ShoppingBag, bg: '#FFF5F7', color: '#97266D' },
  'Boucherie & Charcuterie':    { Icon: Utensils,    bg: '#FFF5F5', color: '#C53030' },
  'Fruits & Légumes':           { Icon: Leaf,        bg: '#F0FFF4', color: '#276749' },
  'Surgelés':                   { Icon: Snowflake,   bg: '#EBF8FF', color: '#2C5282' },
  'Conserves':                  { Icon: Archive,     bg: '#FFFAF0', color: '#744210' },
  'Hygiène':                    { Icon: Sparkles,    bg: '#FAF5FF', color: '#553C9A' },
  'Entretien':                  { Icon: Wrench,      bg: '#F0FFF4', color: '#22543D' },
  'Emballages':                 { Icon: Box,         bg: '#EDF2F7', color: '#2D3748' },
  'Papeterie':                  { Icon: FileText,    bg: '#FFFFF0', color: '#744210' },
  'Food':                       { Icon: Utensils,    bg: '#F0FFF4', color: '#276749' },
  'Non-Food':                   { Icon: Sparkles,    bg: '#EDF2F7', color: '#553C9A' },
};

const DEFAULT: CatStyle = { Icon: Package, bg: '#EDF2F7', color: '#2D3748' };

export function getCatStyle(name: string): CatStyle {
  return STYLES[name] ?? DEFAULT;
}
