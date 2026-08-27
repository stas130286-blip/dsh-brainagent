# Каталог событий шины (EventBus)

> v0.9.21 · 88 публикуемых событий · 46 со слушателями · 42 — осознанная телеметрия.
> Ничего «в никуда»: каждое событие либо меняет поведение агента, либо
> задокументировано здесь как наблюдательная точка. Скрипт-аудитор:
> «уникальные эмиттеры + слушатели» по всем *.ts в src/.

Шина — нервная система агента. Модули публикуют события (bus.emit/emitSync)
и подписываются на них (bus.on). События делятся на два класса:

- **Активные** — реакция слушателя меняет состояние или поведение агента.
- **Телеметрия** — осознанные наблюдательные точки для отладки, метрик и
  будущих реакций. Слушатель им не нужен по дизайну: реакция на них сейчас
  создала бы петли обратной связи или спам инициатив.

## Проводки «мозг → агент» (v0.9.21)

Пять событий закрыты реакциями по аналогии с механизмами человеческого мозга:

| Событие | Реакция | Аналог в мозге |
| --- | --- | --- |
| `metabolic:energy-low` | Витальный импульс: порог инициативы +25% (до +75%) | Накопление глутамата в латеральной ПФК повышает «стоимость усилия» добровольных действий |
| `metabolic:rebalanced` | Витальный импульс: усталость сброшена | Восстановление ресурсов после отдыха снимает усталость |
| `emergent:pattern-established` | Витальный импульс: давление +0.45 (вес в конфиге) | Инсайт — дофаминергический всплеск «ага-момента» |
| `goal:expired` | Goal-stack: угасание желаний ×0.85 для не-пользовательских целей | Негативная ошибка предсказания дофамина → угасание связи |
| `dmn:association-found` | Дофаминовая система: сигнал новизны | Гиппокампальная новизна усиливает консолидацию (Лисман–Грейс) |

Плюс вызов `prepareProactiveContext` при сборке контекста: сеть пассивного
режима заранее готовит материал для предсказанных тем (проспективная функция
ДМН). Реконсолидация воспоминаний уже жила в коде: `recallEpisodes`
инкрементирует `accessCount` и значимость извлечённых эпизодов (правило Хебба).

## ⚡ Активные события (46)

| Событие | Источник | Слушатели | Эффект |
| --- | --- | --- | --- |
| amygdala:assessed | amygdala, cycles | mastery-drive, social-drive | Эмоц. оценка питает драйвы |
| arbiter:drive-selected | drive-arbiter | vital-impulse | Приоритет драйва → давление |
| autonomy:desire-escalated | goal-stack | vital-impulse | Растущее желание → давление |
| basal:habit-matched | context | neural-pathways | Привычка активирована |
| basal:reinforced | cycles | reward-ledger | Подкрепление в реестр наград |
| cerebellum:validated | cerebellum | cognitive-hunger, learning-coordinator, mastery-drive, neural-pathways, reward-ledger | Валидация прогноза |
| circadian:phase-changed | circadian-rhythm | index | Сон → мысли ДМН + ассоциации |
| circadian:wake-started | circadian-rhythm | vital-impulse | Пробуждение → давление |
| curiosity:gap-detected | curiosity-drive | cognitive-hunger, vital-impulse | Пробел знания → голод/давление |
| curiosity:question-generated | curiosity-drive | creative-drive, vital-impulse | Вопрос → творчество/давление |
| dmn:association-found | dmn | index | **Новизна → дофамин (v0.9.21)** |
| dmn:insight-generated | dmn | creative-drive, vital-impulse | Инсайт → насыщение/давление |
| dmn:thought-generated | dmn | creative-drive, vital-impulse | Фоновая мысль |
| dopamine:prediction-error | dopamine-system | mastery-drive | Ошибка предсказания |
| dopamine:reward | dopamine-system | drive-arbiter, drive-engine, interoception, learning-coordinator, mastery-drive, neural-pathways, reward-ledger, vital-impulse | Главная награда: обучает всё |
| dream:consolidation-complete | dream-mode | learning-coordinator, neural-pathways | Консолидация сна |
| emergent:pattern-established | emergent-modules | vital-impulse | **Ага-момент → давление (v0.9.21)** |
| emotional-memory:flashbulb-stored | emotional-memory | vital-impulse | Яркая память → давление |
| goal:completed | goal-stack | index | Внутренняя награда цикла |
| goal:expired | goal-stack | goal-stack | **Угасание желаний (v0.9.21)** |
| goal:triggered | goal-stack | vital-impulse | Цель сработала → давление |
| hippocampus:fact-revised | hippocampus | learning-coordinator | Ревизия факта |
| hippocampus:stored | hippocampus | cognitive-hunger | Запоминание → микро-насыщение |
| identity:capability-updated | agent-identity | mastery-drive | Новая способность |
| identity:significant-experience | agent-identity | vital-impulse | Значимый опыт → давление |
| interoception:state-updated | interoception | vital-impulse | Самочувствие → порог |
| learning:domain-performance-updated | learning-coordinator | cognitive-hunger, mastery-drive | Успехи в домене |
| learning:insight-discovered | learning-coordinator | cognitive-hunger, neural-pathways, vital-impulse | Учебный инсайт |
| mastery-drive:need-rising / urge | mastery-drive | vital-impulse | Драйв мастерства |
| meta:gap-detected | introspection | vital-impulse | Пробел сознания |
| metabolic:energy-low | metabolic-budget | vital-impulse | **Усталость → порог (v0.9.21)** |
| metabolic:rebalanced | metabolic-budget | vital-impulse | **Отдых → сброс усталости (v0.9.21)** |
| mirror:user-updated | mirror-neurons | neural-pathways | Модель пользователя |
| neuromodulator:state-changed | dopamine-system | neural-pathways | Нейромодуляторный фон |
| pathway:prediction-validated | neural-pathways | reward-ledger | Прогноз пути подтверждён |
| predictive:predicted | context | neural-pathways | Предсказание тем |
| proactive:reaction | proactive-feedback | reward-ledger | Реакция на проакцию |
| qualia:experience-generated | emotional-memory | creative-drive, vital-impulse | Субъективный опыт |
| reward:recorded | reward-ledger | strategy-bandit | Награда → выбор стратегии |
| structure:pathway-activated / created | structural-plasticity | vital-impulse | Рост структуры |
| temporal:long-absence / frequent-engagement | temporal-awareness | vital-impulse | Временны́е паттерны |
| thalamus:classified | thalamus, cycles | drive-engine, mastery-drive, neural-pathways | Классификация входа |
| vital-impulse:fired | vital-impulse | index, autonomy-enricher, drive-engine, interoception, mastery-drive | Срабатывание инициативы |

