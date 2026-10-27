import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Languages, Lock, LogOut, Moon, Palette, Settings, Sun, UserRound } from 'lucide-react'
import type { AppTheme, Language } from '@shared/types'
import { toast } from '@renderer/components/ui/toast'
import { errorMessage } from '@renderer/lib/api'
import { useNav } from '@renderer/stores/nav'
import { useSession } from '@renderer/stores/session'
import { lockSession, signOut } from '@renderer/features/auth/sessionActions'
import { Avatar } from './Avatar'
import { saveSettings } from './settingsActions'
import './ProfileMenu.css'

const LANGUAGES: readonly Language[] = ['en', 'ar']
const THEMES: readonly { value: AppTheme; Icon: typeof Sun }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon }
]
const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'
const MARGIN = 8

/**
 * Switching language flips the page direction and the header then remounts this component on its
 * other side; the menu re-opens on the chosen option so the change does not close it.
 */
let reopen: { focusKey: string; at: number } | null = null
const REOPEN_WINDOW_MS = 1500

type InitialFocus = 'first' | 'last' | { key: string }

interface Position {
  top: number
  right: number
}

/** Avatar button at the header's top-right corner with the account dropdown. */
export function ProfileMenu() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position>({ top: 0, right: MARGIN })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const initialFocus = useRef<InitialFocus>('first')
  const uid = useId()
  const buttonId = `${uid}-button`
  const menuId = `${uid}-menu`

  // Anchored by its physical right edge to the button, so it can never run past the window edge.
  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: Math.round(r.bottom + 6), right: Math.max(MARGIN, Math.round(window.innerWidth - r.right)) })
  }, [])

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])

  const openMenu = useCallback(
    (focus: InitialFocus) => {
      initialFocus.current = focus
      place()
      setOpen(true)
    },
    [place]
  )

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const list = items()
    const focus = initialFocus.current
    const target =
      focus === 'first'
        ? list[0]
        : focus === 'last'
          ? list[list.length - 1]
          : (list.find((el) => el.dataset.key === focus.key) ?? list[0])
    target?.focus()
  }, [open])

  useEffect(() => {
    const pending = reopen
    reopen = null
    if (pending && Date.now() - pending.at < REOPEN_WINDOW_MS) openMenu({ key: pending.focusKey })
  }, [openMenu])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close(false)
    }
    const onBlur = () => close(false)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('blur', onBlur)
    }
  }, [open, place, close])

  if (!user) return null
  const name = user.displayName || user.username
  const { language, appTheme } = user.settings

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(e.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const current = list.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus()
    switch (e.key) {
      case 'ArrowDown':
        focusAt(current + 1)
        break
      case 'ArrowUp':
        focusAt(current - 1)
        break
      case 'Home':
        focusAt(0)
        break
      case 'End':
        focusAt(list.length - 1)
        break
      case 'ArrowLeft':
      case 'ArrowRight': {
        // Inside an inline segmented group, horizontal arrows move between its options.
        const el = document.activeElement as HTMLElement | null
        const group = el?.dataset.group
        if (!el || !group) return
        const peers = list.filter((x) => x.dataset.group === group)
        const rtl = getComputedStyle(el).direction === 'rtl'
        const step = (e.key === 'ArrowRight') !== rtl ? 1 : -1
        peers[(peers.indexOf(el) + step + peers.length) % peers.length]?.focus()
        break
      }
      case 'Escape':
        close(true)
        break
      case 'Tab':
        close(true)
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const go = (route: 'profile' | 'settings') => {
    close(false)
    useNav.getState().go({ name: route })
  }

  const runAction = (action: () => Promise<void>) => {
    close(false)
    action().catch((err: unknown) => toast.error(errorMessage(t, err)))
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={`acct-menu-btn${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('account.menu.open', { name })}
        title={name}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onButtonKey}
      >
        <Avatar name={name} seed={user.username} size={30} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="acct-menu"
            role="menu"
            aria-labelledby={buttonId}
            style={{ top: pos.top, right: pos.right }}
            onKeyDown={onMenuKey}
          >
            <div className="acct-menu__head">
              <Avatar name={name} seed={user.username} size={40} />
              <div className="acct-menu__who">
                <span className="acct-menu__name">{name}</span>
                <span className="acct-menu__user" dir="ltr">
                  @{user.username}
                </span>
              </div>
            </div>

            <div className="acct-menu__sep" role="separator" />

            <button type="button" role="menuitem" tabIndex={-1} className="acct-menu__item" onClick={() => go('profile')}>
              <UserRound size={16} aria-hidden="true" />
              <span>{t('account.menu.profile')}</span>
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="acct-menu__item" onClick={() => go('settings')}>
              <Settings size={16} aria-hidden="true" />
              <span>{t('account.menu.settings')}</span>
            </button>

            <div className="acct-menu__sep" role="separator" />

            <div className="acct-menu__row" role="group" aria-labelledby={`${uid}-lang`}>
              <span id={`${uid}-lang`} className="acct-menu__row-label">
                <Languages size={16} aria-hidden="true" />
                {t('account.menu.language')}
              </span>
              <span className="acct-menu__seg">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="menuitemradio"
                    tabIndex={-1}
                    aria-checked={language === l}
                    data-group="language"
                    data-key={`language-${l}`}
                    lang={l}
                    className="acct-menu__seg-opt"
                    onClick={() => {
                      if (language === l) return
                      reopen = { focusKey: `language-${l}`, at: Date.now() }
                      void saveSettings({ language: l }, t)
                    }}
                  >
                    {t(`account.languages.${l}`)}
                  </button>
                ))}
              </span>
            </div>
            <div className="acct-menu__row" role="group" aria-labelledby={`${uid}-theme`}>
              <span id={`${uid}-theme`} className="acct-menu__row-label">
                <Palette size={16} aria-hidden="true" />
                {t('account.menu.theme')}
              </span>
              <span className="acct-menu__seg">
                {THEMES.map(({ value, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    tabIndex={-1}
                    aria-checked={appTheme === value}
                    data-group="theme"
                    className="acct-menu__seg-opt"
                    onClick={() => {
                      if (appTheme !== value) void saveSettings({ appTheme: value }, t)
                    }}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {t(`account.menu.${value}`)}
                  </button>
                ))}
              </span>
            </div>

            <div className="acct-menu__sep" role="separator" />

            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="acct-menu__item"
              aria-keyshortcuts="Control+L"
              onClick={() => runAction(lockSession)}
            >
              <Lock size={16} aria-hidden="true" />
              <span>{t('account.menu.lock')}</span>
              <kbd className="acct-menu__kbd" dir="ltr">
                Ctrl+L
              </kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="acct-menu__item acct-menu__item--danger"
              onClick={() => runAction(signOut)}
            >
              <LogOut size={16} aria-hidden="true" className="acct-flip" />
              <span>{t('account.menu.signOut')}</span>
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
