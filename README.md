# Term Schedule Builder

A single-page tool for planning a quarter or semester class schedule and getting it into Google Calendar.

- Add classes with a course code, name, instructor, room and color, plus optional lab, seminar, discussion or studio sections
- Optional final exam for each class
- Three calendar views: **First week** (blocks out days before classes start and holidays), **Regular week**, and **Finals week**
- Common holidays added automatically for the United States, Canada, or Japan, plus manual holidays
- Export to **iCalendar (.ics)** with weekly repeating events and holidays skipped, or **CSV** in Google Calendar's import format
- Download any view as a **PNG** or **PDF**, or print it. The on-screen calendar is a live preview of that page
- Personalize the page: paper size (Letter or A4), orientation, margins, font, exact text sizes in points, block details, header and legend (top, bottom, left, right or off), hours and days shown, block style, grayscale and a colorblind-safe palette
- Settings on the left (**Schedule** and **Style** tabs) with a live page preview on the right; on phones, a bottom tab bar switches between Schedule, Style and Preview
- Click a class on the preview to edit it; overlapping classes are outlined on the preview and flagged in the class list
- **Undo / redo** (Ctrl+Z / Ctrl+Shift+Z) for every change, including removing a class
- **Export** menu: iCalendar, CSV, PNG, PDF or print of the current view, or one 3-page PDF with all three views
- **Save** writes a .json file you can **Open** later to keep editing

Nothing is stored on a server or in the browser. Use **Save** to keep your work.

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
  layout.css            Header and the two-pane split
  components.css        Buttons, fields, segmented controls, modal, toast
  term.css              Term card and holiday list
  courses.css           Course cards and the course editor
  calendar.css          On-screen weekly calendar
  style-panel.css       Style tab sections
js/
  core/                 Pure logic, no DOM access (unit tested)
    constants.js        Day names, colors, meeting types, fonts, separator, size presets
    dates.js            Date/time parsing and formatting
    holidays.js         Holiday rules for US, Canada and Japan
    color.js            Color math for course colors
    schedule.js         Data model: types, factories, validation, saved-file import
    week-view.js        Builds the data for one calendar view
    event-text.js       Text shown inside calendar blocks
    page-theme.js       Page backgrounds and course block colors
    page-layout.js      Lays out a view as a printed page (shapes and text in points)
    history.js          Undo/redo history of schedule snapshots
  export/
    ics.js              iCalendar export (unit tested)
    csv.js              Google Calendar CSV export (unit tested)
    pdf.js              Image PDF writer, one image per page (unit tested)
    calendar-image.js   Draws a page layout on a canvas for PNG/PDF/print
  ui/                   DOM code, one module per part of the page
    dom.js              Lookups, escaping, toast, modal, downloads, printing
    fonts.js            Loads calendar fonts and measures text for the layout
    store.js            App state, undo/redo and change notifications
    navigation.js       Schedule/Style tabs and the phone tab bar
    term-form.js        Term title and dates
    holidays-panel.js   Automatic and manual holidays
    course-list.js      Course cards and the add/edit form
    calendar-view.js    View tabs, the page preview (SVG), click-to-edit
    style-panel.js      Style tab: page, font, sizes, blocks, legend, hours, colors
    toolbar.js          Undo/redo, Open/Save, Export menu, status
  app.js                Entry point: initializes every UI module
tests/                  Node test runner tests for js/core and js/export
.github/workflows/      Runs tests and deploys to GitHub Pages
```

### How the code fits together

- Every script attaches to one global namespace, `TSB`. Scripts load in the order listed in `index.html`, and each one only uses modules loaded before it.
- `js/core` and `js/export` (except `calendar-image.js`) never touch the DOM, so the tests load them directly in Node.
- The calendar page is laid out once by `core/page-layout.js`, which returns a list of shapes and text positioned in points. `ui/calendar-view.js` draws that list as SVG for the on-screen preview, and `export/calendar-image.js` draws the same list on a canvas for PNG, PDF and print, so the two match.
- UI modules read and change `TSB.store.state`. After a change they call `store.markChanged(...topics)`, and each module re-renders when a topic it subscribes to is emitted. `store.js` lists the topics.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository on the `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs the tests and, if they pass, publishes the site. Pull requests run the tests only.

The site appears at `https://<your-username>.github.io/<repository-name>/`. The workflow is in `.github/workflows/ci.yml`.

## Importing into Google Calendar

1. In Google Calendar, create a new calendar for the term (Settings → Add calendar → Create new calendar). Deleting it later removes every class at once.
2. Go to **Settings → Import & export → Import**.
3. Choose the downloaded `.ics` file, select the new calendar, and click **Import**.

Times are exported in your device's time zone.

## Holiday notes

Automatic holidays cover common national holidays between the first day of classes and the end of finals week. Schools differ, so remove any your school doesn't observe and add breaks such as spring break manually. Canadian provincial holidays vary; Family Day and the Civic Holiday are labeled "most provinces." The Japan list includes substitute holidays (when a holiday falls on a Sunday) and citizens' holidays (a day between two holidays); equinox dates use the National Astronomical Observatory's standard formula. The US list leaves out Columbus Day / Indigenous Peoples' Day because most schools hold classes then.
