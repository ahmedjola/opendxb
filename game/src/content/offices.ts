import type { Office } from './types';

/**
 * The district's offices.
 *
 * These are FICTIONAL, GENERIC desks invented for this game. They are not, and
 * do not represent, any real authority, department or service centre. No real
 * logo, crest, seal or official colour scheme is used anywhere — the palettes
 * below are invented dusk/sand colours.
 */
export const OFFICES: readonly Office[] = [
  {
    id: 'residency-desk',
    nameEn: 'Residency Desk',
    nameAr: 'مكتب الإقامة',
    blurbEn: 'Questions about residence visas and staying long-term.',
    x: 5,
    y: 4,
    wall: 0x3d5a80,
    roof: 0x293f5c,
  },
  {
    id: 'records-desk',
    nameEn: 'Records Desk',
    nameAr: 'مكتب السجلات',
    blurbEn: 'Questions about ID cards and personal records.',
    x: 20,
    y: 4,
    wall: 0x6a5acd,
    roof: 0x4b3f9a,
  },
  {
    id: 'housing-desk',
    nameEn: 'Housing Desk',
    nameAr: 'مكتب الإسكان',
    blurbEn: 'Questions about renting, tenancy contracts and Ejari.',
    x: 35,
    y: 4,
    wall: 0xb56576,
    roof: 0x8a4457,
  },
  {
    id: 'utilities-desk',
    nameEn: 'Utilities Desk',
    nameAr: 'مكتب الخدمات',
    blurbEn: 'Questions about electricity, water and connecting a home.',
    x: 5,
    y: 22,
    wall: 0x4f9d8b,
    roof: 0x367567,
  },
  {
    id: 'roads-desk',
    nameEn: 'Roads Desk',
    nameAr: 'مكتب الطرق',
    blurbEn: 'Questions about driving licences and getting around.',
    x: 20,
    y: 22,
    wall: 0xc08552,
    roof: 0x93613a,
  },
  {
    id: 'everyday-desk',
    nameEn: 'Everyday Desk',
    nameAr: 'مكتب الحياة اليومية',
    blurbEn: 'Questions about schools, health insurance and bank accounts.',
    x: 35,
    y: 22,
    wall: 0x7d8597,
    roof: 0x5b6272,
  },
];

export function getOffice(id: string): Office | undefined {
  return OFFICES.find((o) => o.id === id);
}
