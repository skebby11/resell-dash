# Docs assets

This folder holds static assets referenced by the project documentation (mainly screenshots
used in the root [`README.md`](../README.md)).

## Adding the dashboard screenshot

The main README references `docs/screenshot-dashboard.png`, which is **not included** in this
repository yet. To add it:

1. Run the app locally (`npm run dev`) and open the dashboard page (`/`).
2. Take a screenshot of the KPI cards, the monthly sales chart, and the distribution charts
   (a full-page capture at ~1600px width works well).
3. Save it as `screenshot-dashboard.png` in this folder.
4. Commit the image so it renders in the README on GitHub.

Suggested additional screenshots (optional), if you want to expand the documentation:

- `screenshot-articoli.png` — the items/inventory table with filters.
- `screenshot-catalogo.png` — the product catalog.
- `screenshot-inserimento.png` — the new item entry form.

Keep images reasonably sized (PNG, ideally under ~500 KB) to keep the repository lightweight.
