# Schedule Builder

A single-page tool for planning a quarter or semester class schedule, printing it, and getting it into Google Calendar. It runs entirely in the browser: no server, no account, no build step.

## Features

**Schedule**
- Set the term's title, first and last day of classes, and an optional finals week
- Add classes with a course code, name, instructor, room and color, plus optional lab, seminar, discussion or studio sections (shown as LAB / SEM / DIS / STU when a class has more than one meeting type)
- Optional final exam for each class
- Common holidays added automatically for the United States, Canada or Japan, plus your own breaks
- Overlapping classes and finals are flagged on the class cards and outlined in red on the preview

**Calendar views**
- **First week** blocks out days before classes start, and any holidays that week
- **Regular week** shows the repeating weekly pattern
- **Finals week** shows final exams
- All three views share the same hours and days, so they line up

**Preview and style**
- The right side is a live preview of the printed page, showing the whole page at full window height; click a class on it to edit that class
- The **Style** tab sets:
  - **Page:** paper size (Letter or A4), orientation, margins and background
  - **Font** and exact **text sizes** in points
  - **Class blocks:** course code, name, time, room, instructor and section type. With the code off, blocks lead with the course name
  - **Header and legend:** subtitle, view label, week range, title left or centered; legend position (top, bottom, left, right or off), what it shows (code, name, instructor, room, or color swatches only) and its order (as entered, by course code, or by first class of the week)
  - **Days and time:** hours and days shown, week starting Monday or Sunday, day names (Mon / Monday / M), dates (Jan 5 / 1/5 / 5 Jan), 12- or 24-hour time, half-hour lines, and striped days with no classes
  - **Colors:** block style, grayscale and a colorblind-safe palette
  - **Calendar app events:** how events are named in the .ics and CSV ("CSE 143: Computer Programming II", code only, or name only) and whether to add the section type, like (LEC)
- Each Style section folds up and shows its current values in its heading; **Reset all** restores the defaults

**Exporting and saving**
- **Export** menu:
  - **iCalendar (.ics)**: one weekly repeating series per meeting pattern (a Mon/Wed/Fri lecture is a single series), holidays skipped, time zone included
  - **CSV** in Google Calendar's import format, with one event per class meeting
  - **PNG**, **PDF** or **print** of the current view, or one **3-page PDF** with all three views
- **Save** writes a .json file you can **Open** later to keep editing, including your style settings
- The header shows **Unsaved changes** after an edit and **Saved 4:52 PM** after a Save or export
- **Undo / redo** (Ctrl+Z / Ctrl+Shift+Z, or Cmd on a Mac) for every change, including removing a class

**Layout**
- Desktop: **Schedule** and **Style** tabs on the left, the preview on the right. Drag the divider between them to resize; double-click it to reset to half and half
- Phones: a bottom tab bar switches between Schedule, Style and Preview

Nothing is stored on a server or in the browser. Use **Save** to keep your work; the page warns you before you leave with unsaved changes.

## Running locally

Open `index.html` in a browser. There is no build step and nothing to install.

