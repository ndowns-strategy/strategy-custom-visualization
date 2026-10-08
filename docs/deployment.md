# Deploying a visualization

Build the zip first — it runs the validator and puts the plugin folder at the zip root:

```bash
scripts/package.sh SvBulletChart
```

The output is `dist/SvBulletChart.zip`, which contains `SvBulletChart/…`.

## Strategy Workstation (Windows or Mac)

1. Open a dashboard.
2. In the visualization Gallery, click **+** under **Custom** → **Import Visualization**.
3. Pick `dist/<Name>.zip`.

For a faster edit loop during development you can instead copy (or symlink) `plugins/<Name>` into
Workstation's plugins folder and reopen the dashboard:

- Mac: `/Applications/MicroStrategy Workstation.app/Contents/Frameworks/OneTierDashboardWindow.framework/Resources/code/plugins`
- Windows: `C:/Program Files/MicroStrategy/Code/plugins`

(Paths are the documented defaults. The app may be named "Strategy Workstation" in newer installs.)

## Strategy Library / Web

1. Unzip into the server's `plugins` folder so you end up with `plugins/<Name>/WEB-INF/...`:
   - Library: `<Library install>/plugins`
   - Web (Tomcat/JSP): `<Tomcat>/webapps/MicroStrategy/plugins`
   - Web (IIS/ASP): `<Install>/Web ASPx/plugins`
2. Restart the web server (Tomcat / IIS). XML config is only read at startup.
3. Clear the browser cache (or disable it in dev tools) and reload the dashboard.

Updates to JS or CSS in an already-registered plugin only need a cache-busting reload. New
plugins, or changes to anything under `WEB-INF/`, need a restart.

## Strategy Mobile

- **Dashboards on iPad / Android tablet:** copy the plugin into the Mobile server's `plugins` folder.
- **Documents on iPhone / iPad / Android phone / Android tablet:** add a device-specific
  `<visualization-list>` to `visualizations.xml` (copy the `ajax` list, change `name` and
  `view-mode`, set `show-in-web="false"`, and remove `is-mojo`), deploy to both the Web and Mobile
  servers, then tick the device in the document's widget editor:

  | Device | `name` | `view-mode` |
  |---|---|---|
  | iPhone | `iphone` | `70` |
  | iPad | `ipad` | `71` |
  | Android phone | `android` | `72` |
  | Android tablet | `androidTablet` | `73` |

## Release checklist

- [ ] `python3 scripts/validate.py` is clean (no errors; warnings understood).
- [ ] Harness checks done: every dataset (including **empty** and **single**), dark theme,
      small and large sizes, click / Ctrl-click / right-click / hover, **Simulate PDF export**.
- [ ] Tested in Workstation **and** Library with real data, including:
  - [ ] selection persists after saving and reopening the dashboard
  - [ ] **Use as Filter** filters/highlights another visualization, and the plugin highlights when it is the target
  - [ ] Format-panel changes persist; undo/redo works
  - [ ] Export to PDF works
  - [ ] Switching from a Grid to this visualization fills the drop zones sensibly
- [ ] Gallery icon, name, category and hover tooltip look right.
- [ ] Version noted in the plugin's entry in the README catalog.

## Upgrading Strategy

Back up the `plugins` folder before an upgrade, copy it back afterward, restart the web server,
clear browser caches and re-run the release checklist.
