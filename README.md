# 🧠 BrainAgent for DeepSeek Harness

**Когнитивная архитектура как плагин: память, эмоции, мотивация, обучение и автономия для вашего агента dsh.**

[English version below](#english)

---

## Что это

**BrainAgent** — плагин для [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness), который превращает штатного агента из исполнителя разовых задач в **долгоживущего персонального ассистента** с внутренней когнитивной системой, смоделированной по принципам работы мозга.

~60 модулей, 6 точек интеграции с платформой, **571 unit-тест**, всё работает поверх штатных хуков dsh — без единой правки ядра.

## Возможности

### 💾 Память
- **Эпизодическая** — события разговоров с эмоциями и важностью
- **Семантическая** — устойчивые факты с историей ревизий
- **Процедурная** — выученные сценарии действий («как отвечать / как делать»)
- Укрепление при воспроизведении (правило Хебба), затухание нерелевантного
- Хранение локально на диске — **ваши данные не покидают машину**

### 🎭 Эмоции и эмпатия
- Амигдала классифицирует эмоциональную окраску сообщений
- Зеркальные нейроны строят модель собеседника (настроение, стиль, экспертиза)
- Эмоциональная память сохраняет яркие моменты («flashbulb»)

### 📚 Обучение
- Каждый оборот диалога завершается циклом обучения
- Дофаминовая система подкрепляет успешные стратегии
- Базальные ганглии формируют привычки с оценкой успешности

### ⚡ Автономия
- Четыре драйва: социальный, познавательный, творческий, мастерство
- Vital Impulse — агент сам пишет вам, когда есть что сказать (цель, инсайт, желание)
- Goal Stack ведёт долгосрочные цели, Curiosity Drive находит пробелы в знаниях
- DMN «думает в фоне», Autonomous Research сам ищет информацию
- Встроенные предохранители: минимум 10 минут между проактивными сообщениями, разрыватель цикла

### 🌙 Саморегуляция
- Циркадный ритм и Dream Mode — ночью агент «спит» и консолидирует память
- Attention Gate фильтрует контекст по релевантности (экономия токенов)
- Token Economy и таламический гейт пропускают простые сообщения без дорогих LLM-вызовов
- Metabolic Budget следит за расходом ресурсов модулей

### 🪞 Личность
- Agent Identity: автобиографическая память, уроки, профиль способностей
- Qualia Simulator: текущее субъективное состояние
- Temporal Binding: ощущение непрерывности времени

## Установка

### Вариант 1: как пакет dsh (рекомендуется)

Клонируйте репозиторий и установите в профиль:

```sh
git clone https://github.com/USERNAME/dsh-brainagent.git
dsh plugin --profile мой-профиль add ./dsh-brainagent
dsh --profile мой-профиль
```

> Пакет содержит готовый собранный модуль (`lib/index.js`) — установка с GitHub не требует ни сборки, ни разрешений на скрипты.

### Вариант 2: локальный оверлей (для разработки)

Добавьте в свой `cordis.patch.yml` (или запускайте с `--patch`):

```yaml
- insert:
    - id: brainagent
      name: file:///абсолютный/путь/к/dsh-brainagent/src/index.ts
      config: {}
```

## Использование

Поговорите с агентом — BrainAgent включается автоматически. В чате доступны команды:

| Команда | Что делает |
|---|---|
| `/brain status` | Полный отчёт о состоянии всех систем |
| `/brain memory <запрос>` | Поиск по памяти |
| `/brain goals` | Текущие цели |
| `/brain neuro` | Нейромодуляторы (дофамин и др.) |
| `/brain habits` | Выученные привычки |
| `/brain learning` | Циклы обучения и инсайты |
| `/brain circadian` | Циркадный ритм и сон |
| `/brain dream` | Запустить консолидацию памяти |

…и другие: `predict`, `pathways`, `personality`, `metabolic`, `emergent`.

Все модули настраиваются через Config-схему (39 флагов) — любой компонент можно отключить:

```yaml
- id: brainagent
  name: dsh-brainagent
  config:
    autonomousMinGapMs: 1800000   # пауза между проактивными сообщениями (30 мин)
    modules:
      actionDispatcher: false     # например, отключить автономию
```

## Тестирование

```sh
pnpm install        # из корня monorepo dsh
pnpm vitest run     # 23 файла, 571 тест
```

## Архитектура

Обработанный дsh `message` проходит конвейер:

```
Thalamus (классификация) → Amygdala (эмоции) → Hippocampus (извлечение памяти)
→ Prefrontal Cortex (решение, fast/slow path) → контекстная инъекция (pre-step)
→ Cerebellum (оценка качества после ответа) → цикл обучения
```

Все модули обмениваются типизированными сигналами через внутренний event bus
(Corpus Callosum), автономные таймеры работают через `ctx.effect`.

## Требования

- DeepSeek Harness (dsh) с поддержкой плагинов Cordis
- Node.js 22+
- pnpm

## Лицензия

**BrainAgent Noncommercial License** — свободное некоммерческое использование для всех;
коммерческое использование только по соглашению с автором. Подробнее в [LICENSE](LICENSE).

## Происхождение

BrainAgent был разработан как когнитивный слой для NeuroClaw и портирован на DeepSeek Harness
с сохранением всей функциональности.

---

<a id="english"></a>

## English

**BrainAgent** is a plugin for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) that turns the stock agent into a long-lived personal assistant with a brain-inspired cognitive system.

~60 modules, 6 platform integration points, **571 unit tests**, running entirely on stock dsh hooks — zero core changes.

**Highlights**

- **Memory** — episodic, semantic and procedural; Hebbian strengthening, decay, local-only storage
- **Emotions & empathy** — Amygdala classification, Mirror Neurons user modeling, flashbulb memories
- **Learning** — per-turn learning cycles, dopamine reinforcement, habit formation
- **Autonomy** — four drives, proactive messages (Vital Impulse) with anti-loop guards, goal stack, curiosity, background DMN insights
- **Self-regulation** — circadian rhythm, Dream Mode consolidation, Attention Gate token budgeting, Token Economy
- **Personality** — Agent Identity, Qualia Simulator, Temporal Binding

**Install**

```sh
git clone https://github.com/USERNAME/dsh-brainagent.git
dsh plugin --profile my-profile add ./dsh-brainagent
dsh --profile my-profile
```

Ships a prebuilt bundle (`lib/index.js`) — git installs need no build step and no script permissions.

**Commands**: `/brain status`, `/brain memory <query>`, `/brain goals`, `/brain neuro`, `/brain habits`, `/brain learning`, `/brain circadian`, `/brain dream` and more

**Tests**: `pnpm vitest run` — 23 files, 571 tests

**License**: BrainAgent Noncommercial License — free noncommercial use for everyone; commercial use requires an agreement with the author. See [LICENSE](LICENSE).

**Origin**: BrainAgent was developed as a cognitive layer for NeuroClaw and ported to DeepSeek Harness with full functionality preserved.
