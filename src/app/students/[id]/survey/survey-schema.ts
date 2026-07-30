// Структура на анкетата "Карта за оценка на индивидуалните потребности на детето"
// Всяка секция има ключ, заглавие и полета. Полетата се пазят в JSON по ключ.

export interface SurveyField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'age'  // age = отделна колона "възраст" (за психо-моторното)
}

export interface SurveySection {
  key: string
  title: string
  intro?: string           // въпрос/подзаглавие над таблицата
  fields: SurveyField[]
  hasNotes?: boolean       // има ли поле "Бележки" накрая
  ageColumn?: boolean      // таблицата има колона "Възраст" (раздел 2)
}

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    key: 'child_data',
    title: 'Данни за детето',
    fields: [
      { key: 'full_name', label: 'Трите имена', type: 'text' },
      { key: 'nickname', label: 'Обръщение към детето', type: 'text' },
      { key: 'age', label: 'Възраст', type: 'text' },
      { key: 'group', label: 'Група', type: 'text' },
      { key: 'parent_name', label: 'Име на родителя', type: 'text' },
      { key: 'phone', label: 'Телефон', type: 'text' },
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'doctor', label: 'Личен лекар', type: 'text' },
    ],
  },
  {
    key: 'professional_help',
    title: 'Професионална помощ в грижите за детето',
    fields: [
      { key: 'past', label: 'В минали периоди', type: 'textarea' },
      { key: 'present', label: 'В момента', type: 'textarea' },
      { key: 'education_so_far', label: 'Обучавано ли е детето до момента (заведение, група/клас, форма)', type: 'textarea' },
    ],
  },
  {
    key: 'actual_condition',
    title: 'I.1. Актуално състояние',
    fields: [
      { key: 'disability_type', label: 'Вид увреждане (по медицински документи)', type: 'textarea' },
      { key: 'onset', label: 'Поява на нарушението / календарна възраст', type: 'text' },
      { key: 'change', label: 'Забелязва ли се промяна (влошаване/подобрение)', type: 'text' },
      { key: 'other_conditions', label: 'Други заболявания / алергии', type: 'text' },
      { key: 'diet', label: 'Специален режим на хранене (диета, непоносимост)', type: 'text' },
      { key: 'medications', label: 'Взема ли лекарства? Какви?', type: 'text' },
      { key: 'motor_disorders', label: 'Наличие на двигателни нарушения', type: 'text' },
      { key: 'vision', label: 'Сензорни нарушения — зрение, очила (откога и защо)', type: 'text' },
      { key: 'hearing', label: 'Сензорни нарушения — слух, възприемане на звуци/реч', type: 'text' },
      { key: 'sensitivity', label: 'Чувствителност/непоносимост към шум, светлина, температура, миризми', type: 'text' },
    ],
    hasNotes: true,
  },
  {
    key: 'early_development',
    title: 'I.2. Ранно психо-моторно развитие',
    intro: 'Възраст и особености по показатели',
    ageColumn: true,
    fields: [
      { key: 'pregnancy', label: 'Бременност на майката', type: 'text' },
      { key: 'birth', label: 'Раждане', type: 'text' },
      { key: 'sit_crawl', label: 'Двигателно развитие — седи, пълзи', type: 'text' },
      { key: 'walk', label: 'Двигателно развитие — ходи', type: 'text' },
      { key: 'breastfeeding', label: 'Кърмене', type: 'text' },
      { key: 'toilet', label: 'Контрол на тазово-резервоарни функции', type: 'text' },
      { key: 'cooing', label: 'Гукане', type: 'text' },
      { key: 'babble', label: 'Лепет', type: 'text' },
      { key: 'first_words', label: 'Поява на първи думи', type: 'text' },
      { key: 'sentences', label: 'Поява на изречения', type: 'text' },
    ],
    hasNotes: true,
  },
  {
    key: 'play_behavior',
    title: 'I.3. Игра и поведение',
    fields: [
      { key: 'typical_home', label: 'Типично поведение вкъщи', type: 'text' },
      { key: 'family_activities', label: 'Семейни дейности, в които детето участва', type: 'text' },
      { key: 'favorite', label: 'Любими играчки / занимания', type: 'text' },
      { key: 'disliked', label: 'Играчки/дейности, които не харесва', type: 'text' },
      { key: 'exploration', label: 'Как изследва предметите (зрително, тактилно, слухово, орално, обоняние)', type: 'text' },
      { key: 'oddities', label: 'Странности в поведението (докосване, храни, вода, контакт, дрехи)', type: 'text' },
      { key: 'activity_level', label: 'Ниво на активност / хиперактивност / дефицит на вниманието', type: 'text' },
      { key: 'rituals', label: 'Неизменност на средата, стереотипно поведение, ритуали', type: 'text' },
      { key: 'screen_time', label: 'Екранно време', type: 'text' },
      { key: 'play_skills', label: 'Игрови умения (предметно-манипулативни, функционална употреба, конструктивни, сюжетно-ролеви, с правила, с възрастни, с връстници)', type: 'textarea' },
    ],
    hasNotes: true,
  },
  {
    key: 'interaction',
    title: 'I.4. Интеракция',
    fields: [
      { key: 'siblings', label: 'Взаимодействия с братя/сестри', type: 'text' },
      { key: 'peers', label: 'Отношения с връстници (поведение, приемане от групата)', type: 'text' },
      { key: 'adults', label: 'Отношения с възрастни (начален контакт, авторитети, раздяла)', type: 'text' },
    ],
  },
  {
    key: 'emotions',
    title: 'I.5. Емоции и регулация',
    fields: [
      { key: 'mood_changes', label: 'Често ли сменя настроението и поради каква причина', type: 'text' },
      { key: 'crises', label: 'Изпада ли в кризи? Какво ги провокира', type: 'text' },
      { key: 'calming', label: 'Какво го успокоява в криза (думи, тактилно, друго)', type: 'text' },
      { key: 'self_calm', label: 'Може ли да се успокои само за 2–5 минути', type: 'text' },
      { key: 'aggression', label: 'Агресивно или автоагресивно поведение', type: 'text' },
      { key: 'transitions', label: 'Лесно ли преминава от една дейност в друга', type: 'text' },
      { key: 'motivation', label: 'Какво го поощрява / мотивира', type: 'text' },
    ],
    hasNotes: true,
  },
  {
    key: 'communication',
    title: 'I.6. Комуникация',
    fields: [
      { key: 'eye_contact', label: 'Очен контакт, споделено внимание, реакция на име, жестове', type: 'text' },
      { key: 'ways', label: 'Как общува (иска нещо, боли го, отказва, иска почивка)', type: 'text' },
      { key: 'aac', label: 'Допълнителна алтернативна комуникация', type: 'text' },
      { key: 'bilingual', label: 'Билингвизъм', type: 'text' },
    ],
  },
  {
    key: 'autonomy',
    title: 'I.7. Автономност',
    fields: [
      { key: 'self_care', label: 'Умения за самообслужване (кое затруднява най-много)', type: 'text' },
      { key: 'independence', label: 'Ниво на независимост (придружител, помощни средства, придвижване)', type: 'text' },
      { key: 'positioning', label: 'Специализирано място за позициониране (хранене, учене, игра, сън)', type: 'text' },
    ],
  },
  {
    key: 'family',
    title: 'I.8. Семейни отношения',
    fields: [
      { key: 'family_type', label: 'Вид семейство (двама/един родител, доведен, нуклеарно/разширено)', type: 'text' },
      { key: 'children_count', label: 'Брой деца в семейството', type: 'text' },
      { key: 'contact_frequency', label: 'Честота на контактите с родителите', type: 'text' },
      { key: 'contact_quality', label: 'Качество на контактите с родителите', type: 'text' },
      { key: 'housing', label: 'Жилищни условия', type: 'text' },
      { key: 'employment', label: 'Трудова заетост на родителите', type: 'text' },
      { key: 'basic_care', label: 'Осигурени ли са основни грижа и закрила', type: 'text' },
      { key: 'emotional_bond', label: 'Емоционална връзка и стабилност на отношенията', type: 'text' },
      { key: 'parenting_style', label: 'Родителски стил на възпитание', type: 'text' },
      { key: 'family_burden', label: 'Фамилна обремененост', type: 'text' },
    ],
    hasNotes: true,
  },
  {
    key: 'parent_view',
    title: 'Родителят',
    fields: [
      { key: 'coping', label: 'С какво родителят се справя и с какво среща затруднения (най-големи предизвикателства)', type: 'textarea' },
      { key: 'expectations', label: 'Очаквания на родителя относно престоя в ЦСОП-Варна', type: 'textarea' },
    ],
  },
]
