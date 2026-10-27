import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Info, LayoutDashboard, Monitor, Moon, Move, ShieldCheck, Sun, ZoomIn } from 'lucide-react'
import type { AppTheme, BoardTheme, DockEdge, Language, UserSettings, WheelBehavior } from '@shared/types'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { useSettings } from '@renderer/stores/session'
import { CardChoice } from './CardChoice'
import { Choice } from './Choice'
import { AccountPage, Row, Section } from './PageParts'
import { BoardThemeSwatch, DockDiagram } from './SettingsPreviews'
import { saveSettings } from './settingsActions'
import { Switch } from './Switch'
import './SettingsScreen.css'

const LANGUAGES: readonly Language[] = ['en', 'ar']
const BOARD_THEMES: readonly BoardTheme[] = ['normal', 'hacker', 'detective']
const DOCK_EDGES: readonly DockEdge[] = ['top', 'bottom', 'left', 'right']
const AUTO_LOCK_PRESETS: readonly number[] = [0, 5, 10, 15, 30, 60]

interface AppInfo {
  version: string
  platform: string
  dataPath: string
}

type InfoState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; info: AppInfo }

export function SettingsScreen() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [about, setAbout] = useState<InfoState>({ kind: 'loading' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    call(api.system.appInfo()).then(
      (info) => !cancelled && setAbout({ kind: 'ready', info }),
      () => !cancelled && setAbout({ kind: 'failed' })
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const save = (patch: Partial<UserSettings>) => void saveSettings(patch, t)

  const copyPath = async (path: string) => {
    try {
      await call(api.system.copyText({ text: path }))
      setCopied(true)
      toast.success(t('common.copied'))
    } catch (err) {
      toast.error(errorMessage(t, err))
    }
  }

  // A value set outside the presets (the API accepts up to 240) stays selectable.
  const lockOptions = AUTO_LOCK_PRESETS.includes(settings.autoLockMinutes)
    ? AUTO_LOCK_PRESETS
    : [...AUTO_LOCK_PRESETS, settings.autoLockMinutes].sort((a, b) => a - b)

  const aboutValue = (render: (info: AppInfo) => ReactNode): ReactNode =>
    about.kind === 'ready'
      ? render(about.info)
      : about.kind === 'loading'
        ? t('common.loading')
        : t('account.settings.about.unavailable')

  return (
    <AccountPage id="acct-settings" title={t('account.settings.title')} subtitle={t('account.settings.subtitle')}>
      <Section
        id="acct-set-appearance"
        icon={<Monitor size={18} />}
        title={t('account.settings.appearance.title')}
        description={t('account.settings.appearance.description')}
      >
        <Row
          labelId="acct-set-language"
          label={t('account.settings.language.label')}
          descriptionId="acct-set-language-desc"
          description={t('account.settings.language.description')}
        >
          <Choice<Language>
            labelledBy="acct-set-language"
            describedBy="acct-set-language-desc"
            value={settings.language}
            options={LANGUAGES.map((l) => ({ value: l, label: t(`account.languages.${l}`), lang: l }))}
            onChange={(language) => save({ language })}
          />
        </Row>
        <Row
          labelId="acct-set-theme"
          label={t('account.settings.appTheme.label')}
          descriptionId="acct-set-theme-desc"
          description={t('account.settings.appTheme.description')}
        >
          <Choice<AppTheme>
            labelledBy="acct-set-theme"
            describedBy="acct-set-theme-desc"
            value={settings.appTheme}
            options={[
              { value: 'light', label: t('account.settings.appTheme.light'), icon: <Sun size={15} aria-hidden="true" /> },
              { value: 'dark', label: t('account.settings.appTheme.dark'), icon: <Moon size={15} aria-hidden="true" /> }
            ]}
            onChange={(appTheme) => save({ appTheme })}
          />
        </Row>
      </Section>

      <Section
        id="acct-set-boards"
        icon={<LayoutDashboard size={18} />}
        title={t('account.settings.boards.title')}
        description={t('account.settings.boards.description')}
      >
        <Row
          stacked
          labelId="acct-set-board-theme"
          label={t('account.settings.boardTheme.label')}
          descriptionId="acct-set-board-theme-desc"
          description={t('account.settings.boardTheme.description')}
        >
          <CardChoice<BoardTheme>
            className="acct-set__wide"
            labelledBy="acct-set-board-theme"
            describedBy="acct-set-board-theme-desc"
            value={settings.defaultBoardTheme}
            minCardWidth={170}
            options={BOARD_THEMES.map((theme) => ({
              value: theme,
              label: t(`account.settings.boardTheme.${theme}.name`),
              description: t(`account.settings.boardTheme.${theme}.text`),
              visual: <BoardThemeSwatch theme={theme} animated={settings.animations} />
            }))}
            onChange={(defaultBoardTheme) => save({ defaultBoardTheme })}
          />
        </Row>
        <Row
          stacked
          labelId="acct-set-dock"
          label={t('account.settings.toolbar.label')}
          descriptionId="acct-set-dock-desc"
          description={t('account.settings.toolbar.description')}
        >
          <CardChoice<DockEdge>
            className="acct-set__wide"
            labelledBy="acct-set-dock"
            describedBy="acct-set-dock-desc"
            value={settings.toolbarEdge}
            minCardWidth={112}
            options={DOCK_EDGES.map((edge) => ({
              value: edge,
              label: t(`account.settings.toolbar.${edge}`),
              visual: <DockDiagram edge={edge} />
            }))}
            onChange={(toolbarEdge) => save({ toolbarEdge })}
          />
        </Row>
        <Row
          labelId="acct-set-wheel"
          label={t('account.settings.wheel.label')}
          descriptionId="acct-set-wheel-desc"
          description={t('account.settings.wheel.description')}
        >
          <Choice<WheelBehavior>
            labelledBy="acct-set-wheel"
            describedBy="acct-set-wheel-desc"
            value={settings.wheelBehavior}
            options={[
              { value: 'zoom', label: t('account.settings.wheel.zoom'), icon: <ZoomIn size={15} aria-hidden="true" /> },
              { value: 'pan', label: t('account.settings.wheel.pan'), icon: <Move size={15} aria-hidden="true" /> }
            ]}
            onChange={(wheelBehavior) => save({ wheelBehavior })}
          />
        </Row>
        <Row
          labelId="acct-set-grid"
          label={t('account.settings.grid.label')}
          descriptionId="acct-set-grid-desc"
          description={t('account.settings.grid.description')}
        >
          <Switch
            checked={settings.showGrid}
            onChange={(showGrid) => save({ showGrid })}
            labelledBy="acct-set-grid"
            describedBy="acct-set-grid-desc"
          />
        </Row>
        <Row
          labelId="acct-set-anim"
          label={t('account.settings.animations.label')}
          descriptionId="acct-set-anim-desc"
          description={t('account.settings.animations.description')}
        >
          <Switch
            checked={settings.animations}
            onChange={(animations) => save({ animations })}
            labelledBy="acct-set-anim"
            describedBy="acct-set-anim-desc"
          />
        </Row>
      </Section>

      <Section
        id="acct-set-security"
        icon={<ShieldCheck size={18} />}
        title={t('account.settings.security.title')}
        description={t('account.settings.security.description')}
      >
        <Row
          stacked
          labelId="acct-set-lock"
          label={t('account.settings.autoLock.label')}
          descriptionId="acct-set-lock-desc"
          description={
            <>
              {t('account.settings.autoLock.description')}{' '}
              <kbd className="acct-kbd" dir="ltr">
                Ctrl+L
              </kbd>
            </>
          }
        >
          <Choice<number>
            className="acct-set__lock"
            labelledBy="acct-set-lock"
            describedBy="acct-set-lock-desc"
            value={settings.autoLockMinutes}
            options={lockOptions.map((m) =>
              m === 0
                ? { value: 0, label: t('account.settings.autoLock.off') }
                : {
                    value: m,
                    label: t('account.settings.autoLock.short', { count: m }),
                    ariaLabel: t('account.settings.autoLock.minutes', { count: m })
                  }
            )}
            onChange={(autoLockMinutes) => save({ autoLockMinutes })}
          />
        </Row>
      </Section>

      <Section
        id="acct-set-about"
        icon={<Info size={18} />}
        title={t('account.settings.about.title')}
        description={t('account.settings.about.description')}
      >
        <Row labelId="acct-set-version" label={t('account.settings.about.version')}>
          <span className="acct-value">
            {aboutValue((info) => (
              <>
                <bdi dir="ltr">{info.version}</bdi>
                {' · '}
                {t(`account.settings.about.platforms.${info.platform}`, { defaultValue: info.platform })}
              </>
            ))}
          </span>
        </Row>
        <Row
          stacked
          labelId="acct-set-data"
          label={t('account.settings.about.dataLocation')}
          descriptionId="acct-set-data-desc"
          description={t('account.settings.about.dataLocationText')}
        >
          <div className="acct-set__path">
            <code className="acct-value acct-value--mono" dir="ltr">
              {aboutValue((info) => info.dataPath)}
            </code>
            {about.kind === 'ready' && (
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                onClick={() => void copyPath(about.info.dataPath)}
                aria-label={t('account.settings.about.copyPath')}
                title={t('account.settings.about.copyPath')}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            )}
          </div>
        </Row>
      </Section>
    </AccountPage>
  )
}
