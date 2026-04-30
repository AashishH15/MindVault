Store database migrations here as sequential SQL files.

Naming format:
- `0001_description.sql`
- `0002_add_table.sql`
- `0003_add_index.sql`

Rules:
- One-way, append-only migrations.
- Do not rename or edit an already applied migration.
- New migrations must use the next numeric version.