// Теми на листовете — рисунки, цветове и думите за тях (единствено / множествено число за текстовите задачи).
export type Theme = { id: string; label: string; color: string; soft: string; deep: string; icons: string[] }

export const THEMES: Theme[] = [
  { id: 'autumn', label: 'Есен в гората', color: '#ea580c', soft: '#fff7ed', deep: '#9a3412', icons: ['apple', 'pear', 'leaf', 'acorn', 'mushroom', 'pumpkin'] },
  { id: 'sea', label: 'На морето', color: '#0284c7', soft: '#f0f9ff', deep: '#075985', icons: ['fish', 'shell', 'starfish', 'boat', 'crab'] },
  { id: 'garden', label: 'В градината', color: '#16a34a', soft: '#f0fdf4', deep: '#166534', icons: ['flower', 'ladybug', 'bee', 'carrot', 'strawberry'] },
  { id: 'space', label: 'В космоса', color: '#7c3aed', soft: '#f5f3ff', deep: '#5b21b6', icons: ['star', 'rocket', 'planet', 'moon'] },
  { id: 'winter', label: 'Зимна приказка', color: '#0369a1', soft: '#eff6ff', deep: '#0c4a6e', icons: ['snowflake', 'mitten', 'snowman', 'beanie'] },
  { id: 'party', label: 'Рожден ден', color: '#db2777', soft: '#fdf2f8', deep: '#9d174d', icons: ['balloon', 'cupcake', 'gift', 'candy'] },
  { id: 'city', label: 'В града', color: '#475569', soft: '#f8fafc', deep: '#1e293b', icons: ['car', 'bus', 'house', 'tree'] },
]
export const themeById = (id: string) => THEMES.find(t => t.id === id) || THEMES[0]

/** [един, много (бройна форма)] — „3 ябълки“, „5 жълъда“ */
export const NOUN: Record<string, [string, string]> = {
  apple: ['ябълка', 'ябълки'], pear: ['круша', 'круши'], leaf: ['листо', 'листа'], acorn: ['жълъд', 'жълъда'], mushroom: ['гъба', 'гъби'], pumpkin: ['тиква', 'тикви'],
  fish: ['рибка', 'рибки'], shell: ['мида', 'миди'], starfish: ['морска звезда', 'морски звезди'], boat: ['лодка', 'лодки'], crab: ['рак', 'рака'],
  flower: ['цвете', 'цветя'], ladybug: ['калинка', 'калинки'], bee: ['пчела', 'пчели'], carrot: ['морков', 'моркова'], strawberry: ['ягода', 'ягоди'],
  star: ['звезда', 'звезди'], rocket: ['ракета', 'ракети'], planet: ['планета', 'планети'], moon: ['луна', 'луни'],
  snowflake: ['снежинка', 'снежинки'], mitten: ['ръкавица', 'ръкавици'], snowman: ['снежен човек', 'снежни човека'], beanie: ['шапка', 'шапки'],
  balloon: ['балон', 'балона'], cupcake: ['мъфин', 'мъфина'], gift: ['подарък', 'подаръка'], candy: ['бонбон', 'бонбона'],
  car: ['кола', 'коли'], bus: ['автобус', 'автобуса'], house: ['къща', 'къщи'], tree: ['дърво', 'дървета'], ball: ['топка', 'топки'],
}
export const noun = (id: string, n: number) => (n === 1 ? NOUN[id]?.[0] : NOUN[id]?.[1]) || ''
