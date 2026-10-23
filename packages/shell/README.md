# @newaxhq/shell

Shared application frame for NEWAX apps: header, footer, breadcrumbs with
a GitHub-style overflow dropdown, two independently collapsible sidebars,
and a secondary horizontal nav row under the header -- plus the
supporting pieces every app shell needs (app/workspace switcher, user
menu, search/notifications/help triggers, status banners, skip link,
mobile nav drawer).

Structure and navigation state only. Page content, business logic, and
permission enforcement stay with each application -- see
`docs/package-governance/README.md` §8.

## What's here

| Component                                                | Region                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AppShell`                                               | Root frame, composes every region below                                                  |
| `Header`                                                 | App identity, switchers, triggers, user menu                                             |
| `HorizontalNav`                                          | Secondary nav row under the header                                                       |
| `Sidebar`                                                | Primary _and_ secondary sidebar -- same component, two independently collapsed instances |
| `Breadcrumbs`                                            | Overflow folds behind a `<details>` "..." dropdown past `maxVisible`                     |
| `PageHeader`                                             | Per-page title/description/actions (not app identity)                                    |
| `Footer`                                                 | —                                                                                        |
| `Switcher`                                               | App switcher _and_ workspace/org switcher -- same component                              |
| `UserMenu`                                               | Profile menu dropdown                                                                    |
| `SearchTrigger` / `NotificationsTrigger` / `HelpTrigger` | Header entry points; the app supplies the actual search/notifications UI                 |
| `StatusBanner`                                           | Maintenance/announcement/connectivity banners                                            |
| `SkipLink`                                               | Keyboard skip-to-content                                                                 |
| `MobileNavDrawer`                                        | Built on `<dialog>` for free focus-trap/Escape/backdrop                                  |

`isNavItemActive` and `collapseBreadcrumbs` are exported as pure
functions so active-route and overflow logic are unit-testable without
rendering.

## Usage

```tsx
import {
  AppShell,
  Header,
  HorizontalNav,
  Sidebar,
  Breadcrumbs,
  PageHeader,
  Footer,
  Switcher,
  UserMenu,
  SearchTrigger,
  NotificationsTrigger,
  HelpTrigger,
  StatusBanner,
  MobileNavDrawer,
} from '@newaxhq/shell';

<AppShell
  statusBanners={<StatusBanner banner={banner} onDismiss={dismiss} />}
  header={
    <Header
      application={{ id: 'communicator', name: 'Communicator', homeHref: '/' }}
      appSwitcher={<Switcher label="Switch application" current={current} options={apps} />}
      triggers={
        <>
          <SearchTrigger onActivate={openSearch} />
          <NotificationsTrigger unreadCount={3} onActivate={openNotifications} />
          <HelpTrigger href="/help" />
        </>
      }
      userMenu={<UserMenu profile={profile} actions={accountActions} />}
    />
  }
  horizontalNav={<HorizontalNav items={secondaryNav} currentPath={path} />}
  primarySidebar={
    <Sidebar
      label="Primary"
      items={primaryNav}
      currentPath={path}
      collapsed={primaryCollapsed}
      onToggleCollapse={togglePrimary}
    />
  }
  secondarySidebar={
    <Sidebar
      label="Secondary"
      items={secondaryNav}
      currentPath={path}
      collapsed={secondaryCollapsed}
      onToggleCollapse={toggleSecondary}
    />
  }
  mobileNavDrawer={
    <MobileNavDrawer
      label="Menu"
      items={primaryNav}
      currentPath={path}
      open={drawerOpen}
      onClose={closeDrawer}
    />
  }
  footer={<Footer>© NEWAX</Footer>}
>
  <PageHeader breadcrumbs={<Breadcrumbs items={breadcrumbs} />} title="Conversations" />
  {/* the app's own page content */}
</AppShell>;
```

## What's deliberately not here

Collapsed/expanded state, which layout the user last used, and dismissed
banner ids are the host app's state to own and persist (e.g.
`localStorage`, a user-preference endpoint) -- every prop above is
controlled, nothing is stored inside this package. Routing, search
results, notification content, and the user-menu action list are also
the app's: this package renders the frame, never fetches or interprets
the data inside it.
