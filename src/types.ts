// Модель данных Tea Journal

export interface Tea {
  id: string;
  name: string;
  type: string;
  origin: string; // регион / провинция
  producer: string; // фабрика / магазин / мастер
  year: string; // год сбора или прессовки (строкой: бывает «весна 2023»)
  stockGrams: number | null; // остаток в граммах
  favorite: boolean;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Steep {
  id: string;
  tempC: number | null;
  seconds: number | null;
  notes: string;
}

export interface Ratings {
  aroma: number; // 0 = без оценки, 1..5
  taste: number;
  aftertaste: number;
  overall: number;
}

export interface Session {
  id: string;
  teaId: string;
  date: string; // локальная дата-время "YYYY-MM-DDTHH:mm"
  method: string;
  vessel: string;
  leafGrams: number | null;
  waterMl: number | null;
  water: string;
  dryAroma: string;
  warmAroma: string;
  taste: string;
  texture: string;
  aftertaste: string;
  tags: string[];
  steeps: Steep[];
  ratings: Ratings;
  comment: string;
  createdAt: number;
  updatedAt: number;
}

export interface Backup {
  app: 'tea-journal';
  version: 1;
  exportedAt: string;
  teas: Tea[];
  sessions: Session[];
}

export const TEA_TYPES = [
  'Зелёный',
  'Белый',
  'Жёлтый',
  'Улун',
  'Красный (хун ча)',
  'Шэн пуэр',
  'Шу пуэр',
  'Хэй ча (Лю Бао и др.)',
  'Травяной',
  'Другое',
];

/** Стартовая температура воды по типу чая — просто подсказка. */
export const DEFAULT_TEMP: Record<string, number> = {
  'Зелёный': 80,
  'Белый': 85,
  'Жёлтый': 85,
  'Улун': 95,
  'Красный (хун ча)': 90,
  'Шэн пуэр': 95,
  'Шу пуэр': 100,
  'Хэй ча (Лю Бао и др.)': 100,
  'Травяной': 95,
  'Другое': 95,
};

export const METHODS = [
  'Гунфу (проливы)',
  'Гайвань',
  'Исинский чайник',
  'Типот / гриппа',
  'Западный способ',
  'Холодное заваривание',
  'Варка',
];

export const DESCRIPTOR_GROUPS: { name: string; tags: string[] }[] = [
  { name: 'Цветочные', tags: ['цветочный', 'орхидея', 'жасмин', 'роза', 'сирень', 'ландыш'] },
  { name: 'Фрукты и ягоды', tags: ['фруктовый', 'ягодный', 'цитрус', 'косточковые', 'сухофрукты', 'чернослив', 'яблоко'] },
  { name: 'Сладкие', tags: ['медовый', 'карамель', 'шоколад', 'ваниль', 'выпечка', 'солодовый'] },
  { name: 'Растительные', tags: ['травяной', 'овощной', 'сено', 'хвоя', 'морской'] },
  { name: 'Древесные и пряные', tags: ['древесный', 'камфора', 'пряный', 'ореховый', 'дымный', 'жареный', 'табак', 'кожа'] },
  { name: 'Землистые', tags: ['землистый', 'грибной', 'лесная подстилка', 'погреб', 'минеральный'] },
];

export const ALL_DESCRIPTORS = DESCRIPTOR_GROUPS.flatMap((g) => g.tags);
