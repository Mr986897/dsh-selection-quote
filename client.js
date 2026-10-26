/**
 * Client half of the selection-quote bundle.
 *
 * Two registrations cooperate:
 *
 * 1. `conversation.input.overlay` hosts a headless bridge inside the resident
 *    composer. Only a Session-scoped seat receives the `useInput` and
 *    `inputActions` standard props, so the bridge publishes the current
 *    Session's composer verbs into a module-level registry. It also owns the
 *    insertion: the composer's own `slash/input-insert-reference` scoped event
 *    turns an owner payload into one atomic reference chip, which is the only
 *    wrapped, non-editable inline form the composer has.
 * 2. `shell.overlay` hosts the visible pill. The frame-wide layer is the one
 *    surface above every column and outside their scroll containers, so a pill
 *    can follow a text selection anywhere in the conversation; it reads the
 *    bridge registry for the insert operation and never touches the composer
 *    editor directly.
 *
 * The chip's label carries the quote itself, so the platform tooltip on hover
 * shows the complete quoted content; the chip body stays a compact capsule
 * because the host chip truncates its label to one ellipsized line.
 */
window.__ModuleLoader__.load({
  id: '@kingcharleslzy-ai/dsh-selection-quote',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-selection-quote';
    /** Owner name the inserted chips serialize and route by. */
    const SOURCE = 'selection-quote';
    /** Scoped event the composer turns into one atomic reference chip. */
    const INSERT_EVENT = 'slash/input-insert-reference';
    /** Longest selection body carried into the sent message, in characters. */
    const MAX_CHARS = 4000;
    /** Longest selection body carried in the chip label (and its hover tooltip). */
    const LABEL_CHARS = 1200;
    /** Offset of the pill from the last selected line, in px. */
    const GAP = 10;
    /** Room a pill needs below the selection before flipping above it. */
    const PILL_SPACE = 44;
    const SCOPE_SELECTORS = [
      '[data-slot="conversation.session"]',
      '[data-slot="conversation.chat.flow"]',
    ];
    const PILL_ATTR = 'data-dsq-pill';
    /** Chat row kinds that carry text the user sent. */
    const USER_KINDS = new Set(['user', 'steering', 'question-reply']);
    /** UserText rule id, renderer key, and style tag id of this plugin. */
    const TEXT_RULE_ID = 'selection-quote';
    /**
     * Header line an inserted quote serializes to, in every locale this bundle
     * ships ('引用 · 助手' / 'Quote · assistant'). Only such a first line becomes
     * the card header; any other blockquote keeps all of its lines as body.
     */
    const QUOTE_HEADER_RE = /^(?:引用|Quote)\s*·\s*\S+$/;

    const zh = {
      quote: '引用',
      hint: '把选中的内容作为引用胶囊插入输入框',
      quoted: '已引用到输入框',
      failed: '引用失败，请重试',
      roleUser: '我',
      roleAssistant: '助手',
      header: '引用 · {role}',
      truncated: '（内容过长，已截断）',
      chipSummary: '引用 · {role} · {count} 字',
      chipMore: '…（还有 {count} 字未展开）',
      legacyRef: '（旧版引用无法序列化，请重新选择后引用）',
      cardLabel: '引用',
      jump: '跳到原消息',
      jumpHint: '在对话里定位这段引用的来源',
      jumpMissed: '没找到原消息',
      expand: '展开（共 {count} 行）',
      collapse: '收起',
      'config.style': '引用样式',
      'config.style.card': '卡片',
      'config.style.bar': '左侧竖线',
      'config.style.plain': '极简',
      'config.styleHint': '发送后在对话里怎么画这段引用',
      'config.color': '高亮颜色',
      'config.colorHint': '点「跳到原消息」时，原文字会亮一下',
      'config.duration': '高亮时长',
      'config.durationHint': '亮多久之后自动褪掉',
      'config.clamp': '折叠高度',
      'config.clampHint': '正文超过这个高度就截断，并出现「展开」按钮',
      'config.jump': '跳到原消息按钮',
      'config.jumpHint': '关掉后标题条只显示引用来源',
      'config.on': '显示',
      'config.off': '隐藏',
      'config.preview': '效果预览',
      'config.previewHeader': '引用 · 助手',
      'config.previewBody': '这段文字就是被引用的原文，卡片外是你自己写的内容。',
      'config.reset': '恢复默认',
      'config.storage': '这些设置存在本机浏览器里，换设备不会跟着走。',
      'config.seconds': '{count} 秒',
      'config.lines': '{count} 行',
      'config.summary': '{style} · 高亮 {color}',
    };

    const en = {
      quote: 'Quote',
      hint: 'Insert the selection as a quote capsule',
      quoted: 'Quoted into the composer',
      failed: 'Quote failed, try again',
      roleUser: 'me',
      roleAssistant: 'assistant',
      header: 'Quote · {role}',
      truncated: '(truncated)',
      chipSummary: 'Quote · {role} · {count} chars',
      chipMore: '… ({count} more chars)',
      legacyRef: '(legacy quote could not be serialized; quote it again)',
      cardLabel: 'Quote',
      jump: 'Jump to message',
      jumpHint: 'Scroll to the message this quote came from',
      jumpMissed: 'Original not found',
      expand: 'Expand ({count} lines)',
      collapse: 'Collapse',
      'config.style': 'Quote style',
      'config.style.card': 'Card',
      'config.style.bar': 'Left bar',
      'config.style.plain': 'Plain',
      'config.styleHint': 'How a sent quote is drawn in the conversation',
      'config.color': 'Highlight color',
      'config.colorHint': 'The original text flashes with this color when you jump to it',
      'config.duration': 'Highlight duration',
      'config.durationHint': 'How long the flash stays before it fades',
      'config.clamp': 'Collapsed height',
      'config.clampHint': 'Taller bodies fold and offer an Expand control',
      'config.jump': 'Jump-to-message button',
      'config.jumpHint': 'Off leaves only the quote attribution in the header',
      'config.on': 'Shown',
      'config.off': 'Hidden',
      'config.preview': 'Preview',
      'config.previewHeader': 'Quote · assistant',
      'config.previewBody': 'This text is the quoted passage; whatever sits outside the card is yours.',
      'config.reset': 'Reset to defaults',
      'config.storage': 'These settings live in this browser; another device keeps its own.',
      'config.seconds': '{count} s',
      'config.lines': '{count} lines',
      'config.summary': '{style} · highlight {color}',
    };

    /** Static sheet; the dynamic rules are appended by `buildStyles`. */
    const BASE_STYLES = [
      '.dsq-pill{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;height:30px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-panel,0 6px 18px rgba(0,0,0,.18));font:inherit;font-size:12px;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer;font-family:inherit}',
      '.dsq-pill:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dsq-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsq-pill:active{opacity:.85}',
      '.dsq-glyph{display:block;flex:none;opacity:.9}',
      '.dsq-note{display:inline-flex;align-items:center;box-sizing:border-box;height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-panel,0 6px 18px rgba(0,0,0,.16));font:inherit;font-size:12px;line-height:1;white-space:nowrap;color:var(--dsw-alias-label-secondary)}',
      '.dsq-note[data-ok="1"]{color:var(--dsw-alias-state-success-primary)}',
      '.dsq-note[data-ok="0"]{color:var(--dsw-alias-state-error-primary)}',
      '.dsq-sent{display:block;box-sizing:border-box;margin:4px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-overlay);overflow:hidden;white-space:normal;text-align:start}',
      '.dsq-sent-head{display:flex;align-items:center;gap:5px;padding:5px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsq-sent-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.dsq-sent-body{padding:7px 10px;color:var(--dsw-alias-label-primary);font-size:inherit;line-height:inherit;white-space:pre-wrap;word-break:break-word}',
      '.dsq-sent-body[data-faded="1"]{-webkit-mask-image:linear-gradient(to bottom,#000 62%,transparent);mask-image:linear-gradient(to bottom,#000 62%,transparent)}',
      '.dsq-sent-more{display:flex;justify-content:flex-end;padding:0 6px 5px}',
      '.dsq-sent-action{appearance:none;display:inline-flex;align-items:center;gap:3px;flex:none;padding:1px 6px;border:0;border-radius:var(--dsw-radius-xs);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:17px;white-space:nowrap;cursor:pointer;font-family:inherit}',
      '.dsq-sent-action:hover{background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary)}',
      '.dsq-sent-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      // Style variants chosen in the plugin's configuration page.
      '.dsq-sent[data-style="bar"]{border:0;border-left:3px solid var(--dsw-alias-brand-primary);border-radius:0;background:transparent;padding-left:10px}',
      '.dsq-sent[data-style="bar"] .dsq-sent-head{border-bottom:0;background:transparent;padding:0 0 3px}',
      '.dsq-sent[data-style="bar"] .dsq-sent-body{padding:0}',
      '.dsq-sent[data-style="bar"] .dsq-sent-more{padding:0 0 2px}',
      '.dsq-sent[data-style="plain"]{border:0;background:transparent}',
      '.dsq-sent[data-style="plain"] .dsq-sent-head{border-bottom:0;background:transparent;padding:0 0 3px}',
      '.dsq-sent[data-style="plain"] .dsq-sent-body{padding:0}',
      '.dsq-sent[data-style="plain"] .dsq-sent-more{padding:0}',
      '.dsq-config{display:flex;flex-direction:column;gap:18px;box-sizing:border-box;max-width:560px;padding:2px 0 8px;color:var(--dsw-alias-label-primary);font-size:13px}',
      '.dsq-config-row{display:flex;align-items:flex-start;gap:16px}',
      '.dsq-config-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.dsq-config-label{font-size:13px;line-height:18px;font-weight:500}',
      '.dsq-config-hint{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
      '.dsq-config-control{flex:none;display:flex;align-items:center;gap:8px}',
      '.dsq-seg{display:inline-flex;padding:2px;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1)}',
      '.dsq-seg-item{appearance:none;padding:4px 10px;border:0;border-radius:calc(var(--dsw-radius-sm) - 2px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:16px;white-space:nowrap;cursor:pointer;font-family:inherit}',
      '.dsq-seg-item:hover{color:var(--dsw-alias-label-primary)}',
      '.dsq-seg-item[data-active="1"]{background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}',
      '.dsq-seg-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsq-swatch{width:22px;height:22px;box-sizing:border-box;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;cursor:pointer}',
      '.dsq-swatch[data-active="1"]{outline:2px solid var(--dsw-alias-label-primary);outline-offset:1px}',
      '.dsq-color{width:96px;box-sizing:border-box;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.dsq-number{width:72px;box-sizing:border-box;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12px}',
      '.dsq-preview{padding:10px 12px;border:1px dashed var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base)}',
      '.dsq-config-foot{display:flex;align-items:center;gap:10px;padding-top:2px}',
      '.dsq-config-note{flex:1;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
    ];

    //#region configuration

    /** Where this plugin's configuration page keeps its values (this browser only). */
    const SETTINGS_KEY = 'dsh.selection-quote.v1';
    /** Quote styles the configuration page offers, in display order. */
    const QUOTE_STYLES = ['card', 'bar', 'plain'];
    /** Preset highlight tints beside the picker. */
    const COLOR_PRESETS = ['#34c759', '#ffd60a', '#0a84ff', '#ff9f0a', '#bf5af2'];
    /** Highlight durations the page offers, in milliseconds. */
    const DURATION_OPTIONS = [1200, 1800, 3000];
    /** One rendered line in the message body, in em of its font size. */
    const LINE_EM = 1.5714;
    /** Defaults for every configurable value. */
    const SETTINGS_DEFAULTS = Object.freeze({
      style: 'card',
      highlightColor: '#34c759',
      highlightMs: 1800,
      clampEm: 9.5,
      showJump: true,
    });

    /**
     * Fold one unknown stored or incoming value into a complete, valid setting.
     * @param raw - stored JSON value, or null.
     * @returns a fully populated setting.
     */
    function normalizeSettings(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const style = QUOTE_STYLES.includes(source.style) ? source.style : SETTINGS_DEFAULTS.style;
      const color = typeof source.highlightColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.highlightColor)
        ? source.highlightColor.toLowerCase()
        : SETTINGS_DEFAULTS.highlightColor;
      const highlightMs = Number.isFinite(source.highlightMs)
        ? Math.min(6000, Math.max(600, Math.round(source.highlightMs)))
        : SETTINGS_DEFAULTS.highlightMs;
      const clampEm = Number.isFinite(source.clampEm)
        ? Math.min(24, Math.max(4, Math.round(source.clampEm * 2) / 2))
        : SETTINGS_DEFAULTS.clampEm;
      const showJump = typeof source.showJump === 'boolean' ? source.showJump : SETTINGS_DEFAULTS.showJump;
      return { style, highlightColor: color, highlightMs, clampEm, showJump };
    }

    /** Read the stored setting, falling back to defaults when storage is unusable. */
    function readStoredSettings() {
      try {
        const text = window.localStorage.getItem(SETTINGS_KEY);
        return normalizeSettings(text === null ? null : JSON.parse(text));
      } catch (error) {
        return normalizeSettings(null);
      }
    }

    /** Persist one whole setting; a blocked storage keeps the live value only. */
    function persistSettings(value) {
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
      } catch (error) {
        // Nothing else to do: the page still reflects the choice this session.
      }
    }

    /** `#rrggbb` plus alpha to an rgba() string, with the default tint as fallback. */
    function tintOf(hex, alpha) {
      const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
      if (match === null) return 'rgba(52, 199, 89, ' + alpha + ')';
      const value = parseInt(match[1], 16);
      return 'rgba(' + ((value >> 16) & 0xff) + ', ' + ((value >> 8) & 0xff) + ', ' + (value & 0xff) + ', ' + alpha + ')';
    }

    /** Build the whole sheet for one setting. */
    function buildStyleSheet(settings) {
      return [
        ...BASE_STYLES,
        '.dsq-sent-body[data-clamped="1"]{max-height:' + settings.clampEm + 'em;overflow:hidden}',
        '::highlight(selection-quote-origin){background-color:' + tintOf(settings.highlightColor, 0.36) + '}',
      ].join('\n');
    }

    /** Live style tag written by `apply`; null before installation or after teardown. */
    let styleTag = null;

    /** Rewrite the sheet after a settings change. */
    function applyStyleSheet(settings) {
      if (styleTag !== null) styleTag.textContent = buildStyleSheet(settings);
    }

    /** Current values plus a tiny subscription shared by the page and the cards. */
    const quoteSettings = {
      value: normalizeSettings(null),
      listeners: new Set(),
      getSnapshot() {
        return this.value;
      },
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
      /**
       * Merge one patch, persist it, restyle, and notify every mounted reader.
       * @param patch - changed fields.
       * @returns the normalized setting now in force.
       */
      update(patch) {
        const next = normalizeSettings({ ...this.value, ...patch });
        this.value = next;
        persistSettings(next);
        applyStyleSheet(next);
        for (const listener of [...this.listeners]) {
          try {
            listener();
          } catch (error) {
            // One broken reader never blocks the others.
          }
        }
        return next;
      },
    };

    /** Read the live setting from a component. */
    function useQuoteSettings() {
      const [value, setValue] = React.useState(() => quoteSettings.getSnapshot());
      React.useEffect(() => quoteSettings.subscribe(() => setValue(quoteSettings.getSnapshot())), []);
      return value;
    }

    /** Rows in milliseconds as the page labels them. */
    function secondsLabel(ms) {
      const seconds = ms / 1000;
      return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
    }

    /**
     * One labelled row of the configuration page.
     * @param label - row title.
     * @param hint - one-line explanation.
     * @param control - the control(s) on the right.
     * @returns the row element.
     */
    function settingsRow(label, hint, control) {
      return h('div', { className: 'dsq-config-row' }, [
        h('div', { key: 'text', className: 'dsq-config-text' }, [
          h('div', { key: 'label', className: 'dsq-config-label' }, label),
          h('div', { key: 'hint', className: 'dsq-config-hint' }, hint),
        ]),
        h('div', { key: 'control', className: 'dsq-config-control' }, control),
      ]);
    }

    /**
     * The plugin's configuration page, rendered by the plugin manager on this
     * bundle's row. Every control writes at once: these are display preferences,
     * not a staged form.
     * @param props - the page's dictionary and view kind.
     * @returns the page body.
     */
    function QuoteSettingsPage(props) {
      const t = props.t;
      const settings = useQuoteSettings();
      if (props.view === 'summary') {
        const styleLabel = t('config.style.' + settings.style);
        return h('span', null, t('config.summary', { style: styleLabel, color: settings.highlightColor }));
      }
      const commitColor = (value) => {
        if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) quoteSettings.update({ highlightColor: value });
      };
      const clampLines = Math.max(1, Math.round(settings.clampEm / LINE_EM));
      return h('div', { className: 'dsq-config' }, [
        settingsRow(
          t('config.style'),
          t('config.styleHint'),
          h(
            'div',
            { className: 'dsq-seg', role: 'group' },
            QUOTE_STYLES.map((style) =>
              h(
                'button',
                {
                  key: style,
                  type: 'button',
                  className: 'dsq-seg-item',
                  'data-active': settings.style === style ? '1' : '0',
                  'aria-pressed': settings.style === style ? 'true' : 'false',
                  onClick: () => quoteSettings.update({ style }),
                },
                t('config.style.' + style),
              ),
            ),
          ),
        ),
        settingsRow(
          t('config.color'),
          t('config.colorHint'),
          [
            h('input', {
              key: 'picker',
              type: 'color',
              className: 'dsq-swatch',
              title: settings.highlightColor,
              'aria-label': t('config.color'),
              value: settings.highlightColor,
              style: { background: settings.highlightColor, padding: 0 },
              onChange: (event) => commitColor(event.target.value),
            }),
            ...COLOR_PRESETS.map((color) =>
              h('button', {
                key: color,
                type: 'button',
                className: 'dsq-swatch',
                title: color,
                'aria-label': color,
                'data-active': settings.highlightColor === color ? '1' : '0',
                style: { background: color },
                onClick: () => quoteSettings.update({ highlightColor: color }),
              }),
            ),
            h('input', {
              key: 'hex-' + settings.highlightColor,
              className: 'dsq-color',
              type: 'text',
              spellCheck: false,
              defaultValue: settings.highlightColor,
              'aria-label': t('config.color'),
              onChange: (event) => commitColor(event.target.value.trim()),
            }),
          ],
        ),
        settingsRow(
          t('config.duration'),
          t('config.durationHint'),
          h(
            'div',
            { className: 'dsq-seg', role: 'group' },
            DURATION_OPTIONS.map((ms) =>
              h(
                'button',
                {
                  key: ms,
                  type: 'button',
                  className: 'dsq-seg-item',
                  'data-active': settings.highlightMs === ms ? '1' : '0',
                  'aria-pressed': settings.highlightMs === ms ? 'true' : 'false',
                  onClick: () => quoteSettings.update({ highlightMs: ms }),
                },
                t('config.seconds', { count: secondsLabel(ms) }),
              ),
            ),
          ),
        ),
        settingsRow(
          t('config.clamp'),
          t('config.clampHint'),
          [
            h('input', {
              // Commit on blur/Enter, not per keystroke: a controlled number field
              // would snap "1" to the minimum while the user is still typing "14".
              key: 'clamp-' + settings.clampEm,
              className: 'dsq-number',
              type: 'number',
              min: 4,
              max: 24,
              step: 0.5,
              defaultValue: String(settings.clampEm),
              'aria-label': t('config.clamp'),
              onBlur: (event) => {
                const next = Number.parseFloat(event.target.value);
                quoteSettings.update({ clampEm: Number.isFinite(next) ? next : settings.clampEm });
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.target.blur();
              },
            }),
            h('span', { key: 'lines', className: 'dsq-config-hint' }, t('config.lines', { count: clampLines })),
          ],
        ),
        settingsRow(
          t('config.jump'),
          t('config.jumpHint'),
          h(
            'div',
            { className: 'dsq-seg', role: 'group' },
            [true, false].map((value) =>
              h(
                'button',
                {
                  key: String(value),
                  type: 'button',
                  className: 'dsq-seg-item',
                  'data-active': settings.showJump === value ? '1' : '0',
                  'aria-pressed': settings.showJump === value ? 'true' : 'false',
                  onClick: () => quoteSettings.update({ showJump: value }),
                },
                t(value ? 'config.on' : 'config.off'),
              ),
            ),
          ),
        ),
        h('div', { className: 'dsq-preview' }, [
          h('div', { key: 'label', className: 'dsq-config-hint' }, t('config.preview')),
          h('div', { key: 'card', className: 'dsq-sent', 'data-style': settings.style }, [
            h('div', { key: 'head', className: 'dsq-sent-head' }, [
              h(QuoteGlyph, { key: 'glyph' }),
              h('span', { key: 'label', className: 'dsq-sent-label' }, t('config.previewHeader')),
              settings.showJump ? h('span', { key: 'jump', className: 'dsq-sent-action' }, t('jump')) : null,
            ]),
            h('div', { key: 'body', className: 'dsq-sent-body', 'data-clamped': '0' }, t('config.previewBody')),
          ]),
        ]),
        h('div', { className: 'dsq-config-foot' }, [
          h(
            'button',
            {
              key: 'reset',
              type: 'button',
              className: 'dsq-seg-item',
              style: { border: '1px solid var(--dsw-alias-border-l1)' },
              onClick: () => quoteSettings.update({ ...SETTINGS_DEFAULTS }),
            },
            t('config.reset'),
          ),
          h('span', { key: 'note', className: 'dsq-config-note' }, t('config.storage')),
        ]),
      ]);
    }

    //#endregion

    //#region bridge registry

    /** The composer verbs published by the mounted conversation bridge. */
    let activeBridge = null;
    const bridgeListeners = new Set();

    function readActiveBridge() {
      return activeBridge;
    }

    function publishActiveBridge(next) {
      activeBridge = next;
      for (const listener of [...bridgeListeners]) {
        try {
          listener();
        } catch (error) {
          // A broken listener keeps the registry but never blocks the others.
        }
      }
    }

    function subscribeActiveBridge(listener) {
      bridgeListeners.add(listener);
      return () => {
        bridgeListeners.delete(listener);
      };
    }

    /** Root Client context captured in `apply`; reaches Session scopes. */
    let rootCtx = null;
    /**
     * True while this plugin's reference codec is registered with the input
     * pipeline. A chip without one blocks submission ("no serializer for
     * reference source"), so the bridge only inserts chips while this holds.
     */
    let codecReady = false;
    /** Dictionary bound to this namespace in `apply`, for non-React call sites. */
    let boundT = null;

    /**
     * Resolve one Session's Agent-scoped Context, where the composer registers
     * its scoped input events.
     * @param sessionId - Session the bridge belongs to.
     * @returns the scope, or undefined when it is not retained.
     */
    function sessionScope(sessionId) {
      if (rootCtx === null || sessionId === undefined) return undefined;
      try {
        const sessions = rootCtx.sessions;
        if (sessions === undefined) return undefined;
        return sessions.scope(sessionId);
      } catch (error) {
        return undefined;
      }
    }

    /**
     * Model form of one quote chip. The chip's `ref` carries the serialized
     * blockquote itself, so serialization needs no owner-side registry and
     * survives a reload; ids minted by the pre-codec build carry no text.
     * @param ref - the chip's owner-scoped reference.
     * @returns the text submitted in place of the chip.
     */
    function serializeQuoteRef(ref) {
      const value = typeof ref === 'string' ? ref : '';
      if (value.startsWith('>')) return value;
      return '> ' + (boundT === null ? 'legacy quote' : boundT('legacyRef'));
    }

    //#endregion

    //#region selection geometry

    /** The conversation region that owns quotable text, or null when absent. */
    function scopeElement() {
      for (const selector of SCOPE_SELECTORS) {
        const node = document.querySelector(selector);
        if (node !== null) return node;
      }
      return null;
    }

    function elementOf(node) {
      if (!node) return null;
      if (node.nodeType === 1) return node;
      return node.parentElement ?? null;
    }

    /**
     * Resolve one selection endpoint to an element inside the conversation
     * region.
     * @param node - selection start/focus container.
     * @returns the contained element, or null outside the conversation.
     */
    function locatedEndpoint(node) {
      const element = elementOf(node);
      if (element === null) return null;
      const scope = scopeElement();
      if (scope !== null) return scope.contains(element) ? element : null;
      // No region marker in this build: fall back to a rendered chat row.
      return typeof element.closest === 'function' ? element.closest('[data-chat-flow-kind]') : null;
    }

    /**
     * Read the chat row kind that owns one element.
     * @param element - contained selection element.
     * @returns the row kind, or an empty string when the element sits outside a row.
     */
    function rowKind(element) {
      if (element === null || typeof element.closest !== 'function') return '';
      const row = element.closest('[data-chat-flow-kind]');
      return row === null ? '' : row.getAttribute('data-chat-flow-kind') ?? '';
    }

    /** Map a chat row kind to the speaker a quote is attributed to. */
    function roleOf(kind) {
      return USER_KINDS.has(kind) ? 'user' : 'assistant';
    }

    //#endregion

    //#region quote text

    /**
     * Normalize one selection into blockquote-ready body text.
     * @param raw - `Selection.toString()` output.
     * @returns trimmed text with single blank lines and no trailing blanks.
     */
    function normalizeSelection(raw) {
      const flattened = String(raw)
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/[ \t]+$/gm, '');
      const rows = [];
      let blanks = 0;
      for (const line of flattened.split('\n')) {
        if (line.trim() === '') {
          blanks += 1;
          if (blanks > 1) continue;
          rows.push('');
          continue;
        }
        blanks = 0;
        rows.push(line);
      }
      return rows.join('\n').trim();
    }

    /**
     * Split one body into the part a carrier keeps and the character count it
     * drops.
     * @param text - normalized selection body.
     * @param limit - longest kept prefix, in characters.
     * @returns the kept prefix and how many characters were dropped.
     */
    function clipBody(text, limit) {
      if (text.length <= limit) return { text, dropped: 0 };
      return { text: text.slice(0, limit), dropped: text.length - limit };
    }

    /**
     * Flatten one body line so a selection that already carries quote markers
     * still describes one level of quoting.
     * @param line - one body line.
     * @returns the line without a leading quote marker.
     */
    function flattenQuoteLine(line) {
      return line.replace(/^[ \t]*>[ \t]?/, '');
    }

    /**
     * Build the composer reference one quote inserts.
     *
     * `clipboardText` is the serialized form: the markdown blockquote the model
     * and the sent message receive. `label` is the inline capsule text, and it
     * also becomes the chip's `title`, so hovering the chip reveals the whole
     * quoted content.
     *
     * @param t - bound dictionary of this namespace.
     * @param raw - selected text.
     * @param role - speaker the selection came from.
     * @returns the reference insertion payload, or null for an empty selection.
     */
    function buildQuoteReference(t, raw, role) {
      const body = normalizeSelection(raw);
      if (body === '') return null;
      const roleLabel = role === 'user' ? t('roleUser') : t('roleAssistant');

      const quoted = clipBody(body, MAX_CHARS);
      const quoteLines = ['> ' + t('header', { role: roleLabel })];
      for (const line of quoted.text.split('\n')) {
        const flat = flattenQuoteLine(line);
        quoteLines.push(flat === '' ? '>' : '> ' + flat);
      }
      if (quoted.dropped > 0) quoteLines.push('> ' + t('truncated'));

      const shown = clipBody(body, LABEL_CHARS);
      const labelLines = [t('chipSummary', { role: roleLabel, count: body.length })];
      for (const line of shown.text.split('\n')) labelLines.push(flattenQuoteLine(line));
      if (shown.dropped > 0) labelLines.push(t('chipMore', { count: shown.dropped }));

      const clipboardText = quoteLines.join('\n') + '\n';
      return {
        source: SOURCE,
        // The ref is the model form (see serializeQuoteRef): carrying it here keeps
        // a persisted chip sendable without an owner-side registry.
        ref: clipboardText,
        label: labelLines.join('\n'),
        appearance: 'quote',
        clipboardText,
      };
    }

    //#endregion

    //#region sent quote rendering

    /**
     * Find the next markdown blockquote block in one sent user message.
     *
     * Inserted quotes serialize to `> 引用 · <role>` plus one `> ` line per body
     * line, so the whole contiguous block becomes one node: the first line turns
     * into the card header when it looks like a quote header, and every line
     * stays available as body text.
     *
     * @param text - original message text.
     * @param from - offset the evaluator is matching from.
     * @returns the block node, or undefined when this text has no further blockquote.
     */
    function matchQuoteBlock(text, from) {
      let start = text.indexOf('>', from);
      while (start > 0 && text[start - 1] !== '\n') start = text.indexOf('>', start + 1);
      if (start < 0) return undefined;
      const lines = [];
      let end = start;
      let cursor = start;
      while (cursor < text.length) {
        const newline = text.indexOf('\n', cursor);
        const lineEnd = newline < 0 ? text.length : newline;
        const line = text.slice(cursor, lineEnd);
        if (!line.startsWith('>')) break;
        lines.push(line.replace(/^>[ \t]?/, ''));
        end = lineEnd;
        if (newline < 0) break;
        cursor = newline + 1;
      }
      if (lines.length === 0) return undefined;
      // A quote that closes the message also claims its trailing newlines, so the
      // card sits flush instead of leaving an empty line behind.
      if (text.slice(end).trim() === '') end = text.length;
      const head = lines.length > 1 && QUOTE_HEADER_RE.test(lines[0]) ? lines[0] : undefined;
      const bodyText = (head === undefined ? lines : lines.slice(1)).join('\n').replace(/\s+$/u, '');
      return {
        id: TEXT_RULE_ID,
        start,
        end,
        data: head === undefined ? { body: bodyText } : { header: head, body: bodyText },
      };
    }

    const quoteTextRule = {
      id: TEXT_RULE_ID,
      order: 30,
      match(text, from) {
        return matchQuoteBlock(text, from);
      },
    };

    /** Markdown punctuation the rendered message text does not contain. */
    const MARKDOWN_NOISE_RE = /[`*_#>\[\]!]/;
    /** CSS Custom Highlight name for the quoted passage. */
    const HIGHLIGHT_NAME = 'selection-quote-origin';

    /** Module-owned highlight timer; one passage is highlighted at a time. */
    let highlightTimer = 0;

    /**
     * Flatten text the way the message renders it: markdown punctuation removed
     * and whitespace runs collapsed, while keeping a map back to raw offsets.
     * @param text - raw text.
     * @returns flattened text plus, per flattened character, its source index.
     */
    function normalizeForMatch(text) {
      const chars = [];
      const map = [];
      let gap = false;
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === ' ' || character === '\n' || character === '\t' || character === '\r') {
          gap = chars.length > 0;
          continue;
        }
        if (MARKDOWN_NOISE_RE.test(character)) continue;
        if (gap) {
          chars.push(' ');
          map.push(index);
          gap = false;
        }
        chars.push(character);
        map.push(index);
      }
      return { text: chars.join(''), map };
    }

    /**
     * Build the search needles used to find the message a quote came from.
     *
     * A user message only carries the quoted text, so the jump locates its origin
     * by content: short prefixes of the first and last substantial lines, so a
     * match identifies the row and a hit on both ends lets the highlight span the
     * whole passage instead of its first line.
     *
     * @param raw - quoted body text.
     * @returns up to 6 needles.
     */
    function quoteNeedles(raw) {
      const needles = [];
      for (const line of String(raw).split('\n')) {
        const flat = normalizeForMatch(line).text.trim();
        if (flat.length < 6) continue;
        needles.push(flat.slice(0, 24));
      }
      if (needles.length <= 6) return needles;
      return [...needles.slice(0, 3), ...needles.slice(-3)];
    }

    /**
     * List one row's text nodes with their offsets in the row's text content.
     * @param root - element to walk.
     * @returns text nodes in document order with their starting offsets.
     */
    function textEntriesOf(root) {
      const entries = [];
      let offset = 0;
      const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, null);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const value = node.nodeValue ?? '';
        entries.push({ node, start: offset, length: value.length });
        offset += value.length;
      }
      return entries;
    }

    /**
     * Build one DOM Range covering raw offsets in a row's text content.
     * @param entries - the row's text nodes with their offsets.
     * @param start - first raw offset of the range.
     * @param end - raw offset just past the range.
     * @returns the range, or null when the offsets do not land on text.
     */
    function rangeFromOffsets(entries, start, end) {
      let range = null;
      for (const entry of entries) {
        const entryEnd = entry.start + entry.length;
        if (range === null) {
          if (entryEnd <= start) continue;
          range = document.createRange();
          range.setStart(entry.node, Math.max(0, start - entry.start));
        }
        if (end <= entryEnd) {
          range.setEnd(entry.node, Math.max(0, end - entry.start));
          return range;
        }
      }
      if (range === null) return null;
      const last = entries[entries.length - 1];
      range.setEnd(last.node, last.length);
      return range;
    }

    /**
     * Build a DOM Range over the quoted passage inside one row: from the first
     * needle to the end of the last matched line, so the whole quoted text lights
     * up instead of the message box around it.
     * @param row - the message row that contains the quote.
     * @param needles - flattened needles from `quoteNeedles`.
     * @returns the range, or null when no needle maps to text in this row.
     */
    function rangeOfPassage(row, needles) {
      const entries = textEntriesOf(row);
      if (entries.length === 0) return null;
      const joined = entries.map((entry) => entry.node.nodeValue ?? '').join('');
      const normalized = normalizeForMatch(joined);
      let start = -1;
      let end = -1;
      for (const needle of needles) {
        const at = normalized.text.indexOf(needle);
        if (at < 0) continue;
        const first = normalized.map[at] ?? 0;
        const last = normalized.map[at + needle.length - 1] ?? first;
        const newline = joined.indexOf('\n', last + 1);
        const lineEnd = newline < 0 ? joined.length : newline;
        if (start < 0 || first < start) start = first;
        if (lineEnd > end) end = lineEnd;
      }
      if (start < 0 || end <= start) return null;
      return rangeFromOffsets(entries, start, end);
    }

    /**
     * Paint one range with the CSS Custom Highlight API, then clear it. The pass
     * sits behind the glyphs and follows reflow, so only the quoted characters
     * light up.
     * @param range - text range to highlight.
     * @returns whether a highlight was applied.
     */
    function highlightRange(range) {
      if (typeof CSS === 'undefined' || CSS.highlights === undefined || typeof Highlight !== 'function') return false;
      try {
        if (highlightTimer !== 0) window.clearTimeout(highlightTimer);
        CSS.highlights.delete(HIGHLIGHT_NAME);
        CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
        highlightTimer = window.setTimeout(() => {
          highlightTimer = 0;
          CSS.highlights.delete(HIGHLIGHT_NAME);
        }, quoteSettings.getSnapshot().highlightMs);
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Scroll the conversation to the message a quote was taken from and flash the
     * quoted passage itself. Rows are searched upward from the quoting message,
     * so the nearest earlier match wins.
     *
     * @param originRow - the chat row this card renders in, or null.
     * @param raw - quoted body text.
     * @returns whether a matching message was found and revealed.
     */
    function revealQuotedSource(originRow, raw) {
      const needles = quoteNeedles(raw);
      if (needles.length === 0) return false;
      let rows;
      try {
        rows = [...document.querySelectorAll('[data-chat-flow-kind]')];
      } catch (error) {
        return false;
      }
      if (rows.length === 0) return false;
      const originIndex = originRow === null ? rows.length : rows.indexOf(originRow);
      for (let index = (originIndex < 0 ? rows.length : originIndex) - 1; index >= 0; index -= 1) {
        const row = rows[index];
        const flat = normalizeForMatch(String(row.textContent ?? '')).text;
        const needle = needles.find((candidate) => flat.includes(candidate));
        if (needle === undefined) continue;
        row.scrollIntoView({ block: 'center' });
        const range = rangeOfPassage(row, needles);
        if (range !== null) highlightRange(range);
        return true;
      }
      return false;
    }

    /**
     * Render one sent quote as a wrapped, collapsible card instead of raw `> `
     * lines, with a control that jumps back to the message it quotes.
     * @param props - the parser's node for this text run and the bound dictionary.
     * @returns the quote card.
     */
    function QuoteTextNode(props) {
      const node = props.node;
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const data = node && node.data ? node.data : {};
      const header = typeof data.header === 'string' && data.header !== '' ? data.header : t('cardLabel');
      const body = typeof data.body === 'string' ? data.body : '';
      const lineCount = body === '' ? 0 : body.split('\n').length;
      const settings = useQuoteSettings();
      const [expanded, setExpanded] = React.useState(false);
      const [overflowing, setOverflowing] = React.useState(false);
      const [missed, setMissed] = React.useState(false);
      const bodyRef = React.useRef(null);
      const missTimer = React.useRef(0);

      // Clamp first, then ask the element whether anything is left hidden: a
      // quoted paragraph and a quoted code block both need the toggle, but a
      // two-line quote must not offer one. A ResizeObserver re-measures after
      // fonts, width changes, or the message's first layout.
      React.useEffect(() => {
        const element = bodyRef.current;
        if (element === null) return undefined;
        const measure = () => {
          if (expanded || element.clientHeight === 0) return;
          setOverflowing(element.scrollHeight > element.clientHeight + 2);
        };
        measure();
        if (typeof ResizeObserver !== 'function') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
      }, [body, expanded]);

      React.useEffect(() => () => {
        if (missTimer.current !== 0) window.clearTimeout(missTimer.current);
      }, []);

      const onJump = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget;
        const origin = target !== null && typeof target.closest === 'function' ? target.closest('[data-chat-flow-kind]') : null;
        if (revealQuotedSource(origin, body === '' ? header : body)) return;
        setMissed(true);
        if (missTimer.current !== 0) window.clearTimeout(missTimer.current);
        missTimer.current = window.setTimeout(() => {
          missTimer.current = 0;
          setMissed(false);
        }, 1600);
      };

      const head = h('div', { key: 'head', className: 'dsq-sent-head' }, [
        h(QuoteGlyph, { key: 'glyph' }),
        h('span', { key: 'label', className: 'dsq-sent-label' }, header),
        settings.showJump
          ? h(
              'button',
              {
                key: 'jump',
                type: 'button',
                className: 'dsq-sent-action',
                title: t('jumpHint'),
                onMouseDown: (event) => event.preventDefault(),
                onClick: onJump,
              },
              missed ? t('jumpMissed') : t('jump'),
            )
          : null,
      ]);
      const children = [head];
      children.push(
        h(
          'div',
          {
            key: 'body',
            ref: bodyRef,
            className: 'dsq-sent-body',
            'data-clamped': expanded ? '0' : '1',
            // The fade is measured, not guessed: a short quote must never look
            // as if its last lines were cut off.
            'data-faded': !expanded && overflowing ? '1' : '0',
          },
          body,
        ),
      );
      if (overflowing || expanded) {
        children.push(
          h(
            'div',
            { key: 'more', className: 'dsq-sent-more' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsq-sent-action',
                onClick: () => setExpanded(!expanded),
              },
              expanded ? t('collapse') : t('expand', { count: lineCount }),
            ),
          ),
        );
      }
      return h('div', { className: 'dsq-sent', 'data-style': settings.style }, children);
    }

    //#endregion

    //#region components

    /** Hairline quote glyph; artwork keeps its own color through currentColor. */
    function QuoteGlyph() {
      return h(
        'svg',
        {
          className: 'dsq-glyph',
          width: 12,
          height: 12,
          viewBox: '0 0 16 16',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', {
          fill: 'currentColor',
          d: 'M6.5 3.1C4.4 4.3 3 6.2 3 8.4 3 10.5 4.2 12 6 12c1.5 0 2.6-1.1 2.6-2.5S7.6 7 6.3 7c-.3 0-.6 0-.8.1.3-.9 1.1-1.8 2.2-2.4l-.3-1.6Zm6 0C10.4 4.3 9 6.2 9 8.4 9 10.5 10.2 12 12 12c1.5 0 2.6-1.1 2.6-2.5S13.6 7 12.3 7c-.3 0-.6 0-.8.1.3-.9 1.1-1.8 2.2-2.4l-.3-1.6Z',
        }),
      );
    }

    /**
     * Headless session seat: publishes the composer insert verbs for the pill.
     * It renders nothing and sits on an absolutely positioned zero-height anchor.
     */
    function QuoteBridge(props) {
      const useInput = props.useInput;
      const inputActions = props.inputActions;
      const sessionId = props.sessionId;
      const input = typeof useInput === 'function' ? useInput((state) => state) : undefined;
      const latest = React.useRef({ input, inputActions });
      latest.current.input = input;
      latest.current.inputActions = inputActions;

      React.useEffect(() => {
        if (!inputActions) return undefined;
        const bridge = {
          sessionId,
          /**
           * Insert one quote as an atomic reference chip in this Session's draft.
           *
           * The chip is the composer's only wrapped, non-editable inline form: a
           * decorator node that Backspace removes as a whole, whose label the host
           * renders as a password-style capsule. It serializes to the markdown
           * blockquote in `clipboardText`, which is what the message carries.
           *
           * @param reference - owner reference payload built by the pill.
           * @returns 'chip' when the composer took the chip, 'text' when only the
           * plain blockquote applied, or false when the draft refused both.
           */
          insert(reference) {
            const actions = latest.current.inputActions;
            const state = latest.current.input;
            if (!actions || !reference) return false;
            const draft = state ? String(state.draft ?? '') : '';
            const references = state && Array.isArray(state.occurrences) ? state.occurrences.length : 0;
            const blank = draft === '' && references === 0;
            try {
              // An empty document has no block for a chip to sit in, so seed one
              // block before asking the composer for an insertion point.
              if (blank) actions.setDraft(' ');
              const span = actions.captureInsertion();
              const actx = codecReady ? sessionScope(sessionId) : undefined;
              if (actx !== undefined && typeof actx.bail === 'function') {
                let applied = false;
                try {
                  applied = actx.bail(actx, INSERT_EVENT, { reference, span }) === true;
                } catch (error) {
                  // A composer that refuses the chip leaves the text path below.
                  applied = false;
                }
                if (applied) return 'chip';
              }
              const lead = blank ? '' : '\n\n';
              return actions.insertText(lead + reference.clipboardText, span) === true ? 'text' : false;
            } catch (error) {
              return false;
            }
          },
        };
        publishActiveBridge(bridge);
        return () => {
          publishActiveBridge(null);
        };
      }, [inputActions, sessionId]);

      return null;
    }

    /**
     * Frame-wide pill: follows a conversation text selection and quotes it into
     * the composer through the published bridge.
     */
    function SelectionQuote(props) {
      const t = props.t;
      const tRef = React.useRef(t);
      tRef.current = t;
      const feedbackTimer = React.useRef(0);
      const [bridge, setBridge] = React.useState(readActiveBridge);
      const [target, setTarget] = React.useState(null);
      const [note, setNote] = React.useState(null);

      React.useEffect(() => subscribeActiveBridge(() => setBridge(readActiveBridge())), []);

      React.useEffect(() => {
        let frame = 0;
        let dragging = false;

        const hide = () => setTarget(null);

        const read = () => {
          frame = 0;
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return hide();
          const text = selection.toString();
          if (text.trim() === '') return hide();
          const range = selection.getRangeAt(0);
          const endpoint = locatedEndpoint(range.startContainer) ?? locatedEndpoint(range.endContainer);
          if (endpoint === null) return hide();
          const rects = range.getClientRects();
          const last = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
          if (!last || (last.width === 0 && last.height === 0)) return hide();
          const placeBelow = last.bottom + GAP + PILL_SPACE <= window.innerHeight;
          const top = placeBelow ? last.bottom + GAP : Math.max(12, last.top - GAP);
          const left = Math.max(12, Math.min(last.left, window.innerWidth - 128));
          setTarget({
            text,
            role: roleOf(rowKind(endpoint)),
            left,
            top,
            placeBelow,
          });
        };

        const schedule = () => {
          if (frame !== 0) return;
          frame = window.requestAnimationFrame(read);
        };

        const onSelectionChange = () => {
          if (dragging) return;
          schedule();
        };
        const onPointerDown = (event) => {
          const node = elementOf(event.target);
          if (node !== null && typeof node.closest === 'function' && node.closest('[' + PILL_ATTR + ']') !== null) return;
          dragging = true;
          hide();
        };
        const onPointerUp = () => {
          if (!dragging) return;
          dragging = false;
          schedule();
        };
        const onScroll = () => schedule();
        const onResize = () => schedule();
        const onKeyDown = (event) => {
          if (event.key === 'Escape') return hide();
          if (event.shiftKey || event.key === 'a' || event.key === 'A') schedule();
        };

        document.addEventListener('selectionchange', onSelectionChange);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
          if (frame !== 0) window.cancelAnimationFrame(frame);
          document.removeEventListener('selectionchange', onSelectionChange);
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('pointerup', onPointerUp, true);
          document.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('resize', onResize);
        };
      }, []);

      React.useEffect(() => () => {
        if (feedbackTimer.current !== 0) window.clearTimeout(feedbackTimer.current);
      }, []);

      const showNote = (text, ok, at) => {
        setNote({ text, ok, ...at });
        if (feedbackTimer.current !== 0) window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = window.setTimeout(() => {
          feedbackTimer.current = 0;
          setNote(null);
        }, 1600);
      };

      /** Move focus into the composer so the user keeps typing after a quote. */
      const focusComposer = () => {
        try {
          const bar = document.querySelector('[data-slot="conversation.composer.bar"]');
          const host = (bar ?? document).querySelector('[data-lexical-editor="true"]');
          if (host !== null && typeof host.focus === 'function') host.focus({ preventScroll: true });
        } catch (error) {
          // Focus is a convenience; a missing host never fails the quote.
        }
      };

      const onQuote = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (target === null) return;
        const at = { left: target.left, top: target.top, placeBelow: target.placeBelow };
        const current = readActiveBridge();
        const dictionary = tRef.current;
        const reference = buildQuoteReference(dictionary, target.text, target.role);
        const accepted = current !== null && reference !== null && current.insert(reference) !== false;
        setTarget(null);
        if (accepted) {
          showNote(dictionary('quoted'), true, at);
          focusComposer();
          return;
        }
        showNote(dictionary('failed'), false, at);
      };

      const placement = (left, top, placeBelow) => ({
        position: 'fixed',
        left: left + 'px',
        top: top + 'px',
        transform: placeBelow ? 'none' : 'translateY(-100%)',
        zIndex: 45,
        pointerEvents: 'auto',
      });

      const children = [];
      if (bridge !== null && target !== null) {
        children.push(
          h(
            'div',
            { key: 'dsq-pill', [PILL_ATTR]: '1', style: placement(target.left, target.top, target.placeBelow) },
            h(
              'button',
              {
                type: 'button',
                className: 'dsq-pill',
                title: t('hint'),
                'aria-label': t('hint'),
                onMouseDown: (event) => event.preventDefault(),
                onClick: onQuote,
              },
              h(QuoteGlyph, null),
              h('span', null, t('quote')),
            ),
          ),
        );
      } else if (note !== null) {
        children.push(
          h(
            'div',
            {
              key: 'dsq-note',
              [PILL_ATTR]: '1',
              'data-ok': note.ok ? '1' : '0',
              style: placement(note.left, note.top, note.placeBelow),
            },
            h('span', { className: 'dsq-note', 'data-ok': note.ok ? '1' : '0' }, note.text),
          ),
        );
      }
      return h(React.Fragment, null, children);
    }

    //#endregion

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        rootCtx = ctx;
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'selection-quote: dictionaries');
        boundT = ctx.locale.bind(NS);

        quoteSettings.value = readStoredSettings();

        // One sheet for both surfaces; component-local copies would repeat it per
        // mounted message. It is rewritten whenever the configuration changes, so
        // the highlight tint and collapsed height follow the setting live.
        // Owned by this plugin's effect, removed on unload.
        ctx.effect(() => {
          const tagId = 'selection-quote/styles';
          const existing = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
          // A reload generation may have left its tag behind: take it over rather
          // than injecting a second sheet whose rules would disagree.
          const tag = existing !== null ? existing : document.createElement('style');
          tag.dataset.plugin = '@kingcharleslzy-ai/dsh-selection-quote';
          tag.dataset.pluginCss = tagId;
          tag.textContent = buildStyleSheet(quoteSettings.getSnapshot());
          if (existing === null) document.head.appendChild(tag);
          styleTag = tag;
          return () => {
            if (styleTag === tag) styleTag = null;
            tag.remove();
          };
        }, 'selection-quote: stylesheet');

        // The configuration page on this bundle's row: the plugin manager opens it
        // from the row's Configure control and renders it instead of Settings.
        ctx.slots.inject('plugins.row.config', () =>
          ctx.slots.register(
            {
              name: 'plugins.row.config',
              key: '@kingcharleslzy-ai/dsh-selection-quote#selection-quote',
              locale: NS,
            },
            QuoteSettingsPage,
          ),
        );

        // Sent quotes: the rule finds the blockquote a chip serialized to, and the
        // keyed renderer draws it as a wrapped card in the same user message.
        ctx.inject(['uiConversation'], (scope) => {
          scope.effect(
            () => scope.uiConversation.userText.register(quoteTextRule),
            'selection-quote: sent quote rule',
          );
          scope.slots.inject('conversation.user.text.node', () =>
            scope.slots.register(
              {
                name: 'conversation.user.text.node',
                key: TEXT_RULE_ID,
                priority: 100,
                locale: NS,
              },
              QuoteTextNode,
            ),
          );
        });

        // A reference chip is only sendable while its owner answers prompt
        // serialization, so the source below exists for the codec alone: its
        // candidate roster is empty and never enters the `@` completion menu.
        ctx.inject(['inputTriggers'], (scope) => {
          scope.effect(() => {
            const dispose = scope.inputTriggers.registerSource({
              trigger: '@',
              name: SOURCE,
              showGroupTitle: false,
              candidates: () => Promise.resolve([]),
              onPick: () => undefined,
              codec: {
                clipboardText: (ref) => (typeof ref === 'string' ? ref : ''),
                serialize: (ref) => Promise.resolve(serializeQuoteRef(ref)),
              },
            });
            codecReady = true;
            return () => {
              codecReady = false;
              dispose();
            };
          }, 'selection-quote: reference codec');
        });

        ctx.slots.inject('conversation.input.overlay', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.overlay',
              id: 'selection-quote-bridge',
              order: 20,
            },
            QuoteBridge,
          ),
        );

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'selection-quote',
              order: 45,
              locale: NS,
            },
            SelectionQuote,
          ),
        );
      },
    };
  },
});
