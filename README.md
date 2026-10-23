# Term Schedule Builder

A single-page tool for planning a quarter or semester class schedule and getting it into Google Calendar.

- Add classes with a course code, name, instructor, room and color, plus optional lab, seminar, discussion or studio sections
- Optional final exam for each class
- Three calendar views: **First week** (blocks out days before classes start and holidays), **Regular week**, and **Finals week**
- Common holidays added automatically for the United States, Canada, or the United Kingdom, plus manual holidays
- Export to **iCalendar (.ics)** with weekly repeating events and holidays skipped, or **CSV** in Google Calendar's import format
- Download any view as a **PNG** or a letter-size **PDF**, or print it
- Personalize the calendar's font, text sizes, block details, layout and colors
- **Save schedule** writes a .json file you can **Import** later to keep editing

Nothing is stored on a server or in the browser. Use **Save schedule** to keep your work.

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
  tokens.css            Colors, fonts and sizes (light and dark mode)
  base.css              Element defaults and small utility classes
  layout.css            Header and the two-pane split
  components.css        Buttons, fields, segmented controls, modal, toast
  term.css              Term card and holiday list
  courses.css           Course cards and the course editor
  calendar.css          On-screen weekly calendar
  personalize.css       "Personalize calendar" panel
js/
  core/                 Pure logic, no DOM access (unit tested)
    constants.js        Day names, colors, meeting types, fonts, size presets
    dates.js            Date/time parsing and formatting
    holidays.js         Holiday rules for US, Canada and UK
    color.js            Color math for course colors
    schedule.js         Data model: types, factories, validation, saved-file import
    week-view.js        Builds the data for one calendar view
    event-text.js       Text shown inside calendar blocks
  export/
    ics.js              iCalendar export (unit tested)
    csv.js              Google Calendar CSV export (unit tested)
    pdf.js              One-page image PDF writer (unit tested)
    calendar-image.js   Draws a calendar view on a canvas for PNG/PDF/print
  ui/                   DOM code, one module per part of the page
    dom.js              Lookups, escaping, toast, modal, downloads, printing
    fonts.js            Loads calendar fonts from Google Fonts on demand
    store.js            App state and change notifications
    term-form.js        Term title and dates
    holidays-panel.js   Automatic and manual holidays
    course-list.js      Course cards and the add/edit form
    calendar-view.js    On-screen calendar and view tabs
    personalize-panel.js Font, size, layout and color settings
    toolbar.js          Exports, save/import, image downloads, status
  app.js                Entry point: initializes every UI module
tests/                  Node test runner tests for js/core and js/export
.github/workflows/      Runs tests and deploys to GitHub Pages
```

### How the code fits together

- Every script attaches to one global namespace, `TSB`. Scripts load in the order listed in `index.html`, and each one only uses modules loaded before it.
- `js/core` and `js/export` (except `calendar-image.js`) never touch the DOM, so the tests load them directly in Node.
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

Automatic holidays cover common national holidays between the first day of classes and the end of finals week. Schools differ, so remove any your school doesn't observe and add breaks such as spring break manually. Canadian provincial holidays vary; Family Day and the Civic Holiday are labeled "most provinces." The US list leaves out Columbus Day / Indigenous Peoples' Day because most schools hold classes then.
