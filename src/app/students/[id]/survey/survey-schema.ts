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
      { key: 'onset', label: 'Поява на нарушението / календарна възраст', type: 'textarea' },
      { key: 'change', label: 'Забелязва ли се промяна (влошаване/подобрение)', type: 'textarea' },
      { key: 'other_conditions', label: 'Други заболявания / алергии', type: 'textarea' },
      { key: 'diet', label: 'Специален режим на хранене (диета, непоносимост)', type: 'textarea' },
      { key: 'medications', label: 'Взема ли лекарства? Какви?', type: 'textarea' },
      { key: 'motor_disorders', label: 'Наличие на двигателни нарушения', type: 'textarea' },
      { key: 'vision', label: 'Сензорни нарушения — зрение, очила (откога и защо)', type: 'textarea' },
      { key: 'hearing', label: 'Сензорни нарушения — слух, възприемане на звуци/реч', type: 'textarea' },
      { key: 'sensitivity', label: 'Чувствителност/непоносимост към шум, светлина, температура, миризми', type: 'textarea' },
    ],
    hasNotes: true,
  },
  {
    key: 'early_development',
    title: 'I.2. Ранно психо-моторно развитие',
    intro: 'Възраст и особености по показатели',
    ageColumn: true,
    fields: [
      { key: 'pregnancy', label: 'Бременност на майката', type: 'textarea' },
      { key: 'birth', label: 'Раждане', type: 'textarea' },
      { key: 'sit_crawl', label: 'Двигателно развитие — седи, пълзи', type: 'textarea' },
      { key: 'walk', label: 'Двигателно развитие — ходи', type: 'textarea' },
      { key: 'breastfeeding', label: 'Кърмене', type: 'textarea' },
      { key: 'toilet', label: 'Контрол на тазово-резервоарни функции', type: 'textarea' },
      { key: 'cooing', label: 'Гукане', type: 'textarea' },
      { key: 'babble', label: 'Лепет', type: 'textarea' },
      { key: 'first_words', label: 'Поява на първи думи', type: 'textarea' },
      { key: 'sentences', label: 'Поява на изречения', type: 'textarea' },
    ],
    hasNotes: true,
  },
  {
    key: 'play_behavior',
    title: 'I.3. Игра и поведение',
    fields: [
      { key: 'typical_home', label: 'Типично поведение вкъщи', type: 'textarea' },
      { key: 'family_activities', label: 'Семейни дейности, в които детето участва', type: 'textarea' },
      { key: 'favorite', label: 'Любими играчки / занимания', type: 'textarea' },
      { key: 'disliked', label: 'Играчки/дейности, които не харесва', type: 'textarea' },
      { key: 'exploration', label: 'Как изследва предметите (зрително, тактилно, слухово, орално, обоняние)', type: 'textarea' },
      { key: 'oddities', label: 'Странности в поведението (докосване, храни, вода, контакт, дрехи)', type: 'textarea' },
      { key: 'activity_level', label: 'Ниво на активност / хиперактивност / дефицит на вниманието', type: 'textarea' },
      { key: 'rituals', label: 'Неизменност на средата, стереотипно поведение, ритуали', type: 'textarea' },
      { key: 'screen_time', label: 'Екранно време', type: 'textarea' },
      { key: 'play_skills', label: 'Игрови умения (предметно-манипулативни, функционална употреба, конструктивни, сюжетно-ролеви, с правила, с възрастни, с връстници)', type: 'textarea' },
    ],
    hasNotes: true,
  },
  {
    key: 'interaction',
    title: 'I.4. Интеракция',
    fields: [
      { key: 'siblings', label: 'Взаимодействия с братя/сестри', type: 'textarea' },
      { key: 'peers', label: 'Отношения с връстници (поведение, приемане от групата)', type: 'textarea' },
      { key: 'adults', label: 'Отношения с възрастни (начален контакт, авторитети, раздяла)', type: 'textarea' },
    ],
  },
  {
    key: 'emotions',
    title: 'I.5. Емоции и регулация',
    fields: [
      { key: 'mood_changes', label: 'Често ли сменя настроението и поради каква причина', type: 'textarea' },
      { key: 'crises', label: 'Изпада ли в кризи? Какво ги провокира', type: 'textarea' },
      { key: 'calming', label: 'Какво го успокоява в криза (думи, тактилно, друго)', type: 'textarea' },
      { key: 'self_calm', label: 'Може ли да се успокои само за 2–5 минути', type: 'textarea' },
      { key: 'aggression', label: 'Агресивно или автоагресивно поведение', type: 'textarea' },
      { key: 'transitions', label: 'Лесно ли преминава от една дейност в друга', type: 'textarea' },
      { key: 'motivation', label: 'Какво го поощрява / мотивира', type: 'textarea' },
    ],
    hasNotes: true,
  },
  {
    key: 'communication',
    title: 'I.6. Комуникация',
    fields: [
      { key: 'eye_contact', label: 'Очен контакт, споделено внимание, реакция на име, жестове', type: 'textarea' },
      { key: 'ways', label: 'Как общува (иска нещо, боли го, отказва, иска почивка)', type: 'textarea' },
      { key: 'aac', label: 'Допълнителна алтернативна комуникация', type: 'textarea' },
      { key: 'bilingual', label: 'Билингвизъм', type: 'textarea' },
    ],
  },
  {
    key: 'autonomy',
    title: 'I.7. Автономност',
    fields: [
      { key: 'self_care', label: 'Умения за самообслужване (кое затруднява най-много)', type: 'textarea' },
      { key: 'independence', label: 'Ниво на независимост (придружител, помощни средства, придвижване)', type: 'textarea' },
      { key: 'positioning', label: 'Специализирано място за позициониране (хранене, учене, игра, сън)', type: 'textarea' },
    ],
  },
  {
    key: 'family',
    title: 'I.8. Семейни отношения',
    fields: [
      { key: 'family_type', label: 'Вид семейство (двама/един родител, доведен, нуклеарно/разширено)', type: 'textarea' },
      { key: 'children_count', label: 'Брой деца в семейството', type: 'text' },
      { key: 'contact_frequency', label: 'Честота на контактите с родителите', type: 'textarea' },
      { key: 'contact_quality', label: 'Качество на контактите с родителите', type: 'textarea' },
      { key: 'housing', label: 'Жилищни условия', type: 'textarea' },
      { key: 'employment', label: 'Трудова заетост на родителите', type: 'textarea' },
      { key: 'basic_care', label: 'Осигурени ли са основни грижа и закрила', type: 'textarea' },
      { key: 'emotional_bond', label: 'Емоционална връзка и стабилност на отношенията', type: 'textarea' },
      { key: 'parenting_style', label: 'Родителски стил на възпитание', type: 'textarea' },
      { key: 'family_burden', label: 'Фамилна обремененост', type: 'textarea' },
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