(`bandit:arm-chosen` слушается только в обучающем эвале — в продакшене это телеметрия.)

## 📊 Осознанная телеметрия (42)

Эти события публикуются для наблюдаемости. Слушатели им **не нужны сейчас**:
каждое либо дублирует уже обработанный сигнал, либо реакция на него создала бы
петлю (модуль реагирует на собственную работу). Удаление запрещено политикой
релиза — это точки подключения будущих версий.

### Рабочая память и внимание
- `working-memory:entry-added`, `working-memory:context-built` — след сборки контекста.
- `attention:filtered`, `attention:section-dropped`, `attention:budget-exceeded` — решения аттенционного гейта; реакция создала бы петлю перефильтрации.

### Цели и воля
- `goal:created`, `goal:recurring-scheduled` — журнал создания целей (`goal:triggered/completed/expired` уже активны).
- `volition:desire-activated`, `volition:decision-made` — след волевых решений.

### Цикл мышления и интроспекция
- `introspection:trace-complete`, `introspection:confidence-assessed`, `meta:self-question` — следы самоанализа.
- `prefrontal:decision` — решение префронтального модуля.
- `arbiter:conflict-resolved` — журнал разрешения конфликтов драйвов (сам выбор `arbiter:drive-selected` активен).

### Память и обучение
- `hippocampus:recalled` — сам факт извлечения уже усиливает память внутри `recallEpisodes` (правило Хебба); внешний слушатель дублировал бы эффект.
- `pathway:memory-reinforced`, `pathway:habit-promoted`, `synapse:weight-updated`, `synapse:pathway-strengthened`, `synapse:pathway-weakened` — низкоуровневая синаптическая телеметрия.
- `learning:cycle-complete`, `learning:capability-assessed`, `autonomy:learning-pattern-detected` — итоги обучающих циклов.
- `identity:lesson-learned` — журнал уроков идентичности.

### Состояния и ритмы
- `circadian:activity-detected`, `circadian:sleep-started` — фазовые отметки (переход фазы `circadian:phase-changed` активен).
- `qualia:state-updated`, `vital-impulse:pressure-changed` — непрерывные состояния; подписка дала бы поток без полезных дискретных реакций.
- `metabolic:module-throttled` — журнал троттлинга модулей.
- `mastery-drive:satiated` — насыщение драйва (рост потребности активен).

### Социальное и эмерджентное
- `mirror:intent-inferred`, `mirror:relationship-deepened` — следы моделирования собеседника.
- `emergent:pattern-discovered`, `emergent:pattern-deprecated` — кандидаты и снятые паттерны (закрепление `pattern-established` активно).
- `emotional-memory:emotion-matched` — совпадение эмоции с памятью (буст уже применён внутри модуля).
- `dmn:proactive-context-prepared` — подтверждение сборки заготовки (сам блок уходит в контекст).

### Сессии и время
- `session:resumed`, `session:summary-created` — мосты сессий.
- `temporal:moment-created`, `temporal:stream-updated` — темпоральная связка.
- `structure:pathway-pruned` — обрезка структуры.

## Правило для новых реакций

Перед подключением слушателя проверьте три пункта (иначе агент начнёт
спамить инициативами или дёргать модули без пользы):

1. Реакция дискретна и не создаёт петлю модуль→сам-себе.
2. У неё есть анти-спам механизм (хабитуация, рефрактер, угасание, кап).
3. Поведение проверяемо отдельным юнит-тестом.
