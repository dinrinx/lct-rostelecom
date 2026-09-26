# ЛЦТ 2026 Design System

A compact UI kit for form-heavy web interfaces: one typeface (Rostelecom Basis), an orange accent, soft grey surfaces, 12px-rounded controls. Copy is in Russian.

## Sources
- **Figma:** `Ростелеком ЛЦТ 2026 дизайн.fig` (attached file, no public URL given). Scope narrowed by the user to page **UI-kit** → frames `Font Rostelecom Basis` (7:165), `Color` (11:249), `Components` (22:156).
- **Fonts:** `uploads/RostelecomBasis-{Light,Regular,Medium,Bold}.{otf,woff,woff2}` → copied to `fonts/`.
- The file's other page (`/page`, 9 frames, 107 more component families — tables, tree, date picker, menus, modals, icon sets, iOS chrome) was **out of scope** and is not built. Ask to extend scope if needed.

## Index
- `styles.css` — entry point (imports only)
- `fonts/` — Rostelecom Basis webfonts + `fonts.css`
- `tokens/figma/fig-tokens.css` — all 139 Figma variables, generated (includes a leftover Ant-Design-style collection with light/dark modes)
- `tokens/colors.css` · `typography.css` · `spacing.css` · `base.css` — semantic aliases, type scale, spacing/radii/shadows
- `assets/icons/` — the 5 glyph SVGs from the kit + `icons.css` (mask classes)
- `components/` — React primitives (see below), one `*.card.html` per folder
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `ui_kits/components-board/` — interactive recreation of the Figma Components frame
- `thumbnail.html`, `SKILL.md`

## Components
All exported on the bundle namespace (`window.Ds2026DesignSystem_0d9e7e`).
- `components/actions/` — **Button** (primary / secondary / outline × L / M / S × default / hover / disabled)
- `components/inputs/` — **Input**, **Textarea**
- `components/select/` — **Select**, **SelectOption**
- `components/selection/` — **Checkbox**, **Radio**, **Switch**
- `components/display/` — **Tag**, **Badge**

These are exactly the 10 families in the scoped Components frame. **Intentional additions:** none (icons are CSS classes `ds-icon ds-icon-{chevron|check|checkbox|close|close-s|resize}`, not a component).

## Page library (auto-extracted, secondary)
`components/page-library/` holds components machine-extracted with the Figma exporter from the file's other page (`/page` product mockups), so the design system covers the file's full component inventory. They follow a **different visual language** (Ant-Design-style library, Iconly/vuesax icons, Lab Grotesque / SF Pro / Inter / Commissioner fonts, none of which ship here) and are large, variant-baked files. Use them only when recreating those mockups; for new work use the core components above. Icon families are also available as `<Icon name="…" />` from `components/page-library/icons/` (names in `Icon.d.ts`).

Components: `AirpodsLeft`, `AirpodsRight`, `AlbumCover`, `Arrow`, `ArrowALeft`, `ArrowARight`, `ArrowAUp`, `ArrowCDown`, `ArrowCRight`, `ArrowCollapseCVOpen`, `ArrowLineDown`, `Buildings`, `Button2`, `Button3`, `Button5`, `ButtonArrow`, `CaretDown`, `CaretRight`, `CaretUp`, `ChargingLeft`, `ChargingRight`, `CheckA`, `CheckboxAtom`, `CheckboxInput`, `Circle`, `CloseCross`, `CommentRect`, `CommentRectText`, `ComponentTreeSwitcher`, `ComponentsTableCellAction`, `ComponentsTableCellHeader`, `ComponentsTableCellTextIcon`, `Counter`, `Curve`, `DatePickerItemsCell`, `DeleteOutlined`, `Divider`, `DocText`, `Down`, `Droplist`, `DroplistItemsItem`, `DroplistItemsSection`, `Edit`, `Eye`, `FeedHeader`, `FileText`, `Filter`, `Filter2`, `FilterBase`, `Heart`, `HomeIndicator`, `IONIconCCheckmarkCCircle`, `IONIconCChevronDown`, `IOSIPhoneHomeIndicator`, `IconWrapper`, `Image`, `Input5`, `Label`, `MarkAsRead`, `MarkAsReadBase`, `MasterButtonLarge`, `MasterButtonSmall`, `MasterInput`, `MathFunction`, `Memoji`, `MenuIconMore`, `MenuItem`, `MenuSubItemSingleColumn`, `MinusSquare`, `ModalItemsFooter`, `Picture`, `PlayerControls`, `PlayerTrackText`, `Plus`, `PlusSquare`, `Printer`, `PxIconPin16`, `QuestionCircle`, `Regular`, `Right`, `SearchLoupe`, `SearchLoupePlus`, `Select2`, `Setting`, `SettingsGear`, `ShapeCircle`, `SilentLeft`, `SilentRight`, `Snake`, `Sorter`, `StatusBar`, `StatusBarBattery`, `SwitcherItemsItem`, `TemplateDoc`, `TemplateShapeCircle`, `TemplateShapeRectV`, `TextText`, `Textarea2`, `Treenode1stLevel`, `Treenode2ndLevel`, `Treenode3rdLevel`, `Treenode4thLevel`, `TreenodeFinalLevel`, `TrendUp`, `UTurn`, `UiLoadSpinner`, `UiMenuBars3H`, `UploadPictureListItem`, `VuesaxBulkDirectboxDefault`, `VuesaxBulkEmojiNormal`, `VuesaxBulkGlass`, `VuesaxBulkNote2`, `VuesaxBulkRulerPen`, `VuesaxLinearAward`, `VuesaxLinearCalculator`, `Waveform`, `X`.