To run the tests, install [Node.js](https://nodejs.org/) 20 or later, then:

```sh
npm test
```

## Project structure

```
index.html              Page markup; loads the stylesheets and scripts
css/
  tokens.css            Colors, the site font (DM Sans) and sizes, light and dark mode
  base.css              Element defaults and small utility classes
  layout.css            Header, the two-pane split, the divider and the phone tab bar
  components.css        Buttons, fields, segmented controls, menu, save status, modal, toast
  term.css              Term card and holiday list
  courses.css           Class cards, overlap warnings and the class editor
  calendar.css          View tabs, the note above the calendar, and the page preview
  style-panel.css       Style tab sections
js/
  core/                 Pure logic, no DOM access (unit tested)
    constants.js        Day names, colors, meeting types, fonts, sizes, paper sizes
    dates.js            Date/time parsing and formatting
    holidays.js         Holiday rules for US, Canada and Japan
    color.js            Color math for course colors
    schedule.js         Data model: types, defaults, validation, overlaps, saved-file import
    week-view.js        Builds one calendar view, including the note shown above it
    event-text.js       Text shown inside class blocks
    page-theme.js       Page backgrounds and class block colors
    page-layout.js      Lays out a view as a printed page (shapes and text in points)
    history.js          Undo/redo history of schedule snapshots
    time-zone.js        Time zone offsets and the VTIMEZONE block for .ics files
  export/
    ics.js              iCalendar export
    csv.js              Google Calendar CSV export
    pdf.js              Image PDF writer, one image per page
    calendar-image.js   Draws a page layout on a canvas for PNG/PDF/print
  ui/                   DOM code, one module per part of the page
    dom.js              Lookups, escaping, toast, menu, modal, downloads, printing
    fonts.js            Loads calendar fonts and measures text for the layout
    store.js            App state, undo/redo and change notifications
    navigation.js       Schedule/Style tabs and the phone tab bar
    pane-divider.js     Draggable divider between the panes (desktop)
    term-form.js        Term title and dates
    holidays-panel.js   Automatic and manual holidays
    course-list.js      Class cards, overlap warnings and the add/edit form
    calendar-view.js    View tabs, the note, the page preview (SVG) and click-to-edit
    style-panel.js      Style tab: page, font, sizes, blocks, header and legend, days and time, colors, event titles
    toolbar.js          Undo/redo, Open/Save, Export menu, save status
  app.js                Entry point: starts every UI module
tests/                  Node test runner tests (see below)
.github/workflows/      Runs tests and deploys to GitHub Pages
```

### How the code fits together

- Every script attaches to one global namespace, `TSB`. Scripts load in the order listed in `index.html`, and each one only uses modules loaded before it.
- `js/core` and `js/export` (except `calendar-image.js`) never touch the DOM, so the tests load them directly in Node.
- The calendar page is laid out once by `core/page-layout.js`, which returns a list of shapes and text positioned in points. `ui/calendar-view.js` draws that list as SVG for the on-screen preview, and `export/calendar-image.js` draws the same list on a canvas for PNG, PDF and print, so they match.
- UI modules read and change `TSB.store.state`. After a change they call `store.markChanged(...topics)`, which also records an undo step, and each module re-renders when a topic it subscribes to is emitted. `store.js` lists the topics.
- `app.js` starts each UI module separately. If one script fails to load, the rest of the page still works, the console names the missing file, and a message appears on screen.

### Where to change common text

- **The note above the calendar** ("Repeats weekly from…", "Add the first day of classes to build week 1…", "3 finals scheduled.") is written in `js/core/week-view.js`. The overlap sentence is added in `js/ui/calendar-view.js`.
- **Headings, labels and hints** on the page are in `index.html`.
- **Messages shown after an action** (toasts like "Removed CSE 143") are in the `js/ui/` module for that part of the page.

Some tests check sentences word for word, so run `npm test` after changing wording.

### Tests

- `dates`, `holidays`, `schedule`, `week-view`, `page-layout`, `history` and `time-zone` tests cover the logic in `js/core`.
- `exports` tests check the .ics, CSV and PDF files. One test expands the .ics series the way a calendar app would and checks they produce exactly the same class meetings as the CSV.
- `site-files` checks that every file `index.html` loads exists and that every script in `js/` is loaded. This catches a new or renamed file that was not uploaded, and a leftover old file that should be deleted.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository on the `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs the tests and, if they pass, publishes the site. Pull requests run the tests only.

The site appears at `https://<your-username>.github.io/<repository-name>/`. The workflow is in `.github/workflows/ci.yml`.

When updating the site, upload new files as well as changed ones, and delete files that were removed or renamed. If the tests fail, the run's log names the file or test that failed.

## Importing into Google Calendar

1. In Google Calendar, create a new calendar for the term (Settings → Add calendar → Create new calendar). Deleting it later removes every class at once.
2. Go to **Settings → Import & export → Import**.
3. Choose the downloaded `.ics` file, select the new calendar, and click **Import**.

Each meeting pattern imports as one repeating event. Google Calendar draws a Mon/Wed/Fri series as three blocks each week; clicking one should say "Weekly on Monday, Wednesday, Friday", and editing it asks whether to change this event or all of them.

Importing the same file twice adds every class twice. To re-import after changes, delete the term's calendar and import into a new one.

Times are exported in your device's time zone, and the file describes that time zone, including daylight-saving changes, so every class lands at the right time.

## Holiday notes

Automatic holidays cover common national holidays between the first day of classes and the end of finals week. Schools differ, so remove any your school doesn't observe and add breaks such as spring break yourself.

- **United States:** federal holidays plus the day after Thanksgiving. Columbus Day / Indigenous Peoples' Day is left out because most schools hold classes then.
- **Canada:** provincial holidays vary; Family Day and the Civic Holiday are labeled "most provinces."
- **Japan:** includes substitute holidays (when a holiday falls on a Sunday) and citizens' holidays (a day between two holidays). Equinox dates use the National Astronomical Observatory of Japan's standard formula.