## CONTENT FUNDAMENTALS
- **Language:** Russian. Sentence case everywhere ("Выберите значение", "Пункт списка", "Текст ошибки"). No Title Case, no ALL CAPS.
- **Voice:** neutral, functional, impersonal. Placeholders are imperatives addressed politely to the user — "Введите текст", "Выберите значение" (вы-form implied). First-person appears only as the user's own input ("Ввожу текст").
- **Labels are nouns:** "Лейбл", "Подпись", "Подсказка", "Тег", "Бейдж", "Кнопка". Keep button labels to one or two words.
- **Hints** sit under fields in muted grey; error text replaces the hint in red and is short ("Текст ошибки").
- **Counters** use `n/max` with no spaces: `86/200`.
- **No emoji**, no exclamation marks, no decorative unicode.

## VISUAL FOUNDATIONS
- **Colour:** white page, text in deep navy-black `#0F1A28` (never pure black). Greys are cool/blue-tinted: soft `#4C515E` for labels, muted `#7C8088` for hints/placeholders, `#ABADB5` for disabled. The single accent is orange `#FE4F13` (hover `#D8440F`) — used for primary buttons, focus rings, checked controls, selected tags and the selected-option check. Status colours: success `#11CA5B`, error `#FF2727`, neutral `#585D69`. Warning/info/brand (violet `#7700FF`) exist as variables but no in-scope component uses them — treat as reserve.
- **Scales:** each status colour has default / hover / surface2 / muted / on-colour steps; "soft" badges pair *muted* fill with *on-colour* text.
- **Type:** Rostelecom Basis only. Promo 48/42/32 (500/700), headings 28/22/18/16 (700), body 18/26 · 16/24 · 14/20 (400/500), description 12/16 · 11 · 10. Form values, checkbox/radio labels and option rows use **Light 300** at 16/24; button labels use Regular 400.
- **Spacing:** 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32. Label→field→hint gap is 4px; control→label gap 8px; tag icon gap 4px.
- **Radii:** 12px on buttons, fields, dropdowns; 8px on option rows; 4px on checkbox; 999 pills for tags & badges; 16px panels, 32px boards.
- **Borders:** drawn as inset 1px rings (`#ABADB4` default, `#E5E6E8` disabled/muted). Hover darkens the ring to fg-soft; focus/open = 2px accent ring; error = 1px red ring. Checkbox/radio rings are 1.5px.
- **Shadows:** almost none. Only the dropdown (`0 8px 24px rgba(15,26,41,.12)` + 1px `#E5E6E8` ring) and the switch knob (`0 1px 3px rgba(15,26,41,.2)`).
- **Hover:** fills step one surface darker (surface3 → surface4; transparent → surface2); primary goes to accent-hover. No opacity tricks, no scale.
- **Press/active:** not defined in the source. **Disabled:** surface3/surface4 fill + `#ABADB5` text; accent switch becomes accent-muted.
- **Backgrounds:** flat solid white; no gradients, textures, illustrations or imagery in scope. Specimen boards use `rgb(191,191,191)` and dark `rgb(32,32,32)` panels — presentation only.
- **Transparency/blur:** none.
- **Animation:** not specified; components use short 120–150ms colour/transform transitions (assumption).
- **Cards/panels:** white, radius 16, no shadow, no border, generous 32–40px padding.
- **Layout:** fields default to 320px wide in the kit; dense 3-column form grids.

## ICONOGRAPHY
- The in-scope kit uses only five simple outlined glyphs, drawn at ~1.5–2px stroke with rounded caps: chevron-down (select), check (selected option), checkbox check, close × (tag), resize grip (textarea). Copied verbatim to `assets/icons/*.svg`; rendered via CSS masks so they inherit `currentColor`.
- No icon font, no emoji, no unicode-as-icon. The wider file references Ant-Design-style and "Iconly" sets on the out-of-scope page; they were not imported.
- If you need more icons, pick a CDN set with similar thin rounded outline style (e.g. Lucide at 1.5px stroke) and flag it as a substitution.

## Brand / logo
No logo or brand mark exists in the scoped source. Wherever a mark is needed, set the name in Rostelecom Basis Bold ("ЛЦТ 2026" is taken from the file name). Do not draw a logo.
